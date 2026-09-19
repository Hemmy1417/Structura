"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Copyable, Empty, Gen, Loading, Mark, ReadFailure, Stamp, toneOfDecision, useNow, When } from "@/components/bits";
import { PanelView } from "@/components/PanelView";
import { Section, Sheet } from "@/components/Sheet";
import { addressUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";
import * as present from "@/lib/present";
import { getImage, getItem, getMilestone, getProject, getRound } from "@/lib/read";
import { sha256Hex } from "@/lib/hash";
import type { MilestoneView, RoundView, SnapshotRow } from "@/lib/types";
import { roundTx } from "@/lib/txlog";
import { useChain } from "@/lib/useChain";

function DigestCheck({ row }: { row: SnapshotRow }) {
  const [state, setState] = useState<"idle" | "checking" | "match" | "mismatch" | "failed">("idle");
  async function check() {
    setState("checking");
    try {
      let digest: string;
      if (row.kind === "IMAGE") digest = (await getImage(row.item_id)).digest;
      else digest = await sha256Hex((await getItem(row.item_id))?.text ?? "");
      setState(digest === row.sha256 ? "match" : "mismatch");
    } catch {
      setState("failed");
    }
  }
  if (state === "idle") return <button type="button" className="label underline underline-offset-2 hover:text-ink" onClick={() => void check()}>recompute</button>;
  if (state === "checking") return <span className="label">reading…</span>;
  if (state === "match") return <span className="label text-met">matches</span>;
  if (state === "mismatch") return <span className="label text-fail">does not match</span>;
  return <span className="label">could not read</span>;
}

/** What this round's decision means for the payment now: the milestone's state and the clock decide. */
function payLine(r: RoundView, m: MilestoneView, latest: boolean, nowMs: number): string {
  const pay = present.gen(m.versions[r.version - 1]?.payment_wei ?? "0");
  if (!latest) return `Superseded by a later round; this certificate authorises nothing on its own.`;
  if (m.state === "FINALIZED") return `${pay} released to the contractor on ${present.day(m.finalized_at)}.`;
  if (m.state === "APPEALED") return `Under appeal: nothing is payable until the appeal is decided.`;
  if (m.standing?.kind === "APPEAL_LAPSED") {
    return `Not payable: the appeal against this decision was never decided, so the milestone stands undetermined.`;
  }
  if (m.state === "CLOSED") return `Nothing paid; the milestone closed and ${pay} returned to the client's escrow.`;
  if (r.decision === "ACCEPTED") {
    if (!r.appealable || !r.window_ends) return `${pay} payable now: an appeal upheld the acceptance. Anyone may finalize it.`;
    return nowMs <= Date.parse(r.window_ends)
      ? `${pay} payable once the client's appeal window closes, ${present.moment(r.window_ends)}, unless appealed.`
      : `${pay} payable: the client's appeal window closed ${present.moment(r.window_ends)} with no appeal. Anyone may finalize it.`;
  }
  return r.decision === "REJECTED"
    ? `Not payable: a criterion was found not met.`
    : `Not payable: the evidence did not establish every criterion.`;
}

export default function Certificate() {
  const { mid, n } = useParams<{ mid: string; n: string }>();
  const num = Number(n);
  const nowMs = useNow();
  const read = useChain(`certificate.${mid}.${num}`, async () => {
    const [round, milestone] = await Promise.all([getRound(mid, num), getMilestone(mid)]);
    const project = milestone ? await getProject(milestone.project_id) : null;
    return { round, milestone, project };
  });
  const r = read.data ? read.data.round : read.error ? null : undefined;
  const m = read.data?.milestone ?? null;
  const p = read.data?.project ?? null;
  const error = read.error;

  const certNo = present.certificateNo(mid, num);
  if (error) return <Sheet number={certNo} title="Payment certificate"><ReadFailure error={error} onRetry={read.reload} /></Sheet>;
  if (r === undefined || (r && (!m || !p))) return <Sheet number={certNo} title="Payment certificate"><Loading what="the round" /></Sheet>;
  if (r === null || !m || !p) {
    return (
      <Sheet number={certNo} title="No such round">
        <Empty title="This milestone has no round with that number">
          <p><Link href={`/milestones/${mid}`} className="underline">Back to the milestone</Link></p>
        </Empty>
      </Sheet>
    );
  }

  const v = m.versions[r.version - 1];
  const latest = m.standing?.round === r.round;
  const tx = roundTx(mid, r.round);
  const notes = r.leader_notes ?? {};

  return (
    <Sheet
      number={certNo}
      title={`${r.kind === "APPEAL" ? "Appeal" : "Interim payment"} certificate No. ${certNo}`}
      project={p.title}
      revision={`Round ${r.round}`}
      trail={[
        { number: present.projectSheet(p.project_id), title: p.title, href: `/projects/${p.project_id}` },
        { number: present.milestoneSheet(mid), title: v?.title ?? "Milestone", href: `/milestones/${mid}` },
        { number: certNo, title: `Certificate, round ${r.round}`, href: `/milestones/${mid}/rounds/${r.round}` },
      ]}
      lead={<p>The decision record for one round, as the contract stored it. Every figure below is read from the chain.</p>}
    >
      <div className="grid gap-10">
        <div className="sheet grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-3">
            <div>
              <p className="label">Project</p>
              <p className="heading">{p.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="label">Milestone</p><p>{v?.title}</p></div>
              <div><p className="label">Terms</p><p>Version {r.version}</p></div>
              <div><p className="label">{present.roundKind(r.kind)}</p><p><When iso={r.at} /></p></div>
              <div><p className="label">Requested by</p><p>{(() => {
                const role = r.triggered_by.toLowerCase() === p.client.toLowerCase() ? "the client"
                  : r.triggered_by.toLowerCase() === p.contractor.toLowerCase() ? "the contractor"
                    : p.inspector && r.triggered_by.toLowerCase() === p.inspector.toLowerCase() ? "the inspector" : "someone else";
                return present.capital(role);
              })()}</p></div>
            </div>
            <div className="border-t border-ink pt-3">
              <p className="label">Settlement</p>
              <p className="mt-1">{payLine(r, m, latest, nowMs)}</p>
            </div>
          </div>
          <div className="grid content-start justify-items-start gap-2 sm:justify-items-end">
            <Stamp decision={r.decision} />
            <p className="figure text-sm"><Gen wei={v?.payment_wei ?? "0"} /></p>
            <p className="label">{r.ruleset}</p>
          </div>
        </div>

        {r.appeal ? (
          <Section n={1} title="The appeal">
            <div className="grid gap-2 text-sm">
              <p>The {present.roleLower(r.appeal.appellant_role)} contested the {r.appeal.against.toLowerCase()} of{" "}
                <Link className="underline" href={`/milestones/${mid}/rounds/${r.appeal.reviewed_round}`}>round {r.appeal.reviewed_round}</Link>{" "}
                on <When iso={r.appeal.opened_at} />; every party could add evidence until <When iso={r.appeal.evidence_ends} />.</p>
              <blockquote className="whitespace-pre-line border-l-2 border-line pl-3 text-ink-2">&ldquo;{r.appeal.reason}&rdquo;</blockquote>
              <p className="text-ink-3">The reason is the appellant&apos;s argument; the validators judged the evidence afresh. An appeal&apos;s outcome is final.</p>
            </div>
          </Section>
        ) : null}

        <Section n={r.appeal ? 2 : 1} title="Criteria" aside={`Evidence ${present.quality(r.evidence_quality).toLowerCase()}`}>
          <div className="overflow-x-auto border border-ink">
            <table className="schedule min-w-[560px]">
              <thead><tr><th className="w-14">Id</th><th>Criterion</th><th>Rating</th><th>Decisive</th></tr></thead>
              <tbody>
                {r.criteria.map((c) => (
                  <tr key={c.id}>
                    <td className="figure text-ink-3">{c.id}</td>
                    <td>{v?.criteria.find((x) => x.id === c.id)?.text}</td>
                    <td><Mark tone={toneOfDecision(c.status)}>{present.status(c.status)}</Mark></td>
                    <td className="text-sm">{r.decisive_criteria.includes(c.id) ? "Yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-ink-2">
            {r.conflicts_detected ? "The validators found the evidence in conflict, which never pays. " : ""}
            The decision is derived in code: conflict undetermines, any criterion not met rejects, any unclear
            undetermines, all met accepts. Decisive ratings were reproduced by every agreeing validator; the
            others are the leading validator&apos;s.
          </p>
        </Section>

        <Section n={r.appeal ? 3 : 2} title="Evidence the round read" aside={`${present.plural(r.evidence.length, "item")}, snapshotted before any validator ran`}>
          <div className="overflow-x-auto border border-ink">
            <table className="schedule min-w-[760px]">
              <thead>
                <tr><th>Item</th><th>Kind</th><th>Filed by</th><th>For</th><th>Size</th><th>Digest (sha256)</th><th>Check</th></tr>
              </thead>
              <tbody>
                {r.evidence.map((row) => (
                  <tr key={row.item_id}>
                    <td className="whitespace-nowrap">
                      {present.itemName(row.item_id)}
                      {row.new ? <span className="label ml-2 text-amber-ink">new</span> : null}
                      <p className="max-w-56 truncate text-sm text-ink-3" title={row.caption}>{row.caption}</p>
                    </td>
                    <td className="text-sm">{present.itemKind(row.kind, row.origin || undefined)}</td>
                    <td className="text-sm">{present.role(row.role)}</td>
                    <td className="figure text-sm">{row.requirement_id || ""}</td>
                    <td className="figure text-sm">{present.size(row.bytes)}</td>
                    <td><Copyable value={row.sha256} display={present.shortHash(row.sha256)} /></td>
                    <td><DigestCheck row={row} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-ink-3">
            The contract computed each digest when the item was filed. Recompute reads the stored bytes back and hashes them in this browser.
          </p>
        </Section>

        <Section n={r.appeal ? 4 : 3} title="The leading validator's notes" aside="Recorded as the leader's, not agreed by consensus">
          <div className="grid gap-4">
            {notes.reasoning ? <p className="max-w-3xl text-ink-2">{notes.reasoning}</p> : <p className="text-sm text-ink-3">No notes recorded.</p>}
            {notes.conflict_note ? <p className="text-sm text-ink-2">On conflict: {notes.conflict_note}</p> : null}
            {notes.images?.length ? (
              <ul className="grid gap-2 text-sm">
                {notes.images.map((f) => (
                  <li key={f.item_id} className="border-l-2 border-line pl-3">
                    <p className="font-semibold">{present.itemName(f.item_id)}{f.readable ? "" : ": could not be processed"}</p>
                    {f.visible_detail ? <p className="text-ink-2">Seen: {f.visible_detail}</p> : null}
                    <p className="text-ink-3">{Object.entries(f.readings).map(([k, val]) => `${k} ${present.reading(val).toLowerCase()}`).join("; ")}</p>
                    {f.concerns.length ? <p className="text-ink-3">Concerns: {f.concerns.join("; ")}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Section>

        <Section n={r.appeal ? 5 : 4} title="The panel">
          {tx ? <PanelView hash={tx.hash} source={tx.source} /> : (
            <p className="text-sm text-ink-2">
              The contract cannot know its own transaction&apos;s hash, and this browser did not send this round. Every
              round is listed on{" "}
              <a className="underline" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">the contract&apos;s explorer page</a>,
              with each validator&apos;s vote.
            </p>
          )}
        </Section>

        <p className="text-sm">
          <Link href={`/milestones/${mid}`} className="underline">Back to the milestone</Link>
        </p>
      </div>
    </Sheet>
  );
}
