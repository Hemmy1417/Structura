"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ActButton, Unavailable } from "@/components/Acts";
import { Copyable, Empty, Gen, Loading, Mark, ReadFailure, toneOfState, useNow, When } from "@/components/bits";
import { Section, Sheet } from "@/components/Sheet";
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
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">{label}</span>
        <input className="field figure" inputMode="decimal" placeholder="GEN" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {wei && wei > 0n ? (
        <ActButton key={`${method}.${wei}`} act={act} label={`${label}: ${present.gen(wei)}`} tx={tx}
          value={payable ? wei : undefined} tone="line" />
      ) : <span className="text-sm text-ink-3">{act.reason}</span>}
    </div>
  );
}

function eventLine(e: EventView, p: ProjectView): string {
  const who = roleIn(p, e.by);
  const by = who ? present.role(who) : "Someone";
  const m = e.milestone_id ? ` ${present.milestoneSheet(e.milestone_id)}` : "";
  switch (e.kind) {
    case "ESCROW_FUNDED":
    case "ESCROW_WITHDRAWN":
    case "PROJECT_CANCELLED":
    case "MILESTONE_PAID":
    case "MILESTONE_CLOSED":
      return `${present.eventKind(e.kind)}${m}: ${present.gen(e.detail)}`;
    case "EVIDENCE_FILED":
      return `${by} filed ${present.itemName(e.detail).toLowerCase()} on${m}`;
    case "DECISION": {
      const [kind = "", n = "", d = ""] = e.detail.split(" ");
      return `${present.roundKind(kind)} ${n} on${m}: ${present.decision(d).toLowerCase()}`;
    }
    case "VERSION_PROPOSED":
    case "VERSION_ACCEPTED":
      return `${present.eventKind(e.kind)} on${m}, version ${e.detail}`;
    case "APPEAL_OPENED":
      return `${by} appealed the decision of round ${e.detail} on${m}`;
    case "MILESTONE_PROPOSED":
      return `Milestone${m} proposed: ${e.detail}`;
    default:
      return present.eventKind(e.kind);
  }
}

export default function ProjectSheet() {
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

  const sheetNo = present.projectSheet(pid);
  const acts = useMemo(() => (p && address ? projectActs(p, address, cfg) : []), [p, address, cfg]);
  const act = (id: Act["id"]) => acts.find((a) => a.id === id);
  const you = p && address ? roleIn(p, address) : null;

  if (error) {
    return <Sheet number={sheetNo} title="Project"><ReadFailure error={error} onRetry={read.reload} /></Sheet>;
  }
  if (p === undefined) {
    return <Sheet number={sheetNo} title="Project"><Loading what="the project" /></Sheet>;
  }
  if (p === null) {
    return (
      <Sheet number={sheetNo} title="No such project">
        <Empty title="This deployment has no project with that number">
          <p><Link href="/projects" className="underline">Open the register</Link> to find one.</p>
        </Empty>
      </Sheet>
    );
  }

  const parties: [string, string, string | null][] = [
    ["Client", p.client, p.created_at],
    ["Contractor", p.contractor, p.contractor_accepted_at],
    ...(p.inspector ? [["Inspector", p.inspector, p.inspector_accepted_at] as [string, string, string | null]] : []),
  ];

  return (
    <Sheet
      number={sheetNo}
      title={p.title}
      project={p.title}
      revision={`Rev ${p.events_count}`}
      trail={[{ number: sheetNo, title: p.title, href: `/projects/${pid}` }]}
      lead={
        <div className="flex flex-wrap items-center gap-3">
          <Mark tone={toneOfState(p.state)}>{present.projectState(p.state)}</Mark>
          <span>{p.site || "Site not stated"}</span>
          {you ? <span className="text-ink-3">You are the {present.roleLower(you)}.</span> : null}
        </div>
      }
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-10">
          {p.description ? <p className="max-w-3xl whitespace-pre-line text-ink-2">{p.description}</p> : null}

          <Section n={1} title="Milestone schedule"
            aside={act("add_milestone")?.available ? (
              <Link href={`/projects/${pid}/milestones/new`} className="btn btn-primary">Add a milestone</Link>
            ) : null}>
            {p.milestone_summaries.length === 0 ? (
              <Empty title="No milestones yet">
                <p>{you === "CLIENT" ? "Add the first one: its payment is reserved from the escrow when you propose it."
                  : "The client adds milestones; each reserves its payment from the escrow."}</p>
              </Empty>
            ) : (
              <div className="overflow-x-auto border border-ink">
                <table className="schedule min-w-[680px]">
                  <thead>
                    <tr>
                      <th className="w-20">Sheet</th>
                      <th>Milestone</th>
                      <th className="text-right">Payment</th>
                      <th>Deadline</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.milestone_summaries.map((m) => (
                      <tr key={m.milestone_id} className="hover:bg-paper">
                        <td className="figure text-xs text-ink-3">{present.milestoneSheet(m.milestone_id)}</td>
                        <td>
                          <Link href={`/milestones/${m.milestone_id}`} className="font-semibold underline decoration-line underline-offset-4 hover:decoration-ink">
                            {m.title}
                          </Link>
                          <p className="mt-0.5 text-sm text-ink-3">
                            {m.current_version ? `Version ${m.current_version}` : "Not signed yet"}
                            {m.pending_version ? `, version ${m.pending_version} awaiting signature` : ""}
                            {m.rounds_count ? `, ${present.plural(m.rounds_count, "round")}` : ""}
                          </p>
                        </td>
                        <td className="text-right"><Gen wei={m.payment_wei} /></td>
                        <td className="text-sm">
                          <When iso={m.deadline} withTime={false} />
                          <span className="block text-ink-3">{present.relative(m.deadline, now)}</span>
                        </td>
                        <td><Mark tone={toneOfState(m.state)}>{present.milestoneState(m.state)}</Mark></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section n={2} title="History" aside={`${present.plural(p.events_count, "recorded event")}, newest first`}>
            {!events ? <Loading what="the history" /> : (
              <ol className="border-l border-ink">
                {events.map((e) => (
                  <li key={e.n} className="relative grid gap-0.5 py-2 pl-5 text-sm">
                    <span aria-hidden className="absolute -left-[4.5px] top-3.5 h-2 w-2 bg-ink" />
                    <span>{eventLine(e, p)}</span>
                    <span className="text-ink-3"><When iso={e.at} /></span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <aside className="grid content-start gap-5">
          {you ? (
            <div className="cloud p-4">
              <p className="label">Your part, as the {present.roleLower(you)}</p>
              <div className="mt-3 grid gap-4">
                <ActButton act={act("accept_project")} label="Sign the project"
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "accept_project", args: [pid] }} />
                <ActButton act={act("accept_inspector_role")} label="Accept the inspector role"
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "accept_inspector_role", args: [pid] }} />
                <AmountAct act={act("fund_project")} label="Add escrow" method="fund_project" pid={pid} payable />
                <AmountAct act={act("withdraw_escrow")} label="Withdraw free escrow" method="withdraw_escrow" pid={pid} payable={false} />
                <ActButton act={act("cancel_project")} label="Cancel the project" tone="line"
                  tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "cancel_project", args: [pid] }} />
              </div>
            </div>
          ) : (
            <div className="panel p-4 text-sm text-ink-2">
              <p className="label">Your part</p>
              <p className="mt-1">{address ? "You are not a party to this project; the record is open to read." : "Connect a wallet to act if you are a party."}</p>
            </div>
          )}

          <div className="panel">
            <p className="label border-b border-line px-4 py-2">Escrow ledger</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 py-3 text-sm">
              <dt className="text-ink-2">Funded in total</dt><dd className="text-right"><Gen wei={p.funded_wei} /></dd>
              <dt className="text-ink-2">Held by the contract</dt><dd className="text-right font-semibold"><Gen wei={p.escrow_wei} /></dd>
              <dt className="pl-3 text-ink-3">reserved by milestones</dt><dd className="text-right text-ink-2"><Gen wei={p.reserved_wei} /></dd>
              <dt className="pl-3 text-ink-3">free to reserve or withdraw</dt><dd className="text-right text-ink-2"><Gen wei={p.unreserved_wei} /></dd>
              <dt className="text-ink-2">Paid to the contractor</dt><dd className="text-right"><Gen wei={p.paid_wei} /></dd>
              <dt className="text-ink-2">Returned to the client</dt><dd className="text-right"><Gen wei={p.returned_wei} /></dd>
            </dl>
            <p className="border-t border-line px-4 py-2 text-sm text-ink-3">
              Appeal window: {present.duration(p.appeal_window_seconds)}.
            </p>
          </div>

          <div className="panel">
            <p className="label border-b border-line px-4 py-2">Parties, as the contract records them</p>
            <ul className="grid gap-3 px-4 py-3 text-sm">
              {parties.map(([r, addr, at]) => (
                <li key={r}>
                  <p className="font-semibold">{r}{address && addr.toLowerCase() === address.toLowerCase() ? " (you)" : ""}</p>
                  <Copyable value={addr} display={present.shortAddress(addr)} />
                  <p className="text-ink-3">
                    {r === "Client" ? <>Created the project <When iso={at} withTime={false} /></>
                      : at ? <>Accepted <When iso={at} withTime={false} /></> : "Has not accepted yet"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Sheet>
  );
}
