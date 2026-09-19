"""Evidence intake: who may file what, when, in which format, and that the
record keeps the exact bytes it hashed. Claimed metadata is stored as a
claim; the digest is the contract's own."""

import hashlib
import json

import pytest

from conftest import (CLIENT, CONTRACTOR, INSPECTOR, STRANGER, active_milestone, as_, assess,
                      create_project, declaration, document, err, exif_jpeg, image, jfif,
                      judge_all, milestone, png, set_now, terms)


def test_an_image_is_stored_with_the_contracts_own_digest(module, c):
    pid, mid = active_milestone(module, c)
    data = jfif(b"north beam", size=150_000)
    as_(module, CONTRACTOR)
    out = json.loads(c.submit_image(mid, json.dumps({
        "requirement_id": "R1", "caption": "North ground beam, poured", "origin": "PHOTO",
        "claimed_capture": "2011-02-18T10:04:00", "claimed_location": "12.24 N, 102.51 E"}), data))
    assert out == {"item_id": "ev-000001", "sha256": hashlib.sha256(data).hexdigest()}
    item = json.loads(c.get_item("ev-000001"))
    assert item["kind"] == "IMAGE" and item["origin"] == "PHOTO" and item["format"] == "JPEG"
    assert item["bytes"] == 150_000 and item["sha256"] == out["sha256"]
    assert (item["role"], item["submitter"]) == ("CONTRACTOR", CONTRACTOR)
    assert (item["milestone_id"], item["project_id"], item["version"]) == (mid, pid, 1)
    assert item["requirement_id"] == "R1" and item["submitted_at"] == "2026-09-20T09:00:00Z"
    assert item["claimed_capture"] == "2011-02-18T10:04:00"
    assert item["claimed_location"] == "12.24 N, 102.51 E"
    assert "text" not in item
    assert bytes(c.get_image("ev-000001")) == data
    assert milestone(c, mid)["evidence"]["1"][0]["item_id"] == "ev-000001"


def test_a_png_is_accepted_and_labelled(module, c):
    pid, mid = active_milestone(module, c)
    eid = image(module, c, mid, data=png(b"drawing"))
    assert json.loads(c.get_item(eid))["format"] == "PNG"


@pytest.mark.parametrize("data, words", [
    (b"", "the image is empty"),
    (exif_jpeg(), "a PNG or a JFIF JPEG"),
    (b"\xff\xd8\xff\xdb" + b"\x00" * 2000, "a PNG or a JFIF JPEG"),
    (b"GIF89a" + b"\x00" * 2000, "a PNG or a JFIF JPEG"),
    (jfif(size=400_001), "at most 400000 bytes"),
], ids=["empty", "exif-jpeg", "stripped-jpeg", "gif", "oversize"])
def test_images_the_runtime_cannot_read_are_refused_at_the_door(module, c, data, words):
    pid, mid = active_milestone(module, c)
    with pytest.raises(err(module), match=words):
        image(module, c, mid, data=data)
    assert milestone(c, mid)["evidence"]["1"] == []


def test_the_size_limit_is_inclusive(module, c):
    pid, mid = active_milestone(module, c)
    eid = image(module, c, mid, data=jfif(size=400_000))
    assert json.loads(c.get_item(eid))["bytes"] == 400_000


def test_evidence_details_must_be_a_json_object(module, c):
    pid, mid = active_milestone(module, c)
    as_(module, CONTRACTOR)
    with pytest.raises(err(module), match="evidence details must be JSON"):
        c.submit_image(mid, "{nope", jfif())
    with pytest.raises(err(module), match="must be a JSON object"):
        c.submit_document(mid, "[]", "text")
    with pytest.raises(err(module), match="PHOTO, a VIDEO_FRAME or a SCAN"):
        c.submit_image(mid, json.dumps({"origin": "DRONE"}), jfif())


def test_claims_are_cleaned_and_bounded(module, c):
    pid, mid = active_milestone(module, c)
    eid = image(module, c, mid, caption="  line one\n\tline two  " + "x" * 400,
                claimed_location="y" * 400, claimed_capture="z" * 100)
    item = json.loads(c.get_item(eid))
    assert item["caption"].startswith("line one line two") and len(item["caption"]) == 200
    assert len(item["claimed_location"]) == 200 and len(item["claimed_capture"]) == 40


def test_video_frames_and_scans_are_images_with_their_origin_recorded(module, c):
    pid, mid = active_milestone(module, c, evidence_requirements=[
        {"text": "Site photographs", "kind": "IMAGE", "from_role": "CONTRACTOR", "min_count": 1},
        {"text": "Delivery note for the concrete", "kind": "DOCUMENT", "from_role": "CONTRACTOR",
         "min_count": 1}])
    frame = image(module, c, mid, req="R1", origin="VIDEO_FRAME", origin_ref="site-walk.mp4 at 00:12")
    scan = image(module, c, mid, req="R2", origin="SCAN", caption="Delivery note, page 1")
    assert json.loads(c.get_item(frame))["origin_ref"] == "site-walk.mp4 at 00:12"
    assert json.loads(c.get_item(scan))["origin"] == "SCAN"
    with pytest.raises(err(module), match="requirement R1 asks for an image from the contractor"):
        image(module, c, mid, req="R1", origin="SCAN")
    with pytest.raises(err(module), match="requirement R2 asks for a document from the contractor"):
        image(module, c, mid, req="R2", origin="PHOTO")


def test_a_requirement_must_exist_and_be_answered_by_its_party(module, c):
    pid, mid = active_milestone(module, c, inspector=INSPECTOR, evidence_requirements=[
        {"text": "Site photographs", "kind": "IMAGE", "from_role": "CONTRACTOR", "min_count": 1},
        {"text": "Inspection report", "kind": "DOCUMENT", "from_role": "INSPECTOR", "min_count": 1}])
    with pytest.raises(err(module), match="no evidence requirement with that id"):
        image(module, c, mid, req="R9")
    with pytest.raises(err(module), match="requirement R2 asks for a document from the inspector"):
        document(module, c, mid, who=CONTRACTOR, req="R2")
    with pytest.raises(err(module), match="requirement R1 asks for an image from the contractor"):
        image(module, c, mid, who=CLIENT, req="R1")
    eid = document(module, c, mid, who=INSPECTOR, req="R2")
    assert json.loads(c.get_item(eid))["role"] == "INSPECTOR"
    # an item may also be filed for no particular requirement
    assert json.loads(c.get_item(image(module, c, mid, who=CLIENT, req="")))["requirement_id"] == ""


def test_only_the_three_parties_file_and_the_inspector_only_after_accepting(module, c):
    pid, mid = active_milestone(module, c)
    with pytest.raises(err(module), match="only the client, the contractor or the named inspector"):
        image(module, c, mid, who=STRANGER, req="")
    with pytest.raises(err(module), match="only the client, the contractor or the named inspector"):
        image(module, c, mid, who=INSPECTOR, req="")     # this project names no inspector

    pid2 = create_project(module, c, inspector=INSPECTOR)
    as_(module, CLIENT)
    mid2 = json.loads(c.add_milestone(pid2, terms()))["milestone_id"]
    as_(module, CONTRACTOR)
    c.accept_project(pid2)
    with pytest.raises(err(module), match="the inspector must accept the role before submitting"):
        document(module, c, mid2, who=INSPECTOR)
    as_(module, INSPECTOR)
    c.accept_inspector_role(pid2)
    assert document(module, c, mid2, who=INSPECTOR)


def test_no_evidence_before_the_terms_are_signed(module, c):
    pid = create_project(module, c)
    as_(module, CLIENT)
    mid = json.loads(c.add_milestone(pid, terms()))["milestone_id"]
    with pytest.raises(err(module), match="once the contractor has accepted the project"):
        image(module, c, mid)
    as_(module, CONTRACTOR)
    c.accept_project(pid)
    as_(module, CLIENT)
    mid2 = json.loads(c.add_milestone(pid, terms(title="Slab")))["milestone_id"]
    with pytest.raises(err(module), match="have not been accepted by the contractor yet"):
        image(module, c, mid2)


def test_no_evidence_after_the_deadline_outside_an_appeal(module, c):
    pid, mid = active_milestone(module, c)
    set_now("2026-10-20T12:00:00Z")
    image(module, c, mid, caption="filed on the deadline")         # the deadline itself is in time
    set_now("2026-10-20T12:00:01Z")
    with pytest.raises(err(module), match="the deadline has passed; evidence is accepted only during an appeal"):
        image(module, c, mid, caption="late")


def test_nobody_files_against_a_standing_acceptance(module, c):
    """An objection the standing verdict never read must be impossible
    while money can still move: the only way to contest an acceptance is
    to open an appeal, which then takes evidence from every party."""
    pid, mid = active_milestone(module, c, inspector=INSPECTOR)
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items)
    assert milestone(c, mid)["state"] == "ACCEPTED"
    for who in (CLIENT, CONTRACTOR, INSPECTOR):
        with pytest.raises(err(module), match="to contest it the client opens an appeal"):
            image(module, c, mid, who=who, req="")
        with pytest.raises(err(module), match="to contest it the client opens an appeal"):
            declaration(module, c, mid, who=who, text="the beams were never poured")


def test_no_evidence_on_a_settled_milestone(module, c):
    pid, mid = active_milestone(module, c)
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    assess(module, c, mid, items)
    set_now("2026-09-20T10:00:01Z")
    c.finalize(mid)
    with pytest.raises(err(module), match="the milestone is settled"):
        document(module, c, mid)

    pid2, mid2 = active_milestone(module, c)
    set_now("2026-10-21T00:00:00Z")
    c.close_milestone(mid2)
    with pytest.raises(err(module), match="the milestone is settled"):
        image(module, c, mid2)


@pytest.mark.parametrize("who, bucket, n", [
    (CLIENT, "IMAGE", 3), (CLIENT, "TEXT", 3),
    (INSPECTOR, "IMAGE", 3), (INSPECTOR, "TEXT", 3),
    (CONTRACTOR, "IMAGE", 12), (CONTRACTOR, "TEXT", 6),
])
def test_each_party_has_its_own_quota_per_version(module, c, who, bucket, n):
    pid, mid = active_milestone(module, c, inspector=INSPECTOR)

    def file_one(i):
        if bucket == "IMAGE":
            return image(module, c, mid, who=who, req="", caption=f"item {i}")
        if i % 2:
            return declaration(module, c, mid, who=who, text=f"statement {i}")
        return document(module, c, mid, who=who, title=f"doc {i}")

    for i in range(n):
        file_one(i)
    with pytest.raises(err(module), match=f"has filed the {n} "):
        file_one(n)
    # one party's quota never limits another's
    others = [w for w in (CLIENT, CONTRACTOR, INSPECTOR) if w != who]
    for other in others:
        image(module, c, mid, who=other, req="", caption="still room")
    # and a new version of the terms starts every quota afresh
    as_(module, CLIENT)
    c.propose_version(mid, terms(title="Foundation v2"))
    as_(module, CONTRACTOR)
    c.accept_version(mid, 2)
    file_one(0)


def test_documents_and_declarations_are_hashed_over_their_utf8_text(module, c):
    pid, mid = active_milestone(module, c)
    text = "Inspection: footings cast to drawing S-101 (rev C), 600 × 600 mm, béton C25."
    eid = document(module, c, mid, text=text, title="Inspection report", reference="IR-0042")
    item = json.loads(c.get_item(eid))
    assert item["sha256"] == hashlib.sha256(text.encode("utf-8")).hexdigest()
    assert item["text"] == text and item["reference"] == "IR-0042"
    assert item["chars"] == len(text) and item["bytes"] == len(text.encode("utf-8"))
    did = declaration(module, c, mid, text="Work complete as of 18 Feb.")
    d = json.loads(c.get_item(did))
    assert d["kind"] == "DECLARATION" and d["caption"] == "declaration by the contractor"
    assert d["requirement_id"] == ""


@pytest.mark.parametrize("kind, text, words", [
    ("document", "   ", "the document is empty"),
    ("document", "x" * 6001, "a document is at most 6000 characters"),
    ("declaration", "\n", "the declaration is empty"),
    ("declaration", "x" * 2001, "a declaration is at most 2000 characters"),
])
def test_text_limits(module, c, kind, text, words):
    pid, mid = active_milestone(module, c)
    with pytest.raises(err(module), match=words):
        if kind == "document":
            document(module, c, mid, text=text)
        else:
            declaration(module, c, mid, text=text)


def test_text_limits_are_inclusive(module, c):
    pid, mid = active_milestone(module, c)
    assert document(module, c, mid, text="x" * 6000)
    assert declaration(module, c, mid, text="y" * 2000)


def test_filed_evidence_never_changes(module, c):
    pid, mid = active_milestone(module, c)
    items = [image(module, c, mid, caption=f"beam {i}") for i in range(2)]
    before = {e: (c.get_item(e), bytes(c.get_image(e))) for e in items}
    assess(module, c, mid, items, judge=judge_all("NOT_MET"))
    as_(module, CONTRACTOR)
    c.open_appeal(mid, "the beams are visible in both photographs")
    image(module, c, mid, caption="close-up of the east beam")
    set_now("2026-09-20T10:00:01Z")
    from conftest import llm, look_all
    llm(look=look_all(), judge=judge_all("MET"))
    c.decide_appeal(mid)
    after = {e: (c.get_item(e), bytes(c.get_image(e))) for e in items}
    assert after == before
