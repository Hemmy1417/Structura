"use client";

import Link from "next/link";
import { useState } from "react";

import { Empty, Gen, Loading, Mark, ReadFailure, toneOfState } from "@/components/bits";
import { Section, Sheet } from "@/components/Sheet";
import { roleIn } from "@/lib/acts";
import * as present from "@/lib/present";
import { getProject, listProjects, projectsOf } from "@/lib/read";
import type { ProjectView } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

const PAGE = 10;

function counts(p: ProjectView): string {
  const by = new Map<string, number>();
  for (const m of p.milestone_summaries) by.set(m.state, (by.get(m.state) ?? 0) + 1);
  if (!by.size) return "No milestones yet";
  return [...by.entries()].map(([s, n]) => `${n} ${present.milestoneState(s).toLowerCase()}`).join(", ");
}

export default function Register() {
  const { address } = useWallet();
  const [chosenScope, setScope] = useState<"all" | "mine">("all");
  const [skip, setSkip] = useState(0);
  // Without a wallet there is no "mine" to show.
  const scope = address ? chosenScope : "all";

  const read = useChain(`register.${scope}.${address}.${skip}`, async (fresh) => {
    const page = scope === "mine" && address
      ? await projectsOf(address, skip, PAGE, fresh)
      : await listProjects(skip, PAGE, fresh);
    const projects = await Promise.all(page.project_ids.map((id) => getProject(id, fresh)));
    return { total: page.total, rows: projects.filter((p): p is ProjectView => !!p) };
  });
  const total = read.data?.total ?? null;
  const rows = read.data?.rows ?? null;
  const error = read.error;

  return (
    <Sheet
      number="S-01"
      title="Project register"
      lead={<p>Every project on this deployment, newest first. Anyone can read a record; only its parties can act on it.</p>}
      actions={<Link href="/projects/new" className="btn btn-primary">Start a project</Link>}
    >
      <Section
        n={1}
        title={scope === "mine" ? "Projects you are named in" : "All projects"}
        aside={
          address ? (
            <div className="flex overflow-hidden border border-ink text-sm" role="tablist">
              {(["all", "mine"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={scope === s}
                  onClick={() => { setScope(s); setSkip(0); }}
                  className={`px-3 py-1 ${scope === s ? "bg-ink text-sheet" : "hover:bg-paper"}`}
                >
                  {s === "all" ? "All" : "Mine"}
                </button>
              ))}
            </div>
          ) : "Connect a wallet to see your own"
        }
      >
        {error ? <ReadFailure error={error} onRetry={read.reload} /> : !rows ? <Loading what="the register" /> : rows.length === 0 ? (
          <Empty title={scope === "mine" ? "You are not named in any project yet" : "No projects yet"}>
            <p>A project starts when a client escrows a payment and names a contractor.</p>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto border border-ink">
              <table className="schedule min-w-[720px]">
                <thead>
                  <tr>
                    <th className="w-20">Sheet</th>
                    <th>Project</th>
                    <th>Milestones</th>
                    <th className="text-right">Escrow held</th>
                    <th className="text-right">Paid</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const you = address ? roleIn(p, address) : null;
                    return (
                      <tr key={p.project_id} className="hover:bg-paper">
                        <td className="figure text-xs text-ink-3">{present.projectSheet(p.project_id)}</td>
                        <td>
                          <Link href={`/projects/${p.project_id}`} className="font-semibold underline decoration-line underline-offset-4 hover:decoration-ink">
                            {p.title}
                          </Link>
                          <p className="mt-0.5 text-sm text-ink-3">
                            {p.site || "Site not stated"}{you ? `, you are the ${present.roleLower(you)}` : ""}
                          </p>
                        </td>
                        <td className="text-sm text-ink-2">{counts(p)}</td>
                        <td className="text-right"><Gen wei={p.escrow_wei} /></td>
                        <td className="text-right"><Gen wei={p.paid_wei} /></td>
                        <td><Mark tone={toneOfState(p.state)}>{present.projectState(p.state)}</Mark></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {total !== null && total > PAGE ? (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-3">
                  {skip + 1} to {Math.min(skip + PAGE, total)} of {present.plural(total, "project")}
                </span>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-line" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Newer</button>
                  <button type="button" className="btn btn-line" disabled={skip + PAGE >= total} onClick={() => setSkip(skip + PAGE)}>Older</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Section>
    </Sheet>
  );
}
