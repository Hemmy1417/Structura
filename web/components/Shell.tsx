"use client";

/**
 * The frame: a slim utility band saying which network this is, a sticky
 * white navigation bar with the wallet at its right edge, and a quiet
 * footer. Nothing here competes with the page: the bar is 52px of hairline
 * and 12px labels, the way a product page carries its own chrome.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { IS_RECORD } from "@/lib/config";
import { WalletDock } from "./WalletDock";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/how", label: "How it works" },
  { href: "/verify", label: "Verification" },
];

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0071e3" />
      <g fill="#ffffff">
        <rect x="6.5" y="19" width="5" height="6.5" rx="1.4" />
        <rect x="13.5" y="14" width="5" height="11.5" rx="1.4" />
        <rect x="20.5" y="8.5" width="5" height="17" rx="1.4" />
      </g>
    </svg>
  );
}

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="flex items-center gap-2 no-underline">
      <Logo />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">STRUCTURA</span>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === path;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-canvas px-5 py-2 text-center">
        <p className="caption">
          GenLayer Studio Next, a test network: its GEN has no value.{" "}
          <Link className="link" href="/verify">
            {IS_RECORD ? "Check the deployment" : "This is a test deployment"}
          </Link>
        </p>
      </div>

      <header className="sticky top-0 z-40 border-b border-fog bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[52px] max-w-[1180px] items-center gap-4 px-5">
          <Wordmark />
          <nav aria-label="Main" className="ml-4 hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs no-underline ${
 path.startsWith(item.href) ? "text-obsidian" : "text-charcoal hover:text-obsidian"
 }`}
                aria-current={path.startsWith(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <WalletDock />
            <button
              type="button"
              className="pill md:hidden"
              aria-expanded={open}
              onClick={() => setOpenedAt(open ? null : path)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {open ? (
          <nav aria-label="Main" className="border-t border-fog bg-card px-5 py-3 md:hidden">
            <ul className="grid gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpenedAt(null)}
                    className="block rounded-[10px] px-3 py-2 text-[15px] no-underline hover:bg-canvas"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-fog bg-card">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Logo size={22} />
              <span className="text-sm font-semibold">STRUCTURA</span>
            </div>
            <p className="caption mt-2 max-w-xs">
              Construction milestone escrow. The payment moves when the evidence, judged by
              GenLayer&apos;s validators, shows the work is done.
            </p>
          </div>
          <div>
            <p className="caption font-semibold text-obsidian">The app</p>
            <ul className="mt-2 grid gap-1.5">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="body-sm no-underline text-slate hover:text-obsidian">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/projects/new" className="body-sm no-underline text-slate hover:text-obsidian">
                  Start a project
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="caption font-semibold text-obsidian">The record</p>
            <p className="body-sm mt-2 text-slate">
              Every project, decision and payment on this page is read from one contract on
              GenLayer Studio Next. Nothing is stored anywhere else.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
