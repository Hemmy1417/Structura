"use client";

/**
 * Filing evidence. Photographs and scanned pages are redrawn in this
 * browser as JFIF JPEGs the validators' models can read; a video is
 * represented by the frames the submitter picks; a document is its text.
 * The contract stores and hashes whatever is filed; the submitter's claims
 * (caption, capture date, place) are recorded as claims.
 */
import { useEffect, useMemo, useState } from "react";

import { filingClosed, type MilestoneContext, currentTerms } from "@/lib/acts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { preparePhoto, prepareVideoFrame, timecode, videoDuration, type PreparedImage } from "@/lib/images";
import { useTransactionKit } from "@/lib/kit";
import * as present from "@/lib/present";
import type { EvidenceRequirement, ImageOrigin, Role } from "@/lib/types";
import { useSignGate } from "./Acts";
import { Field, Notice } from "./bits";
import { TxPanel } from "./TxPanel";

type Tab = "PHOTO" | "VIDEO_FRAME" | "SCAN" | "DOCUMENT" | "DECLARATION";
const TABS: { id: Tab; label: string }[] = [
  { id: "PHOTO", label: "Photograph" },
  { id: "VIDEO_FRAME", label: "Video frame" },
  { id: "SCAN", label: "Scanned page" },
  { id: "DOCUMENT", label: "Document" },
  { id: "DECLARATION", label: "Declaration" },
];

function fits(req: EvidenceRequirement, role: Role, tab: Tab): boolean {
  if (req.from_role !== role) return false;
  if (req.kind === "IMAGE") return tab === "PHOTO" || tab === "VIDEO_FRAME";
  return tab === "DOCUMENT" || tab === "SCAN";
}

function RequirementPick({ reqs, value, onChange }: {
  reqs: EvidenceRequirement[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Offered for" hint="Which requirement of the terms this item answers. The validators treat it as your claim.">
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No particular requirement</option>
        {reqs.map((r) => <option key={r.id} value={r.id}>{present.prose(r.text)}</option>)}
      </select>
    </Field>
  );
}

export function FilePanel({ ctx, role }: { ctx: MilestoneContext; role: Role }) {
  const kit = useTransactionKit();
  const gate = useSignGate();
  const [tab, setTab] = useState<Tab>("PHOTO");
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState("");
  const [caption, setCaption] = useState("");
  const [capture, setCapture] = useState("");
  const [place, setPlace] = useState("");
  const [requirement, setRequirement] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [at, setAt] = useState(0);
  const [docTitle, setDocTitle] = useState("");
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [signing, setSigning] = useState(false);

  const terms = currentTerms(ctx.milestone);
  const reqs = useMemo(() => (terms?.evidence_requirements ?? []).filter((r) => fits(r, role, tab)), [terms, role, tab]);
  const bucketKind = tab === "DOCUMENT" ? "DOCUMENT" : tab === "DECLARATION" ? "DECLARATION" : "IMAGE";
  const closed = filingClosed(ctx, bucketKind);

  useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.preview); }, [prepared]);

  function reset() {
    setPrepared(null);
    setProblem("");
    setCaption("");
    setCapture("");
    setPlace("");
    setRequirement("");
    setVideo(null);
    setDuration(0);
    setAt(0);
    setDocTitle("");
    setReference("");
    setText("");
    setSigning(false);
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setProblem("");
    setPreparing(true);
    try {
      const img = await preparePhoto(file);
      setPrepared(img);
      setCapture(img.claimedCapture);
      setPlace(img.claimedLocation);
      if (!caption) setCaption(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That image could not be prepared.");
    } finally {
      setPreparing(false);
    }
  }

  async function pickVideo(file: File | undefined) {
    if (!file) return;
    setProblem("");
    try {
      setVideo(file);
      setDuration(await videoDuration(file));
      setAt(0);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That video could not be read.");
    }
  }

  async function takeFrame() {
    if (!video) return;
    setPreparing(true);
    setProblem("");
    try {
      setPrepared(await prepareVideoFrame(video, at));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That frame could not be taken.");
    } finally {
      setPreparing(false);
    }
  }

  async function loadText(file: File | undefined) {
    if (!file) return;
    if (!/^text\/|\.md$|\.txt$/i.test(file.type || file.name)) {
      setProblem("Load a plain text file, or paste the document's text.");
      return;
    }
    const body = await file.text();
    setText(body.slice(0, ctx.config?.text_max_chars ?? 6000));
    if (!docTitle) setDocTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  const origin: ImageOrigin = tab === "VIDEO_FRAME" ? "VIDEO_FRAME" : tab === "SCAN" ? "SCAN" : "PHOTO";
  const tx = useMemo(() => {
    const mid = ctx.milestone.milestone_id;
    if (tab === "DOCUMENT") {
      return { kind: "write" as const, address: CONTRACT_ADDRESS, method: "submit_document",
        args: [mid, JSON.stringify({ requirement_id: requirement, title: docTitle.trim(), reference: reference.trim() }), text] };
    }
    if (tab === "DECLARATION") {
      return { kind: "write" as const, address: CONTRACT_ADDRESS, method: "submit_declaration", args: [mid, text] };
    }
    return { kind: "write" as const, address: CONTRACT_ADDRESS, method: "submit_image",
      args: [mid, JSON.stringify({
        requirement_id: requirement, caption: caption.trim(), origin,
        origin_ref: tab === "VIDEO_FRAME" && video ? `${video.name} at ${timecode(at)}` : "",
        claimed_capture: capture.trim(), claimed_location: place.trim(),
      }), prepared?.bytes ?? new Uint8Array()] };
  }, [ctx.milestone.milestone_id, tab, requirement, docTitle, reference, text, caption, origin, video, at, capture, place, prepared]);

  const maxText = tab === "DECLARATION" ? ctx.config?.declaration_max_chars ?? 2000 : ctx.config?.text_max_chars ?? 6000;
  const ready = tab === "DOCUMENT" || tab === "DECLARATION" ? text.trim().length > 0 && text.length <= maxText : !!prepared;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kind of evidence">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            onClick={() => { reset(); setTab(t.id); }}
            className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-neutral"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-5">
        {closed ? <Notice tone="quiet" title="Filing is closed for you here">{closed}</Notice> : signing && kit ? (
          <TxPanel kit={kit} tx={tx} confirmText="File it on the record"
            onDone={(o) => { if (o.successful) window.setTimeout(reset, 1500); }}
            onClose={() => setSigning(false)} />
        ) : (
          <>
            {tab === "PHOTO" || tab === "SCAN" ? (
              <Field label={tab === "SCAN" ? "A scanned page" : "A photograph"}
                hint="Any common image. It is redrawn here at up to 1,024 pixels as a JPEG under 400 KB.">
                <input className="input" type="file" accept="image/*" onChange={(e) => void pickImage(e.target.files?.[0])} />
              </Field>
            ) : null}

            {tab === "VIDEO_FRAME" ? (
              <div className="grid gap-3">
                <Field label="A video" hint="The validators cannot watch video; you choose the frames that show the work.">
                  <input className="input" type="file" accept="video/*" onChange={(e) => void pickVideo(e.target.files?.[0])} />
                </Field>
                {video && duration > 0 ? (
                  <div className="grid gap-2">
                    <label className="body-sm">
                      Frame at <span className="tabular">{timecode(at)}</span> of <span className="tabular">{timecode(duration)}</span>
                      <input type="range" className="mt-1 block w-full" min={0} max={Math.max(0, Math.floor(duration))} step={1}
                        value={at} onChange={(e) => setAt(Number(e.target.value))} />
                    </label>
                    <button type="button" className="btn btn-neutral justify-self-start" disabled={preparing} onClick={() => void takeFrame()}>
                      Take this frame
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {preparing ? <p className="body-sm text-slate">Preparing the image</p> : null}

            {prepared && (tab === "PHOTO" || tab === "SCAN" || tab === "VIDEO_FRAME") ? (
              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                <div className="grid content-start gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={prepared.preview} alt="What will be filed" className="aspect-[4/3] w-full rounded-[10px] object-cover" />
                  <p className="caption">{prepared.width} by {prepared.height} pixels, {present.size(prepared.bytes.length)}</p>
                </div>
                <div className="grid content-start gap-3">
                  <Field label="Caption" hint="What the image shows, in your words.">
                    <input className="input" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
                  </Field>
                  {tab !== "VIDEO_FRAME" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Taken (claimed)" hint={capture ? "Read from the photo's own data." : "Optional."}>
                        <input className="input tabular" maxLength={40} value={capture} onChange={(e) => setCapture(e.target.value)} />
                      </Field>
                      <Field label="Place (claimed)" hint={place ? "Read from the photo's own data." : "Optional."}>
                        <input className="input" maxLength={200} value={place} onChange={(e) => setPlace(e.target.value)} />
                      </Field>
                    </div>
                  ) : null}
                  <RequirementPick reqs={reqs} value={requirement} onChange={setRequirement} />
                </div>
              </div>
            ) : null}

            {tab === "DOCUMENT" ? (
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title">
                    <input className="input" maxLength={200} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Site inspection report" />
                  </Field>
                  <Field label="Reference (optional)" hint="A report or drawing number.">
                    <input className="input" maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="IR-0042" />
                  </Field>
                </div>
                <Field label="The document's text" hint={`${text.length.toLocaleString("en-US")} of ${maxText.toLocaleString("en-US")} characters. A scanned page goes under Scanned page instead.`}>
                  <textarea className="input min-h-40" value={text} maxLength={maxText} onChange={(e) => setText(e.target.value)} />
                </Field>
                <Field label="Or load a text file">
                  <input className="input" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(e) => void loadText(e.target.files?.[0])} />
                </Field>
                <RequirementPick reqs={reqs} value={requirement} onChange={setRequirement} />
              </div>
            ) : null}

            {tab === "DECLARATION" ? (
              <Field label="Your declaration"
                hint={`A statement in your own name, kept on the record and shown to every party. No round reads it: a party's own word can neither establish nor contest a criterion. To contest a decision, file evidence or appeal. ${text.length} of ${maxText} characters.`}>
                <textarea className="input" value={text} maxLength={maxText} onChange={(e) => setText(e.target.value)} />
              </Field>
            ) : null}

            {problem ? <p className="body-sm text-orange">{present.prose(problem)}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary" disabled={!ready || !!gate} onClick={() => setSigning(true)}>
                Review and file
              </button>
              {gate ? <span className="body-sm text-iron">{gate}</span> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
