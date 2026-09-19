# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

"""STRUCTURA probe (disposable, never the deployment of record).

Questions it answers on Studio Next before any design is fixed:
  1. does this runner still deploy;
  2. do validators fetch the same photo bytes (sha256 against a committed hash);
  3. which exec_prompt image keyword this runner takes;
  4. do validators running different model families agree on what a
     construction photo shows, one photo at a time and several at once.
Every node prints its own reading to stdout so disagreements carry a cause.
"""

import hashlib
import json

import genlayer as gl

STAGES = ("NO_CONSTRUCTION", "EXCAVATION_ONLY", "REBAR_OR_FORMWORK",
          "FOUNDATION_CONCRETE_POURED", "WORK_ABOVE_FOUNDATION", "UNCLEAR")
DECISIONS = ("MET", "NOT_MET", "UNCLEAR")

STAGE_GUIDE = (
    "Stages, judged only from what is visible:\n"
    "- NO_CONSTRUCTION: the photo does not show a construction site.\n"
    "- EXCAVATION_ONLY: trenches or pits are dug for footings; no steel "
    "reinforcement cages and no concrete in them yet. Columns or posts that "
    "already stand do not change this.\n"
    "- REBAR_OR_FORMWORK: steel reinforcement or formwork is in place for "
    "footings or ground beams, but their concrete is not poured.\n"
    "- FOUNDATION_CONCRETE_POURED: footings or ground beams are cast in "
    "concrete, fresh or cured, with or without formwork.\n"
    "- WORK_ABOVE_FOUNDATION: walls, floors or a roof above the foundation "
    "are the main subject.\n"
    "- UNCLEAR: too dark, blurred, cropped or ambiguous to tell.\n")


def _normalize(body: bytes) -> bytes:
    """GenVM's LLM module accepts only PNG or JFIF-headed JPEG (FF D8 FF E0),
    at most 2 images of 5 MB each. Re-encode whatever was fetched (the hash
    was already checked on the ORIGINAL bytes) as a bounded JFIF JPEG."""
    import io
    import PIL.Image
    im = PIL.Image.open(io.BytesIO(body))
    im = im.convert("RGB")
    im.thumbnail((1024, 1024))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _ask(prompt: str, images: list) -> tuple:
    try:
        normalized = [_normalize(b) for b in images]
    except Exception as e:
        return {"error": "normalize " + type(e).__name__ + ": " + str(e)[:160]}, ""
    try:
        raw = gl.nondet.exec_prompt(prompt, response_format="json", images=normalized)
    except Exception as e:
        return {"error": "exec_prompt " + type(e).__name__ + ": " + str(e)[:160]}, "images"
    out = raw if isinstance(raw, dict) else json.loads(raw)
    return out, "images:" + ",".join(str(len(n)) for n in normalized)


def _fetch(url: str, expected_sha: str) -> tuple:
    resp = gl.nondet.web.get(url)
    body = resp.body or b""
    sha = hashlib.sha256(body).hexdigest()
    return resp.status, body, sha == expected_sha


class StructuraProbe(gl.contract.Contract):
    results: gl.storage.TreeMap[str, str]
    blobs: gl.storage.TreeMap[str, bytes]
    count: str

    def __init__(self):
        self.count = "0"

    @gl.public.write
    def put_blob(self, key: str, data: bytes) -> str:
        """Evidence bytes held by the contract itself: the digest is computed
        here, deterministically, so the record needs no external host."""
        self.blobs[key] = data
        return json.dumps({"key": key, "bytes": len(data),
                           "sha256": hashlib.sha256(data).hexdigest(),
                           "head": data[:4].hex()})

    @gl.public.view
    def blob_info(self, key: str) -> str:
        data = self.blobs.get(key) or b""
        return json.dumps({"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})

    @gl.public.write
    def judge_blobs(self, keys_json: str, criteria_json: str, spec_text: str) -> str:
        """The product's question: up to two stored photos plus a written
        specification, judged criterion by criterion. Validators compare
        every criterion status, so a split names the criterion it split on."""
        keys = json.loads(keys_json)[:2]
        criteria = json.loads(criteria_json)
        photos = [self.blobs[k] for k in keys]
        crit_lines = "\n".join(f"{c['id']}: {c['text']}" for c in criteria)
        prompt = (
            "You are one of several independent reviewers deciding whether "
            "construction evidence establishes contractual criteria.\n"
            f"{len(photos)} photograph(s) are attached, in order. If you cannot "
            "see them, say so with images_received=false and mark every "
            "criterion UNCLEAR.\n"
            "Specification (a contract document, not evidence):\n<<<SPEC\n"
            + spec_text.replace("<<<", "(").replace(">>>", ")") + "\nSPEC>>>\n"
            "Criteria:\n" + crit_lines + "\n"
            "For each criterion answer MET only if the photographs clearly "
            "show it; NOT_MET if they clearly show it is not; UNCLEAR "
            "otherwise. For every photo, name one concrete visible detail.\n"
            "Answer STRICT JSON, reasoning first: {\"reasoning\": \"<3-5 "
            "sentences>\", \"images_received\": true|false, \"photos\": "
            "[{\"index\": 1, \"visible_detail\": \"<short>\"}], \"criteria\": "
            "[{\"id\": \"<id>\", \"status\": \"MET|NOT_MET|UNCLEAR\"}]}")

        def observe() -> dict:
            try:
                raw = gl.nondet.exec_prompt(prompt, response_format="json", images=photos)
                out = raw if isinstance(raw, dict) else json.loads(raw)
            except Exception as e:
                return {"error": type(e).__name__ + ": " + str(e)[:160], "statuses": {}}
            statuses = {}
            for row in out.get("criteria") or []:
                if isinstance(row, dict):
                    s = str(row.get("status", "")).strip().upper()
                    statuses[str(row.get("id"))] = s if s in DECISIONS else "INVALID"
            details = [str(p.get("visible_detail", ""))[:80] for p in (out.get("photos") or [])
                       if isinstance(p, dict)]
            return {"images_received": bool(out.get("images_received")),
                    "statuses": {c["id"]: statuses.get(c["id"], "MISSING") for c in criteria},
                    "details": details, "why": str(out.get("reasoning", ""))[:260]}

        def leader_fn() -> dict:
            mine = observe()
            print("[PROBE] leader " + json.dumps(mine))
            return mine

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                print("[PROBE] leader result is an error")
                return False
            theirs = leader_result.calldata
            mine = observe()
            split = [cid for cid, s in mine["statuses"].items()
                     if (theirs.get("statuses") or {}).get(cid) != s]
            agree = (not split and mine["images_received"]
                     and bool(theirs.get("images_received")))
            print("[PROBE] validator agree=" + str(agree) + " split=" + ",".join(split)
                  + " mine=" + json.dumps(mine))
            return agree

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        return self._store({"kind": "judge_blobs", "keys": keys, **result})

    @gl.public.write
    def look_blob(self, key: str) -> str:
        data = self.blobs[key]
        prompt = (
            "You are inspecting ONE construction-site photograph for a "
            "foundation milestone.\n" + STAGE_GUIDE +
            "Answer STRICT JSON, reasoning first: {\"reasoning\": \"<2-4 "
            "sentences>\", \"stage\": \"<one stage name>\", \"clear_enough\": "
            "true|false}")

        def observe() -> dict:
            try:
                raw = gl.nondet.exec_prompt(prompt, response_format="json", images=[data])
                out = raw if isinstance(raw, dict) else json.loads(raw)
            except Exception as e:
                return {"stage": "ERROR", "error": type(e).__name__ + ": " + str(e)[:160]}
            stage = str(out.get("stage", "")).strip().upper()
            return {"stage": stage if stage in STAGES else "INVALID:" + stage[:30],
                    "clear": bool(out.get("clear_enough")),
                    "why": str(out.get("reasoning", ""))[:240]}

        def leader_fn() -> dict:
            mine = observe()
            print("[PROBE] leader " + json.dumps(mine))
            return mine

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                print("[PROBE] leader result is an error")
                return False
            theirs = leader_result.calldata
            mine = observe()
            agree = mine["stage"] == theirs.get("stage")
            print("[PROBE] validator agree=" + str(agree) + " mine=" + json.dumps(mine)
                  + " leader_stage=" + str(theirs.get("stage")))
            return agree

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        return self._store({"kind": "look_blob", "key": key, **result})

    @gl.public.view
    def get_result(self, key: str) -> str:
        return self.results.get(key) or ""

    @gl.public.view
    def get_count(self) -> str:
        return self.count

    def _store(self, record: dict) -> str:
        n = int(self.count) + 1
        self.count = str(n)
        self.results[str(n)] = json.dumps(record, sort_keys=True)
        return str(n)

    @gl.public.write
    def classify(self, url: str, expected_sha: str) -> str:
        prompt = (
            "You are inspecting ONE construction-site photograph for a "
            "foundation milestone.\n" + STAGE_GUIDE +
            "Answer STRICT JSON, reasoning first: {\"reasoning\": \"<2-4 "
            "sentences>\", \"stage\": \"<one stage name>\", \"clear_enough\": "
            "true|false}")

        def observe() -> dict:
            status, body, sha_ok = _fetch(url, expected_sha)
            if status != 200 or not sha_ok:
                return {"status": status, "bytes": len(body), "sha_ok": False,
                        "stage": "UNAVAILABLE", "spelling": ""}
            out, spelling = _ask(prompt, [body])
            path = "pil"
            first_error = out.get("error")
            if first_error:
                # Fallback: GenVM renders the URL itself and returns a PNG.
                try:
                    shot = gl.nondet.web.render(url, mode="screenshot")
                    raw = gl.nondet.exec_prompt(prompt, response_format="json", images=[shot.raw])
                    out = raw if isinstance(raw, dict) else json.loads(raw)
                    spelling = "screenshot:" + str(len(shot.raw)) + ":" + shot.raw[:4].hex()
                    path = "screenshot"
                except Exception as e:
                    out = {"error": "screenshot " + type(e).__name__ + ": " + str(e)[:160]}
                    path = "none"
            stage = str(out.get("stage", "")).strip().upper()
            return {"status": status, "bytes": len(body), "sha_ok": True,
                    "stage": stage if stage in STAGES else "INVALID:" + stage[:30],
                    "clear": bool(out.get("clear_enough")), "spelling": spelling,
                    "path": path, "pil_error": first_error, "error": out.get("error"),
                    "why": str(out.get("reasoning", ""))[:240]}

        def leader_fn() -> dict:
            mine = observe()
            print("[PROBE] leader " + json.dumps(mine))
            return mine

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                print("[PROBE] leader result is an error")
                return False
            theirs = leader_result.calldata
            mine = observe()
            agree = (mine["sha_ok"] == theirs.get("sha_ok")
                     and mine["stage"] == theirs.get("stage"))
            print("[PROBE] validator agree=" + str(agree) + " mine="
                  + json.dumps(mine) + " leader_stage=" + str(theirs.get("stage")))
            return agree

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        return self._store({"kind": "classify", "url": url, **result})

    @gl.public.write
    def assess(self, items_json: str, criterion: str) -> str:
        items = json.loads(items_json)
        prompt = (
            "You are judging whether construction photographs, taken together, "
            "establish one contractual criterion.\n"
            "Criterion: " + criterion.replace("<", "(").replace(">", ")") + "\n"
            + STAGE_GUIDE +
            "Classify each photo (in the order given), then decide the "
            "criterion: MET only if the photos clearly show it satisfied; "
            "NOT_MET if they clearly show it is not; UNCLEAR otherwise.\n"
            "Answer STRICT JSON, reasoning first: {\"reasoning\": \"<2-5 "
            "sentences>\", \"photos\": [{\"index\": 1, \"stage\": \"<stage>\"}], "
            "\"decision\": \"MET|NOT_MET|UNCLEAR\"}")

        def observe() -> dict:
            bodies = []
            for it in items:
                status, body, sha_ok = _fetch(it["url"], it["sha"])
                if status != 200 or not sha_ok:
                    return {"decision": "UNAVAILABLE", "missing": it["url"][-60:]}
                bodies.append(body)
            out, spelling = _ask(prompt, bodies)
            decision = str(out.get("decision", "")).strip().upper()
            stages = [str(p.get("stage", "")).upper() for p in (out.get("photos") or [])
                      if isinstance(p, dict)]
            return {"decision": decision if decision in DECISIONS else "INVALID:" + decision[:30],
                    "stages": stages, "spelling": spelling,
                    "why": str(out.get("reasoning", ""))[:300]}

        def leader_fn() -> dict:
            mine = observe()
            print("[PROBE] leader " + json.dumps(mine))
            return mine

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                print("[PROBE] leader result is an error")
                return False
            theirs = leader_result.calldata
            mine = observe()
            agree = mine["decision"] == theirs.get("decision")
            print("[PROBE] validator agree=" + str(agree) + " mine="
                  + json.dumps(mine) + " leader_decision=" + str(theirs.get("decision")))
            return agree

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        return self._store({"kind": "assess", "criterion": criterion, **result})
