"use client";

/**
 * The drawing set's binder: a sheet index down the left edge (a top bar
 * with a menu on small screens), the sheets themselves, and the wallet dock.
 * Pages tell the index which project and milestone sheets they belong to,
 * so the index always shows where a person is in the set.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { IS_RECORD } from "@/lib/config";
import { WalletDock } from "./WalletDock";

export interface TrailEntry {
  number: string;
  title: string;
  href: string;
}

const TrailCtx = createContext<(trail: TrailEntry[]) => void>(() => {});

/** A page sets the project and milestone sheets it sits under. */
export function useTrail(trail: TrailEntry[]): void {
  const set = useContext(TrailCtx);
  const key = JSON.stringify(trail);
  useEffect(() => {
    set(JSON.parse(key) as TrailEntry[]);
    return () => set([]);
  }, [key, set]);
}

const SHEETS: TrailEntry[] = [
  { number: "S-00", title: "Cover", href: "/" },
  { number: "S-01", title: "Project register", href: "/projects" },
  { number: "S-02", title: "New project", href: "/projects/new" },
  { number: "S-03", title: "How it works", href: "/how" },
  { number: "S-04", title: "Verification", href: "/verify" },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="2" fill="#e39a2d" />
      <path d="M7 6.5h18v4.5h-6.75v10h6.75v4.5H7V21h6.75V11H7z" fill="#1f2226" />
    </svg>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 no-underline">
      <Logo />
      <span className="text-[1.02rem] font-semibold tracking-[0.14em]">STRUCTURA</span>
    </Link>
  );
}

function IndexList({ trail, onPick }: { trail: TrailEntry[]; onPick?: () => void }) {
  const path = usePathname();
  const row = (s: TrailEntry, nested = false) => {
    const active = s.href === path || (s.href !== "/" && path === s.href);
    return (
      <li key={s.href + s.number}>
        <Link
          href={s.href}
          onClick={onPick}
          className={`grid grid-cols-[3.4rem_1fr] items-baseline gap-2 px-3 py-1.5 text-sm no-underline ${
            active ? "bg-ink text-sheet" : "hover:bg-paper"
          } ${nested ? "pl-5" : ""}`}
          aria-current={active ? "page" : undefined}
        >
          <span className={`figure text-xs ${active ? "text-amber" : "text-ink-3"}`}>{s.number}</span>
          <span className="truncate">{s.title}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Sheet index">
      <p className="label px-3 pb-1.5">Sheet index</p>
      <ul>{SHEETS.map((s) => row(s))}</ul>
      {trail.length ? (
        <>
          <p className="label mt-4 px-3 pb-1.5">This record</p>
          <ul>{trail.map((s) => row(s, false))}</ul>
        </>
      ) : null}
    </nav>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  // The menu is open on the page it was opened on; navigating closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const path = usePathname();
  const open = openedAt === path;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenedAt((typeof next === "function" ? next(open) : next) ? path : null);
  const setter = useMemo(() => (t: TrailEntry[]) => setTrail(t), []);

  return (
    <TrailCtx.Provider value={setter}>
      <div className="min-h-screen px-2 py-2 sm:px-5 sm:py-5">
        <div className="sheet mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1380px] lg:grid-cols-[248px_minmax(0,1fr)]">
          {/* small screens: a top bar with the menu */}
          <header className="flex items-center justify-between gap-3 border-b border-ink px-4 py-3 lg:hidden">
            <Wordmark />
            <button
              type="button"
              className="btn btn-line min-h-9 px-3 py-1 text-sm"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Close" : "Sheets"}
            </button>
          </header>
          {open ? (
            <div className="border-b border-ink bg-sheet py-3 lg:hidden">
              <IndexList trail={trail} onPick={() => setOpen(false)} />
              <div className="mt-4 border-t border-line px-3 pt-3">
                <WalletDock />
              </div>
            </div>
          ) : null}

          {/* large screens: the index down the left edge */}
          <aside className="hidden flex-col border-r border-ink lg:flex">
            <div className="border-b border-ink px-4 py-4">
              <Wordmark />
              <p className="label mt-2">Construction milestone escrow, judged from the evidence</p>
            </div>
            <div className="flex-1 py-3">
              <IndexList trail={trail} />
            </div>
            <div className="border-t border-ink px-3 py-3">
              <WalletDock />
            </div>
            <div className="border-t border-line px-4 py-2.5">
              <p className="label">
                GenLayer Studio Next{IS_RECORD ? ", deployment of record" : ", a test deployment"}
              </p>
            </div>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </TrailCtx.Provider>
  );
}
