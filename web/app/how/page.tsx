"use client";

import Link from "next/link";

import { Mark } from "@/components/bits";
import { Section, Sheet } from "@/components/Sheet";

export default function How() {
  return (
    <Sheet
      number="S-03"
      title="How it works"
      lead={<p>What the contract decides in code, what the validators judge, and what nobody can know from a photograph.</p>}
    >
      <div className="grid max-w-4xl gap-10 text-[0.98rem] leading-relaxed">
        <Section n={1} title="The question the validators answer">
          <blockquote className="border-l-4 border-amber pl-4 text-lg">
            Given a milestone&apos;s contractual criteria and the evidence recorded for it, does the evidence establish
            that each criterion is satisfied?
          </blockquote>
          <p className="mt-4 text-ink-2">
            Everything else is ordinary code: who may act, when, how much is reserved, what is paid. Only the judgment
            of photographs and documents against written criteria goes to GenLayer&apos;s validators, because it is the
            one thing no oracle can answer and no single party should.
          </p>
        </Section>

        <Section n={2} title="The parties">
          <table className="schedule">
            <tbody>
              <tr><td className="w-36 font-semibold">Client</td><td className="text-ink-2">Creates the project, escrows GEN, writes each milestone&apos;s terms, may file counter-evidence and appeal an acceptance.</td></tr>
              <tr><td className="font-semibold">Contractor</td><td className="text-ink-2">Signs the project and its terms, files the evidence, requests assessments, may appeal a rejection. Paid only by a finalized acceptance.</td></tr>
              <tr><td className="font-semibold">Inspector</td><td className="text-ink-2">Optional, named by the client and accepted by the contractor. Files reports the terms can require.</td></tr>
              <tr><td className="font-semibold">Anyone</td><td className="text-ink-2">Finalizes, closes and triggers readjudication when their time comes. No power over any outcome.</td></tr>
            </tbody>
          </table>
        </Section>

        <Section n={3} title="Evidence">
          <p className="text-ink-2">
            Images (photographs, frames from a video, scanned pages) and documents are stored by the contract itself and
            hashed by the contract when they are filed. Every validator reads those exact bytes; nothing is fetched from
            a website that could change or throttle. Captions, capture dates and places are recorded as the submitter&apos;s
            claims. Each party has its own evidence quota, so no side can use up the other&apos;s room.
          </p>
          <p className="mt-3 text-ink-2">
            Your browser redraws every image before it is filed, because the network&apos;s model gateway reads only PNG and
            one kind of JPEG. A video is represented by the frames you pick: the validators cannot watch video, and this
            app does not pretend they can. A declaration is a party&apos;s statement for the record: stored, hashed and
            shown to everyone, but read by no round, because a party&apos;s own word can neither establish nor contest a
            criterion. Argument belongs in an appeal&apos;s reason.
          </p>
        </Section>

        <Section n={4} title="A round">
          <ol className="grid gap-3 text-ink-2">
            <li><span className="font-semibold text-ink">1. The contract checks everything code can check:</span> roles, states, the deadline, the evidence the terms require. A failure costs no model call.</li>
            <li><span className="font-semibold text-ink">2. Every validator looks at the images itself,</span> two per prompt, and notes for each criterion whether an image supports it, contradicts it or does not show it.</li>
            <li><span className="font-semibold text-ink">3. Every validator judges every criterion:</span> met, not met or unclear, and whether the evidence conflicts.</li>
            <li><span className="font-semibold text-ink">4. The decision is recorded only if a majority reproduces it:</span> the same acceptance, or the same criteria found not met. A leader may assert less than a validator would, never withhold a payment it would grant.</li>
          </ol>
          <div className="mt-4 panel p-4">
            <p className="label mb-2">Derived in code</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Mark tone="open">Conflict: undetermined</Mark>
              <Mark tone="fail">Any not met: rejected</Mark>
              <Mark tone="open">Any unclear: undetermined</Mark>
              <Mark tone="met">All met: accepted</Mark>
            </div>
          </div>
        </Section>

        <Section n={5} title="Appeals and settlement">
          <p className="text-ink-2">
            The party a decision goes against may appeal once, inside the project&apos;s window. An evidence period
            follows in which every party may file; then anyone can ask the validators to re-judge the recorded evidence
            and everything filed since. The certificate marks which items were new. An appeal&apos;s outcome is final.
            Nobody can file against a standing acceptance without appealing it, so no objection sits unread while money
            can move.
          </p>
          <p className="mt-3 text-ink-2">
            An acceptance is finalized after its window, or at once when an appeal upheld it, and the payment is
            credited to the contractor, who claims it. A milestone never accepted closes after its deadline and its
            reservation returns to the client. If validators cannot agree on an appeal for three days after its evidence
            period, the appeal lapses to undetermined: nothing pays on a decision that was never confirmed.
          </p>
        </Section>

        <Section n={6} title="What this cannot know">
          <ul className="grid gap-2 text-ink-2">
            <li>Where or when a photograph was taken. Metadata is the submitter&apos;s claim; the defences are the client&apos;s window, the client&apos;s own evidence and an inspector.</li>
            <li>Whether work is structurally sound. STRUCTURA settles a contract on evidence; it does not replace a licensed inspection.</li>
            <li>How well a model sees. Validators run different model families; some cannot see images at all. The rules make them lose their vote rather than decide, and <Link className="underline" href="/verify">the verification sheet</Link> links the live rounds.</li>
          </ul>
        </Section>
      </div>
    </Sheet>
  );
}
