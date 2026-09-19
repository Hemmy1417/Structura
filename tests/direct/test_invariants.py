"""Invariants under random play: whatever the sequence of actions, whoever
sends them and whenever, the contract

  - conserves value to the wei (everything sent in is held in escrow or
    credited to someone, and every transfer is a claimed credit),
  - never lets a project reserve more than it holds,
  - pays a milestone once, and only after a standing acceptance,
  - never changes a settled milestone, a recorded round or a filed item,
  - keeps every milestone's state and standing consistent,
  - and answers every payable call instead of raising (a raise would
    strand the value on this platform).

Refusals are expected and ignored; any other exception fails the walk.
"""

import json
import random
from datetime import timedelta

import pytest

from conftest import (_NOW, CLIENT, CONTRACTOR, GEN, INSPECTOR, STRANGER, _fresh_instance, _reset,
                      as_, jfif, judge_answer, llm, look_all, project_params, terms, transfers)

PARTIES = (CLIENT, CONTRACTOR, INSPECTOR, STRANGER)
PAYMENTS = (10**16, GEN // 2, GEN, 2 * GEN, 3 * GEN)


class Walk:
    def __init__(self, module, c, seed):
        self.m, self.c, self.rng = module, c, random.Random(seed)
        self.total_in = 0
        self.settled = {}      # milestone id -> its record once FINALIZED or CLOSED
        self.rounds = {}       # "mid|n" -> the record as first seen
        self.items = {}        # item id -> (metadata, bytes or text) as first seen
        self.steps = {}
        self.seen_states = set()

    # ── picking ──────────────────────────────────────────────────────────────

    def projects(self):
        return [json.loads(v) for v in self.c.projects.values()]

    def milestones(self):
        return [json.loads(v) for v in self.c.milestones.values()]

    def pick(self, seq):
        return self.rng.choice(seq) if seq else None

    def pick_ms(self, *states):
        """Mostly a milestone in a state the action is meant for, so the walk
        reaches deep states; sometimes any milestone, so walls are hit too."""
        every = self.milestones()
        fitting = [m for m in every if m["state"] in states]
        if fitting and self.rng.random() < 0.85:
            return self.pick(fitting)
        return self.pick(every)

    def usually(self, who):
        """The right party most of the time, anyone some of the time."""
        return who if who and self.rng.random() < 0.85 else self.pick(PARTIES)

    def party_of(self, pid, role):
        p = json.loads(self.c.projects[pid])
        return p.get(role) or ""

    # ── actions ──────────────────────────────────────────────────────────────

    def create_project(self):
        sender = self.pick(PARTIES)
        others = [a for a in PARTIES if a != sender]
        contractor = self.pick(others)
        inspector = self.pick([a for a in others if a != contractor] + ["", ""])
        params = project_params(contractor=contractor, inspector=inspector,
                                appeal_window_seconds=self.pick((600, 3600, 86400)))
        if self.rng.random() < 0.1:
            params = project_params(contractor=sender)          # refused: own contractor
        value = self.pick((0, GEN, 2 * GEN, 5 * GEN))
        as_(self.m, sender, value)
        json.loads(self.c.create_project(params))              # must never raise
        self.total_in += value

    def fund_project(self):
        p = self.pick(self.projects())
        if not p:
            return
        value = self.pick((0, GEN // 4, GEN))
        as_(self.m, self.usually(p["client"]), value)
        json.loads(self.c.fund_project(p["project_id"]))       # must never raise
        self.total_in += value

    def add_milestone(self):
        p = self.pick(self.projects())
        if not p:
            return
        as_(self.m, self.usually(p["client"]))
        reqs = self.pick(([], [{"text": "Site photographs", "kind": "IMAGE",
                                "from_role": "CONTRACTOR", "min_count": 1}]))
        deadline = _NOW[0] + timedelta(seconds=self.pick((6 * 3600, 2 * 86400, 10 * 86400)))
        self.c.add_milestone(p["project_id"], terms(
            payment_wei=str(self.pick(PAYMENTS)), evidence_requirements=reqs,
            deadline=deadline.strftime("%Y-%m-%dT%H:%M:%SZ")))

    def propose_version(self):
        ms = self.pick_ms("AWAITING_TERMS", "AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED")
        if not ms:
            return
        as_(self.m, self.usually(self.party_of(ms["project_id"], "client")))
        deadline = _NOW[0] + timedelta(seconds=self.pick((6 * 3600, 2 * 86400, 10 * 86400)))
        self.c.propose_version(ms["milestone_id"], terms(
            title="Revised", payment_wei=str(self.pick(PAYMENTS)), evidence_requirements=[],
            deadline=deadline.strftime("%Y-%m-%dT%H:%M:%SZ")))

    def accept_project(self):
        p = self.pick(self.projects())
        if p:
            as_(self.m, self.usually(p["contractor"]))
            self.c.accept_project(p["project_id"])

    def accept_inspector_role(self):
        p = self.pick(self.projects())
        if p:
            as_(self.m, self.usually(p["inspector"]))
            self.c.accept_inspector_role(p["project_id"])

    def accept_version(self):
        ms = self.pick_ms("AWAITING_TERMS", "AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED")
        if ms:
            as_(self.m, self.usually(self.party_of(ms["project_id"], "contractor")))
            self.c.accept_version(ms["milestone_id"], ms["pending_version"] or 1)

    def cancel_project(self):
        p = self.pick(self.projects())
        if p:
            as_(self.m, self.usually(p["client"]))
            self.c.cancel_project(p["project_id"])

    def withdraw_escrow(self):
        p = self.pick(self.projects())
        if p:
            free = int(p["escrow_wei"]) - int(p["reserved_wei"])
            as_(self.m, self.usually(p["client"]))
            self.c.withdraw_escrow(p["project_id"], str(self.pick((1, free, free + 1))))

    def _filer(self, ms):
        role = self.pick(("client", "contractor", "contractor", "inspector"))
        return self.usually(self.party_of(ms["project_id"], role))

    def submit_image(self):
        ms = self.pick_ms("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED", "APPEALED")
        if ms:
            as_(self.m, self._filer(ms))
            meta = {"requirement_id": self.pick(("R1", "")), "caption": "site",
                    "origin": self.pick(("PHOTO", "VIDEO_FRAME", "SCAN"))}
            data = jfif(self.rng.randbytes(8), size=self.pick((3000, 60_000)))
            self.c.submit_image(ms["milestone_id"], json.dumps(meta), data)

    def submit_document(self):
        ms = self.pick_ms("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED", "APPEALED")
        if ms:
            as_(self.m, self._filer(ms))
            self.c.submit_document(ms["milestone_id"], json.dumps({"title": "record"}),
                                   "Pour record " + self.rng.randbytes(4).hex())

    def submit_declaration(self):
        ms = self.pick_ms("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED", "APPEALED")
        if ms:
            as_(self.m, self._filer(ms))
            self.c.submit_declaration(ms["milestone_id"], "It is done.")

    def _answers(self):
        statuses = {f"C{i}": self.pick(("MET", "MET", "NOT_MET", "UNCLEAR")) for i in (1, 2, 3)}
        conflicts = self.rng.random() < 0.1
        judge = judge_answer(statuses, conflicts=conflicts)
        v_judge = judge
        if self.rng.random() < 0.15:                  # a panel that splits records nothing
            v_judge = judge_answer({k: ("UNCLEAR" if v != "UNCLEAR" else "MET")
                                    for k, v in statuses.items()}, conflicts=conflicts)
        llm(look=look_all(n_images=2), judge=judge, v_judge=v_judge)

    def request_assessment(self):
        ms = self.pick_ms("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED")
        if not ms:
            return
        v = int(ms["current_version"] or 1)
        own = json.loads(self.c.version_items.get(f"{ms['milestone_id']}|{v}") or "[]")
        mine = [json.loads(self.c.items[e]) for e in own]
        mine = [it for it in mine if it["role"] == "CONTRACTOR"]
        images = [it["item_id"] for it in mine if it["kind"] == "IMAGE"][:4]
        texts = [it["item_id"] for it in mine if it["kind"] != "IMAGE"][:4]
        named = images + texts
        if self.rng.random() < 0.1:
            named = own                                # may include others' items: refused
        self._answers()
        as_(self.m, self.usually(self.party_of(ms["project_id"], "contractor")))
        self.c.request_assessment(ms["milestone_id"], json.dumps(named))

    def open_appeal(self):
        ms = self.pick_ms("ACCEPTED", "REJECTED")
        if ms:
            role = "client" if ms["state"] == "ACCEPTED" else "contractor"
            as_(self.m, self.usually(self.party_of(ms["project_id"], role)))
            self.c.open_appeal(ms["milestone_id"], self.pick(("Wrong site.", "", "Look again.")))

    def decide_appeal(self):
        ms = self.pick_ms("APPEALED")
        if ms:
            self._answers()
            as_(self.m, self.pick(PARTIES))
            self.c.decide_appeal(ms["milestone_id"])

    def lapse_appeal(self):
        ms = self.pick_ms("APPEALED")
        if ms:
            as_(self.m, self.pick(PARTIES))
            self.c.lapse_appeal(ms["milestone_id"])

    def finalize(self):
        ms = self.pick_ms("ACCEPTED")
        if ms:
            as_(self.m, self.pick(PARTIES))
            self.c.finalize(ms["milestone_id"])

    def close_milestone(self):
        ms = self.pick_ms("AWAITING_TERMS", "AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED")
        if ms:
            as_(self.m, self.pick(PARTIES))
            self.c.close_milestone(ms["milestone_id"])

    def claim(self):
        as_(self.m, self.pick(PARTIES))
        self.c.claim()

    def warp(self):
        _NOW[0] = _NOW[0] + timedelta(seconds=self.pick((60, 600, 1800, 1800, 3 * 3600, 86400, 4 * 86400)))

    ACTIONS = (("create_project", 5), ("fund_project", 4), ("add_milestone", 8),
               ("propose_version", 3), ("accept_project", 5), ("accept_inspector_role", 2),
               ("accept_version", 5), ("cancel_project", 1), ("withdraw_escrow", 3),
               ("submit_image", 12), ("submit_document", 4), ("submit_declaration", 2),
               ("request_assessment", 10), ("open_appeal", 5), ("decide_appeal", 4), ("lapse_appeal", 2),
               ("finalize", 5), ("close_milestone", 5), ("claim", 4), ("warp", 10))

    def step(self):
        names = [n for n, _ in self.ACTIONS]
        weights = [w for _, w in self.ACTIONS]
        name = self.rng.choices(names, weights)[0]
        try:
            getattr(self, name)()
            self.steps[name] = self.steps.get(name, 0) + 1
        except self.m.gl.vm.UserError:
            pass
        self.check()

    # ── invariants ───────────────────────────────────────────────────────────

    def check(self):
        c = self.c
        ledger = [json.loads(v) for v in c.ledger.values()]
        credited = sum(int(r["claimable"]) + int(r["claimed"]) for r in ledger)
        claimed = sum(int(r["claimed"]) for r in ledger)
        projects = self.projects()
        held = sum(int(p["escrow_wei"]) for p in projects)
        assert held + credited == self.total_in, "value was created or destroyed"
        assert sum(t["wei"] for t in transfers()) == claimed, "a transfer without a claim"
        assert all(int(r["claimable"]) >= 0 for r in ledger)

        by_project = {}
        for m in self.milestones():
            by_project.setdefault(m["project_id"], []).append(m)
            mid, state = m["milestone_id"], m["state"]
            self.seen_states.add(state)
            cur = int(m["current_version"])
            terms_now = m["versions"][(cur or 1) - 1]
            if state in ("FINALIZED", "CLOSED"):
                assert m["reserved_wei"] == "0"
                if mid in self.settled:
                    assert self.settled[mid] == m, f"settled milestone {mid} changed"
                self.settled[mid] = m
            else:
                assert m["reserved_wei"] == terms_now["payment_wei"], f"{mid} reservation drifted"
            standing = m["standing"]
            if state in ("ACCEPTED", "REJECTED", "UNDETERMINED"):
                assert standing and standing["decision"] == state and m["appeal"] is None
            if standing and standing["kind"] == "APPEAL_LAPSED":
                assert state in ("UNDETERMINED", "CLOSED"), "a lapsed appeal was paid on"
            if state == "APPEALED":
                assert m["appeal"] and standing["appealed"] is True
                assert standing["decision"] == m["appeal"]["against"]
            if state == "FINALIZED":
                assert standing and standing["decision"] == "ACCEPTED"
            assert int(m["version_assessments"]) <= 5
            for n in range(1, int(m["rounds_count"]) + 1):
                key = f"{mid}|{n}"
                rec = c.rounds[key]
                assert self.rounds.setdefault(key, rec) == rec, f"round {key} changed"
            assert f"{mid}|{int(m['rounds_count']) + 1}" not in c.rounds

        for p in projects:
            ms = by_project.get(p["project_id"], [])
            escrow, reserved = int(p["escrow_wei"]), int(p["reserved_wei"])
            assert int(p["funded_wei"]) == escrow + int(p["paid_wei"]) + int(p["returned_wei"])
            assert 0 <= reserved <= escrow, "a project reserved more than it holds"
            assert reserved == sum(int(m["reserved_wei"]) for m in ms)
            paid = sum(int(m["versions"][int(m["current_version"]) - 1]["payment_wei"])
                       for m in ms if m["state"] == "FINALIZED")
            assert int(p["paid_wei"]) == paid, "a milestone was paid twice or not at all"
            if p["state"] == "CANCELLED":
                assert escrow == reserved == 0

        for eid, meta in c.items.items():
            body = c.item_bytes.get(eid) if eid in c.item_bytes else c.item_text.get(eid)
            assert self.items.setdefault(eid, (meta, body)) == (meta, body), f"item {eid} changed"


def test_random_play_preserves_every_invariant(module):
    reached, states = {}, set()
    for seed in range(1, 9):
        _reset()
        c = _fresh_instance(module)
        walk = Walk(module, c, seed)
        for i in range(800):
            try:
                walk.step()
            except AssertionError as e:
                raise AssertionError(f"seed {seed}, step {i}: {e}") from e
        for action, n in walk.steps.items():
            reached[action] = reached.get(action, 0) + n
        states |= walk.seen_states
    # the walks must reach every state and every settling act, or they prove little
    assert states == set(module.MILESTONE_STATES), states
    for action in ("request_assessment", "open_appeal", "decide_appeal", "lapse_appeal", "finalize",
                   "close_milestone", "claim", "cancel_project", "withdraw_escrow"):
        assert reached.get(action, 0) >= 5, (action, reached)
