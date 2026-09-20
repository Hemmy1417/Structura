"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ActButton, Unavailable } from "@/components/Acts";
import {
  Chip, DecisionMark, Empty, Fold, Gen, Loading, Notice, ReadFailure, Stat, toneOfDecision, toneOfState,
  useNow, When,
} from "@/components/bits";
import { ItemCard } from "@/components/Evidence";
import { FilePanel } from "@/components/FilePanel";
import { PanelView } from "@/components/PanelView";
import { Band, PageHead, Section } from "@/components/Page";
import { type TxOutcome } from "@/components/TxPanel";
import { coverageGap, currentItems, currentTerms, milestoneActs, roleIn, shownTerms, type Act, type MilestoneContext } from "@/lib/acts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import * as present from "@/lib/present";
import { getConfig, getMilestone, getProject, getRound } from "@/lib/read";
import type { MilestoneView, Version } from "@/lib/types";
import { rememberRoundTx, roundTx } from "@/lib/txlog";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

function Terms({ v, items }: { v: Version; items: MilestoneView["evidence"][string] }) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-1.5">
        <p className="kicker">Requirements</p>
        <p className="whitespace-pre-line">{present.prose(v.requirements)}</p>
      </div>
      {v.specification ? (
        <div className="grid gap-1.5">
          <p className="kicker">Specification</p>
          <p className="whitespace-pre-line text-slate">{present.prose(v.specification)}</p>
        </div>
      ) : null}
      <div>
        <p className="kicker">Acceptance criteria, each judged on its own</p>
        <ol className="mt-3 grid gap-3">
          {v.criteria.map((c, i) => (
            <li key={c.id} className="grid grid-cols-[1.75rem_1fr] gap-3 border-t border-fog pt-3">
              <span className="caption tabular">{String(i + 1).padStart(2, "0")}</span>
              <span>{present.prose(c.text)}</span>
            </li>
          ))}
        </ol>
      </div>
      {v.evidence_requirements.length ? (
        <div>
          <p className="kicker">Evidence the terms require</p>
          <ul className="mt-3 grid gap-3">
            {v.evidence_requirements.map((r) => {
              const have = items.filter((it) => it.requirement_id === r.id && it.role === r.from_role).length;
              return (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-3 border-t border-fog pt-3">
                  <span className="max-w-[52ch]">
                    {present.prose(r.text)}{" "}
                    <span className="text-iron">
                      ({present.requirementKind(r.kind).toLowerCase()}, at least {r.min_count}, from the {r.from_role.toLowerCase()})
                    </span>
                  </span>
                  <Chip tone={have >= r.min_count ? "green" : "blue"}>{have} filed</Chip>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <dl className="grid grid-cols-2 gap-6 border-t border-fog pt-6 sm:grid-cols-4">
        <div><dt className="caption">Payment</dt><dd className="tabular mt-1"><Gen wei={v.payment_wei} /></dd></div>
        <div><dt className="caption">Deadline</dt><dd className="mt-1"><When iso={v.deadline} /></dd></div>
        <div><dt className="caption">Proposed</dt><dd className="mt-1"><When iso={v.proposed_at} withTime={false} /></dd></div>
        <div><dt className="caption">Signed</dt><dd className="mt-1">{v.accepted_at ? <When iso={v.accepted_at} withTime={false} /> : "Not yet"}</dd></div>
      </dl>
    </div>
  );
}

function AssessPanel({ ctx, act, onDone }: { ctx: MilestoneContext; act: Act | undefined; onDone: (o: TxOutcome) => void }) {
  const items = currentItems(ctx.milestone);
  // Rounds read images and documents; declarations stay on the record unread.
  const mine = items.filter((it) => it.role === "CONTRACTOR" && it.kind !== "DECLARATION");
  const others = items.filter((it) => it.role !== "CONTRACTOR" && it.kind !== "DECLARATION");
  const maxImages = ctx.config?.max_named.IMAGE ?? 4;
  const maxTexts = ctx.config?.max_named.TEXT ?? 4;
  const [chosen, setChosen] = useState<string[]>(() => {
    const images = mine.filter((it) => it.kind === "IMAGE").slice(-maxImages).map((it) => it.item_id);
    const texts = mine.filter((it) => it.kind !== "IMAGE").slice(-maxTexts).map((it) => it.item_id);
    return [...images, ...texts];
  });
  const images = chosen.filter((id) => mine.find((it) => it.item_id === id)?.kind === "IMAGE").length;
  const texts = chosen.length - images;
  const gap = coverageGap(ctx.milestone, chosen);
  const over = images > maxImages ? `Choose at most ${maxImages} of your images.` : texts > maxTexts ? `Choose at most ${maxTexts} of your documents.` : "";
  const totalImages = images + others.filter((it) => it.kind === "IMAGE").length;
  const terms = currentTerms(ctx.milestone);
  const tx = useMemo(() => ({
    kind: "write" as const, address: CONTRACT_ADDRESS, method: "request_assessment",
    args: [ctx.milestone.milestone_id, JSON.stringify(chosen)],
  }), [ctx.milestone.milestone_id, chosen]);

  if (!act) return null;
  if (!act.available) return <Unavailable label="Request an assessment" reason={act.reason} />;
  return (
    <div className="grid gap-3">
      <p className="body-sm font-semibold">Request an assessment</p>
      {mine.length === 0 ? <p className="body-sm text-iron">File your evidence first.</p> : (
        <fieldset className="grid gap-2">
          <legend className="caption mb-1">Your items to present</legend>
          {mine.map((it) => (
            <label key={it.item_id} className="flex items-start gap-2.5 body-sm">
              <input type="checkbox" className="mt-1 accent-[#0071e3]" checked={chosen.includes(it.item_id)}
                onChange={(e) => setChosen(e.target.checked ? [...chosen, it.item_id] : chosen.filter((x) => x !== it.item_id))} />
              <span>{present.itemName(it.item_id)}: {present.prose(it.caption) || present.itemKind(it.kind, it.origin)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="body-sm text-iron">
        {others.length
          ? `${present.plural(others.length, "item")} from the other parties ${others.length === 1 ? "is" : "are"} read as well, always.`
          : "The other parties have filed nothing; anything they file is read as well."}
      </p>
      {over || gap ? <p className="body-sm text-orange">{over || gap}</p> : (
        <ActButton act={act} label="Request the assessment" tx={tx}
          working={`The validators are each looking at ${present.plural(totalImages, "image")} and judging ${present.plural(terms?.criteria.length ?? 0, "criterion", "criteria")}. A round takes one to four minutes.`}
          onDone={onDone} />
      )}
    </div>
  );
}

function AppealForm({ act, mid, against }: { act: Act | undefined; mid: string; against: string }) {
  const [reason, setReason] = useState("");
  const tx = useMemo(() => ({ kind: "write" as const, address: CONTRACT_ADDRESS, method: "open_appeal", args: [mid, reason.trim()] }), [mid, reason]);
  if (!act) return null;
  if (!act.available) return <Unavailable label="Appeal the decision" reason={act.reason} />;
  return (
    <div className="grid gap-2">
      <p className="body-sm font-semibold">Appeal the {present.decisionNoun(against)}</p>
      <textarea className="input" maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Why the decision is wrong. The validators read this as your argument, not as evidence." />
      {reason.trim() ? <ActButton key={reason.length > 0 ? "ready" : "empty"} act={act} label="Open the appeal" tx={tx} /> :
        <span className="body-sm text-iron">State your grounds; then every party may add evidence for one window.</span>}
    </div>
  );
}

export default function MilestonePage() {
  const { mid } = useParams<{ mid: string }>();
  const { address } = useWallet();
  const now = useNow(10_000);
  const read = useChain(`milestone.${mid}`, async (fresh) => {
    const milestone = await getMilestone(mid, fresh);
    if (!milestone) return { milestone: null, project: null, config: null, standingRound: null };
    const [project, config] = await Promise.all([getProject(milestone.project_id, fresh), getConfig()]);
    const standingRound = milestone.standing ? await getRound(mid, milestone.standing.round) : null;
    return { milestone, project, config, standingRound };
  });
  const m = read.data ? read.data.milestone : read.error ? null : undefined;
  const p = read.data?.project ?? null;
  const cfg = read.data?.config ?? null;
  const standingRound = read.data?.standingRound ?? null;
  const error = read.error;

  const ctx: MilestoneContext | null = m && p ? { project: p, milestone: m, addr: address, nowMs: now, config: cfg } : null;
  const acts = ctx ? milestoneActs(ctx) : [];
  const act = (id: Act["id"]) => acts.find((a) => a.id === id);

  if (error) return <Band tone="canvas" wide><ReadFailure error={error} onRetry={read.reload} /></Band>;
  if (m === undefined || (m && !p)) return <Band tone="canvas" wide><Loading what="the milestone" /></Band>;
  if (m === null || !p || !ctx) {
    return (
      <Band tone="canvas" wide>
        <Empty title="No milestone with that address">
          <p><Link href="/projects" className="link">Open the register</Link> to find one.</p>
        </Empty>
      </Band>
    );
  }

  const who = address ? roleIn(p, address) : null;
  const terms = shownTerms(m);
  const signed = currentTerms(m);
  const pending = m.pending_version ? m.versions[m.pending_version - 1] : null;
  const items = currentItems(m);
  const byRole = (["CONTRACTOR", "CLIENT", "INSPECTOR"] as const).map((r) => ({ role: r, items: items.filter((it) => it.role === r) }));
  const earlier = m.versions.filter((v) => v.version !== m.current_version && (m.evidence[String(v.version)] ?? []).length > 0);
  const reqText = (id: string) => signed?.evidence_requirements.find((r) => r.id === id)?.text;
  const standing = m.standing;
  const newSince = standing ? standing.item_mark : Infinity;
  const tx = standing ? roundTx(mid, standing.round) : null;
  const roundDone = (o: TxOutcome) => {
    if (o.successful && o.hash) rememberRoundTx(mid, m.rounds_count + 1, o.hash);
  };

  return (
    <>
      <PageHead
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: present.prose(p.title), href: `/projects/${p.project_id}` },
        ]}
        kicker="Milestone"
        title={present.prose(terms.title)}
        lead={who ? <p>You are the {present.roleLower(who)} on this project.</p> : null}
        status={<Chip tone={toneOfState(m.state)}>{present.milestoneState(m.state)}</Chip>}
        facts={
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-fog pt-8 sm:grid-cols-4">
            <Stat value={<Gen wei={terms.payment_wei} />} label="Payment on acceptance" />
            <Stat value={present.day(terms.deadline)} label={`Deadline, ${present.relative(terms.deadline, now)}`} />
            <Stat value={m.rounds_count} label={m.rounds_count === 1 ? "Round judged" : "Rounds judged"} />
            <Stat value={items.length} label="Evidence items" />
          </dl>
        }
      />

      <Band tone="canvas" wide>
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid content-start gap-12">
            {m.state === "APPEALED" && m.appeal ? (
              <Notice tone="violet" title={`Under appeal: the ${present.roleLower(m.appeal.appellant_role)} contests the ${present.decisionNoun(m.appeal.against)}`}>
                <p className="whitespace-pre-line">&ldquo;{present.prose(m.appeal.reason)}&rdquo;</p>
                <p className="mt-2">
                  Every party may add evidence until <When iso={m.appeal.evidence_ends} />, {present.relative(m.appeal.evidence_ends, now)}.
                  Then anyone can ask the validators to decide. Nothing else moves until then.
                </p>
              </Notice>
            ) : null}

            <Section
              title={signed ? `Terms, version ${signed.version}` : "Terms awaiting the contractor's signature"}
              aside={signed ? `Signed ${present.day(signed.accepted_at)}` : undefined}
            >
              {pending && signed ? (
                <Notice tone="blue" title={`Version ${pending.version} proposed, awaiting the contractor's signature`}>
                  <p>
                    The terms below stay in force until the contractor signs. The new version pays{" "}
                    {present.gen(pending.payment_wei)} and is due {present.day(pending.deadline)}.
                  </p>
                </Notice>
              ) : null}
              <div className={`card ${pending && signed ? "mt-5" : ""}`}>
                <Terms v={signed ?? terms} items={items} />
              </div>
            </Section>

            <Section title="Evidence on the record" aside={signed ? `${present.plural(items.length, "item")} for version ${signed.version}` : undefined}>
              {!signed ? <Empty title="Evidence opens once the contractor signs the terms" /> : items.length === 0 ? (
                <Empty title="Nothing filed yet">
                  <p>The contractor files photographs and documents; the client and the inspector can answer them.</p>
                </Empty>
              ) : (
                <div className="grid gap-8">
                  {byRole.filter((g) => g.items.length).map((g) => (
                    <div key={g.role}>
                      <p className="kicker mb-3">Filed by the {present.roleLower(g.role)}</p>
                      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                        {g.items.map((it) => (
                          <ItemCard key={it.item_id} item={it} requirement={reqText(it.requirement_id)}
                            isNew={m.state === "APPEALED" && Number(it.item_id.split("-")[1]) > newSince} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {earlier.length ? (
                <div className="mt-6">
                  <Fold summary="Evidence filed under earlier terms">
                    {earlier.map((v) => (
                      <div key={v.version} className="mt-4">
                        <p className="kicker mb-3">Version {v.version}</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {(m.evidence[String(v.version)] ?? []).map((it) => <ItemCard key={it.item_id} item={it} />)}
                        </div>
                      </div>
                    ))}
                  </Fold>
                </div>
              ) : null}
            </Section>

            <Section
              title="Decision"
              aside={standing ? <Link className="link" href={`/milestones/${mid}/rounds/${standing.round}`}>Open the full record</Link> : undefined}
            >
              {!standing || !standingRound ? (
                <Empty title={m.state === "FINALIZED" || m.state === "CLOSED" ? "Settled" : "No decision yet"}>
                  <p>{m.state === "CLOSED" ? `Closed: ${present.prose(m.close_reason) || "not accepted by the deadline"}. The reservation returned to the client.`
                    : "When the contractor requests an assessment, the validators judge every criterion and the decision appears here."}</p>
                </Empty>
              ) : (
                <div className="card">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <DecisionMark decision={standing.decision} />
                      <p className="body-sm mt-2 text-slate">
                        {present.roundName(standingRound.kind, standing.round)}, <When iso={standing.at} />
                      </p>
                    </div>
                    <p className="body-sm max-w-[34ch] text-iron sm:text-right">
                      {standing.kind === "APPEAL_LAPSED" ? "The appeal lapsed without a decision, so the appealed decision was never confirmed."
                        : standing.appealable && standing.window_ends ? (now <= Date.parse(standing.window_ends)
                          ? `Open to appeal until ${present.moment(standing.window_ends)}, ${present.relative(standing.window_ends, now)}.`
                          : "The appeal window has closed.")
                          : standingRound.kind === "APPEAL" ? "An appeal's outcome, and final." : "Not appealable."}
                    </p>
                  </div>

                  <ul className="mt-8 grid gap-3">
                    {standingRound.criteria.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-3 border-t border-fog pt-3">
                        <span className="max-w-[56ch]">
                          {present.prose(m.versions[standingRound.version - 1]?.criteria.find((x) => x.id === c.id)?.text)}
                          {standingRound.decisive_criteria.includes(c.id) ? <span className="caption"> decisive</span> : null}
                        </span>
                        <Chip tone={toneOfDecision(c.status)}>{present.status(c.status)}</Chip>
                      </li>
                    ))}
                  </ul>

                  <p className="body-sm mt-6 text-iron">
                    Evidence {present.quality(standingRound.evidence_quality).toLowerCase()}
                    {standingRound.conflicts_detected ? ", and the validators found it in conflict" : ""}.
                    Decisive ratings were reproduced by every agreeing validator; the others are the leading validator&apos;s.
                  </p>
                  {tx ? (
                    <div className="mt-5">
                      <Fold summary="The panel that decided it">
                        <PanelView hash={tx.hash} source={tx.source} />
                      </Fold>
                    </div>
                  ) : null}
                </div>
              )}
            </Section>

            {m.rounds_count > 1 ? (
              <Section title="Earlier rounds">
                <ul className="grid gap-2">
                  {Array.from({ length: m.rounds_count }, (_, i) => i + 1).reverse().map((n) => (
                    <li key={n}>
                      <Link href={`/milestones/${mid}/rounds/${n}`} className="link body-sm">
                        Round {n}, the full record
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </div>

          <aside className="grid content-start gap-5">
            <div className="card">
              <p className="kicker">{who ? `Your part, as the ${present.roleLower(who)}` : "What happens next"}</p>
              <div className="mt-5 grid gap-5">
                <ActButton act={act("accept_version")} label={`Sign version ${m.pending_version ?? ""}`}
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "accept_version", args: [mid, m.pending_version ?? 0] }} />
                {act("propose_version") ? (
                  act("propose_version")!.available ? (
                    <Link href={`/projects/${p.project_id}/milestones/new?milestone=${mid}`} className="btn btn-neutral no-underline">Propose new terms</Link>
                  ) : <Unavailable label="Propose new terms" reason={act("propose_version")!.reason} />
                ) : null}
                <AssessPanel key={`${m.rounds_count}.${items.length}`} ctx={ctx} act={act("request_assessment")} onDone={roundDone} />
                {m.state === "ACCEPTED" || m.state === "REJECTED" ? (
                  <AppealForm act={act("open_appeal")} mid={mid} against={m.state} />
                ) : null}
                <ActButton act={act("decide_appeal")} label="Decide the appeal"
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "decide_appeal", args: [mid] }}
                  working="The validators re-judge the recorded evidence and everything filed since. A round takes one to four minutes."
                  onDone={roundDone} />
                <ActButton act={act("lapse_appeal")} label="Record the appeal as lapsed" tone="neutral"
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "lapse_appeal", args: [mid] }} />
                <ActButton act={act("finalize")} label={`Finalize and credit ${present.gen(m.reserved_wei)}`}
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "finalize", args: [mid] }} />
                <ActButton act={act("close_milestone")} label="Close the milestone" tone="neutral"
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "close_milestone", args: [mid] }} />
                {m.state === "FINALIZED" ? (
                  <p className="body-sm text-slate">
                    Paid: {present.gen(signed?.payment_wei ?? "0")} credited to the contractor{" "}
                    <When iso={m.finalized_at} withTime={false} />. The contractor claims it from the wallet.
                  </p>
                ) : null}
                {!who ? (
                  <p className="body-sm text-iron">
                    Anyone may finalize, close or trigger a readjudication once its time comes. Only the parties
                    sign terms, file evidence and appeal.
                  </p>
                ) : null}
              </div>
            </div>

            {who && signed && !["FINALIZED", "CLOSED"].includes(m.state) ? (
              <div className="card">
                <p className="kicker mb-4">File evidence</p>
                <FilePanel ctx={ctx} role={who} />
              </div>
            ) : null}
          </aside>
        </div>
      </Band>
    </>
  );
}
