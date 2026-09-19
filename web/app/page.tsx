"use client";

import Link from "next/link";

import { Empty, Gen, Loading, Mark, ReadFailure, toneOfState } from "@/components/bits";
import { Section, Sheet } from "@/components/Sheet";
import * as present from "@/lib/present";
import { getProject, getStats, listProjects } from "@/lib/read";
import type { ProjectView } from "@/lib/types";
import { useChain } from "@/lib/useChain";

const SEQUENCE = [
  { n: 1, title: "Terms signed", text: "The client escrows the payment and writes the criteria; the contractor signs them." },
  { n: 2, title: "Evidence filed", text: "Photographs, video frames and documents, stored and hashed by the contract." },
  { n: 3, title: "Validators judge", text: "Each validator looks at the evidence itself and rates every criterion." },
  { n: 4, title: "Contest window", text: "The party a decision goes against may appeal once, with new evidence." },
  { n: 5, title: "Paid or closed", text: "Only a finalized acceptance releases the payment; anything else returns it." },
];

export default function Cover() {
  const statsRead = useChain("cover.stats", (fresh) => getStats(fresh));
  const recentRead = useChain("cover.recent", async (fresh) => {
    const page = await listProjects(0, 4, fresh);
    const projects = await Promise.all(page.project_ids.map((id) => getProject(id, fresh)));
    return projects.filter((p): p is ProjectView => !!p);
  });
  const stats = statsRead.data;
  const recent = recentRead.data;
  const error = statsRead.error ?? recentRead.error;
  const retry = () => { statsRead.reload(); recentRead.reload(); };

  return (
    <Sheet
      number="S-00"
      title="Construction milestone escrow, judged from the evidence"
      lead={
        <p>
          A client escrows a milestone&apos;s payment. The contractor files photographs and documents.
          Validators on GenLayer each look at the evidence themselves and judge every criterion in the
          contract, and the payment moves only when they agree the work is done and the client&apos;s
          window to contest it has passed.
        </p>
      }
      actions={
        <>
          <Link href="/projects/new" className="btn btn-primary">Start a project</Link>
          <Link href="/projects" className="btn btn-line">Open the register</Link>
        </>
      }
    >
      <div className="grid gap-10">
        <Section n={1} title="On this deployment" aside="Read live from the contract">
          {error ? <ReadFailure error={error} onRetry={retry} /> : !stats ? <Loading what="the figures" /> : (
            <dl className="grid grid-cols-2 border border-ink sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Projects", stats.projects],
                ["Milestones", stats.milestones],
                ["Evidence items", stats.evidence_items],
                ["Rounds judged", stats.rounds],
                ["Milestones paid", stats.finalized],
              ].map(([k, v]) => (
                <div key={String(k)} className="border-b border-r border-line px-4 py-3 last:border-r-0">
                  <dt className="label">{k}</dt>
                  <dd className="figure mt-1 text-2xl">{Number(v).toLocaleString("en-US")}</dd>
                </div>
              ))}
              <div className="border-b border-line px-4 py-3">
                <dt className="label">Paid to contractors</dt>
                <dd className="mt-1 text-2xl"><Gen wei={stats.paid_wei} /></dd>
              </div>
            </dl>
          )}
        </Section>

        <Section n={2} title="The sequence" aside="Section through one milestone">
          <ol className="grid gap-0 border border-ink md:grid-cols-5">
            {SEQUENCE.map((s) => (
              <li key={s.n} className="relative border-b border-line p-4 md:border-b-0 md:border-r md:last:border-r-0">
                <div className="flex items-center gap-2.5">
                  <span className="callout">{s.n}</span>
                  <span className="font-semibold">{s.title}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-3">
            <span className="h-2 w-8 bg-ink" aria-hidden />
            <span>The beam: nothing moves unless a majority of validators reproduces the decision and its grounds.</span>
          </div>
        </Section>

        <Section n={3} title="Why this needs GenLayer">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="prose-sheet max-w-2xl text-[0.98rem] leading-relaxed text-ink-2">
              <p>
                <span className="font-semibold text-ink">The question is a judgment.</span> Do these photographs and
                this inspection report show the footings and ground beams cast in concrete, to the approved layout?
                No price feed or data API can answer that, and one person or service answering it is exactly the
                trusted intermediary an escrow is meant to remove.
              </p>
              <p>
                On GenLayer, the leading validator and every other validator run the same reading of the same stored
                bytes. A decision is recorded only when a majority reproduces it: the same acceptance, or the same
                criteria found unmet. A node that cannot see the images cannot vote for any decision, a leader
                that cannot see them is replaced, and a leader cannot withhold an acceptance the others would grant.
              </p>
              <p>
                Code decides everything else: who may act, when, and what moves. Money moves only through the
                contract&apos;s own ledger.
              </p>
            </div>
            <div className="panel p-4 text-sm">
              <p className="label">Decided in code, from the ratings the majority reproduced</p>
              <table className="schedule mt-2">
                <tbody>
                  <tr><td>Evidence contradicts itself</td><td><Mark tone="open">Undetermined</Mark></td></tr>
                  <tr><td>Any criterion not met</td><td><Mark tone="fail">Rejected</Mark></td></tr>
                  <tr><td>Any criterion unclear</td><td><Mark tone="open">Undetermined</Mark></td></tr>
                  <tr><td>Every criterion met</td><td><Mark tone="met">Accepted</Mark></td></tr>
                </tbody>
              </table>
              <p className="mt-3 text-ink-3">Doubt and conflict never pay.</p>
            </div>
          </div>
        </Section>

        <Section n={4} title="Latest projects" aside={<Link href="/projects" className="underline">All projects</Link>}>
          {error ? null : !recent ? <Loading what="the latest projects" /> : recent.length === 0 ? (
            <Empty title="No projects yet">
              <p>Start one: you become its client, name the contractor, and escrow the first payment.</p>
            </Empty>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {recent.map((p) => (
                <li key={p.project_id}>
                  <Link href={`/projects/${p.project_id}`} className="panel block p-4 no-underline hover:border-ink">
                    <div className="flex items-start justify-between gap-3">
                      <p className="figure text-xs text-ink-3">{present.projectSheet(p.project_id)}</p>
                      <Mark tone={toneOfState(p.state)}>{present.projectState(p.state)}</Mark>
                    </div>
                    <p className="heading mt-1">{p.title}</p>
                    <p className="mt-1 text-sm text-ink-2">{p.site || "Site not stated"}</p>
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
                      <span>{present.plural(p.milestone_summaries.length, "milestone")}</span>
                      <span>Escrow <Gen wei={p.escrow_wei} /></span>
                      <span>Paid <Gen wei={p.paid_wei} /></span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-ink-3">
            Demonstration projects on this deployment use a public photo series of one house build in Thailand,
            February 2011, by Khaosaming (Wikimedia Commons, CC BY-SA 3.0). They show how the record works;
            they are not anyone&apos;s real contract.
          </p>
        </Section>
      </div>
    </Sheet>
  );
}
