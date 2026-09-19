"use client";

/**
 * One sheet of the drawing set: a heading row with the sheet's detail
 * callout, the drawing area, and the title block along the bottom edge,
 * the way every construction drawing carries its project, sheet number and
 * revision.
 */
import { useSyncExternalStore } from "react";

import * as present from "@/lib/present";
import { Logo, useTrail, type TrailEntry } from "./Shell";

const noSubscription = () => () => {};
const todayUtc = () => present.day(new Date().toISOString());

export function Sheet({
  number, title, project, revision, lead, trail = [], actions, children,
}: {
  number: string;
  title: string;
  /** what the title block's project cell says */
  project?: string;
  /** a revision figure: how many recorded events this record has */
  revision?: string;
  lead?: React.ReactNode;
  trail?: TrailEntry[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  useTrail(trail);
  // The printing date is the reader's today: rendered on the client only, so
  // a server render never disagrees with the browser about the date.
  const today = useSyncExternalStore(noSubscription, todayUtc, () => "");

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
        <div className="min-w-0 max-w-3xl">
          <p className="figure text-xs text-ink-3">Sheet {number}</p>
          <h1 className="title mt-1.5">{title}</h1>
          {lead ? <div className="mt-2.5 text-[0.98rem] leading-relaxed text-ink-2">{lead}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8">{children}</div>

      <footer className="grid grid-cols-2 border-t border-ink text-sm sm:grid-cols-[1.4fr_1.6fr_1.4fr_0.8fr_0.8fr_0.9fr]">
        <div className="tb-cell col-span-2 flex items-center gap-2.5 border-b border-ink sm:col-span-1 sm:border-b-0">
          <Logo size={22} />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.12em]">STRUCTURA</p>
            <p className="label truncate">Settled on GenLayer</p>
          </div>
        </div>
        <div className="tb-cell border-b border-ink sm:border-b-0">
          <p className="label">Project</p>
          <p className="truncate">{project ?? "The drawing set"}</p>
        </div>
        <div className="tb-cell border-b border-ink sm:border-b-0">
          <p className="label">Sheet title</p>
          <p className="truncate">{title}</p>
        </div>
        <div className="tb-cell">
          <p className="label">Sheet</p>
          <p className="figure">{number}</p>
        </div>
        <div className="tb-cell">
          <p className="label">Revision</p>
          <p className="figure">{revision ?? "None"}</p>
        </div>
        <div className="tb-cell col-span-2 border-t border-ink sm:col-span-1 sm:border-t-0">
          <p className="label">Printed</p>
          <p className="figure">{today}</p>
        </div>
      </footer>
    </div>
  );
}

/** A numbered section of a sheet: detail callout, heading, aside. */
export function Section({ n, title, aside, children, id }: {
  n: string | number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-2">
        <div className="flex items-center gap-3">
          <span className="callout" aria-hidden>{n}</span>
          <h2 className="heading">{title}</h2>
        </div>
        {aside ? <div className="text-sm text-ink-2">{aside}</div> : null}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}
