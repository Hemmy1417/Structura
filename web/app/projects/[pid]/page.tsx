"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ActButton, Unavailable } from "@/components/Acts";
import { Chip, CopyRow, Empty, Fold, Gen, Loading, ReadFailure, Stat, toneOfState, useNow, When } from "@/components/bits";
import { Band, PageHead, Section } from "@/components/Page";
import { projectActs, roleIn, type Act } from "@/lib/acts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import * as present from "@/lib/present";
import { getConfig, getEvents, getProject } from "@/lib/read";
import type { EventView, ProjectView } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

function AmountAct({ act, label, method, pid, payable }: {
  act: Act | undefined;
  label: string;
  method: "fund_project" | "withdraw_escrow";
  pid: string;
  payable: boolean;
}) {
  const [amount, setAmount] = useState("");
  const wei = present.parseGen(amount);
  const tx = useMemo(() => ({
    kind: "write" as const,
    address: CONTRACT_ADDRESS,
    method,
    args: payable ? [pid] : [pid, (wei ?? 0n).toString()],
  }), [method, pid, payable, wei]);
  if (!act) return null;
  if (!act.available) return <Unavailable label={label} reason={act.reason} />;
  return (
    <div className="grid gap-2">
      <label className="grid gap-2">
        <span className="body-sm font-semibold">{label}</span>
        <input className="input tabular" inputMode="decimal" placeholder="Amount in GEN" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {wei && wei > 0n ? (
        <ActButton key={`${method}.${wei}`} act={act} label={`${label}: ${present.gen(wei)}`} tx={tx}
          value={payable ? wei : undefined} tone="neutral" />
      ) : <span className="body-sm text-iron">{act.reason}</span>}
    </div>
  );
}

function eventLine(e: EventView, p: ProjectView, titles: Map<string, string>): string {
  const who = roleIn(p, e.by);
  const by = who ? present.role(who) : "Someone";
  const on = e.milestone_id ? ` on ${present.prose(titles.get(e.milestone_id) ?? "a milestone")}` : "";
  switch (e.kind) {
    case "ESCROW_FUNDED":
    case "ESCROW_WITHDRAWN":
    case "PROJECT_CANCELLED":
    case "MILESTONE_PAID":
    case "MILESTONE_CLOSED":
      return `${present.eventKind(e.kind)}${on}: ${present.gen(e.detail)}`;
    case "EVIDENCE_FILED":
      return `${by} filed ${present.itemName(e.detail).toLowerCase()}${on}`;
    case "DECISION": {
      const [kind = "", n = "", d = ""] = e.detail.split(" ");
      return `${present.roundName(kind, Number(n))}${on}: ${present.decision(d).toLowerCase()}`;
    }
    case "VERSION_PROPOSED":
    case "VERSION_ACCEPTED":
      return `${present.eventKind(e.kind)}${on}, version ${e.detail}`;
    case "APPEAL_OPENED":
      return `${by} appealed the decision of round ${e.detail}${on}`;
    case "MILESTONE_PROPOSED":
      return `Milestone proposed: ${present.prose(e.detail)}`;
    default:
      return present.eventKind(e.kind);
  }
}

export default function ProjectPage() {
  const { pid } = useParams<{ pid: string }>();
  const { address } = useWallet();
  const now = useNow();
  const read = useChain(`project.${pid}`, async (fresh) => {
    const [project, config] = await Promise.all([getProject(pid, fresh), getConfig()]);
    const events = project ? (await getEvents(pid, 0, 30, fresh)).events : [];
    return { project, config, events };
  });
  const p = read.data ? read.data.project : read.error ? null : undefined;
  const cfg = read.data?.config ?? null;
  const events = read.data?.events ?? null;
  const error = read.error;

  const acts = useMemo(() => (p && address ? projectActs(p, address, cfg) : []), [p, address, cfg]);
  const act = (id: Act["id"]) => acts.find((a) => a.id === id);
  const you = p && address ? roleIn(p, address) : null;

  if (error) {
    return <Band tone="canvas" wide><ReadFailure error={error} onRetry={read.reload} /></Band>;
  }
  if (p === undefined) {
    return <Band tone="canvas" wide><Loading what="the project" /></Band>;
  }
  if (p === null) {
    return (
      <Band tone="canvas" wide>
        <Empty title="No project with that address">
          <p><Link href="/projects" className="link">Open the register</Link> to find one.</p>
        </Empty>
      </Band>
    );
  }

  const parties: [string, string, string | null][] = [
    ["Client", p.client, p.created_at],
    ["Contractor", p.contractor, p.contractor_accepted_at],
    ...(p.inspector ? [["Inspector", p.inspector, p.inspector_accepted_at] as [string, string, string | null]] : []),
  ];
  const titles = new Map(p.milestone_summaries.map((m) => [m.milestone_id, m.title]));

  return (
    <>
      <PageHead
        crumbs={[{ label: "Projects", href: "/projects" }]}
        kicker="Project"
        title={present.prose(p.title)}
        lead={
          <p>
            {present.prose(p.site) || "Site not stated"}
            {you ? `. You are the ${present.roleLower(you)}.` : ""}
          </p>
        }
        status={<Chip tone={toneOfState(p.state)}>{present.projectState(p.state)}</Chip>}
        actions={act("add_milestone")?.available ? (
          <Link href={`/projects/${pid}/milestones/new`} className="btn btn-primary no-underline">Add a milestone</Link>
        ) : null}
        facts={
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-fog pt-8 sm:grid-cols-4">
            <Stat value={<Gen wei={p.escrow_wei} />} label="Held by the contract" />
            <Stat value={<Gen wei={p.reserved_wei} />} label="Reserved by milestones" />
            <Stat value={<Gen wei={p.paid_wei} />} label="Paid to the contractor" />
            <Stat value={p.milestone_summaries.length} label="Milestones" />
          </dl>
        }
      />

      {p.description ? (
        <Band tone="white" wide className="py-0 sm:py-0">
          <p className="max-w-[60ch] whitespace-pre-line text-slate">{present.prose(p.description)}</p>
        </Band>
      ) : null}

      <Band tone="canvas" wide>
        <Section title="Milestones">
          {p.milestone_summaries.length === 0 ? (
            <Empty title="No milestones yet">
              <p>{you === "CLIENT" ? "Add the first one: its payment is reserved from the escrow when you propose it."
                : "The client adds milestones; each reserves its payment from the escrow."}</p>
            </Empty>
          ) : (
            <ul className="grid gap-4">
              {p.milestone_summaries.map((m) => (
                <li key={m.milestone_id}>
                  <Link href={`/milestones/${m.milestone_id}`} className="card block no-underline transition-colors hover:bg-[#fbfbfd]">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="subheading">{present.prose(m.title)}</p>
                        <p className="body-sm mt-1.5 text-slate">
                          {m.current_version ? `Version ${m.current_version} signed` : "Terms not signed yet"}
                          {m.pending_version ? `, version ${m.pending_version} awaiting signature` : ""}
                          {m.rounds_count ? `, ${present.plural(m.rounds_count, "round judged", "rounds judged")}` : ""}
                        </p>
                      </div>
                      <Chip tone={toneOfState(m.state)}>{present.milestoneState(m.state)}</Chip>
                    </div>
                    <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
                      <div>
                        <dt className="caption">Payment</dt>
                        <dd className="body-sm tabular mt-1"><Gen wei={m.payment_wei} /></dd>
                      </div>
                      <div>
                        <dt className="caption">Deadline</dt>
                        <dd className="body-sm mt-1"><When iso={m.deadline} withTime={false} />, {present.relative(m.deadline, now)}</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Band>

      <Band tone="white" wide>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Section title="History" aside={`${present.plural(p.events_count, "recorded event")}, newest first`}>
            {!events ? <Loading what="the history" /> : (
              <ol className="border-l border-fog">
                {events.map((e) => (
                  <li key={e.n} className="relative grid gap-0.5 py-2.5 pl-6">
                    <span aria-hidden className="absolute -left-[4px] top-4 h-2 w-2 rounded-full bg-fog" />
                    <span className="body-sm">{eventLine(e, p, titles)}</span>
                    <span className="caption"><When iso={e.at} /></span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <aside className="grid content-start gap-5">
            <div className="card-quiet">
              <p className="kicker">{you ? `Your part, as the ${present.roleLower(you)}` : "Your part"}</p>
              {you ? (
                <div className="mt-5 grid gap-5">
                  <ActButton act={act("accept_project")} label="Sign the project"
                    tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "accept_project", args: [pid] }} />
                  <ActButton act={act("accept_inspector_role")} label="Accept the inspector role"
                    tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "accept_inspector_role", args: [pid] }} />
                  <AmountAct act={act("fund_project")} label="Add escrow" method="fund_project" pid={pid} payable />
                  <AmountAct act={act("withdraw_escrow")} label="Withdraw free escrow" method="withdraw_escrow" pid={pid} payable={false} />
                  <ActButton act={act("cancel_project")} label="Cancel the project" tone="neutral"
                    tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "cancel_project", args: [pid] }} />
                </div>
              ) : (
                <p className="body-sm mt-3 text-slate">
                  {address ? "You are not a party to this project. The record is open to read." : "Connect a wallet to act if you are a party."}
                </p>
              )}
            </div>

            <div className="card-quiet">
              <p className="kicker">Escrow</p>
              <dl className="mt-4 grid gap-2.5">
                {[
                  ["Funded in total", p.funded_wei],
                  ["Held by the contract", p.escrow_wei],
                  ["Reserved by milestones", p.reserved_wei],
                  ["Free to reserve or withdraw", p.unreserved_wei],
                  ["Paid to the contractor", p.paid_wei],
                  ["Returned to the client", p.returned_wei],
                ].map(([label, wei]) => (
                  <div key={String(label)} className="flex items-baseline justify-between gap-4">
                    <dt className="body-sm text-slate">{label}</dt>
                    <dd className="body-sm tabular"><Gen wei={String(wei)} /></dd>
                  </div>
                ))}
              </dl>
              <p className="body-sm mt-4 border-t border-fog pt-3 text-iron">
                A decision can be contested for {present.duration(p.appeal_window_seconds)} after it is recorded.
              </p>
            </div>

            <div className="card-quiet">
              <p className="kicker">Parties</p>
              <ul className="mt-4 grid gap-3">
                {parties.map(([r, addr, at]) => (
                  <li key={r} className="flex items-baseline justify-between gap-3">
                    <span className="body-sm font-semibold">
                      {r}{address && addr.toLowerCase() === address.toLowerCase() ? ", you" : ""}
                    </span>
                    <span className="body-sm text-right text-iron">
                      {r === "Client" ? <>started <When iso={at} withTime={false} /></>
                        : at ? <>signed <When iso={at} withTime={false} /></> : "has not signed yet"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Fold summary="Addresses, as the contract records them">
                  {parties.map(([r, addr]) => <CopyRow key={r} label={r} value={addr} />)}
                </Fold>
              </div>
            </div>
          </aside>
        </div>
      </Band>
    </>
  );
}
