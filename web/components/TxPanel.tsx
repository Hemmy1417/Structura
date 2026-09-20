"use client";

/**
 * The write lifecycle, driven by the Transaction Kit's headless flow: price,
 * review, sign, track. "Confirmed" appears only when the transaction reports
 * FINALIZED with a successful execution; an accepted-but-unfinalized write
 * is shown as exactly that, because the network can still walk it back. A
 * refused write shows the contract's own sentence.
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

/** Tell every page that the chain changed, so it reads again. */
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
      <div className="card-quiet hair p-5">
        <p className="body-sm text-slate">Pricing this transaction against the network&apos;s live fees</p>
        <div className="working mt-3 h-[3px] w-full" />
      </div>
    );
  }

  if (state.step === "blocked") {
    return (
      <div className="card-quiet hair p-5">
        <p className="font-semibold text-orange">The fee quote no longer matches the network&apos;s fee policy</p>
        <p className="body-sm mt-1.5 text-slate">Nothing was signed.</p>
        <button type="button" className="btn btn-neutral btn-sm mt-4" onClick={() => flow.reset()}>Price it again</button>
      </div>
    );
  }

  if (state.step === "error") {
    const err = describeError(state.message);
    return (
      <div className="card-quiet hair p-5">
        <p className="font-semibold text-orange">{present.prose(err.title)}</p>
        <p className="body-sm mt-1.5 text-slate">{present.prose(err.detail)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-neutral btn-sm" onClick={() => flow.reset()}>Start over</button>
          {onClose ? <button type="button" className="btn btn-neutral btn-sm" onClick={onClose}>Close</button> : null}
        </div>
      </div>
    );
  }

  if (state.step === "review" || state.step === "signing") {
    const q = state.quote;
    const signing = state.step === "signing";
    return (
      <div className="card-quiet hair p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Review before signing</p>
          {q.verification.status === "verified" ? <span className="caption">Fee policy verified</span> : null}
        </div>
        <dl className="mt-4 grid gap-2">
          {value && value > 0n ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="body-sm text-slate">Sent to the contract</dt>
              <dd className="body-sm tabular">{kitFormatGen(value)} GEN</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="body-sm text-slate">Refundable fee deposit</dt>
            <dd className="body-sm tabular">{q.gasless ? "None" : `${kitFormatGen(q.feeValue)} GEN`}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-fog pt-2">
            <dt className="body-sm font-semibold">Total leaving the wallet</dt>
            <dd className="body-sm tabular font-semibold">{kitFormatGen(q.total)} GEN</dd>
          </div>
        </dl>
        {q.queue?.pendingAhead ? (
          <p className="body-sm mt-3 text-iron">{present.plural(q.queue.pendingAhead, "transaction")} ahead of this wallet.</p>
        ) : null}
        <p className="body-sm mt-1 text-iron">Prices are live, and unused fees are refunded.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={signing} onClick={() => void flow.approve()}>
            {signing ? "Waiting for your wallet" : confirmText}
          </button>
          <button type="button" className="btn btn-neutral btn-sm" disabled={signing} onClick={() => { flow.reset(); onClose?.(); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const phaseIdx = status ? PHASES.indexOf(status.phase as (typeof PHASES)[number]) : -1;
  return (
    <div className="card-quiet hair p-5">
      <ol className="grid gap-2.5">
        {PHASES.map((p, i) => {
          const reached = i < phaseIdx || done;
          const now = i === phaseIdx && !done;
          return (
            <li key={p} className="grid grid-cols-[14px_1fr] items-start gap-3">
              <span aria-hidden className={`mt-1.5 inline-block h-2.5 w-2.5 rounded-full ${
 reached ? "bg-obsidian" : now ? "bg-blue" : "bg-fog"}`} />
              <span className={`body-sm ${reached || now ? "text-obsidian" : "text-iron"}`}>
                {PHASE_TEXT[p]}
                {now && p === "pending" && status?.queuePosition !== undefined ? `, position ${status.queuePosition}` : ""}
                {now && p === "processing" && working ? <span className="block text-iron">{working}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {!done ? <div className="working mt-4 h-[3px] w-full" /> : null}

      {done && status ? (
        <div className="mt-5 border-t border-fog pt-4">
          {succeeded ? (
            <>
              <p className="font-semibold text-green">Confirmed: finalized on chain with a successful execution.</p>
              {hash ? <a className="link body-sm mt-1 inline-block" href={txUrl(hash)} target="_blank" rel="noreferrer">See the transaction</a> : null}
            </>
          ) : finalized ? (
            <>
              <p className="font-semibold text-orange">The contract refused it</p>
              <p className="body-sm mt-1.5 text-slate">{refused ? present.refusal(refused) : "Reading the contract's reason"}</p>
              {hash ? <a className="link body-sm mt-1 inline-block" href={txUrl(hash)} target="_blank" rel="noreferrer">See the transaction</a> : null}
            </>
          ) : (
            <>
              <p className="font-semibold text-teal">Decided, not yet final</p>
              <p className="body-sm mt-1.5 text-slate">
                The validators accepted it. It can still be appealed at network level until it finalizes.
              </p>
            </>
          )}
          {onClose ? <button type="button" className="btn btn-neutral btn-sm mt-4" onClick={onClose}>Close</button> : null}
        </div>
      ) : flow.canCancel ? (
        <button type="button" className="btn btn-neutral btn-sm mt-4" onClick={() => void flow.cancel()}>Cancel while still queued</button>
      ) : null}
    </div>
  );
}
