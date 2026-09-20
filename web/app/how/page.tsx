"use client";

import Link from "next/link";

import { Band, Hero, Section } from "@/components/Page";

const PARTIES = [
  ["Client", "Creates the project, escrows GEN, writes each milestone's terms, may file counter-evidence and appeal an acceptance."],
  ["Contractor", "Signs the project and its terms, files the evidence, requests assessments, may appeal a rejection. Paid only by a finalized acceptance."],
  ["Inspector", "Optional, named by the client and accepted with their own signature. Files the reports the terms require."],
  ["Anyone", "Finalizes, closes and triggers a readjudication when its time comes. No power over any outcome."],
];

const ROUND = [
  ["The contract checks everything code can check", "Roles, states, the deadline, the evidence the terms require. A failure costs no model call."],
  ["Every validator looks at the images itself", "Two per prompt, noting for each criterion whether an image supports it, contradicts it, or does not show it."],
  ["Every validator judges every criterion", "Met, not met or unclear, and whether the evidence conflicts."],
  ["The decision is recorded only if a majority reproduces it", "The same acceptance, or the same criteria found not met. A leader may assert less than a validator would, never withhold a payment it would grant."],
];

const DERIVED = [
  ["Conflict", "Undetermined", "text-teal"],
  ["Any criterion not met", "Rejected", "text-orange"],
  ["Any criterion unclear", "Undetermined", "text-teal"],
  ["All met", "Accepted", "text-green"],
];

export default function How() {
  return (
    <>
      <Hero
        kicker="How it works"
        title={<>One question goes to the <span className="tint-violet">validators</span>. Everything else is code.</>}
        lead={
          <p>
            What the contract decides in plain code, what the panel judges, and what nobody can know from a
            photograph.
          </p>
        }
      />

      <Band tone="canvas" wide>
        <div className="card">
          <p className="kicker">The question the validators answer</p>
          <blockquote className="heading-sm mt-4 max-w-[46ch]">
            Given a milestone&apos;s contractual criteria and the evidence recorded for it, does the evidence
            establish that each criterion is satisfied?
          </blockquote>
          <p className="mt-6 max-w-[70ch] text-slate">
            Everything else is ordinary code: who may act, when, how much is reserved, what is paid. Only the
            judgment of photographs and documents against written criteria goes to GenLayer&apos;s validators,
            because it is the one thing no oracle can answer and no single party should.
          </p>
        </div>
      </Band>

      <Band tone="white" wide>
        <Section title="The parties">
          <dl className="grid gap-5 sm:grid-cols-2">
            {PARTIES.map(([who, what]) => (
              <div key={who} className="card-quiet">
                <dt className="subheading">{who}</dt>
                <dd className="body-sm mt-2 text-slate">{what}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </Band>

      <Band tone="canvas" wide>
        <Section title="Evidence">
          <div className="grid gap-6 lg:grid-cols-2">
            <p className="text-slate">
              Images (photographs, frames from a video, scanned pages) and documents are stored by the contract
              itself and hashed by it when they are filed. Every validator reads those exact bytes; nothing is
              fetched from a website that could change or throttle. Captions, capture dates and places are recorded
              as the submitter&apos;s claims. Each party has its own evidence quota, so no side can use up the
              other&apos;s room.
            </p>
            <p className="text-slate">
              Your browser redraws every image before it is filed, because the network&apos;s model gateway reads
              only two image formats. A video is represented by the frames you pick: the validators cannot watch
              video, and this app does not pretend they can. A declaration is a party&apos;s statement for the
              record: stored, hashed and shown to everyone, but read by no round, because a party&apos;s own word
              can neither establish nor contest a criterion. Argument belongs in an appeal&apos;s reason.
            </p>
          </div>
        </Section>
      </Band>

      <Band tone="white" wide>
        <Section title="A round">
          <ol className="grid gap-px overflow-hidden rounded-[28px] bg-fog sm:grid-cols-2">
            {ROUND.map(([title, text], i) => (
              <li key={title} className="bg-card p-6">
                <p className="kicker tabular">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-3 font-semibold">{title}</p>
                <p className="body-sm mt-2 text-slate">{text}</p>
              </li>
            ))}
          </ol>
          <div className="card-quiet mt-6">
            <p className="kicker">Derived in code</p>
            <dl className="mt-4 grid gap-2 sm:grid-cols-4">
              {DERIVED.map(([condition, outcome, tint]) => (
                <div key={condition} className="flex items-baseline justify-between gap-3 border-t border-fog pt-2 sm:block sm:border-t-0 sm:pt-0">
                  <dt className="body-sm text-slate">{condition}</dt>
                  <dd className={`body-sm font-semibold sm:mt-1 ${tint}`}>{outcome}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>
      </Band>

      <Band tone="canvas" wide>
        <Section title="Appeals and settlement">
          <div className="grid gap-6 lg:grid-cols-2">
            <p className="text-slate">
              The party a decision goes against may appeal once, inside the project&apos;s window. An evidence
              period follows in which every party may file; then anyone can ask the validators to re-judge the
              recorded evidence and everything filed since. The record marks which items were new. An
              appeal&apos;s outcome is final. Nobody can file against a standing acceptance without appealing it,
              so no objection sits unread while money can move.
            </p>
            <p className="text-slate">
              An acceptance is finalized after its window, or at once when an appeal upheld it, and the payment is
              credited to the contractor, who claims it. A milestone never accepted closes after its deadline and
              its reservation returns to the client. If validators cannot agree on an appeal for three days after
              its evidence period, the appeal lapses to undetermined: nothing pays on a decision that was never
              confirmed.
            </p>
          </div>
        </Section>
      </Band>

      <Band tone="white" wide>
        <Section title="What this cannot know">
          <ul className="grid gap-5 sm:grid-cols-3">
            <li className="card-quiet">
              <p className="font-semibold">Where or when a photograph was taken</p>
              <p className="body-sm mt-2 text-slate">
                Metadata is the submitter&apos;s claim. The defences are the client&apos;s window, the
                client&apos;s own evidence, and an inspector.
              </p>
            </li>
            <li className="card-quiet">
              <p className="font-semibold">Whether the work is structurally sound</p>
              <p className="body-sm mt-2 text-slate">
                STRUCTURA settles a contract on evidence. It does not replace a licensed inspection.
              </p>
            </li>
            <li className="card-quiet">
              <p className="font-semibold">How well a model sees</p>
              <p className="body-sm mt-2 text-slate">
                Validators run different model families, and some cannot see images at all. The rules make them
                lose their vote rather than decide, and{" "}
                <Link className="link" href="/verify">the verification page</Link> links the live rounds.
              </p>
            </li>
          </ul>
        </Section>
      </Band>
    </>
  );
}
