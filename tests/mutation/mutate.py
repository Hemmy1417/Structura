"""Mutation check: break each safety floor of contracts/structura.py and prove
the direct suite fails, then prove the unbroken contract passes.

Run from the repo root:  python tests/mutation/mutate.py
Exit status 0 only if every mutant is killed and the control passes. The
sweep runs on a temporary copy of contracts/ and tests/, so the repository's
own files are never touched. The official-runner suite is left out: it
confirms the SDK, not the floors. A floor guarded twice is broken in both
places at once (a list of replacements), or one mutant would be equivalent.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
TEXT = (REPO / "contracts" / "structura.py").read_text(encoding="utf-8")

MUTATIONS = [
    # consensus: what validators must agree on
    ("an acceptance stands without the validator's own acceptance",
     '    if leader_decision == "ACCEPTED" and my_decision != "ACCEPTED":', "    if False:"),
    ("a rejection stands on grounds the validator does not reproduce",
     '            if t[cid] == "NOT_MET" and mine[cid] != "NOT_MET":', "            if False:"),
    ("a rejection ignores a conflict the validator sees",
     "        if mine_conflicts:\n            return", "        if False:\n            return"),
    ("a leader withholds an acceptance a validator would grant",
     '    if leader_decision == "UNDETERMINED" and my_decision == "ACCEPTED":', "    if False:"),
    ("a conflict the leader alone reports is recorded",
     "    if theirs_conflicts and not mine_conflicts:", "    if False:"),
    ("a leader that does not rate every criterion stands",
     "    if any(v not in STATUSES for v in t.values()):", "    if False:"),
    ("the record overstates what was decisive",
     '        return [cid for cid, s in statuses.items() if s == "NOT_MET"]', "        return list(statuses)"),
    ("a blind leader is agreed with",
     '            if not theirs.get("images_received"):', "            if False:"),
    ("a blind validator agrees",
     '            if not mine["images_received"]:', "            if False:"),
    ("a failed leader is agreed with",
     "                print(\"[DISAGREE] the leader's round failed\")\n                return False",
     "                print(\"mutant\")\n                return True"),
    ("the boundary accepts a blind consensus result",
     '        if not isinstance(result, dict) or not result.get("images_received"):',
     "        if not isinstance(result, dict):"),
    ("a blind leader is agreed with and the boundary accepts it", [
        ('            if not theirs.get("images_received"):', "            if False:"),
        ('        if not isinstance(result, dict) or not result.get("images_received"):',
         "        if not isinstance(result, dict):")]),
    ("one unprocessable image stops the round",
     "            except Exception as e:\n                print(\"[LOOK] pair failed: \"",
     "            except KeyboardInterrupt as e:\n                print(\"[LOOK] pair failed: \""),
    ("a node that processed no image counts as seeing",
     "return findings, (received and answered > 0) if images else True",
     "return findings, received if images else True"),
    ("fences can be forged",
     '    out = str(text).replace("<<<", "‹‹‹").replace(">>>", "›››")', "    out = str(text)"),
    # derivation: doubt and conflict never pay
    ("conflicts no longer undetermine",
     '    if conflicts:\n        return "UNDETERMINED"', '    if False:\n        return "UNDETERMINED"'),
    ("a failed criterion no longer rejects",
     '    if any(v == "NOT_MET" for v in values):\n        return "REJECTED"',
     '    if False:\n        return "REJECTED"'),
    ("doubt pays",
     '    if not values or any(v != "MET" for v in values):', "    if not values:"),
    ("an appeal outcome is appealable",
     '        appealable = kind == "ASSESSMENT" and outcome["decision"] in ("ACCEPTED", "REJECTED")',
     '        appealable = outcome["decision"] in ("ACCEPTED", "REJECTED")'),
    # money
    ("finalize ignores the window",
     '        if standing.get("appealable") and _now() <= _parse_iso(standing["window_ends"]):',
     "        if False:"),
    ("finalize pays any state",
     '        if m["state"] != "ACCEPTED":\n            _refuse("only a standing acceptance can be finalized")',
     '        if m["state"] == "FINALIZED":\n            _refuse("only a standing acceptance can be finalized")'),
    ("claim does not zero the balance",
     '        row["claimable"] = "0"\n', ""),
    ("a refused creation keeps the value",
     "        except _PayableRefusal as e:\n            if wei > 0:\n                self._credit(sender, wei)",
     "        except _PayableRefusal as e:\n            if wei > 0:\n                pass"),
    ("a refused creation raises and strands the value",
     "        except _PayableRefusal as e:\n            if wei > 0:",
     "        except _PayableRefusal as e:\n            raise gl.vm.UserError(str(e))\n            if wei > 0:"),
    ("a refused funding keeps the value",
     "        if refuse is not None:\n            if wei > 0:\n                self._credit(sender, wei)",
     "        if refuse is not None:\n            if wei > 0:\n                pass"),
    ("a cancelled project takes funding",
     '        elif p["state"] == "CANCELLED":\n            refuse = "the project was cancelled"',
     '        elif False:\n            refuse = "the project was cancelled"'),
    ("milestones over-reserve",
     "        if payment > self._unreserved(p):", "        if False:"),
    ("a milestone reserves nothing",
     '        p["reserved_wei"] = str(int(p["reserved_wei"]) + payment)',
     '        p["reserved_wei"] = str(int(p["reserved_wei"]) + 0)'),
    ("a signed version over-reserves",
     "        if delta > self._unreserved(p):", "        if False:"),
    ("withdrawal ignores reservations",
     "        if amount <= 0 or amount > self._unreserved(p):",
     '        if amount <= 0 or amount > int(p["escrow_wei"]):'),
    ("payments below the minimum",
     "    if payment < MIN_PAYMENT_WEI:", "    if payment < 0:"),
    # evidence
    ("evidence is filed against a standing acceptance",
     '        if state == "ACCEPTED":\n            _refuse(', "        if False:\n            _refuse("),
    ("evidence after the deadline",
     '        elif now > _parse_iso(version["deadline"]):', "        elif False:"),
    ("no evidence quota",
     "        if len(mine) >= QUOTAS[role][bucket]:", "        if False:"),
    ("no cap on the contractor's appeal additions",
     "            if len(added) >= APPEAL_ADDITIONS[bucket]:", "            if False:"),
    ("unreadable image formats accepted",
     "        if not (_is_png(data) or _is_jfif(data)):", "        if False:"),
    ("oversized images accepted",
     "        if len(data) > IMAGE_MAX_BYTES:", "        if False:"),
    ("the inspector files before accepting the role",
     '        if role == "INSPECTOR" and not p.get("inspector_accepted_at"):', "        if False:"),
    # assessment preflight
    ("counterparty evidence left unread",
     '            if it["role"] != "CONTRACTOR" and it["kind"] != "DECLARATION" and e not in eids:',
     "            if False:"),
    ("a counterparty's declaration reaches the panel",
     '            if it["role"] != "CONTRACTOR" and it["kind"] != "DECLARATION" and e not in eids:',
     '            if it["role"] != "CONTRACTOR" and e not in eids:'),
    ("the contractor's declaration reaches the panel",
     '            if it["kind"] == "DECLARATION":\n                _refuse(f"item {e} is a declaration',
     '            if False:\n                _refuse(f"item {e} is a declaration'),
    ("an appeal reads declarations as new evidence",
     '        new_ids = [e for e in self._version_items(mid, v) if e not in recorded and _num(e) > mark\n                   and self._item(e)["kind"] != "DECLARATION"]',
     '        new_ids = [e for e in self._version_items(mid, v) if e not in recorded and _num(e) > mark]'),
    ("coverage never checked",
     "        gap = self._coverage_gap(version, eids)", '        gap = ""'),
    ("the contractor names the client's items",
     '            if it["role"] != "CONTRACTOR":\n                _refuse(f"item {e} is not the contractor\'s',
     '            if False:\n                _refuse(f"item {e} is not the contractor\'s'),
    ("anyone requests an assessment",
     '        if self._sender() != p["contractor"]:\n            _refuse("only the contractor requests an assessment")',
     '        if False:\n            _refuse("only the contractor requests an assessment")'),
    ("no assessment cap",
     '        if int(m["version_assessments"]) >= MAX_ASSESSMENTS_PER_VERSION:', "        if False:"),
    # appeals
    ("anyone appeals",
     "        if sender != p[adverse_role.lower()]:", "        if False:"),
    ("the appeal window never closes",
     '        if now > _parse_iso(standing["window_ends"]):\n            _refuse("the appeal window has closed")',
     '        if False:\n            _refuse("the appeal window has closed")'),
    ("an appeal lapses before its grace period",
     '        if now <= _parse_iso(appeal["evidence_ends"]) + timedelta(seconds=APPEAL_LAPSE_SECONDS):',
     "        if False:"),
    ("an appeal never lapses",
     '        if now <= _parse_iso(appeal["evidence_ends"]) + timedelta(seconds=APPEAL_LAPSE_SECONDS):',
     "        if True:"),
    ("a lapsed appeal restores the appealed decision",
     '        m["state"] = "UNDETERMINED"\n        m["standing"] = {"round": standing["round"], "decision": "UNDETERMINED",',
     '        m["state"] = standing["decision"]\n        m["standing"] = {"round": standing["round"], "decision": standing["decision"],'),
    ("an appeal is decided before its evidence period ends",
     '        if _now() <= _parse_iso(appeal["evidence_ends"]):', "        if False:"),
    ("an appeal ignores new evidence",
     "        new_ids = [e for e in self._version_items(mid, v) if e not in recorded and _num(e) > mark\n",
     "        new_ids = [e for e in self._version_items(mid, v) if False\n"),
    ("an appeal reads items the contractor never named",
     "        new_ids = [e for e in self._version_items(mid, v) if e not in recorded and _num(e) > mark\n",
     "        new_ids = [e for e in self._version_items(mid, v) if e not in recorded\n"),
    ("the decision's item mark is lost",
     '"item_mark": int(self.counters.get("item") or "0")}', '"item_mark": 0}'),
    ("terms change during an appeal",
     '        if m["state"] in ("ACCEPTED", "APPEALED", "FINALIZED", "CLOSED"):\n            _refuse("new terms cannot replace',
     '        if m["state"] in ("ACCEPTED", "FINALIZED", "CLOSED"):\n            _refuse("new terms cannot replace'),
    ("a version is signed during an appeal",
     '        if m["state"] in ("ACCEPTED", "APPEALED", "FINALIZED", "CLOSED"):\n            _refuse("the milestone no longer takes new terms")',
     '        if m["state"] in ("ACCEPTED", "FINALIZED", "CLOSED"):\n            _refuse("the milestone no longer takes new terms")'),
    # closing and cancelling
    ("close ignores the deadline",
     '        if now <= _parse_iso(latest["deadline"]):', "        if False:"),
    ("close ignores a standing window",
     '        if standing and standing.get("window_ends") and now <= _parse_iso(standing["window_ends"]):',
     "        if False:"),
    ("close under an open appeal",
     '        if m["state"] == "APPEALED":\n            _refuse("an open appeal is decided first")',
     '        if False:\n            _refuse("an open appeal is decided first")'),
    ("cancel rewrites settled milestones",
     '            if m["state"] in ("CLOSED", "FINALIZED"):\n                continue',
     "            if False:\n                continue"),
    # parties
    ("the client is their own contractor",
     "        if contractor == sender:", "        if False:"),
    ("a deadline in the past",
     "    if deadline <= now:", "    if False:"),
    ("lookups miss other spellings of an address",
     "        a = _address_or_refuse(addr)", "        a = str(addr)"),

    # terms a party could never satisfy, versions signed too late, and the
    # guards that keep a settled or renegotiated milestone intact
    ("terms require an inspector the project never named",
     '        if role == "INSPECTOR" and not has_inspector:', "        if False:"),
    ("a version is signed after its own deadline",
     '        if _parse_iso(m["versions"][int(version) - 1]["deadline"]) <= now:', "        if False:"),
    ("accepting a project signs an expired version",
     '            if _parse_iso(m["versions"][int(m["pending_version"]) - 1]["deadline"]) <= now:',
     "            if False:"),
    ("a close kills terms the contractor can still sign",
     '        if pending and _parse_iso(m["versions"][int(pending) - 1]["deadline"]) > now:',
     "        if False:"),
    ("a view raises at a reader who mistypes an address",
     "    return self.ledger.get(_address_or_refuse(addr))",
     "    return self.ledger.get(_address(addr))"),
]


def suite_passes(work: pathlib.Path) -> tuple[bool, str]:
    r = subprocess.run([sys.executable, "-m", "pytest", "tests/direct/", "-q", "-x",
                        "--tb=no", "-p", "no:cacheprovider",
                        "--ignore", "tests/direct/test_sdk_runner.py"],
                       cwd=work, capture_output=True, text=True)
    tail = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    return r.returncode == 0, tail[0]


def apply(text: str, edits: list) -> str | None:
    for old, new in edits:
        if text.count(old) != 1:
            return None
        text = text.replace(old, new)
    return text


def main() -> int:
    survivors = []
    with tempfile.TemporaryDirectory(prefix="structura-mutants-") as tmp:
        work = pathlib.Path(tmp)
        shutil.copytree(REPO / "contracts", work / "contracts")
        shutil.copytree(REPO / "tests", work / "tests",
                        ignore=shutil.ignore_patterns("__pycache__", "mutation"))
        shutil.copy(REPO / "pyproject.toml", work / "pyproject.toml")
        target = work / "contracts" / "structura.py"
        for entry in MUTATIONS:
            name = entry[0]
            edits = entry[1] if isinstance(entry[1], list) else [(entry[1], entry[2])]
            mutant = apply(TEXT, edits)
            if mutant is None:
                print(f"SKIPPED  {name}: a target is missing or ambiguous", flush=True)
                survivors.append(name)
                continue
            target.write_text(mutant, encoding="utf-8", newline="\n")
            passed, tail = suite_passes(work)
            print(f"{'SURVIVED' if passed else 'killed  '} {name}  ({tail})", flush=True)
            if passed:
                survivors.append(name)
        target.write_text(TEXT, encoding="utf-8", newline="\n")
        passed, tail = suite_passes(work)
    print(f"control, the contract as written: {'passes' if passed else 'FAILS'} ({tail})")
    print(f"{len(MUTATIONS) - len(survivors)}/{len(MUTATIONS)} mutants killed")
    return 0 if passed and not survivors else 1


if __name__ == "__main__":
    sys.exit(main())
