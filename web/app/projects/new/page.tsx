"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { isAddress } from "viem";

import { Field, Notice } from "@/components/bits";
import { Section, Sheet } from "@/components/Sheet";
import { TxPanel, type TxOutcome } from "@/components/TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import * as present from "@/lib/present";
import { returnedJson } from "@/lib/receipt";
import { accountOf, useWallet } from "@/lib/wallet";

const WINDOWS = [
  { seconds: 600, text: "10 minutes (for trying it out)" },
  { seconds: 3600, text: "1 hour" },
  { seconds: 86400, text: "1 day" },
  { seconds: 3 * 86400, text: "3 days" },
  { seconds: 7 * 86400, text: "7 days" },
];

export default function NewProject() {
  const router = useRouter();
  const w = useWallet();
  const kit = useTransactionKit();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [site, setSite] = useState("");
  const [contractor, setContractor] = useState("");
  const [inspector, setInspector] = useState("");
  const [windowSeconds, setWindowSeconds] = useState(3600);
  const [escrow, setEscrow] = useState("");
  const [review, setReview] = useState(false);
  const [outcome, setOutcome] = useState<{ kind: "refused" | "unknown"; text: string } | null>(null);

  const me = accountOf(w.address);
  const problems = useMemo(() => {
    const p: Record<string, string> = {};
    if (!title.trim()) p.title = "A project needs a title.";
    if (!isAddress(contractor.trim())) p.contractor = "Enter the contractor's wallet address.";
    else if (me && accountOf(contractor.trim()) === me) p.contractor = "You cannot be your own contractor.";
    if (inspector.trim()) {
      if (!isAddress(inspector.trim())) p.inspector = "That is not a wallet address.";
      else if ([me, accountOf(contractor.trim())].includes(accountOf(inspector.trim()))) {
        p.inspector = "The inspector must be neither the client nor the contractor.";
      }
    }
    if (escrow.trim() && present.parseGen(escrow) === null) p.escrow = "Enter an amount such as 5 or 0.25.";
    return p;
  }, [title, contractor, inspector, escrow, me]);

  const value = escrow.trim() ? present.parseGen(escrow) ?? 0n : 0n;
  const tx = useMemo(() => ({
    kind: "write" as const,
    address: CONTRACT_ADDRESS,
    method: "create_project",
    args: [JSON.stringify({
      title: title.trim(), description: description.trim(), site: site.trim(),
      contractor: accountOf(contractor.trim()), inspector: inspector.trim() ? accountOf(inspector.trim()) : "",
      appeal_window_seconds: windowSeconds,
    })],
  }), [title, description, site, contractor, inspector, windowSeconds]);

  async function finished(o: TxOutcome) {
    if (!o.successful || !o.hash) return;
    const out = await returnedJson<{ refused: boolean; project_id?: string; reason?: string }>(o.hash).catch(() => null);
    if (out?.refused) setOutcome({ kind: "refused", text: out.reason ?? "" });
    else if (out?.project_id) router.push(`/projects/${out.project_id}`);
    else setOutcome({ kind: "unknown", text: "" });
  }

  const ready = Object.keys(problems).length === 0;

  return (
    <Sheet
      number="S-02"
      title="New project"
      lead={
        <p>
          You become the client. Name the contractor and, if you want an independent attestation, an inspector.
          Each of them accepts with their own signature before anything is judged.
        </p>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form className="grid gap-8" onSubmit={(e) => { e.preventDefault(); if (ready) setReview(true); }}>
          <Section n={1} title="The project">
            <div className="grid gap-4">
              <Field label="Title" error={review ? problems.title : undefined}>
                <input className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Residential building, foundation phase" />
              </Field>
              <Field label="Site" hint="Where the work happens, as the parties will recognise it.">
                <input className="field" value={site} maxLength={200} onChange={(e) => setSite(e.target.value)}
                  placeholder="Plot 14, Canal Road" />
              </Field>
              <Field label="Description" hint="Optional. The milestones carry the contractual terms.">
                <textarea className="field" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section n={2} title="The parties">
            <div className="grid gap-4">
              <Field label="Client" hint="The wallet that signs this project.">
                <input className="field figure" value={me || "Connect a wallet"} disabled />
              </Field>
              <Field label="Contractor's wallet" error={problems.contractor && contractor ? problems.contractor : review ? problems.contractor : undefined}>
                <input className="field figure" value={contractor} onChange={(e) => setContractor(e.target.value)} placeholder="0x…" spellCheck={false} />
              </Field>
              <Field label="Inspector's wallet (optional)" error={problems.inspector}
                hint="An independent party whose report the terms can require.">
                <input className="field figure" value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="0x…" spellCheck={false} />
              </Field>
            </div>
          </Section>

          <Section n={3} title="Money and time">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opening escrow" error={problems.escrow} hint="GEN held by the contract. You can add more later.">
                <input className="field figure" inputMode="decimal" value={escrow} onChange={(e) => setEscrow(e.target.value)} placeholder="5" />
              </Field>
              <Field label="Appeal window" hint="How long the losing side has to contest a decision.">
                <select className="field" value={windowSeconds} onChange={(e) => setWindowSeconds(Number(e.target.value))}>
                  {WINDOWS.map((o) => <option key={o.seconds} value={o.seconds}>{o.text}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {!review ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={!ready || !w.address || !w.chainOk}>
                Review and sign
              </button>
              {!w.address ? <span className="text-sm text-ink-3">Connect a wallet to sign.</span>
                : !w.chainOk ? <span className="text-sm text-ink-3">Switch the wallet to Studio Next.</span> : null}
            </div>
          ) : null}
        </form>

        <aside className="grid content-start gap-4">
          <div className="panel p-4 text-sm">
            <p className="label">What happens next</p>
            <ol className="mt-2 grid gap-2 text-ink-2">
              <li>1. You add milestones: terms, criteria, the evidence each needs, a payment and a deadline.</li>
              <li>2. The contractor signs the project and its terms.</li>
              <li>3. Evidence is filed; validators judge each milestone.</li>
              <li>4. An acceptance pays after your window to contest it.</li>
            </ol>
          </div>
          {review && kit ? (
            <TxPanel
              kit={kit}
              tx={tx}
              value={value}
              confirmText={value > 0n ? `Create and escrow ${present.gen(value)}` : "Create the project"}
              onDone={(o) => void finished(o)}
              onClose={() => setReview(false)}
            />
          ) : review && !kit ? (
            <Notice tone="amber" title="Connect a wallet on Studio Next to sign" />
          ) : null}
          {outcome?.kind === "refused" ? (
            <Notice tone="fail" title="The contract refused the project">
              <p>{present.refusal(outcome.text)}</p>
            </Notice>
          ) : outcome?.kind === "unknown" ? (
            <Notice tone="amber" title="Created, but its number could not be read">
              <p>Open the register; your project is the newest one.</p>
            </Notice>
          ) : null}
        </aside>
      </div>
    </Sheet>
  );
}
