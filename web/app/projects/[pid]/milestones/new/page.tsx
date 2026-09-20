"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { Field, Loading, Notice, ReadFailure, useNow } from "@/components/bits";
import { Band, PageHead, Section } from "@/components/Page";
import { TxPanel, type TxOutcome } from "@/components/TxPanel";
import { currentTerms, shownTerms } from "@/lib/acts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import * as present from "@/lib/present";
import { getConfig, getMilestone, getProject } from "@/lib/read";
import { returnedJson } from "@/lib/receipt";
import type { ConfigView, MilestoneView, ProjectView, RequirementKind } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

interface ReqDraft {
  text: string;
  kind: RequirementKind;
  from_role: "CONTRACTOR" | "INSPECTOR";
  min_count: number;
}

function localInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function Wizard() {
  const { pid } = useParams<{ pid: string }>();
  const params = useSearchParams();
  const revising = params.get("milestone");
  const router = useRouter();
  const w = useWallet();
  const kit = useTransactionKit();
  const now = useNow(30_000);

  const [project, setProject] = useState<ProjectView | null | undefined>(undefined);
  const [milestone, setMilestone] = useState<MilestoneView | null>(null);
  const [cfg, setCfg] = useState<ConfigView | null>(null);
  const [error, setError] = useState<unknown>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [specification, setSpecification] = useState("");
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [reqs, setReqs] = useState<ReqDraft[]>([
    { text: "Photographs of the completed work", kind: "IMAGE", from_role: "CONTRACTOR", min_count: 2 },
  ]);
  const [payment, setPayment] = useState("");
  const [deadline, setDeadline] = useState(() => localInput(new Date(Date.now() + 14 * 86400_000).toISOString()));  // the initial value only
  const [review, setReview] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [p, c] = await Promise.all([getProject(pid, true), getConfig()]);
        setProject(p);
        setCfg(c);
        if (revising) {
          const m = await getMilestone(revising, true);
          setMilestone(m);
          if (m) {
            const t = shownTerms(m);
            setTitle(t.title);
            setDescription(t.description);
            setRequirements(t.requirements);
            setSpecification(t.specification);
            setCriteria(t.criteria.map((c2) => c2.text));
            setReqs(t.evidence_requirements.map(({ text, kind, from_role, min_count }) => ({ text, kind, from_role, min_count })));
            setPayment(present.gen(t.payment_wei, false).replace(/,/g, ""));
            setDeadline(localInput(t.deadline));
          }
        }
      } catch (e) {
        setError(e);
      }
    })();
  }, [pid, revising]);

  const maxCriteria = cfg?.max_criteria ?? 8;
  const maxReqs = cfg?.max_evidence_requirements ?? 8;
  const inspectorNamed = !!project?.inspector;
  const wei = present.parseGen(payment);
  const deadlineIso = deadline ? `${deadline}:00Z` : "";

  const problems = useMemo(() => {
    const p: string[] = [];
    if (!title.trim()) p.push("Give the milestone a title.");
    if (!requirements.trim()) p.push("State the contractual requirements in words.");
    if (criteria.filter((c) => c.trim()).length === 0) p.push("Add at least one acceptance criterion.");
    if (criteria.some((c) => !c.trim()) && criteria.length > 1) p.push("Remove or fill the empty criterion.");
    if (reqs.some((r) => !r.text.trim())) p.push("Describe every evidence requirement.");
    if (reqs.some((r) => r.from_role === "INSPECTOR") && !inspectorNamed) p.push("This project names no inspector; ask the contractor instead.");
    if (wei === null || wei < BigInt(cfg?.min_payment_wei ?? "10000000000000000")) p.push("A milestone pays at least 0.01 GEN.");
    const d = Date.parse(deadlineIso);
    if (!Number.isFinite(d) || d <= now + 60_000) p.push("The deadline must lie in the future.");
    return p;
  }, [title, requirements, criteria, reqs, wei, cfg, deadlineIso, inspectorNamed, now]);

  const tx = useMemo(() => {
    const terms = JSON.stringify({
      title: title.trim(), description: description.trim(), requirements: requirements.trim(),
      specification: specification.trim(),
      criteria: criteria.map((text) => ({ text: text.trim() })).filter((c) => c.text),
      evidence_requirements: reqs.map((r) => ({ ...r, text: r.text.trim() })),
      payment_wei: (wei ?? 0n).toString(),
      deadline: deadlineIso,
    });
    return revising
      ? { kind: "write" as const, address: CONTRACT_ADDRESS, method: "propose_version", args: [revising, terms] }
      : { kind: "write" as const, address: CONTRACT_ADDRESS, method: "add_milestone", args: [pid, terms] };
  }, [title, description, requirements, specification, criteria, reqs, wei, deadlineIso, revising, pid]);

  async function finished(o: TxOutcome) {
    if (!o.successful || !o.hash) return;
    const out = await returnedJson<{ milestone_id: string }>(o.hash).catch(() => null);
    const mid = out?.milestone_id ?? revising;
    setDone(mid ?? "");
    if (mid) router.push(`/milestones/${mid}`);
  }

  if (error) return <Band tone="canvas" wide><ReadFailure error={error} /></Band>;
  if (project === undefined) return <Band tone="canvas" wide><Loading what="the project" /></Band>;
  if (project === null) return <Band tone="canvas" wide><Notice tone="orange" title="No project with that address" /></Band>;

  const isClient = !!w.address && w.address.toLowerCase() === project.client.toLowerCase();
  const signedCurrent = milestone ? currentTerms(milestone) : null;

  return (
    <>
      <PageHead
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: present.prose(project.title), href: `/projects/${pid}` },
          ...(revising ? [{ label: present.prose(milestone ? shownTerms(milestone).title : "Milestone"), href: `/milestones/${revising}` }] : []),
        ]}
        kicker={revising ? "New version of the terms" : "New milestone"}
        title={revising ? "Change what this milestone means." : "The terms are the contract."}
        lead={
          <p>
            {revising
              ? "The current terms stay in force until the contractor signs the new ones, and every earlier decision stays tied to the terms it judged."
              : "What must be built, the criteria the validators judge, the evidence each party must file, the payment and the deadline. The payment is reserved from the escrow when you propose it."}
          </p>
        }
      />

      <Band tone="canvas" wide>
      {!isClient ? (
        <Notice tone="blue" title="Only the project's client writes its milestone terms">
          <p>{w.address ? "The connected wallet is not this project's client." : "Connect the client's wallet."}</p>
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form className="grid gap-9" onSubmit={(e) => { e.preventDefault(); if (!problems.length) setReview(true); }}>
          <Section title="What must be built">
            <div className="grid gap-4">
              <Field label="Title">
                <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Foundation completed" />
              </Field>
              <Field label="Contractual requirements" hint="In words, as the parties would sign them.">
                <textarea className="input" value={requirements} maxLength={2000} onChange={(e) => setRequirements(e.target.value)}
                  placeholder="All footings and ground beams are poured in concrete to the approved layout." />
              </Field>
              <Field label="Specification (optional)" hint="Dimensions, layout, materials: what the work must match. Up to 6,000 characters.">
                <textarea className="input min-h-32" value={specification} maxLength={6000} onChange={(e) => setSpecification(e.target.value)}
                  placeholder="Reinforced concrete ground beams connect every column base in a grid." />
              </Field>
              <Field label="Description (optional)">
                <textarea className="input" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Acceptance criteria" aside={`${criteria.length} of ${maxCriteria}`}>
            <p className="body-sm mb-4 text-slate">
              Each criterion is judged on its own: met, not met, or unclear. Write what a photograph or a report can show.
            </p>
            <ol className="grid gap-2">
              {criteria.map((c, i) => (
                <li key={i} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-2">
                  <span className="caption tabular pt-3">{String(i + 1).padStart(2, "0")}</span>
                  <input className="input" value={c} maxLength={300}
                    onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={i === 0 ? "The footings and ground beams are cast in concrete." : "Another criterion"} />
                  <button type="button" className="btn btn-neutral btn-sm" disabled={criteria.length === 1}
                    onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>Remove</button>
                </li>
              ))}
            </ol>
            <button type="button" className="btn btn-neutral mt-3" disabled={criteria.length >= maxCriteria}
              onClick={() => setCriteria([...criteria, ""])}>Add a criterion</button>
          </Section>

          <Section title="Evidence the terms require" aside={`${reqs.length} of ${maxReqs}`}>
            <p className="body-sm mb-4 text-slate">
              An assessment runs only when every requirement has its items. A requirement from the inspector makes their
              report a condition of payment.
            </p>
            <div className="grid gap-3">
              {reqs.map((r, i) => (
                <div key={i} className="card-quiet grid gap-3 sm:grid-cols-[3rem_1fr]">
                  <span className="caption tabular pt-3">{String(i + 1).padStart(2, "0")}</span>
                  <div className="grid gap-3">
                    <input className="input" value={r.text} maxLength={300} placeholder="Photographs of the poured ground beams"
                      onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <select className="input" value={r.kind} aria-label="Kind"
                        onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, kind: e.target.value as RequirementKind } : x)))}>
                        <option value="IMAGE">Images</option>
                        <option value="DOCUMENT">A document</option>
                      </select>
                      <select className="input" value={r.from_role} aria-label="From"
                        onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, from_role: e.target.value as ReqDraft["from_role"] } : x)))}>
                        <option value="CONTRACTOR">From the contractor</option>
                        <option value="INSPECTOR" disabled={!inspectorNamed}>From the inspector</option>
                      </select>
                      <select className="input" value={r.min_count} aria-label="How many"
                        onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, min_count: Number(e.target.value) } : x)))}>
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>At least {n}</option>)}
                      </select>
                    </div>
                    <button type="button" className="btn btn-neutral btn-sm justify-self-start" onClick={() => setReqs(reqs.filter((_, j) => j !== i))}>
                      Remove this requirement
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-neutral mt-3" disabled={reqs.length >= maxReqs}
              onClick={() => setReqs([...reqs, { text: "", kind: "IMAGE", from_role: "CONTRACTOR", min_count: 1 }])}>
              Add a requirement
            </button>
          </Section>

          <Section title="Payment and deadline">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Payment" hint={`Reserved from the escrow now; ${present.gen(project.unreserved_wei)} is free.`}>
                <input className="input tabular" inputMode="decimal" value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="2" />
              </Field>
              <Field label="Deadline (UTC)" hint="After it, a milestone not accepted closes and its payment returns to you.">
                <input className="input tabular" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </Field>
            </div>
          </Section>

          {!review ? (
            <div className="grid gap-3">
              {problems.length ? (
                <ul className="body-sm grid gap-1 text-iron">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              ) : null}
              <div>
                <button type="submit" className="btn btn-primary" disabled={!!problems.length || !isClient || !w.chainOk}>
                  Review and sign
                </button>
              </div>
            </div>
          ) : null}
        </form>

        <aside className="grid content-start gap-4">
          {signedCurrent ? (
            <div className="card-quiet">
              <p className="kicker">In force now</p>
              <p className="mt-2 font-semibold">Version {signedCurrent.version}: {present.prose(signedCurrent.title)}</p>
              <p className="body-sm mt-1 text-slate">{present.gen(signedCurrent.payment_wei)}, due {present.day(signedCurrent.deadline)}</p>
            </div>
          ) : null}
          {review && kit ? (
            <TxPanel
              kit={kit}
              tx={tx}
              confirmText={revising ? "Propose the new terms" : `Propose and reserve ${present.gen(wei ?? 0n)}`}
              onDone={(o) => void finished(o)}
              onClose={() => setReview(false)}
            />
          ) : null}
          {done === "" ? <Notice tone="teal" title="Proposed. Open the project to find it." /> : null}
          <p>
            <Link href={`/projects/${pid}`} className="link body-sm">Back to the project</Link>
          </p>
        </aside>
      </div>
      </Band>
    </>
  );
}

export default function NewMilestone() {
  return (
    <Suspense fallback={<Band tone="canvas" wide><Loading what="the project" /></Band>}>
      <Wizard />
    </Suspense>
  );
}
