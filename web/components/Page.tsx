"use client";

/**
 * The page's structure: full-bleed bands, alternating white and canvas, each
 * holding one left-aligned column. A hero band opens a page; record pages
 * open with a quieter head that carries the trail back up the record.
 */
import Link from "next/link";

export type Tone = "white" | "canvas";

const SURFACE: Record<Tone, string> = { white: "bg-card", canvas: "bg-canvas" };

export function Band({ tone = "white", wide = false, children, id, className = "" }: {
  tone?: Tone;
  /** the full 1180px frame, for card grids; otherwise a 980px reading column */
  wide?: boolean;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={`${SURFACE[tone]} px-5 py-12 sm:py-16 ${className}`}>
      <div className={`mx-auto ${wide ? "max-w-[1180px]" : "max-w-[980px]"}`}>{children}</div>
    </section>
  );
}

export function Crumbs({ items }: { items: { label: string; href: string }[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => (
        <span key={item.href} className="flex items-center gap-1.5">
          {i > 0 ? <span className="caption" aria-hidden>›</span> : null}
          <Link href={item.href} className="caption block max-w-[28ch] truncate no-underline hover:text-obsidian">{item.label}</Link>
        </span>
      ))}
    </nav>
  );
}

/** The opening band of a page a visitor lands on. */
export function Hero({ kicker, title, lead, actions, aside }: {
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="bg-card px-5 pb-14 pt-12 sm:pb-20 sm:pt-16">
      <div className="mx-auto max-w-[1180px]">
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1 className="display mt-3 max-w-[15ch]">{title}</h1>
        {lead ? <div className="mt-5 max-w-[46ch] text-[1.25rem] leading-[1.4] tracking-[-0.019em] text-slate">{lead}</div> : null}
        {actions ? <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div> : null}
        {aside ? <div className="mt-10">{aside}</div> : null}
      </div>
    </section>
  );
}

/** The opening band of one record: a project, a milestone, a decision. */
export function PageHead({ crumbs = [], kicker, title, lead, status, actions, facts }: {
  crumbs?: { label: string; href: string }[];
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  facts?: React.ReactNode;
}) {
  return (
    <section className="bg-card px-5 pb-10 pt-6 sm:pb-12">
      <div className="mx-auto max-w-[1180px]">
        <Crumbs items={crumbs} />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 max-w-[42ch]">
            {kicker ? <p className="kicker">{kicker}</p> : null}
            <h1 className="heading mt-2">{title}</h1>
            {lead ? <div className="mt-3 text-slate">{lead}</div> : null}
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {status}
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
        {facts ? <div className="mt-8">{facts}</div> : null}
      </div>
    </section>
  );
}

/** A heading inside a band, with an optional note on its right. */
export function Section({ title, aside, children, id }: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="heading-sm">{title}</h2>
        {aside ? <div className="body-sm text-iron">{aside}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
