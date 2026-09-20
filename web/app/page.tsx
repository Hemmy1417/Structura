"use client";

import Link from "next/link";

import { Chip, Empty, Gen, Loading, ReadFailure, Stat, StateChip, When, toneOfState } from "@/components/bits";
import { Band, Hero, Section } from "@/components/Page";
import { workedExample } from "@/lib/acts";
import { FEATURED_PROJECT } from "@/lib/config";
import * as present from "@/lib/present";
import { getProject, getStats, listProjects } from "@/lib/read";
import type { ProjectView } from "@/lib/types";
import { useChain } from "@/lib/useChain";

const SEQUENCE = [
  { n: 1, title: "Terms signed", text: "The client escrows the payment and writes the criteria. The contractor signs them before anything is judged." },
  { n: 2, title: "Evidence filed", text: "Photographs, video frames and documents, stored and hashed by the contract itself." },
  { n: 3, title: "Validators judge", text: "Every validator looks at the evidence and rates each criterion on its own." },
  { n: 4, title: "Contest window", text: "The party a decision goes against may appeal once, and every party may add evidence." },
  { n: 5, title: "Paid or closed", text: "Only a finalized acceptance releases the payment. Anything else returns it to the client." },
];

const DERIVED = [
  ["Evidence contradicts itself", "Undetermined", "text-teal"],
  ["Any criterion not met", "Rejected", "text-orange"],
  ["Any criterion unclear", "Undetermined", "text-teal"],
  ["Every criterion met", "Accepted", "text-green"],
];

export default function Cover() {
  const statsRead = useChain("cover.stats", (fresh) => getStats(fresh));
  const recentRead = useChain("cover.recent", async (fresh) => {
    const page = await listProjects(0, 4, fresh);
    const projects = await Promise.all(page.project_ids.map((id) => getProject(id, fresh)));
    return projects.filter((p): p is ProjectView => !!p);
  });
  const featuredRead = useChain("cover.featured", (fresh) =>
    (FEATURED_PROJECT ? getProject(FEATURED_PROJECT, fresh) : Promise.resolve(null)));
  const stats = statsRead.data;
  const recent = recentRead.data;
  const featured = featuredRead.data ?? null;
  const example = workedExample(featured);
  const error = statsRead.error ?? recentRead.error;
  const retry = () => { statsRead.reload(); recentRead.reload(); featuredRead.reload(); };

  return (
    <>
      <Hero
        kicker="Construction milestone escrow"
        title={<>The payment moves when the <span className="tint-green">evidence</span> says the work is done.</>}
        lead={
          <p>
            A client escrows a milestone. The contractor files the photographs. Validators on GenLayer
            each judge the evidence themselves, and nothing pays until they agree.
          </p>
        }
        actions={
          <>
            <Link href="/projects/new" className="btn btn-primary no-underline">Start a project</Link>
            <Link href="/projects" className="btn btn-neutral no-underline">Open the register</Link>
          </>
        }
      />

      <Band tone="canvas" wide>
        {error ? <ReadFailure error={error} onRetry={retry} /> : !stats ? <Loading what="the figures" /> : (
          <div className="card">
            <p className="kicker">On this deployment, read live from the contract</p>
            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
              <Stat value={stats.projects.toLocaleString("en-US")} label="Projects" />
              <Stat value={stats.milestones.toLocaleString("en-US")} label="Milestones" />
              <Stat value={stats.evidence_items.toLocaleString("en-US")} label="Evidence items" />
              <Stat value={stats.rounds.toLocaleString("en-US")} label="Rounds judged" />
              <Stat value={stats.finalized.toLocaleString("en-US")} label="Milestones paid" />
              <Stat value={<Gen wei={stats.paid_wei} />} label="Paid to contractors" />
            </dl>
          </div>
        )}
      </Band>

      <Band tone="white" wide>
        <h2 className="heading-lg max-w-[18ch]">Five steps, and only one of them is a judgment.</h2>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-[28px] bg-fog sm:grid-cols-2 lg:grid-cols-5">
          {SEQUENCE.map((s) => (
            <li key={s.n} className="bg-card p-6">
              <p className="kicker tabular">{String(s.n).padStart(2, "0")}</p>
              <p className="mt-3 font-semibold">{s.title}</p>
              <p className="body-sm mt-2 text-slate">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="body-sm mt-6 text-iron">
          Nothing moves unless a majority of validators reproduces the decision and the grounds it rests on.
        </p>
      </Band>

      <Band tone="canvas" wide>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h2 className="heading">Why this needs GenLayer.</h2>
            <div className="mt-6 grid gap-4 text-slate">
              <p>
                <span className="font-semibold text-obsidian">The question is a judgment.</span> Do these
                photographs and this inspection report show the footings and ground beams cast in concrete,
                to the approved layout? No price feed or data API can answer that, and one person or service
                answering it is exactly the trusted intermediary an escrow is meant to remove.
              </p>
              <p>
                On GenLayer, every validator reads the same stored bytes and judges them itself. A decision is
                recorded only when a majority reproduces it: the same acceptance, or the same criteria found
                unmet. A node that cannot see the images cannot vote for any decision, a leader that cannot
                see them is replaced, and no leader can withhold an acceptance the others would grant.
              </p>
              <p>
                Code decides everything else: who may act, when, and what moves. Money moves only through the
                contract&apos;s own ledger.
              </p>
            </div>
            <Link href="/how" className="link body-sm mt-6 inline-block">Read how a round works</Link>
          </div>
          <div className="card h-fit">
            <p className="kicker">Derived in code, from the ratings the majority reproduced</p>
            <dl className="mt-5">
              {DERIVED.map(([condition, outcome, tint]) => (
                <div key={String(condition)} className="flex items-baseline justify-between gap-4 border-b border-fog py-3 last:border-b-0">
                  <dt className="body-sm text-slate">{condition}</dt>
                  <dd className={`body-sm font-semibold ${tint}`}>{outcome}</dd>
                </div>
              ))}
            </dl>
            <p className="body-sm mt-5 text-iron">Doubt and conflict never pay.</p>
          </div>
        </div>
      </Band>

      <Band tone="white" wide>
       <div className="grid gap-14">
        {featured && example ? (
          <Section title="A worked example">
            <div className="card grid gap-8 lg:grid-cols-[1.35fr_1fr]">
              <div>
                <p className="kicker">{present.prose(featured.title)}</p>
                <p className="subheading mt-3 max-w-[28ch]">{present.prose(example.title)}</p>
                <p className="body-sm mt-4 max-w-[58ch] text-slate">
                  {example.state === "FINALIZED"
                    ? "The whole path on one record: terms signed, evidence filed and hashed by the contract, every criterion judged, and the payment released."
                    : "The whole path on one record: terms signed, evidence filed and hashed by the contract, and every criterion judged."}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href={`/projects/${featured.project_id}`} className="btn btn-neutral btn-sm no-underline">
                    Open the record
                  </Link>
                  {example.standing ? (
                    <Link
                      href={`/milestones/${example.milestone_id}/rounds/${example.standing.round}`}
                      className="btn btn-neutral btn-sm no-underline"
                    >
                      Read the decision
                    </Link>
                  ) : null}
                </div>
              </div>
              <dl className="grid content-start gap-3">
                <div className="flex items-baseline justify-between gap-4 border-b border-fog py-2">
                  <dt className="caption">Outcome</dt>
                  <dd><StateChip state={example.state} /></dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-fog py-2">
                  <dt className="caption">Payment</dt>
                  <dd className="tabular font-semibold"><Gen wei={example.payment_wei} /></dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-fog py-2">
                  <dt className="caption">Rounds judged</dt>
                  <dd className="tabular font-semibold">{example.rounds_count}</dd>
                </div>
                {example.standing ? (
                  <div className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="caption">Decided</dt>
                    <dd className="body-sm text-slate"><When iso={example.standing.at} withTime={false} /></dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </Section>
        ) : null}
        <Section
          title="Latest projects"
          aside={<Link href="/projects" className="link">See all projects</Link>}
        >
          {error ? null : !recent ? <Loading what="the latest projects" /> : recent.length === 0 ? (
            <Empty title="No projects yet">
              <p>Start one: you become its client, name the contractor, and escrow the first payment.</p>
            </Empty>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {recent.map((p) => (
                <li key={p.project_id}>
                  <Link
                    href={`/projects/${p.project_id}`}
                    className="card-quiet block h-full no-underline transition-colors hover:bg-mist"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="subheading max-w-[24ch]">{present.prose(p.title)}</p>
                      <Chip tone={toneOfState(p.state)}>{present.projectState(p.state)}</Chip>
                    </div>
                    <p className="body-sm mt-2 text-slate">{present.prose(p.site) || "Site not stated"}</p>
                    <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
                      <div>
                        <dt className="caption">Milestones</dt>
                        <dd className="tabular font-semibold">{p.milestone_summaries.length}</dd>
                      </div>
                      <div>
                        <dt className="caption">In escrow</dt>
                        <dd className="tabular font-semibold"><Gen wei={p.escrow_wei} /></dd>
                      </div>
                      <div>
                        <dt className="caption">Paid</dt>
                        <dd className="tabular font-semibold"><Gen wei={p.paid_wei} /></dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="caption mt-8 max-w-[70ch]">
            Demonstration projects on this deployment use a public photo series of one house build in Thailand,
            February 2011, by Khaosaming (Wikimedia Commons, CC BY-SA 3.0). They show how the record works;
            they are not anyone&apos;s real contract.
          </p>
        </Section>
       </div>
      </Band>
    </>
  );
}
