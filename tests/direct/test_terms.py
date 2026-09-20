"""Milestone terms: validation, the reservation taken when a milestone is
proposed (never at settlement), and versions that never rewrite history."""

import json

import pytest

from conftest import (CLIENT, CONTRACTOR, CRITERIA, DEADLINE, GEN, INSPECTOR, REQUIREMENTS, STRANGER,
                      active_milestone, as_, assess, create_project, err, image, judge_all,
                      look_all, milestone, project, set_now, terms)


def add(module, c, pid, **over):
    as_(module, CLIENT)
    return json.loads(c.add_milestone(pid, terms(**over)))["milestone_id"]


def test_proposing_a_milestone_reserves_its_payment_at_once(module, c):
    pid = create_project(module, c, escrow=5 * GEN)
    mid = add(module, c, pid)
    p = project(c, pid)
    assert p["reserved_wei"] == str(2 * GEN) and p["unreserved_wei"] == str(3 * GEN)
    m = milestone(c, mid)
    assert m["state"] == "AWAITING_TERMS" and m["reserved_wei"] == str(2 * GEN)
    assert m["current_version"] == 0 and m["pending_version"] == 1
    v = m["versions"][0]
    assert v["criteria"] == [{"id": f"C{i + 1}", "text": c_["text"]} for i, c_ in enumerate(CRITERIA)]
    assert v["evidence_requirements"] == [dict(REQUIREMENTS[0], id="R1")]
    assert v["deadline"] == DEADLINE and v["accepted_at"] is None
    assert p["milestone_summaries"][0]["title"] == "Foundation completed"


def test_only_the_client_proposes_milestones(module, c):
    pid = create_project(module, c)
    for who in (CONTRACTOR, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="only the client adds milestones"):
            c.add_milestone(pid, terms())


def _crit(n):
    return [{"text": f"criterion {i}"} for i in range(n)]


def _req(**over):
    r = {"text": "Photographs of the slab", "kind": "IMAGE", "from_role": "CONTRACTOR", "min_count": 1}
    r.update(over)
    return r


@pytest.mark.parametrize("over, words", [
    ({"title": ""}, "a milestone needs a title"),
    ({"requirements": "  "}, "contractual requirements in words"),
    ({"specification": "x" * 6001}, "the specification is at most 6000 characters"),
    ({"criteria": []}, "1 to 8 acceptance criteria"),
    ({"criteria": _crit(9)}, "1 to 8 acceptance criteria"),
    ({"criteria": "C1"}, "1 to 8 acceptance criteria"),
    ({"criteria": [{"text": "ok"}, {"text": "  "}]}, "criterion 2 is empty"),
    ({"evidence_requirements": [_req()] * 9}, "at most 8 evidence requirements"),
    ({"evidence_requirements": "R1"}, "at most 8 evidence requirements"),
    ({"evidence_requirements": ["photos"]}, "evidence requirement 1 must be an object"),
    ({"evidence_requirements": [_req(text="")]}, "evidence requirement 1 needs a description"),
    ({"evidence_requirements": [_req(kind="PHOTO")]}, "must ask for an IMAGE or a DOCUMENT"),
    ({"evidence_requirements": [_req(kind="VIDEO")]}, "must ask for an IMAGE or a DOCUMENT"),
    ({"evidence_requirements": [_req(from_role="CLIENT")]}, "from the contractor or the inspector"),
    ({"evidence_requirements": [_req(min_count=0)]}, "must ask for 1 to 4 items"),
    ({"evidence_requirements": [_req(min_count=5)]}, "must ask for 1 to 4 items"),
    ({"evidence_requirements": [_req(min_count="many")]}, "must ask for 1 to 4 items"),
    ({"evidence_requirements": [_req(from_role="INSPECTOR", min_count=4)]}, "must ask for 1 to 3 items"),
    ({"evidence_requirements": [_req(min_count=3), _req(min_count=2)]}, "more items than one assessment reads"),
    ({"evidence_requirements": [_req(kind="DOCUMENT", from_role="INSPECTOR", min_count=2),
                                _req(kind="DOCUMENT", from_role="INSPECTOR", min_count=2)]},
     "more items than one assessment reads"),
    ({"payment_wei": str(10**16 - 1)}, "at least 0.01 GEN"),
    ({"payment_wei": "two"}, "at least 0.01 GEN"),
    ({"deadline": "next week"}, "an ISO date-time in UTC"),
    ({"deadline": "2026-09-20T09:00:00Z"}, "must lie in the future"),
    ({"deadline": "2027-09-21T09:00:00Z"}, "more than 365 days out"),
])
def test_invalid_terms_are_refused_in_words(module, c, over, words):
    pid = create_project(module, c, inspector=INSPECTOR)
    as_(module, CLIENT)
    with pytest.raises(err(module), match=words):
        c.add_milestone(pid, terms(**over))
    assert project(c, pid)["reserved_wei"] == "0"


def test_terms_cannot_require_an_inspector_the_project_never_named(module, c):
    """Nobody could file it, so the milestone could never be assessed and its
    payment could never be released."""
    pid = create_project(module, c)
    as_(module, CLIENT)
    with pytest.raises(err(module), match="asks the inspector, and this project names none"):
        c.add_milestone(pid, terms(evidence_requirements=[
            {"text": "Site inspection report", "kind": "DOCUMENT", "from_role": "INSPECTOR", "min_count": 1}]))
    assert project(c, pid)["reserved_wei"] == "0"
    # The same rule holds for a later version of an existing milestone.
    mid = add(module, c, pid)
    with pytest.raises(err(module), match="asks the inspector, and this project names none"):
        c.propose_version(mid, terms(evidence_requirements=[
            {"text": "Site inspection report", "kind": "DOCUMENT", "from_role": "INSPECTOR", "min_count": 1}]))


def test_terms_must_be_a_json_object(module, c):
    pid = create_project(module, c)
    as_(module, CLIENT)
    with pytest.raises(err(module), match="the terms must be JSON"):
        c.add_milestone(pid, "{broken")
    with pytest.raises(err(module), match="terms must be a JSON object"):
        c.add_milestone(pid, "[]")


def test_terms_are_stored_canonically(module, c):
    pid = create_project(module, c, inspector=INSPECTOR)
    mid = add(module, c, pid, title="  Foundation\n  completed ",
              criteria=["plain string criterion"],
              evidence_requirements=[_req(kind="document", from_role="inspector")],
              deadline="2026-10-20T14:00:00+02:00", specification="Footings 600 x 600 mm.")
    v = milestone(c, mid)["versions"][0]
    assert v["title"] == "Foundation completed"
    assert v["criteria"] == [{"id": "C1", "text": "plain string criterion"}]
    assert v["evidence_requirements"][0]["kind"] == "DOCUMENT"
    assert v["evidence_requirements"][0]["from_role"] == "INSPECTOR"
    assert v["deadline"] == "2026-10-20T12:00:00Z"
    assert v["specification"] == "Footings 600 x 600 mm."


def test_a_payment_the_unreserved_escrow_cannot_cover_is_refused(module, c):
    """Two milestones against a pool that can fund exactly one: the second
    is refused at proposal, not discovered empty at settlement."""
    pid = create_project(module, c, escrow=3 * GEN)
    add(module, c, pid, payment_wei=str(2 * GEN))
    as_(module, CLIENT)
    with pytest.raises(err(module), match="does not cover this payment"):
        c.add_milestone(pid, terms(payment_wei=str(2 * GEN)))
    as_(module, CLIENT, GEN)
    c.fund_project(pid)
    add(module, c, pid, payment_wei=str(2 * GEN))
    p = project(c, pid)
    assert p["reserved_wei"] == p["escrow_wei"] == str(4 * GEN)


def test_a_project_holds_at_most_twelve_milestones(module, c):
    pid = create_project(module, c, escrow=GEN)
    for _ in range(12):
        add(module, c, pid, payment_wei=str(10**16))
    as_(module, CLIENT)
    with pytest.raises(err(module), match="at most 12 milestones"):
        c.add_milestone(pid, terms(payment_wei=str(10**16)))


def test_a_new_version_waits_for_the_contractor_and_the_old_one_stays_in_force(module, c):
    pid, mid = active_milestone(module, c)
    for who in (CONTRACTOR, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="only the client proposes new terms"):
            c.propose_version(mid, terms(title="Foundation v2"))
    as_(module, CLIENT)
    assert json.loads(c.propose_version(mid, terms(title="Foundation v2")))["version"] == 2
    m = milestone(c, mid)
    assert m["current_version"] == 1 and m["pending_version"] == 2
    assert m["versions"][0]["title"] == "Foundation completed"
    assert m["state"] == "AWAITING_EVIDENCE"


def test_only_the_contractor_signs_the_pending_version(module, c):
    pid, mid = active_milestone(module, c)
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation v2"))
    for who in (CLIENT, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="only the named contractor accepts milestone terms"):
            c.accept_version(mid, 2)
    as_(module, CONTRACTOR)
    for wrong in (1, 3):
        with pytest.raises(err(module), match="not the one awaiting acceptance"):
            c.accept_version(mid, wrong)
    c.accept_version(mid, 2)
    m = milestone(c, mid)
    assert m["current_version"] == 2 and m["pending_version"] is None
    with pytest.raises(err(module), match="not the one awaiting acceptance"):
        c.accept_version(mid, 2)


def test_milestone_terms_are_signed_only_in_an_accepted_project(module, c):
    pid = create_project(module, c)
    mid = add(module, c, pid)
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="accept the project first"):
        c.accept_version(mid, 1)


def test_signing_a_version_moves_the_reservation_to_its_payment(module, c):
    pid, mid = active_milestone(module, c, escrow=5 * GEN)
    as_(module, CLIENT)
    c.propose_version(mid, terms(payment_wei=str(3 * GEN)))
    assert project(c, pid)["reserved_wei"] == str(2 * GEN)     # not until signed
    as_(module, CONTRACTOR)
    c.accept_version(mid, 2)
    assert project(c, pid)["reserved_wei"] == str(3 * GEN)
    assert milestone(c, mid)["reserved_wei"] == str(3 * GEN)
    as_(module, CLIENT)
    c.propose_version(mid, terms(payment_wei=str(GEN)))
    as_(module, CONTRACTOR)
    c.accept_version(mid, 3)
    p = project(c, pid)
    assert p["reserved_wei"] == str(GEN) and p["unreserved_wei"] == str(4 * GEN)


def test_a_higher_payment_must_be_covered_when_proposed_and_when_signed(module, c):
    pid, mid = active_milestone(module, c, escrow=3 * GEN)
    as_(module, CLIENT)
    with pytest.raises(err(module), match="does not cover the higher payment"):
        c.propose_version(mid, terms(payment_wei=str(3 * GEN + 1)))
    c.propose_version(mid, terms(payment_wei=str(3 * GEN)))
    c.withdraw_escrow(pid, str(GEN))                  # the client takes the room back
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="the client must fund the project"):
        c.accept_version(mid, 2)
    m = milestone(c, mid)
    assert m["current_version"] == 1 and m["pending_version"] == 2
    assert project(c, pid)["reserved_wei"] == str(2 * GEN)


def test_accepting_a_project_is_atomic_when_a_pending_version_is_uncovered(module, c):
    pid = create_project(module, c, escrow=3 * GEN)
    mid = add(module, c, pid, payment_wei=str(2 * GEN))
    as_(module, CLIENT)
    c.propose_version(mid, terms(payment_wei=str(3 * GEN)))
    c.withdraw_escrow(pid, str(GEN))
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="the client must fund the project"):
        c.accept_project(pid)
    assert project(c, pid)["state"] == "PROPOSED"
    assert milestone(c, mid)["current_version"] == 0


def test_a_milestone_holds_at_most_six_versions(module, c):
    pid, mid = active_milestone(module, c)
    as_(module, CLIENT)
    for i in range(5):
        c.propose_version(mid, terms(title=f"v{i + 2}"))
    with pytest.raises(err(module), match="at most 6 versions"):
        c.propose_version(mid, terms(title="v7"))


def test_a_new_version_starts_evidence_and_assessments_afresh(module, c):
    pid, mid = active_milestone(module, c)
    first = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, first, judge=judge_all("UNCLEAR"))
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation, revised"))
    as_(module, CONTRACTOR)
    c.accept_version(mid, 2)
    m = milestone(c, mid)
    assert m["state"] == "AWAITING_EVIDENCE" and m["standing"] is None
    assert m["version_assessments"] == 0 and m["rounds_count"] == 1
    assert [e["item_id"] for e in m["evidence"]["1"]] == first and m["evidence"]["2"] == []
    with pytest.raises(err(module), match="does not belong to the current terms"):
        assess(module, c, mid, first)
    # the historical round stays tied to the version it judged
    r1 = json.loads(c.get_round(mid, 1))
    assert r1["version"] == 1 and [e["item_id"] for e in r1["evidence"]] == first


@pytest.mark.parametrize("state_maker, words", [
    ("accepted", "cannot replace a standing acceptance"),
    ("finalized", "cannot replace a standing acceptance"),
])
def test_terms_cannot_change_under_a_standing_acceptance(module, c, state_maker, words):
    pid, mid = active_milestone(module, c)
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items)
    if state_maker == "finalized":
        set_now("2026-09-20T10:00:01Z")
        c.finalize(mid)
    as_(module, CLIENT)
    with pytest.raises(err(module), match=words):
        c.propose_version(mid, terms(title="moved goalposts"))


def test_a_pending_version_cannot_be_signed_over_a_standing_acceptance(module, c):
    pid, mid = active_milestone(module, c)
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation v2"))
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items)
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="no longer takes new terms"):
        c.accept_version(mid, 2)


def test_a_rejected_milestone_can_be_renegotiated_and_the_old_decision_lapses(module, c):
    pid, mid = active_milestone(module, c)
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items, judge=judge_all("NOT_MET"))
    assert milestone(c, mid)["state"] == "REJECTED"
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation, reduced scope", payment_wei=str(GEN)))
    as_(module, CONTRACTOR)
    c.accept_version(mid, 2)
    m = milestone(c, mid)
    assert m["state"] == "AWAITING_EVIDENCE" and m["standing"] is None
    with pytest.raises(err(module), match="needs a standing acceptance or rejection"):
        c.open_appeal(mid, "the rejection was wrong")


def test_a_version_whose_deadline_has_passed_is_never_signed_into_force(module, c):
    """Signing it would discard the live terms, their evidence and their
    decision for terms nothing could be filed against."""
    pid, mid = active_milestone(module, c)
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation v2", deadline="2026-10-20T11:00:00Z"))
    set_now("2026-10-20T11:00:01Z")
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="that version's deadline has passed"):
        c.accept_version(mid, 2)
    m = milestone(c, mid)
    assert m["current_version"] == 1 and m["pending_version"] == 2


def test_accepting_a_project_leaves_an_expired_version_unsigned(module, c):
    """One stale milestone cannot block the signature that starts the rest."""
    pid = create_project(module, c, escrow=5 * GEN)
    stale = add(module, c, pid, title="Stale", deadline="2026-10-01T12:00:00Z")
    live = add(module, c, pid, title="Live", deadline="2026-11-01T12:00:00Z")
    set_now("2026-10-01T12:00:01Z")
    as_(module, CONTRACTOR)
    c.accept_project(pid)
    assert milestone(c, stale)["current_version"] == 0
    assert milestone(c, stale)["pending_version"] == 1
    assert milestone(c, live)["current_version"] == 1
