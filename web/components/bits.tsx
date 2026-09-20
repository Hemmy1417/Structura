"use client";

/**
 * The small pieces. Colour appears in two places only: one blue pill for the
 * action a person is meant to take, and an outlined chip for a decision.
 * Machine values (addresses, digests, identifiers) appear only inside a
 * disclosure, so no page reads like a database dump.
 */
import { useEffect, useState } from "react";

import * as present from "@/lib/present";

export type Tone = "green" | "orange" | "teal" | "violet" | "blue" | "quiet";

const TEXT: Record<Tone, string> = {
  green: "text-green",
  orange: "text-orange",
  teal: "text-teal",
  violet: "text-violet",
  blue: "text-link",
  quiet: "text-iron",
};

export function toneOfDecision(d: string | null | undefined): Tone {
  if (d === "ACCEPTED" || d === "MET" || d === "FINALIZED" || d === "SUFFICIENT") return "green";
  if (d === "REJECTED" || d === "NOT_MET") return "orange";
  if (d === "UNDETERMINED" || d === "UNCLEAR" || d === "INSUFFICIENT" || d === "CONFLICTING") return "teal";
  if (d === "APPEALED") return "violet";
  return "quiet";
}

export function toneOfState(s: string): Tone {
  switch (s) {
    case "ACCEPTED":
    case "FINALIZED":
      return "green";
    case "REJECTED":
      return "orange";
    case "UNDETERMINED":
      return "teal";
    case "APPEALED":
      return "violet";
    case "AWAITING_TERMS":
    case "AWAITING_EVIDENCE":
    case "PROPOSED":
      return "blue";
    default:
      return "quiet";
  }
}

const DOT: Record<Tone, string> = {
  green: "bg-green",
  orange: "bg-orange",
  teal: "bg-teal",
  violet: "bg-violet",
  blue: "bg-link",
  quiet: "bg-iron",
};

export function Chip({ tone, children, dot = true }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={`chip ${TEXT[tone]}`}>
      {dot ? <span aria-hidden className={`h-[6px] w-[6px] rounded-full ${DOT[tone]}`} /> : null}
      {children}
    </span>
  );
}

export function DecisionChip({ decision }: { decision: string }) {
  return <Chip tone={toneOfDecision(decision)}>{present.decision(decision)}</Chip>;
}

export function StateChip({ state }: { state: string }) {
  return <Chip tone={toneOfState(state)}>{present.milestoneState(state)}</Chip>;
}

/** A decision at the size of a headline, for the top of a certificate. */
export function DecisionMark({ decision }: { decision: string }) {
  const tone = toneOfDecision(decision);
  return <p className={`heading-sm ${TEXT[tone]}`}>{present.decision(decision)}</p>;
}

export function Gen({ wei, className = "" }: { wei: string | bigint | number; className?: string }) {
  return <span className={`tabular ${className}`}>{present.gen(wei)}</span>;
}

export function When({ iso, withTime = true }: { iso: string | null | undefined; withTime?: boolean }) {
  if (!iso) return null;
  return <time dateTime={iso} className="tabular">{withTime ? present.moment(iso) : present.day(iso)}</time>;
}

/** One large number with its label, for a band of live figures. */
export function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: Tone }) {
  return (
    <div>
      <p className={`figure ${tone ? TEXT[tone] : ""}`}>{value}</p>
      <p className="caption mt-2">{label}</p>
    </div>
  );
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
  return (
    <div className="card-quiet hair p-5">
      {title ? <p className={`font-semibold ${tone === "quiet" ? "" : TEXT[tone]}`}>{title}</p> : null}
      {children ? <div className={`${title ? "mt-1.5 " : ""}body-sm text-slate`}>{children}</div> : null}
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
      <span className="body-sm font-semibold">{label}</span>
      <span className="mt-2 block">{children}</span>
      {error ? <span className="body-sm mt-1.5 block text-orange">{error}</span>
        : hint ? <span className="body-sm mt-1.5 block text-iron">{hint}</span> : null}
    </label>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <div className="card-quiet p-6">
      <p className="body-sm text-slate">Reading {what} from the chain</p>
      <div className="working mt-3 h-[3px] w-full" />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card-quiet hair p-8 text-center">
      <p className="subheading">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md body-sm text-slate">{children}</div> : null}
    </div>
  );
}

export function ReadFailure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? present.prose(error.message) : "The chain could not answer.";
  return (
    <Notice tone="orange" title="This could not be read from the chain">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-neutral btn-sm mt-4" onClick={onRetry}>Try again</button>
      ) : null}
    </Notice>
  );
}

/**
 * A disclosure: the pill that opens into the technical detail of a record.
 * Everything a machine wrote belongs in here.
 */
export function Fold({ summary, children, id }: { summary: string; children: React.ReactNode; id?: string }) {
  return (
    <details className="fold" id={id}>
      <summary>{summary}</summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

/** One machine value inside a disclosure, with a copy button. */
export function CopyRow({ label, value, display, href }: {
  label: string;
  value: string;
  display?: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[12rem_1fr] sm:items-baseline">
      <p className="caption">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="tabular min-w-0 break-all text-[13px] text-slate">{display ?? value}</span>
        <button
          type="button"
          className="caption underline decoration-fog underline-offset-2 hover:text-obsidian"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {href ? <a className="caption link" href={href} target="_blank" rel="noreferrer">Open</a> : null}
      </div>
    </div>
  );
}
