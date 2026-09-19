"use client";

/**
 * The write lifecycle in the drawing set's own language, driven by the
 * Transaction Kit's headless flow: price, review, sign, track. "Confirmed"
 * appears only when the transaction reports FINALIZED with a successful
 * execution; an accepted-but-unfinalized write is shown as exactly that,
 * because the network can still walk it back. A refused write shows the
 * contract's own sentence.
 */
import {
  describeError,
  formatGen as kitFormatGen,
  useTransactionFlow,
  type SubmitInput,
  type TransactionKit,
} from "@genlayer/transaction-kit-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { txUrl } from "@/lib/chain";
import { refusalOf } from "@/lib/receipt";
import * as present from "@/lib/present";

const PHASES = ["submitted", "pending", "processing", "decided", "finalized"] as const;
const PHASE_TEXT: Record<(typeof PHASES)[number], string> = {
  submitted: "Signed and submitted",
  pending: "Waiting in the queue",
  processing: "Validators are executing it",
  decided: "Decided by the validators",
  finalized: "Finalized on chain",
};

export interface TxOutcome {
  successful: boolean;
  hash: string | null;
}

/** Tell every sheet that the chain changed, so it reads again. */
export function announceChange(): void {
  window.dispatchEvent(new Event("structura:changed"));
}

export function useOnChange(fn: () => void): void {
  const onChange = useEffectEvent(fn);
  useEffect(() => {
    const h = () => onChange();
    window.addEventListener("structura:changed", h);
    return () => window.removeEventListener("structura:changed", h);
  }, []);
}

/**
 * One panel is one review of one transaction: the transaction and its
 * value are frozen when the panel opens, so a re-render can neither
 * re-price the quote mid-review nor change what gets signed.
 */
export function TxPanel({ kit, tx: txProp, value: valueProp, confirmText, working, onDone, onClose }: {
  kit: TransactionKit;
  tx: SubmitInput;
  value?: bigint;
  confirmText: string;
  /** what the validators are doing while it runs, for long rounds */
  working?: string;
  onDone?: (outcome: TxOutcome) => void;
  onClose?: () => void;
}) {
  const [tx] = useState(txProp);
  const [value] = useState(valueProp);
  const flow = useTransactionFlow({ kit, tx, userValue: value, trackUntil: "finalized" });
  const { state } = flow;
  const fired = useRef(false);
  const [refused, setRefused] = useState<string | null>(null);

  const status = state.step === "tracking" || state.step === "done" ? state.status : null;
  const hash = status?.genlayerTxId ?? null;
  const done = state.step === "done";
  const finalized = status?.phase === "finalized";
  const succeeded = done && finalized && status?.successful !== false;

  useEffect(() => {
    if (!done || fired.current) return;
    fired.current = true;
    if (status?.successful === false && hash) {
      void refusalOf(hash).then(setRefused).catch(() => setRefused(null));
    }
    if (succeeded) announceChange();
    onDone?.({ successful: succeeded, hash });
  }, [done, succeeded, status, hash, onDone]);

  if (state.step === "estimating") {
    return (
      <div className="panel px-4 py-3">
        <p className="text-sm text-ink-2">Pricing the transaction against the network&apos;s live fees…</p>
        <div className="working mt-2 h-[2px]" />
      </div>
    );
  }

  if (state.step === "blocked") {
    return (
      <div className="panel border-l-4 border-amber px-4 py-3 text-sm">
        <p className="font-semibold">The fee quote no longer matches the network&apos;s fee policy</p>
        <p className="mt-1 text-ink-2">Nothing was signed.</p>
        <button type="button" className="btn btn-line mt-3" onClick={() => flow.reset()}>Price it again</button>
      </div>
    );
  }

  if (state.step === "error") {
    const err = describeError(state.message);
    return (
      <div className="panel border-l-4 border-fail px-4 py-3 text-sm">
        <p className="font-semibold">{err.title}</p>
        <p className="mt-1 text-ink-2">{err.detail}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn btn-line" onClick={() => flow.reset()}>Start over</button>
          {onClose ? <button type="button" className="btn btn-quiet" onClick={onClose}>Close</button> : null}
        </div>
      </div>
    );
  }

  if (state.step === "review" || state.step === "signing") {
    const q = state.quote;
    const signing = state.step === "signing";
    return (
      <div className="panel px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Review before signing</p>
          {q.verification.status === "verified" ? <span className="label">fee policy verified</span> : null}
        </div>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          {value && value > 0n ? (
            <>
              <dt className="text-ink-2">Sent to the contract</dt>
              <dd className="figure text-right">{kitFormatGen(value)} GEN</dd>
            </>
          ) : null}
          <dt className="text-ink-2">Refundable fee deposit</dt>
          <dd className="figure text-right">{q.gasless ? "None" : `${kitFormatGen(q.feeValue)} GEN`}</dd>
          <dt className="text-ink-2">Total leaving the wallet</dt>
          <dd className="figure text-right font-semibold">{kitFormatGen(q.total)} GEN</dd>
        </dl>
        {q.queue?.pendingAhead ? (
          <p className="mt-2 text-sm text-ink-3">{present.plural(q.queue.pendingAhead, "transaction")} ahead of this wallet.</p>
        ) : null}
        <p className="mt-2 text-sm text-ink-3">Prices are live; unused fees are refunded.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={signing} onClick={() => void flow.approve()}>
            {signing ? "Waiting for your wallet…" : confirmText}
          </button>
          <button type="button" className="btn btn-quiet" disabled={signing} onClick={() => { flow.reset(); onClose?.(); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const phaseIdx = status ? PHASES.indexOf(status.phase as (typeof PHASES)[number]) : -1;
  return (
    <div className="panel px-4 py-4">
      <ol className="grid gap-2">
        {PHASES.map((p, i) => {
          const reached = i < phaseIdx || done;
          const now = i === phaseIdx && !done;
          return (
            <li key={p} className="grid grid-cols-[1.25rem_1fr] items-start gap-2 text-sm">
              <span aria-hidden className={`mt-1 inline-block h-3 w-3 border ${
                reached ? "border-ink bg-ink" : now ? "border-amber bg-amber" : "border-line bg-sheet"}`} />
              <span className={reached || now ? "text-ink" : "text-ink-3"}>
                {PHASE_TEXT[p]}
                {now && p === "pending" && status?.queuePosition !== undefined ? `, position ${status.queuePosition}` : ""}
                {now && p === "processing" && working ? <span className="block text-ink-3">{working}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {!done ? <div className="working mt-3 h-[2px]" /> : null}

      {done && status ? (
        <div className="mt-4 text-sm">
          {succeeded ? (
            <div className="border-l-4 border-met pl-3">
              <p className="font-semibold">Confirmed: finalized on chain with a successful execution.</p>
              {hash ? <a className="text-ink-2 underline" href={txUrl(hash)} target="_blank" rel="noreferrer">See the transaction</a> : null}
            </div>
          ) : finalized ? (
            <div className="border-l-4 border-fail pl-3">
              <p className="font-semibold">The contract refused it</p>
              <p className="mt-1 text-ink-2">{refused ? present.refusal(refused) : "Reading the contract's reason…"}</p>
              {hash ? <a className="text-ink-2 underline" href={txUrl(hash)} target="_blank" rel="noreferrer">See the transaction</a> : null}
            </div>
          ) : (
            <div className="border-l-4 border-amber pl-3">
              <p className="font-semibold">Decided, not yet final</p>
              <p className="mt-1 text-ink-2">The validators accepted it; it can still be appealed at network level until it finalizes.</p>
            </div>
          )}
          {onClose ? <button type="button" className="btn btn-line mt-3" onClick={onClose}>Close</button> : null}
        </div>
      ) : flow.canCancel ? (
        <button type="button" className="btn btn-quiet mt-2" onClick={() => void flow.cancel()}>Cancel while still queued</button>
      ) : null}
    </div>
  );
}
