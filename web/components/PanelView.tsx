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

  if (failed) return <p className="body-sm text-iron">The transaction&apos;s receipt could not be read right now.</p>;
  if (!panel) return <div className="working h-[3px] w-1/2" aria-label="Reading the receipt" />;

  return (
    <div className="grid gap-4">
      <p className="body-sm text-slate">
        {present.plural(panel.rotations.length, "leader rotation")}, and the transaction is {panel.status.toLowerCase()}
        {panel.result ? `, ${present.humanize(panel.result).toLowerCase()}` : ""}. Found through {source}.{" "}
        <a className="link" href={txUrl(hash)} target="_blank" rel="noreferrer">Open it on the explorer</a>
      </p>
      {panel.rotations.map((r, i) => (
        <div key={i} className="overflow-hidden rounded-[10px] border border-fog">
          <p className="caption border-b border-fog bg-canvas px-4 py-2">
            Rotation {i + 1}{r.label ? `: ${present.rotationOutcome(r.label)}` : ""}
          </p>
          <ul className="divide-y divide-fog">
            {r.nodes.map((n, j) => (
              <li key={j} className="body-sm grid gap-1 px-4 py-3 sm:grid-cols-[11rem_11rem_1fr]">
                <span className="font-semibold">{n.leader ? "Leader" : `Validator ${j}`}: {n.model}</span>
                <span className={n.vote === "disagree" ? "text-orange" : n.vote === "agree" || n.vote === "proposed" ? "text-green" : "text-iron"}>
                  {VOTE[n.vote] ?? present.humanize(n.vote)}
                </span>
                <span className="text-slate">{present.prose(n.note)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
