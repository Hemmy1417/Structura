"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ActButton, Unavailable } from "@/components/Acts";
import { Empty, Gen, Loading, Mark, Notice, ReadFailure, Rev, Stamp, toneOfDecision, toneOfState, useNow, When } from "@/components/bits";
import { ItemCard } from "@/components/Evidence";
import { FilePanel } from "@/components/FilePanel";
import { PanelView } from "@/components/PanelView";
import { Section, Sheet } from "@/components/Sheet";
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
    <div className="grid gap-5">
      <div className="grid gap-1">
        <p className="label">Requirements</p>
        <p className="whitespace-pre-line">{v.requirements}</p>
      </div>
      {v.specification ? (
        <div className="grid gap-1">
          <p className="label">Specification</p>
          <p className="whitespace-pre-line text-ink-2">{v.specification}</p>
        </div>
      ) : null}
      <div>
        <p className="label mb-1.5">Acceptance criteria, each judged on its own</p>
        <ol className="grid gap-1.5">
          {v.criteria.map((c) => (
            <li key={c.id} className="grid grid-cols-[2.5rem_1fr] gap-2">
              <span className="figure text-sm text-ink-3">{c.id}</span><span>{c.text}</span>
            </li>
          ))}
        </ol>
      </div>
      {v.evidence_requirements.length ? (
        <div>
          <p className="label mb-1.5">Evidence the terms require</p>
          <ul className="grid gap-1.5 text-sm">
            {v.evidence_requirements.map((r) => {
              const have = items.filter((it) => it.requirement_id === r.id && it.role === r.from_role).length;
              return (
                <li key={r.id} className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-2">
                  <span className="figure text-ink-3">{r.id}</span>
                  <span>{r.text} <span className="text-ink-3">({present.requirementKind(r.kind).toLowerCase()}, at least {r.min_count}, from the {r.from_role.toLowerCase()})</span></span>
                  <Mark tone={have >= r.min_count ? "met" : "amber"} glyph={false}>{have} filed</Mark>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-4">
        <div><dt className="label">Payment</dt><dd><Gen wei={v.payment_wei} /></dd></div>
        <div><dt className="label">Deadline</dt><dd><When iso={v.deadline} /></dd></div>
        <div><dt className="label">Proposed</dt><dd><When iso={v.proposed_at} withTime={false} /></dd></div>
        <div><dt className="label">Signed</dt><dd>{v.accepted_at ? <When iso={v.accepted_at} withTime={false} /> : "Not yet"}</dd></div>
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
  const over = images > maxImages ? `Choose at most ${maxImages} of your images.` : texts > maxTexts ? `Choose at most ${maxTexts} of your documents and declarations.` : "";
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
      <p className="text-sm font-semibold">Request an assessment</p>
      {mine.length === 0 ? <p className="text-sm text-ink-3">File your evidence first.</p> : (
        <fieldset className="grid gap-1.5">
          <legend className="label mb-1">Your items to present</legend>
          {mine.map((it) => (
            <label key={it.item_id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-ink" checked={chosen.includes(it.item_id)}
                onChange={(e) => setChosen(e.target.checked ? [...chosen, it.item_id] : chosen.filter((x) => x !== it.item_id))} />
              <span>{present.itemName(it.item_id)}: {it.caption || present.itemKind(it.kind, it.origin)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-sm text-ink-3">
        {others.length ? `${present.plural(others.length, "item")} from the other parties ${others.length === 1 ? "is" : "are"} read as well, always.` : "The other parties have filed nothing; anything they file is read as well."}
      </p>
      {over || gap ? <p className="text-sm text-amber-ink">{over || gap}</p> : (
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
      <p className="text-sm font-semibold">Appeal the {against.toLowerCase()}</p>
      <textarea className="field" maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Why the decision is wrong. The validators read this as your argument, not as evidence." />
      {reason.trim() ? <ActButton key={reason.length > 0 ? "ready" : "empty"} act={act} label="Open the appeal" tx={tx} /> :
        <span className="text-sm text-ink-3">State your grounds; then every party may add evidence for one window.</span>}
    </div>
  );
}

export default function MilestoneSheet() {
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

  const sheetNo = present.milestoneSheet(mid);
  if (error) return <Sheet number={sheetNo} title="Milestone"><ReadFailure error={error} onRetry={read.reload} /></Sheet>;
  if (m === undefined || (m && !p)) return <Sheet number={sheetNo} title="Milestone"><Loading what="the milestone" /></Sheet>;
  if (m === null || !p || !ctx) {
    return (
      <Sheet number={sheetNo} title="No such milestone">
        <Empty title="This deployment has no milestone with that number">
          <p><Link href="/projects" className="underline">Open the register</Link> to find one.</p>
        </Empty>
      </Sheet>
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
    <Sheet
      number={sheetNo}
      title={terms.title}
      project={p.title}
      revision={`Rev ${m.versions.length}.${m.rounds_count}`}
      trail={[
        { number: present.projectSheet(p.project_id), title: p.title, href: `/projects/${p.project_id}` },
        { number: sheetNo, title: terms.title, href: `/milestones/${mid}` },
      ]}
      lead={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Mark tone={toneOfState(m.state)}>{present.milestoneState(m.state)}</Mark>
          <span>Pays <Gen wei={terms.payment_wei} /></span>
          <span>Due <When iso={terms.deadline} withTime={false} /> <span className="text-ink-3">({present.relative(terms.deadline, now)})</span></span>
          {who ? <span className="text-ink-3">You are the {present.roleLower(who)}.</span> : null}
        </div>
      }
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-10">
          {m.state === "APPEALED" && m.appeal ? (
            <Notice tone="open" title={`Under appeal: the ${present.roleLower(m.appeal.appellant_role)} contests the ${m.appeal.against.toLowerCase()}`}>
              <p className="whitespace-pre-line">&ldquo;{m.appeal.reason}&rdquo;</p>
              <p className="mt-1">
                Every party may add evidence until <When iso={m.appeal.evidence_ends} /> ({present.relative(m.appeal.evidence_ends, now)}).
                Then anyone can ask the validators to decide. Nothing else moves until then.
              </p>
            </Notice>
          ) : null}

          <Section n={1} title={signed ? `Terms, version ${signed.version}` : "Terms awaiting the contractor's signature"}
            aside={signed ? `Signed by the contractor ${present.day(signed.accepted_at)}` : undefined}>
            {pending && signed ? (
              <div className="cloud mb-5 p-4">
                <div className="flex items-center gap-2"><Rev n={pending.version} /><p className="font-semibold">Version {pending.version} proposed, awaiting the contractor&apos;s signature</p></div>
                <p className="mt-1 text-sm text-ink-2">
                  The terms below stay in force until the contractor signs. The new version pays {present.gen(pending.payment_wei)} and is due {present.day(pending.deadline)}.
                </p>
              </div>
            ) : null}
            <Terms v={signed ?? terms} items={items} />
          </Section>

          <Section n={2} title="Evidence on the record" aside={signed ? `${present.plural(items.length, "item")} for version ${signed.version}` : undefined}>
            {!signed ? <Empty title="Evidence opens once the contractor signs the terms" /> : items.length === 0 ? (
              <Empty title="Nothing filed yet">
                <p>The contractor files photographs and documents; the client and the inspector can answer them.</p>
              </Empty>
            ) : (
              <div className="grid gap-6">
                {byRole.filter((g) => g.items.length).map((g) => (
                  <div key={g.role}>
                    <p className="label mb-2">Filed by the {present.roleLower(g.role)}</p>
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-ink-2">Evidence filed under earlier terms</summary>
                {earlier.map((v) => (
                  <div key={v.version} className="mt-3">
                    <p className="label mb-2">Version {v.version}</p>
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {(m.evidence[String(v.version)] ?? []).map((it) => <ItemCard key={it.item_id} item={it} />)}
                    </div>
                  </div>
                ))}
              </details>
            ) : null}
          </Section>

          <Section n={3} title="Decision"
            aside={standing ? <Link className="underline" href={`/milestones/${mid}/rounds/${standing.round}`}>Payment certificate {present.certificateNo(mid, standing.round)}</Link> : undefined}>
            {!standing || !standingRound ? (
              <Empty title={m.state === "FINALIZED" || m.state === "CLOSED" ? "Settled" : "No decision yet"}>
                <p>{m.state === "CLOSED" ? `Closed: ${m.close_reason ?? "not accepted by the deadline"}. The reservation returned to the client.`
                  : "When the contractor requests an assessment, the validators judge every criterion and the decision appears here."}</p>
              </Empty>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Stamp decision={standing.decision} />
                  <div className="text-sm text-ink-2">
                    <p>{present.roundKind(standingRound.kind)} {standing.round}, <When iso={standing.at} /></p>
                    <p>
                      {standing.kind === "APPEAL_LAPSED" ? "The appeal lapsed without a decision; the appealed decision was never confirmed."
                        : standing.appealable && standing.window_ends ? (now <= Date.parse(standing.window_ends)
                          ? `Open to appeal until ${present.moment(standing.window_ends)} (${present.relative(standing.window_ends, now)}).`
                          : "The appeal window has closed.")
                          : standingRound.kind === "APPEAL" ? "An appeal's outcome: final." : "Not appealable."}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto border border-ink">
                  <table className="schedule min-w-[520px]">
                    <thead><tr><th className="w-14">Id</th><th>Criterion</th><th>Rating</th><th>Decisive</th></tr></thead>
                    <tbody>
                      {standingRound.criteria.map((c) => (
                        <tr key={c.id}>
                          <td className="figure text-ink-3">{c.id}</td>
                          <td>{m.versions[standingRound.version - 1]?.criteria.find((x) => x.id === c.id)?.text}</td>
                          <td><Mark tone={toneOfDecision(c.status)}>{present.status(c.status)}</Mark></td>
                          <td className="text-sm text-ink-2">{standingRound.decisive_criteria.includes(c.id) ? "Yes" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-ink-3">
                  Evidence {present.quality(standingRound.evidence_quality).toLowerCase()}
                  {standingRound.conflicts_detected ? "; the validators found the evidence in conflict" : ""}. Decisive ratings were reproduced by every agreeing validator; the others are the leading validator&apos;s.
                </p>
                {tx ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-ink-2">The panel that decided it</summary>
                    <div className="mt-3"><PanelView hash={tx.hash} source={tx.source} /></div>
                  </details>
                ) : null}
              </div>
            )}
          </Section>

          {m.rounds_count ? (
            <Section n={4} title="Rounds" aside={present.plural(m.rounds_count, "round")}>
              <ul className="grid gap-2 text-sm">
                {Array.from({ length: m.rounds_count }, (_, i) => i + 1).reverse().map((n) => (
                  <li key={n}>
                    <Link href={`/milestones/${mid}/rounds/${n}`} className="underline decoration-line underline-offset-4 hover:decoration-ink">
                      Payment certificate {present.certificateNo(mid, n)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          <div className={who ? "cloud p-4" : "panel p-4"}>
            <p className="label">{who ? `Your part, as the ${present.roleLower(who)}` : "What happens next"}</p>
            <div className="mt-3 grid gap-4">
              <ActButton act={act("accept_version")} label={`Sign version ${m.pending_version ?? ""}`}
                tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "accept_version", args: [mid, m.pending_version ?? 0] }} />
              {act("propose_version") ? (
                act("propose_version")!.available ? (
                  <Link href={`/projects/${p.project_id}/milestones/new?milestone=${mid}`} className="btn btn-line">Propose new terms</Link>
                ) : <Unavailable label="Propose new terms" reason={act("propose_version")!.reason} />
              ) : null}
              <AssessPanel key={`${m.rounds_count}.${items.length}`} ctx={ctx} act={act("request_assessment")} onDone={roundDone} />
              {m.state === "ACCEPTED" || m.state === "REJECTED" ? (
                <AppealForm act={act("open_appeal")} mid={mid} against={present.decision(m.state)} />
              ) : null}
              <ActButton act={act("decide_appeal")} label="Decide the appeal"
                tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "decide_appeal", args: [mid] }}
                working="The validators re-judge the recorded evidence and everything filed since. A round takes one to four minutes."
                onDone={roundDone} />
              <ActButton act={act("lapse_appeal")} label="Record the appeal as lapsed" tone="line"
                tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "lapse_appeal", args: [mid] }} />
              <ActButton act={act("finalize")} label={`Finalize and credit ${present.gen(m.reserved_wei)}`}
                tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "finalize", args: [mid] }} />
              <ActButton act={act("close_milestone")} label="Close the milestone" tone="line"
                tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "close_milestone", args: [mid] }} />
              {m.state === "FINALIZED" ? (
                <p className="text-sm text-ink-2">Paid: {present.gen(signed?.payment_wei ?? "0")} credited to the contractor <When iso={m.finalized_at} withTime={false} />. The contractor claims it from the wallet dock.</p>
              ) : null}
              {!who ? <p className="text-sm text-ink-3">Anyone may finalize, close or trigger a readjudication once its time comes; only the parties sign terms, file evidence and appeal.</p> : null}
            </div>
          </div>

          {who && signed && !["FINALIZED", "CLOSED"].includes(m.state) ? (
            <div>
              <p className="label mb-2">File evidence</p>
              <FilePanel ctx={ctx} role={who} />
            </div>
          ) : null}
        </aside>
      </div>
    </Sheet>
  );
}
