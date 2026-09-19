"use client";

/**
 * Small drawing-set atoms. Status colour appears only in marks and stamps;
 * everything else is graphite on paper.
 */
import { useEffect, useState } from "react";

import * as present from "@/lib/present";

export type Tone = "met" | "fail" | "open" | "amber" | "quiet";

export function toneOfDecision(d: string | null | undefined): Tone {
  if (d === "ACCEPTED" || d === "MET" || d === "FINALIZED" || d === "SUFFICIENT") return "met";
  if (d === "REJECTED" || d === "NOT_MET") return "fail";
  if (d === "UNDETERMINED" || d === "UNCLEAR" || d === "INSUFFICIENT" || d === "CONFLICTING" || d === "APPEALED") return "open";
  return "quiet";
}

export function toneOfState(s: string): Tone {
  switch (s) {
    case "ACCEPTED":
    case "FINALIZED":
      return "met";
    case "REJECTED":
      return "fail";
    case "UNDETERMINED":
    case "APPEALED":
      return "open";
    case "AWAITING_TERMS":
    case "AWAITING_EVIDENCE":
    case "PROPOSED":
      return "amber";
    default:
      return "quiet";
  }
}

const GLYPH: Record<Tone, string> = { met: "●", fail: "■", open: "◆", amber: "▲", quiet: "○" };

export function Mark({ tone, children, glyph = true }: { tone: Tone; children: React.ReactNode; glyph?: boolean }) {
  return (
    <span className={`mark tone-${tone}`}>
      {glyph ? <span aria-hidden className="text-[0.6rem] leading-none">{GLYPH[tone]}</span> : null}
      {children}
    </span>
  );
}

export function Stamp({ decision }: { decision: string }) {
  const tone = toneOfDecision(decision);
  return (
    <span className={`stamp text-lg ${tone === "met" ? "text-met" : tone === "fail" ? "text-fail" : "text-open"}`}>
      {present.decision(decision)}
    </span>
  );
}

export function Callout({ n }: { n: string | number }) {
  return <span className="callout" aria-hidden>{n}</span>;
}

export function Rev({ n }: { n: string | number }) {
  return <span className="rev" aria-label={`revision ${n}`}>{n}</span>;
}

export function Gen({ wei, className = "" }: { wei: string | bigint | number; className?: string }) {
  return <span className={`figure ${className}`}>{present.gen(wei)}</span>;
}

export function When({ iso, withTime = true }: { iso: string | null | undefined; withTime?: boolean }) {
  if (!iso) return null;
  return <time dateTime={iso} className="figure">{withTime ? present.moment(iso) : present.day(iso)}</time>;
}

/** A clock that ticks every `everyMs`, for countdowns and availability. */
export function useNow(everyMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}

export function Notice({ tone = "quiet", title, children }: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const bar = tone === "met" ? "border-met" : tone === "fail" ? "border-fail" : tone === "open" ? "border-open"
    : tone === "amber" ? "border-amber" : "border-line";
  return (
    <div className={`panel border-l-4 ${bar} px-4 py-3 text-sm`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={`${title ? "mt-1 " : ""}text-ink-2`}>{children}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children, error }: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {error ? <span className="mt-1 block text-sm text-fail">{error}</span>
        : hint ? <span className="mt-1 block text-sm text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <div className="panel px-5 py-6">
      <p className="text-sm text-ink-2">Reading {what} from the chain…</p>
      <div className="working mt-3 h-[2px]" />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="panel border-dashed px-5 py-8 text-center">
      <p className="heading">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}

export function ReadFailure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "The chain could not answer.";
  return (
    <Notice tone="fail" title="This sheet could not be read">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-line mt-3" onClick={onRetry}>Read it again</button>
      ) : null}
    </Notice>
  );
}

/** A value with a copy button, for the verification parts of a sheet only. */
export function Copyable({ value, display }: { value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span className="figure truncate text-sm">{display ?? value}</span>
      <button
        type="button"
        className="label shrink-0 underline decoration-line underline-offset-2 hover:text-ink"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}
