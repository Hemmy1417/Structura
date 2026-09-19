"""STRUCTURA on the OFFICIAL direct-mode runner (genlayer-test's `direct_vm`):
the real GenLayer SDK pinned by the contract's Depends header, not a stub.

The stub harness in conftest.py stays the stricter instrument: it runs
every validator on every call, answers leader and validator differently,
and enforces GenVM's image rules. This suite proves the same mechanism on
the real SDK: bytes calldata into TreeMap[str, bytes] storage, payable
value, the transaction clock, `exec_prompt` with images, the `run_nondet`
validator (replayed with `run_validator`), the appeal path and the claim.

Run: pytest tests/direct/test_sdk_runner.py -v
"""

import copy
import hashlib
import json

import pytest

GEN = 10**18
START = "2026-09-20T09:00:00Z"
AFTER_WINDOW = "2026-09-20T10:00:01Z"
APPEAL_OPENED = "2026-09-20T09:30:00Z"
AFTER_EVIDENCE = "2026-09-20T10:30:01Z"

LOOK = r"(?s)image\(s\) are attached"
JUDGE = r"(?s)^You decide whether recorded construction evidence"


def hexaddr(addr):
    """The account as the contract records it: EIP-55, what str(sender) gives."""
    from genlayer.types import Address
    return Address(addr).as_hex


def jfif(tag=b"", size=4000):
    body = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + tag
    return body + b"\x00" * (size - len(body))


def _encode(answer):
    """Double-encoded: the direct runner's LLM boundary is raw text."""
    return json.dumps(json.dumps(answer))


def panel(vm, c1="MET", c2="MET", conflicts=False, received=True):
    vm.clear_mocks()
    vm.mock_llm(LOOK, _encode({
        "reasoning": "Two photographs of cast ground beams.", "images_received": received,
        "images": [{"index": i, "visible_detail": "grey beam meeting a column",
                    "criteria": {"C1": "SUPPORTS", "C2": "SUPPORTS"}, "concerns": []}
                   for i in (1, 2)]}))
    vm.mock_llm(JUDGE, _encode({
        "reasoning": "Both photographs show the beams cast.",
        "criteria": [{"id": "C1", "status": c1, "basis": ["ev-000001"]},
                     {"id": "C2", "status": c2, "basis": ["ev-000002"]}],
        "conflicts_detected": conflicts, "conflict_note": ""}))


@pytest.fixture
def milestone(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A funded, accepted foundation milestone with two photographs filed."""
    direct_vm.warp(START)
    c = direct_deploy("contracts/structura.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 5 * GEN
    out = json.loads(c.create_project(json.dumps({
        "title": "Residential building", "contractor": hexaddr(direct_bob),
        "appeal_window_seconds": 3600})))
    direct_vm.value = 0
    assert out["refused"] is False
    pid = out["project_id"]
    mid = json.loads(c.add_milestone(pid, json.dumps({
        "title": "Foundation completed", "requirements": "Footings and ground beams cast.",
        "criteria": [{"text": "The ground beams are cast in concrete."},
                     {"text": "The photographs show one site."}],
        "evidence_requirements": [{"text": "Photographs of the beams", "kind": "IMAGE",
                                   "from_role": "CONTRACTOR", "min_count": 2}],
        "payment_wei": str(2 * GEN), "deadline": "2026-10-20T12:00:00Z"})))["milestone_id"]
    direct_vm.sender = direct_bob
    c.accept_project(pid)
    items = []
    for i in range(2):
        meta = json.dumps({"requirement_id": "R1", "caption": f"beam {i}", "origin": "PHOTO"})
        items.append(json.loads(c.submit_image(mid, meta, jfif(bytes([i]), 150_000)))["item_id"])
    return c, pid, mid, items


def claimable(c, addr):
    return int(json.loads(c.get_balance(hexaddr(addr)))["claimable"])


def test_the_pinned_runner_is_the_real_sdk(direct_vm, direct_deploy):
    c = direct_deploy("contracts/structura.py")
    assert json.loads(c.get_config())["ruleset"] == "structura-rules-1"
    import genlayer
    assert hasattr(genlayer, "vm") and hasattr(genlayer.vm, "run_nondet")


def test_image_bytes_survive_calldata_and_storage(direct_vm, milestone):
    c, pid, mid, items = milestone
    stored = bytes(c.get_image(items[0]))
    assert stored == jfif(bytes([0]), 150_000)
    assert json.loads(c.get_item(items[0]))["sha256"] == hashlib.sha256(stored).hexdigest()


def test_an_assessment_validators_agree_then_settle_and_claim(direct_vm, milestone, direct_bob):
    c, pid, mid, items = milestone
    panel(direct_vm)
    out = json.loads(c.request_assessment(mid, json.dumps(items)))
    assert out["decision"] == "ACCEPTED"
    assert direct_vm.run_validator() is True

    with direct_vm.expect_revert("the appeal window is still open"):
        c.finalize(mid)
    direct_vm.warp(AFTER_WINDOW)
    c.finalize(mid)
    assert claimable(c, direct_bob) == 2 * GEN
    direct_vm.sender = direct_bob
    assert json.loads(c.claim()) == {"claimed_wei": str(2 * GEN)}
    assert claimable(c, direct_bob) == 0
    with direct_vm.expect_revert("nothing claimable"):
        c.claim()


@pytest.mark.parametrize("swap", [{"c1": "NOT_MET"}, {"c2": "UNCLEAR"}, {"conflicts": True},
                                  {"received": False}],
                         ids=["c1-split", "c2-split", "conflict-split", "blind-validator"])
def test_a_validator_that_reads_the_evidence_differently_refuses(direct_vm, milestone, swap):
    c, pid, mid, items = milestone
    panel(direct_vm)
    c.request_assessment(mid, json.dumps(items))
    panel(direct_vm, **swap)
    assert direct_vm.run_validator() is False


def test_a_forged_leader_result_is_refused(direct_vm, milestone):
    c, pid, mid, items = milestone
    panel(direct_vm, c1="NOT_MET")
    assert json.loads(c.request_assessment(mid, json.dumps(items)))["decision"] == "REJECTED"
    stored = direct_vm._captured_validators[-1][0]
    forged = copy.deepcopy(stored)
    forged["statuses"]["C1"] = "MET"                  # a reading nobody made
    assert direct_vm.run_validator(leader_result=forged) is False
    assert direct_vm.run_validator(leader_result=stored) is True
    assert direct_vm.run_validator(leader_error=Exception("leader crashed")) is False


def test_the_appeal_path_on_the_real_sdk(direct_vm, milestone, direct_alice, direct_bob):
    c, pid, mid, items = milestone
    panel(direct_vm)
    c.request_assessment(mid, json.dumps(items))
    direct_vm.warp(APPEAL_OPENED)
    direct_vm.sender = direct_alice
    assert json.loads(c.open_appeal(mid, "Beam 1 is on another site."))["state"] == "APPEALED"
    meta = json.dumps({"caption": "the plot today", "origin": "PHOTO"})
    objection = json.loads(c.submit_image(mid, meta, jfif(b"client", 90_000)))["item_id"]
    with direct_vm.expect_revert("evidence period is still open"):
        c.decide_appeal(mid)
    direct_vm.warp(AFTER_EVIDENCE)
    panel(direct_vm, c2="NOT_MET")
    out = json.loads(c.decide_appeal(mid))
    assert out == {"round": 2, "decision": "REJECTED", "reviewed_round": 1, "new_items": [objection]}
    assert direct_vm.run_validator() is True
    r = json.loads(c.get_round(mid, 2))
    assert [row["new"] for row in r["evidence"]] == [False, False, True]
    with direct_vm.expect_revert("only a standing acceptance can be finalized"):
        c.finalize(mid)
    assert claimable(c, direct_bob) == 0


def test_a_refused_payable_returns_and_credits_the_value(direct_vm, milestone, direct_charlie):
    c, pid, mid, items = milestone
    direct_vm.sender = direct_charlie
    direct_vm.value = GEN // 50
    out = json.loads(c.fund_project(pid))
    direct_vm.value = 0
    assert out["refused"] is True
    assert claimable(c, direct_charlie) == GEN // 50


def test_parties_are_found_by_any_spelling_of_their_address(direct_vm, milestone, direct_bob):
    c, pid, mid, items = milestone
    for spelling in (hexaddr(direct_bob), hexaddr(direct_bob).lower()):
        assert json.loads(c.projects_of(spelling, 0, 10))["project_ids"] == [pid]
