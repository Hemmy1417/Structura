"""Settlement: only a finalized acceptance pays, a milestone never accepted
returns its reservation, value leaves only through claim, and nothing acts
on a settled milestone."""

import json

import pytest

from conftest import (CLIENT, CONTRACTOR, GEN, INSPECTOR, STRANGER, active_milestone, as_, assess,
                      claimable, err, image, judge_all, llm, look_all, milestone, project,
                      set_now, terms, transfers)

AFTER_WINDOW = "2026-09-20T10:00:01Z"
AFTER_DEADLINE = "2026-10-20T12:00:01Z"


def accepted(module, c, **kw):
    pid, mid = active_milestone(module, c, **kw)
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items)
    return pid, mid, items


def test_an_acceptance_pays_once_its_window_has_passed(module, c):
    pid, mid, items = accepted(module, c)
    set_now("2026-09-20T10:00:00Z")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="the appeal window is still open"):
        c.finalize(mid)
    set_now(AFTER_WINDOW)
    assert json.loads(c.finalize(mid)) == {"milestone_id": mid, "state": "FINALIZED",
                                           "paid_wei": str(2 * GEN)}
    m = milestone(c, mid)
    assert m["state"] == "FINALIZED" and m["reserved_wei"] == "0"
    assert m["finalized_at"] == AFTER_WINDOW
    p = project(c, pid)
    assert p["escrow_wei"] == str(3 * GEN) and p["reserved_wei"] == "0"
    assert p["paid_wei"] == str(2 * GEN) and p["unreserved_wei"] == str(3 * GEN)
    assert claimable(c, CONTRACTOR) == 2 * GEN and claimable(c, CLIENT) == 0
    s = json.loads(c.get_stats())
    assert s["finalized"] == 1 and s["paid_wei"] == str(2 * GEN)
    assert transfers() == []                         # crediting is not paying


@pytest.mark.parametrize("state", ["AWAITING_TERMS", "AWAITING_EVIDENCE", "REJECTED",
                                   "UNDETERMINED", "FINALIZED", "CLOSED"])
def test_nothing_but_a_standing_acceptance_is_finalized(module, c, state):
    pid, mid = active_milestone(module, c)
    if state == "AWAITING_TERMS":
        as_(module, CLIENT)
        mid = json.loads(c.add_milestone(pid, terms(title="Slab", payment_wei=str(GEN))))["milestone_id"]
    elif state in ("REJECTED", "UNDETERMINED"):
        items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
        assess(module, c, mid, items, judge=judge_all("NOT_MET" if state == "REJECTED" else "UNCLEAR"))
    elif state == "FINALIZED":
        items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
        assess(module, c, mid, items)
        set_now(AFTER_WINDOW)
        c.finalize(mid)
    elif state == "CLOSED":
        set_now(AFTER_DEADLINE)
        c.close_milestone(mid)
    set_now(AFTER_DEADLINE)
    assert milestone(c, mid)["state"] == state
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a standing acceptance can be finalized"):
        c.finalize(mid)
    assert claimable(c, CONTRACTOR) == (2 * GEN if state == "FINALIZED" else 0)


def test_the_contractor_claims_exactly_what_was_credited(module, c):
    pid, mid, items = accepted(module, c)
    set_now(AFTER_WINDOW)
    c.finalize(mid)
    for who in (CLIENT, STRANGER, INSPECTOR):
        as_(module, who)
        with pytest.raises(err(module), match="nothing claimable for this wallet"):
            c.claim()
    as_(module, CONTRACTOR)
    assert json.loads(c.claim()) == {"claimed_wei": str(2 * GEN)}
    assert transfers() == [{"to": CONTRACTOR, "wei": 2 * GEN}]
    assert json.loads(c.get_balance(CONTRACTOR)) == {"claimable": "0", "claimed": str(2 * GEN)}
    with pytest.raises(err(module), match="nothing claimable for this wallet"):
        c.claim()
    assert len(transfers()) == 1


def test_a_balance_is_read_by_any_spelling_of_the_address(module, c):
    pid, mid, items = accepted(module, c)
    set_now(AFTER_WINDOW)
    c.finalize(mid)
    assert json.loads(c.get_balance(CONTRACTOR.lower()))["claimable"] == str(2 * GEN)


def test_a_milestone_never_accepted_closes_after_its_deadline(module, c):
    pid, mid = active_milestone(module, c)
    set_now("2026-10-20T12:00:00Z")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="the deadline has not passed"):
        c.close_milestone(mid)
    set_now(AFTER_DEADLINE)
    assert json.loads(c.close_milestone(mid)) == {"milestone_id": mid, "state": "CLOSED",
                                                  "released_wei": str(2 * GEN)}
    m = milestone(c, mid)
    assert m["state"] == "CLOSED" and m["close_reason"] == "not accepted by the deadline"
    p = project(c, pid)
    assert p["reserved_wei"] == "0" and p["unreserved_wei"] == str(5 * GEN)
    as_(module, CLIENT)
    c.withdraw_escrow(pid, str(5 * GEN))
    c.claim()
    assert transfers() == [{"to": CLIENT, "wei": 5 * GEN}]


def test_terms_the_contractor_never_signed_close_after_their_deadline(module, c):
    pid, mid = active_milestone(module, c)
    as_(module, CLIENT)
    unsigned = json.loads(c.add_milestone(pid, terms(title="Slab", payment_wei=str(GEN),
                                                     deadline="2026-09-25T00:00:00Z")))["milestone_id"]
    set_now("2026-09-25T00:00:01Z")
    as_(module, STRANGER)
    assert json.loads(c.close_milestone(unsigned))["released_wei"] == str(GEN)


def test_a_rejection_open_to_appeal_holds_the_milestone_past_its_deadline(module, c):
    pid, mid = active_milestone(module, c, deadline="2026-09-20T09:30:00Z")
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items, judge=judge_all("NOT_MET"))
    set_now("2026-09-20T09:45:00Z")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="a decision's appeal window is still open"):
        c.close_milestone(mid)
    set_now(AFTER_WINDOW)
    assert json.loads(c.close_milestone(mid))["state"] == "CLOSED"


def test_an_undetermined_milestone_closes_at_its_deadline(module, c):
    pid, mid = active_milestone(module, c, deadline="2026-09-20T09:30:00Z")
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items, judge=judge_all("UNCLEAR"))
    set_now("2026-09-20T09:30:01Z")
    as_(module, STRANGER)
    assert json.loads(c.close_milestone(mid))["state"] == "CLOSED"


def test_a_standing_acceptance_is_finalized_not_closed(module, c):
    pid, mid, items = accepted(module, c)
    set_now(AFTER_DEADLINE)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="a standing acceptance is finalized, not closed"):
        c.close_milestone(mid)
    c.finalize(mid)
    with pytest.raises(err(module), match="already settled"):
        c.close_milestone(mid)


def test_nothing_acts_on_a_finalized_milestone(module, c):
    pid, mid, items = accepted(module, c)
    set_now(AFTER_WINDOW)
    c.finalize(mid)
    before = c.get_milestone(mid)
    as_(module, CLIENT)
    with pytest.raises(err(module), match="standing acceptance or rejection"):
        c.open_appeal(mid, "too late to complain")
    with pytest.raises(err(module), match="settled milestone"):
        c.propose_version(mid, terms(title="after the fact"))
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="not available while the milestone is finalized"):
        c.request_assessment(mid, json.dumps(items))
    with pytest.raises(err(module), match="the milestone is settled"):
        image(module, c, mid, caption="more")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a standing acceptance can be finalized"):
        c.finalize(mid)
    assert json.loads(before)["state"] == "FINALIZED"
    after = json.loads(c.get_milestone(mid))
    assert {k: v for k, v in after.items() if k != "now"} == {
        k: v for k, v in json.loads(before).items() if k != "now"}


def test_nothing_acts_on_a_closed_milestone(module, c):
    pid, mid = active_milestone(module, c)
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation v2", deadline="2026-10-20T11:00:00Z"))
    set_now(AFTER_DEADLINE)
    as_(module, STRANGER)
    c.close_milestone(mid)
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="not the one awaiting acceptance"):
        c.accept_version(mid, 2)
    with pytest.raises(err(module), match="not available while the milestone is closed"):
        c.request_assessment(mid, "[]")
    as_(module, CLIENT)
    with pytest.raises(err(module), match="settled milestone"):
        c.propose_version(mid, terms(title="v3", deadline="2026-11-20T12:00:00Z"))
    as_(module, STRANGER)
    with pytest.raises(err(module), match="already settled"):
        c.close_milestone(mid)
    with pytest.raises(err(module), match="only a standing acceptance can be finalized"):
        c.finalize(mid)
    assert project(c, pid)["reserved_wei"] == "0"


def test_finalize_and_close_cannot_both_happen(module, c):
    pid, mid, items = accepted(module, c)
    set_now(AFTER_DEADLINE)
    as_(module, STRANGER)
    c.finalize(mid)
    with pytest.raises(err(module), match="already settled"):
        c.close_milestone(mid)
    assert project(c, pid)["paid_wei"] == str(2 * GEN)


def test_two_milestones_settle_independently_from_one_escrow(module, c):
    pid, m1 = active_milestone(module, c, escrow=5 * GEN)
    as_(module, CLIENT)
    m2 = json.loads(c.add_milestone(pid, terms(title="Slab", payment_wei=str(3 * GEN))))["milestone_id"]
    as_(module, CONTRACTOR)
    c.accept_version(m2, 1)
    items = [image(module, c, m1, caption=f"beam {i}") for i in range(2)]
    assess(module, c, m1, items)
    set_now(AFTER_WINDOW)
    c.finalize(m1)
    set_now(AFTER_DEADLINE)
    c.close_milestone(m2)
    p = project(c, pid)
    assert p["paid_wei"] == str(2 * GEN) and p["escrow_wei"] == str(3 * GEN)
    assert p["reserved_wei"] == "0" and p["unreserved_wei"] == str(3 * GEN)
    assert int(p["funded_wei"]) == int(p["escrow_wei"]) + int(p["paid_wei"]) + int(p["returned_wei"])


def test_a_refused_fund_is_claimable_and_a_claim_moves_it(module, c):
    pid, mid = active_milestone(module, c)
    as_(module, STRANGER, GEN)
    assert json.loads(c.fund_project(pid))["refused"] is True
    as_(module, STRANGER)
    c.claim()
    assert transfers() == [{"to": STRANGER, "wei": GEN}]


def test_an_appeal_outcome_acceptance_skips_the_window(module, c):
    pid, mid, items = accepted(module, c)
    set_now("2026-09-20T09:30:00Z")
    as_(module, CLIENT)
    c.open_appeal(mid, "different site")
    set_now("2026-09-20T10:30:01Z")
    llm(look=look_all(), judge=judge_all("MET"))
    as_(module, STRANGER)
    c.decide_appeal(mid)
    assert json.loads(c.finalize(mid))["state"] == "FINALIZED"


def test_close_waits_for_terms_the_contractor_can_still_sign(module, c):
    """A permissionless close must not kill a renegotiation: while new terms
    await signature and their own deadline stands, the milestone lives."""
    pid, mid = active_milestone(module, c)
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation v2", deadline="2026-11-01T12:00:00Z"))
    set_now(AFTER_DEADLINE)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="new terms await the contractor's signature"):
        c.close_milestone(mid)
    as_(module, CONTRACTOR)
    c.accept_version(mid, 2)
    assert milestone(c, mid)["current_version"] == 2
    # Once that version's own deadline passes, anyone can close it.
    set_now("2026-11-01T12:00:01Z")
    as_(module, STRANGER)
    c.close_milestone(mid)
    assert milestone(c, mid)["state"] == "CLOSED"
    assert project(c, pid)["reserved_wei"] == "0"
