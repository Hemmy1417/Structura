"use client";

import Link from "next/link";
import { useState } from "react";

import { Chip, Empty, Gen, Loading, ReadFailure, toneOfState } from "@/components/bits";
import { Band, PageHead } from "@/components/Page";
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
    <>
      <PageHead
        kicker="The register"
        title="Every project on this deployment."
        lead={<p>Newest first. Anyone can read a record; only its parties can act on one.</p>}
        actions={<Link href="/projects/new" className="btn btn-primary no-underline">Start a project</Link>}
      />

      <Band tone="canvas" wide>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="heading-sm">{scope === "mine" ? "Projects you are named in" : "All projects"}</h2>
          {address ? (
            <div className="flex gap-2" role="tablist" aria-label="Which projects to show">
              {(["all", "mine"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={scope === s}
                  onClick={() => { setScope(s); setSkip(0); }}
                  className={`btn btn-sm ${scope === s ? "btn-primary" : "btn-neutral"}`}
                >
                  {s === "all" ? "All projects" : "Mine"}
                </button>
              ))}
            </div>
          ) : (
            <p className="body-sm text-iron">Connect a wallet to see the projects you are named in.</p>
          )}
        </div>

        <div className="mt-8">
          {error ? <ReadFailure error={error} onRetry={read.reload} /> : !rows ? <Loading what="the register" /> : rows.length === 0 ? (
            <Empty title={scope === "mine" ? "You are not named in any project yet" : "No projects yet"}>
              <p>A project starts when a client escrows a payment and names a contractor.</p>
            </Empty>
          ) : (
            <>
              <ul className="grid gap-4">
                {rows.map((p) => {
                  const you = address ? roleIn(p, address) : null;
                  return (
                    <li key={p.project_id}>
                      <Link
                        href={`/projects/${p.project_id}`}
                        className="card block no-underline transition-colors hover:bg-[#fbfbfd]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="subheading">{present.prose(p.title)}</p>
                            <p className="body-sm mt-1.5 text-slate">
                              {present.prose(p.site) || "Site not stated"}
                              {you ? `, you are the ${present.roleLower(you)}` : ""}
                            </p>
                          </div>
                          <Chip tone={toneOfState(p.state)}>{present.projectState(p.state)}</Chip>
                        </div>
                        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
                          <div>
                            <dt className="caption">Milestones</dt>
                            <dd className="body-sm mt-1">{counts(p)}</dd>
                          </div>
                          <div>
                            <dt className="caption">In escrow</dt>
                            <dd className="body-sm tabular mt-1"><Gen wei={p.escrow_wei} /></dd>
                          </div>
                          <div>
                            <dt className="caption">Paid to the contractor</dt>
                            <dd className="body-sm tabular mt-1"><Gen wei={p.paid_wei} /></dd>
                          </div>
                        </dl>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {total !== null && total > PAGE ? (
                <div className="mt-8 flex items-center justify-between gap-3">
                  <span className="body-sm text-iron">
                    {skip + 1} to {Math.min(skip + PAGE, total)} of {present.plural(total, "project")}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-neutral btn-sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Newer</button>
                    <button type="button" className="btn btn-neutral btn-sm" disabled={skip + PAGE >= total} onClick={() => setSkip(skip + PAGE)}>Older</button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Band>
    </>
  );
}
