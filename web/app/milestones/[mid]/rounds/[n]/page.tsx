"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  Chip, CopyRow, DecisionMark, Empty, Fold, Loading, ReadFailure, toneOfDecision, useNow, When,
} from "@/components/bits";
import { PanelView } from "@/components/PanelView";
import { Band, PageHead, Section } from "@/components/Page";
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
  if (state === "idle") {
    return (
      <button type="button" className="caption underline decoration-fog underline-offset-2 hover:text-obsidian" onClick={() => void check()}>
        Recompute
      </button>
    );
  }
  if (state === "checking") return <span className="caption">Reading the bytes</span>;
  if (state === "match") return <span className="caption text-green">Matches the record</span>;
  if (state === "mismatch") return <span className="caption text-orange">Does not match</span>;
  return <span className="caption">Could not read</span>;
}

/** What this round's decision means for the payment now: the milestone's state and the clock decide. */
function payLine(r: RoundView, m: MilestoneView, latest: boolean, nowMs: number): string {
  const pay = present.gen(m.versions[r.version - 1]?.payment_wei ?? "0");
  if (!latest) return `Superseded by a later round; this record authorises nothing on its own.`;
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

export default function RoundRecord() {
  const { mid, n } = useParams<{ mid: string; n: string }>();
  const num = Number(n);
  const nowMs = useNow();
  const read = useChain(`round.${mid}.${num}`, async () => {
    const [round, milestone] = await Promise.all([getRound(mid, num), getMilestone(mid)]);
    const project = milestone ? await getProject(milestone.project_id) : null;
    return { round, milestone, project };
  });
  const r = read.data ? read.data.round : read.error ? null : undefined;
  const m = read.data?.milestone ?? null;
  const p = read.data?.project ?? null;
  const error = read.error;

  if (error) return <Band tone="canvas" wide><ReadFailure error={error} onRetry={read.reload} /></Band>;
  if (r === undefined || (r && (!m || !p))) return <Band tone="canvas" wide><Loading what="the round" /></Band>;
  if (r === null || !m || !p) {
    return (
      <Band tone="canvas" wide>
        <Empty title="This milestone has no round with that number">
          <p><Link href={`/milestones/${mid}`} className="link">Back to the milestone</Link></p>
        </Empty>
      </Band>
    );
  }

  const v = m.versions[r.version - 1];
  const latest = m.standing?.round === r.round;
  const tx = roundTx(mid, r.round);
  const notes = r.leader_notes ?? {};
  const requestedBy = r.triggered_by.toLowerCase() === p.client.toLowerCase() ? "The client"
    : r.triggered_by.toLowerCase() === p.contractor.toLowerCase() ? "The contractor"
      : p.inspector && r.triggered_by.toLowerCase() === p.inspector.toLowerCase() ? "The inspector"
        : "Someone outside the project";

  return (
    <>
      <PageHead
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: present.prose(p.title), href: `/projects/${p.project_id}` },
          { label: present.prose(v?.title ?? "Milestone"), href: `/milestones/${mid}` },
        ]}
        kicker={`${present.roundName(r.kind, r.round)}, the full record`}
        title={<>The validators found the evidence <span className={
          r.decision === "ACCEPTED" ? "tint-green" : r.decision === "REJECTED" ? "tint-orange" : "tint-teal"
        }>{r.decision === "ACCEPTED" ? "sufficient" : r.decision === "REJECTED" ? "wanting" : "inconclusive"}</span>.</>}
        lead={<p>{payLine(r, m, latest, nowMs)}</p>}
        status={<DecisionMark decision={r.decision} />}
        facts={
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-fog pt-8 sm:grid-cols-4">
            <div><dt className="caption">Milestone</dt><dd className="mt-1">{present.prose(v?.title ?? "")}</dd></div>
            <div><dt className="caption">Terms</dt><dd className="mt-1">Version {r.version}</dd></div>
            <div><dt className="caption">Judged</dt><dd className="mt-1"><When iso={r.at} /></dd></div>
            <div><dt className="caption">Requested by</dt><dd className="mt-1">{requestedBy}</dd></div>
          </dl>
        }
      />

      <Band tone="canvas" wide>
        <div className="grid gap-12">
          {r.appeal ? (
            <Section title="The appeal">
              <div className="card grid gap-3">
                <p>
                  The {present.roleLower(r.appeal.appellant_role)} contested the {present.decisionNoun(r.appeal.against)} of{" "}
                  <Link className="link" href={`/milestones/${mid}/rounds/${r.appeal.reviewed_round}`}>round {r.appeal.reviewed_round}</Link>{" "}
                  on <When iso={r.appeal.opened_at} />. Every party could add evidence until <When iso={r.appeal.evidence_ends} />.
                </p>
                <blockquote className="whitespace-pre-line border-l-2 border-fog pl-4 text-slate">
                  &ldquo;{present.prose(r.appeal.reason)}&rdquo;
                </blockquote>
                <p className="body-sm text-iron">
                  The reason is the appellant&apos;s argument; the validators judged the evidence afresh. An
                  appeal&apos;s outcome is final.
                </p>
              </div>
            </Section>
          ) : null}

          <Section title="Criteria" aside={`Evidence ${present.quality(r.evidence_quality).toLowerCase()}`}>
            <div className="card">
              <ul className="grid gap-3">
                {r.criteria.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-fog pb-3 last:border-b-0 last:pb-0">
                    <span className="max-w-[60ch]">
                      {present.prose(v?.criteria.find((x) => x.id === c.id)?.text)}
                      {r.decisive_criteria.includes(c.id) ? <span className="caption"> decisive</span> : null}
                    </span>
                    <Chip tone={toneOfDecision(c.status)}>{present.status(c.status)}</Chip>
                  </li>
                ))}
              </ul>
              <p className="body-sm mt-6 text-iron">
                {r.conflicts_detected ? "The validators found the evidence in conflict, which never pays. " : ""}
                The decision is derived in code: conflict undetermines, any criterion not met rejects, any unclear
                undetermines, all met accepts. Decisive ratings were reproduced by every agreeing validator; the
                others are the leading validator&apos;s.
              </p>
            </div>
          </Section>

          <Section title="Evidence the round read" aside={`${present.plural(r.evidence.length, "item")}, recorded before any validator ran`}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {r.evidence.map((row) => (
                <li key={row.item_id} className="card-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <p className="body-sm font-semibold">{present.itemName(row.item_id)}</p>
                    {row.new ? <Chip tone="violet" dot={false}>New in the appeal</Chip> : null}
                  </div>
                  <p className="body-sm mt-1.5 text-slate">{present.prose(row.caption) || present.itemKind(row.kind, row.origin || undefined)}</p>
                  <p className="caption mt-3">
                    {present.itemKind(row.kind, row.origin || undefined)}, filed by the {present.roleLower(row.role)}, {present.size(row.bytes)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <DigestCheck row={row} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="body-sm mt-4 text-iron">
              The contract computed each digest when the item was filed. Recompute reads the stored bytes back and
              hashes them in this browser.
            </p>
            <div className="mt-4">
              <Fold summary="Digests, as the contract recorded them">
                {r.evidence.map((row) => (
                  <CopyRow key={row.item_id} label={present.itemName(row.item_id)} value={row.sha256} display={present.shortHash(row.sha256)} />
                ))}
              </Fold>
            </div>
          </Section>

          <Section title="The leading validator's notes" aside="Recorded as the leader's, not agreed by consensus">
            <div className="card grid gap-5">
              {notes.reasoning ? <p className="max-w-[70ch] text-slate">{present.prose(notes.reasoning)}</p>
                : <p className="body-sm text-iron">No notes recorded.</p>}
              {notes.conflict_note ? <p className="body-sm text-slate">On conflict: {present.prose(notes.conflict_note)}</p> : null}
              {notes.images?.length ? (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {notes.images.map((f) => (
                    <li key={f.item_id} className="border-l-2 border-fog pl-4">
                      <p className="body-sm font-semibold">
                        {present.itemName(f.item_id)}{f.readable ? "" : ", could not be processed"}
                      </p>
                      {f.visible_detail ? <p className="body-sm mt-1 text-slate">Seen: {present.prose(f.visible_detail)}</p> : null}
                      <p className="caption mt-1">
                        {Object.entries(f.readings).map(([k, val]) => `${k} ${present.reading(val).toLowerCase()}`).join("; ")}
                      </p>
                      {f.concerns.length ? <p className="caption mt-1">Concerns: {present.prose(f.concerns.join("; "))}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Section>

          <Section title="The panel">
            {tx ? <PanelView hash={tx.hash} source={tx.source} /> : (
              <p className="body-sm text-slate">
                The contract cannot know its own transaction, and this browser did not send this round. Every round
                is listed on{" "}
                <a className="link" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">the contract&apos;s page on the explorer</a>,
                with each validator&apos;s vote.
              </p>
            )}
          </Section>

          <p>
            <Link href={`/milestones/${mid}`} className="link body-sm">Back to the milestone</Link>
          </p>
        </div>
      </Band>
    </>
  );
}
