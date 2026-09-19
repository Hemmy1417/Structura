"use client";

/**
 * The panel that decided a round, straight from its transaction receipt:
 * every leader rotation, each node's model and vote, and what the contract
 * printed for it (the leader's reading, a validator's reason to disagree).
 */
import { useEffect, useState } from "react";

import { txUrl } from "@/lib/chain";
import { panelOf, type PanelSummary } from "@/lib/receipt";
import * as present from "@/lib/present";

const VOTE: Record<string, string> = {
  proposed: "Proposed the result",
  agree: "Agreed",
  disagree: "Disagreed",
  idle: "Not needed: the vote had its majority",
  timeout: "Timed out",
};

export function PanelView({ hash, source }: { hash: string; source: string }) {
  const [panel, setPanel] = useState<PanelSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    panelOf(hash).then((p) => alive && setPanel(p)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [hash]);

  if (failed) return <p className="text-sm text-ink-3">The transaction&apos;s receipt could not be read right now.</p>;
  if (!panel) return <div className="working h-[2px] w-1/2" aria-label="Reading the receipt" />;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-2">
        {present.plural(panel.rotations.length, "leader rotation")}; the transaction is {panel.status.toLowerCase()}
        {panel.result ? ` (${present.humanize(panel.result).toLowerCase()})` : ""}. Found through {source}.{" "}
        <a className="underline" href={txUrl(hash)} target="_blank" rel="noreferrer">Open it on the explorer</a>
      </p>
      {panel.rotations.map((r, i) => (
        <div key={i} className="border border-line">
          <p className="label border-b border-line px-3 py-1.5">
            Rotation {i + 1}{r.label ? `: ${present.humanize(r.label).toLowerCase()}` : ""}
          </p>
          <ul className="divide-y divide-line-soft">
            {r.nodes.map((n, j) => (
              <li key={j} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[11rem_12rem_1fr]">
                <span className="font-semibold">{n.leader ? "Leader" : `Validator ${j}`}: {n.model}</span>
                <span className={n.vote === "disagree" ? "text-fail" : n.vote === "agree" || n.vote === "proposed" ? "text-met" : "text-ink-3"}>
                  {VOTE[n.vote] ?? present.humanize(n.vote)}
                </span>
                <span className="text-ink-2">{n.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
