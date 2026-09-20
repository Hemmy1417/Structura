"use client";

/**
 * Acts. An available act is a button that opens its transaction inline; an
 * unavailable one is a line with the contract's reason in words, never a
 * button that would fail.
 */
import type { SubmitInput } from "@genlayer/transaction-kit";
import { useState } from "react";

import type { Act } from "@/lib/acts";
import { useTransactionKit } from "@/lib/kit";
import { useWallet } from "@/lib/wallet";
import { TxPanel, type TxOutcome } from "./TxPanel";

export function Unavailable({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="grid gap-0.5 border-l-2 border-fog py-1 pl-4">
      <span className="body-sm font-semibold text-iron">{label}</span>
      <span className="body-sm text-iron">{reason}</span>
    </div>
  );
}

/** Wallet readiness as a sentence, or "" when the wallet can sign here. */
export function useSignGate(): string {
  const w = useWallet();
  if (!w.address) return "Connect a wallet to act.";
  if (!w.chainOk) return "Switch the wallet to Studio Next.";
  return "";
}

export function ActButton({ act, label, tx, value, confirm, working, onDone, tone = "primary" }: {
  act: Act | undefined;
  label: string;
  tx: SubmitInput;
  value?: bigint;
  confirm?: string;
  working?: string;
  onDone?: (o: TxOutcome) => void;
  tone?: "primary" | "neutral";
}) {
  const kit = useTransactionKit();
  const gate = useSignGate();
  const [open, setOpen] = useState(false);
  if (!act) return null;
  if (!act.available) return <Unavailable label={label} reason={act.reason} />;
  if (open && kit) {
    return (
      <TxPanel
        kit={kit}
        tx={tx}
        value={value}
        confirmText={confirm ?? label}
        working={working}
        onDone={onDone}
        onClose={() => setOpen(false)}
      />
    );
  }
  return (
    <div className="grid gap-1.5">
      <button type="button" className={`btn btn-${tone} w-full sm:w-auto`} disabled={!!gate} onClick={() => setOpen(true)}>
        {label}
      </button>
      <span className="body-sm text-iron">{gate || act.reason}</span>
    </div>
  );
}
