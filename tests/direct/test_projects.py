"""Projects and escrow: who the parties are, how value enters and leaves
before any milestone is judged, and that every refusal speaks and returns
the money it was sent."""

import json

import pytest

from conftest import (CLIENT, CONTRACTOR, GEN, INSPECTOR, STRANGER, as_, claimable,
                      create_project, err, project, project_params, terms)


def stats(c):
    return json.loads(c.get_stats())


def test_the_signer_becomes_the_client_and_the_value_the_escrow(module, c):
    pid = create_project(module, c, escrow=5 * GEN, inspector=INSPECTOR)
    p = project(c, pid)
    assert pid == "pr-00001"
    assert (p["client"], p["contractor"], p["inspector"]) == (CLIENT, CONTRACTOR, INSPECTOR)
    assert p["state"] == "PROPOSED" and p["appeal_window_seconds"] == 3600
    assert p["funded_wei"] == p["escrow_wei"] == p["unreserved_wei"] == str(5 * GEN)
    assert p["reserved_wei"] == p["paid_wei"] == p["returned_wei"] == "0"
    assert p["contractor_accepted_at"] is None and p["inspector_accepted_at"] is None
    assert stats(c)["projects"] == 1


def test_party_addresses_are_recorded_checksummed_whatever_their_case(module, c):
    pid = create_project(module, c, contractor=CONTRACTOR.lower(), inspector=INSPECTOR.lower())
    p = project(c, pid)
    assert p["contractor"] == CONTRACTOR and p["inspector"] == INSPECTOR
    found = json.loads(c.projects_of(CONTRACTOR.lower(), 0, 10))
    assert found == {"total": 1, "project_ids": [pid]}


@pytest.mark.parametrize("params, words", [
    ("not json", "the project parameters must be JSON"),
    ("[1, 2]", "the project parameters must be a JSON object"),
    (project_params(title="   "), "a project needs a title"),
    (project_params(contractor="0x1234"), "the contractor must be a wallet address"),
    (project_params(contractor=""), "the contractor must be a wallet address"),
    (project_params(inspector="not an address"), "the inspector must be a wallet address"),
    (project_params(contractor=CLIENT), "the client cannot be their own contractor"),
    (project_params(inspector=CLIENT), "the inspector must be independent"),
    (project_params(inspector=CONTRACTOR), "the inspector must be independent"),
    (project_params(appeal_window_seconds=599), "between 10 minutes and 7 days"),
    (project_params(appeal_window_seconds=7 * 86400 + 1), "between 10 minutes and 7 days"),
    (project_params(appeal_window_seconds="soon"), "between 10 minutes and 7 days"),
])
def test_a_refused_creation_returns_in_words_and_credits_the_value(module, c, params, words):
    as_(module, CLIENT, 3 * GEN)
    out = json.loads(c.create_project(params))
    assert out["refused"] is True
    assert words in out["reason"] and "claimable back" in out["reason"]
    assert claimable(c, CLIENT) == 3 * GEN
    assert stats(c)["projects"] == 0


def test_a_refused_creation_without_value_credits_nothing(module, c):
    as_(module, CLIENT, 0)
    out = json.loads(c.create_project("not json"))
    assert out["refused"] is True
    assert json.loads(c.get_balance(CLIENT)) == {"claimable": "0", "claimed": "0"}


def test_the_window_bounds_are_inclusive(module, c):
    for window in (600, 7 * 86400):
        as_(module, CLIENT, GEN)
        assert json.loads(c.create_project(project_params(appeal_window_seconds=window)))["refused"] is False


def test_only_the_client_funds_and_anyone_elses_value_comes_back(module, c):
    pid = create_project(module, c, escrow=GEN)
    as_(module, CLIENT, 2 * GEN)
    assert json.loads(c.fund_project(pid)) == {"refused": False, "escrow_wei": str(3 * GEN)}
    p = project(c, pid)
    assert p["funded_wei"] == p["escrow_wei"] == str(3 * GEN)

    for who, target, words in ((STRANGER, pid, "only the client funds"),
                               (CONTRACTOR, pid, "only the client funds"),
                               (STRANGER, "pr-99999", "unknown project")):
        as_(module, who, GEN // 10)
        out = json.loads(c.fund_project(target))
        assert out["refused"] is True and words in out["reason"]
        assert claimable(c, who) == GEN // 10
        as_(module, who)
        c.claim()

    as_(module, CLIENT, 0)
    out = json.loads(c.fund_project(pid))
    assert out["refused"] is True and "send the amount" in out["reason"]
    assert project(c, pid)["escrow_wei"] == str(3 * GEN)


def test_the_contractor_accepts_once_and_nobody_else_can(module, c):
    pid = create_project(module, c)
    for who in (CLIENT, STRANGER, INSPECTOR):
        as_(module, who)
        with pytest.raises(err(module), match="only the named contractor accepts this project"):
            c.accept_project(pid)
    as_(module, CONTRACTOR)
    assert json.loads(c.accept_project(pid))["state"] == "ACTIVE"
    assert project(c, pid)["contractor_accepted_at"] == "2026-09-20T09:00:00Z"
    with pytest.raises(err(module), match="not awaiting acceptance"):
        c.accept_project(pid)


def test_accepting_the_project_signs_every_pending_milestone(module, c):
    pid = create_project(module, c)
    as_(module, CLIENT)
    m1 = json.loads(c.add_milestone(pid, terms()))["milestone_id"]
    m2 = json.loads(c.add_milestone(pid, terms(title="Ground floor slab", payment_wei=str(GEN))))["milestone_id"]
    as_(module, CONTRACTOR)
    c.accept_project(pid)
    for mid in (m1, m2):
        m = json.loads(c.get_milestone(mid))
        assert m["state"] == "AWAITING_EVIDENCE"
        assert m["current_version"] == 1 and m["pending_version"] is None
        assert m["versions"][0]["accepted_at"] == "2026-09-20T09:00:00Z"


def test_the_inspector_accepts_the_role_once(module, c):
    pid = create_project(module, c, inspector=INSPECTOR)
    for who in (CLIENT, CONTRACTOR, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="only the named inspector"):
            c.accept_inspector_role(pid)
    as_(module, INSPECTOR)
    c.accept_inspector_role(pid)
    assert project(c, pid)["inspector_accepted_at"] == "2026-09-20T09:00:00Z"
    with pytest.raises(err(module), match="already accepted"):
        c.accept_inspector_role(pid)


def test_a_project_without_an_inspector_has_no_inspector_to_accept(module, c):
    pid = create_project(module, c)
    for who in (INSPECTOR, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="only the named inspector"):
            c.accept_inspector_role(pid)


def test_cancelling_before_acceptance_returns_all_escrow_and_closes_milestones(module, c):
    pid = create_project(module, c, escrow=5 * GEN)
    as_(module, CLIENT)
    mid = json.loads(c.add_milestone(pid, terms()))["milestone_id"]
    for who in (CONTRACTOR, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="only the client cancels"):
            c.cancel_project(pid)
    as_(module, CLIENT)
    assert json.loads(c.cancel_project(pid))["returned_wei"] == str(5 * GEN)
    p = project(c, pid)
    assert p["state"] == "CANCELLED"
    assert p["escrow_wei"] == p["reserved_wei"] == "0" and p["returned_wei"] == str(5 * GEN)
    m = json.loads(c.get_milestone(mid))
    assert m["state"] == "CLOSED" and m["reserved_wei"] == "0" and m["pending_version"] is None
    assert claimable(c, CLIENT) == 5 * GEN

    as_(module, CLIENT, GEN)
    out = json.loads(c.fund_project(pid))
    assert out["refused"] is True and "cancelled" in out["reason"]
    assert claimable(c, CLIENT) == 6 * GEN
    as_(module, CLIENT)
    with pytest.raises(err(module), match="the project was cancelled"):
        c.add_milestone(pid, terms())
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="not awaiting acceptance"):
        c.accept_project(pid)


def test_cancelling_leaves_an_already_closed_milestone_as_it_was(module, c):
    """Found by the invariant walk: a cancellation once rewrote the close
    reason and time of a milestone that had closed at its deadline."""
    pid = create_project(module, c, escrow=5 * GEN)
    as_(module, CLIENT)
    mid = json.loads(c.add_milestone(pid, terms(deadline="2026-09-21T00:00:00Z")))["milestone_id"]
    from conftest import set_now
    set_now("2026-09-21T00:00:01Z")
    as_(module, STRANGER)
    c.close_milestone(mid)
    before = json.loads(c.get_milestone(mid))
    set_now("2026-09-22T00:00:00Z")
    as_(module, CLIENT)
    assert json.loads(c.cancel_project(pid))["returned_wei"] == str(5 * GEN)
    after = json.loads(c.get_milestone(mid))
    assert after["close_reason"] == before["close_reason"] == "not accepted by the deadline"
    assert after["closed_at"] == before["closed_at"] == "2026-09-21T00:00:01Z"


def test_an_accepted_project_cannot_be_cancelled(module, c):
    pid = create_project(module, c)
    as_(module, CONTRACTOR)
    c.accept_project(pid)
    as_(module, CLIENT)
    with pytest.raises(err(module), match="cannot be cancelled"):
        c.cancel_project(pid)


def test_the_client_withdraws_only_unreserved_escrow(module, c):
    pid = create_project(module, c, escrow=5 * GEN)
    as_(module, CLIENT)
    c.add_milestone(pid, terms(payment_wei=str(2 * GEN)))
    for who in (CONTRACTOR, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="only the client withdraws"):
            c.withdraw_escrow(pid, str(GEN))
    as_(module, CLIENT)
    for amount in ("0", "-1", str(3 * GEN + 1)):
        with pytest.raises(err(module), match="exceeds the escrow no milestone has reserved"):
            c.withdraw_escrow(pid, amount)
    with pytest.raises(err(module), match="whole number of wei"):
        c.withdraw_escrow(pid, "1.5")
    c.withdraw_escrow(pid, str(3 * GEN))
    p = project(c, pid)
    assert p["escrow_wei"] == p["reserved_wei"] == str(2 * GEN)
    assert p["returned_wei"] == str(3 * GEN) and p["unreserved_wei"] == "0"
    assert claimable(c, CLIENT) == 3 * GEN


def test_listings_page_newest_first(module, c):
    ids = [create_project(module, c, title=f"Project {i}") for i in range(3)]
    assert json.loads(c.list_projects(0, 2)) == {"total": 3, "project_ids": ids[::-1][:2]}
    assert json.loads(c.list_projects(2, 2)) == {"total": 3, "project_ids": [ids[0]]}
    assert json.loads(c.list_projects(3, 2)) == {"total": 3, "project_ids": []}
    assert json.loads(c.projects_of(CLIENT, 0, 50))["project_ids"] == ids[::-1]
    assert json.loads(c.projects_of(STRANGER, 0, 50)) == {"total": 0, "project_ids": []}


def test_pages_are_capped(module, c):
    for i in range(3):
        create_project(module, c, title=f"Project {i}")
    assert len(json.loads(c.list_projects(0, 10_000))["project_ids"]) == 3
    assert json.loads(c.list_projects(0, -5))["project_ids"] == []


def test_being_named_in_many_projects_never_blocks_an_address(module, c):
    """A stranger naming a contractor in project after project must not use
    up any capacity the contractor needs for real work."""
    for i in range(70):
        as_(module, STRANGER, 0)
        out = json.loads(c.create_project(project_params(title=f"Spam {i}")))
        assert out["refused"] is False
    pid = create_project(module, c, title="Real work")
    listing = json.loads(c.projects_of(CONTRACTOR, 0, 1))
    assert listing == {"total": 71, "project_ids": [pid]}


def test_the_project_history_is_recorded_newest_first(module, c):
    pid = create_project(module, c, escrow=2 * GEN, inspector=INSPECTOR)
    as_(module, CLIENT, GEN)
    c.fund_project(pid)
    as_(module, CONTRACTOR)
    c.accept_project(pid)
    as_(module, INSPECTOR)
    c.accept_inspector_role(pid)
    events = json.loads(c.get_events(pid, 0, 10))
    assert events["total"] == 4
    assert [e["kind"] for e in events["events"]] == [
        "INSPECTOR_ACCEPTED", "PROJECT_ACCEPTED", "ESCROW_FUNDED", "PROJECT_CREATED"]
    assert [e["by"] for e in events["events"]] == [INSPECTOR, CONTRACTOR, CLIENT, CLIENT]
    assert json.loads(c.get_events(pid, 3, 10))["events"][0]["kind"] == "PROJECT_CREATED"


def test_config_surfaces_every_limit(c):
    cfg = json.loads(c.get_config())
    assert cfg["ruleset"] == "structura-rules-1"
    assert cfg["quotas"]["CLIENT"] == {"IMAGE": 3, "TEXT": 3}
    assert cfg["round_capacity"] == {"IMAGE": 12, "TEXT": 12}
    assert cfg["min_payment_wei"] == str(10**16)
    assert cfg["image_max_bytes"] == 400_000


def test_round_capacity_is_the_sum_of_what_an_appeal_can_read(module):
    """The capacity figure is derived, not chosen: named contractor items,
    plus the contractor's appeal additions, plus the client's and the
    inspector's whole quotas."""
    for bucket in ("IMAGE", "TEXT"):
        assert module.ROUND_CAPACITY[bucket] == (
            module.MAX_NAMED[bucket] + module.APPEAL_ADDITIONS[bucket]
            + module.QUOTAS["CLIENT"][bucket] + module.QUOTAS["INSPECTOR"][bucket])


def test_unknown_ids_speak(module, c):
    with pytest.raises(err(module), match="unknown project"):
        c.get_project("pr-00042")
    with pytest.raises(err(module), match="unknown milestone"):
        c.get_milestone("ms-00042")
    with pytest.raises(err(module), match="no round with that number"):
        c.get_round("ms-00042", 1)
    with pytest.raises(err(module), match="unknown evidence item"):
        c.get_item("ev-000042")
    with pytest.raises(err(module), match="no image with that id"):
        c.get_image("ev-000042")
