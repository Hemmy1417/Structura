"use client";

/**
 * The wallet, at the right edge of the navigation: a pill that opens one
 * panel holding everything a person needs here. Connect (every wallet the
 * browser announces, EIP-6963), switch to Studio Next, take test GEN, and
 * claim what the contract has credited to this address. Claim is the only
 * way value leaves the contract, so it is never more than one click away.
 */
import { useMemo, useState } from "react";

import { CONTRACT_ADDRESS } from "@/lib/config";
import { LOW_BALANCE_WEI, requestTestGen, walletBalance } from "@/lib/faucet";
import { useTransactionKit } from "@/lib/kit";
import * as present from "@/lib/present";
import { getBalance } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";
import { TxPanel } from "./TxPanel";

export function WalletDock() {
  const w = useWallet();
  const kit = useTransactionKit();
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [funding, setFunding] = useState<"idle" | "asking" | "done" | "failed">("idle");
  const balances = useChain(w.address ? `wallet.${w.address}` : null, async () => {
    const [native, ledger] = await Promise.all([
      walletBalance(w.address).catch(() => null),
      getBalance(w.address).catch(() => null),
    ]);
    return { native, ledger };
  });
  const native = balances.data?.native ?? null;
  const ledger = balances.data?.ledger ?? null;
  const claimable = BigInt(ledger?.claimable ?? "0");

  const claimTx = useMemo(
    () => ({ kind: "write" as const, address: CONTRACT_ADDRESS, method: "claim", args: [] as unknown[] }),
    [],
  );

  const panel = (
    <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[320px] rounded-[32px] border border-fog bg-card p-5 text-left">
      {!w.address ? (
        <>
          <p className="font-semibold">Connect a wallet</p>
          <p className="body-sm mt-1.5 text-slate">Reading this record needs no wallet. Signing does.</p>
          {w.wallets.length ? (
            <ul className="mt-4 grid gap-2">
              {w.wallets.map((d) => (
                <li key={d.info.uuid}>
                  <button
                    type="button"
                    className="btn btn-neutral btn-sm w-full justify-start"
                    disabled={w.connecting}
                    onClick={() => void w.connect(d).then(() => setOpen(false))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- wallets announce their icon as a data URI */}
                    {d.info.icon ? <img src={d.info.icon} alt="" width={18} height={18} /> : null}
                    {d.info.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="body-sm mt-4 text-slate">
              No browser wallet announced itself. Install MetaMask, Rabby or another wallet, then reload.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="caption">Connected wallet</p>
              <p className="tabular mt-0.5 truncate text-[15px]" title={w.address}>{present.shortAddress(w.address)}</p>
            </div>
            <button type="button" className="caption underline decoration-fog underline-offset-2 hover:text-obsidian" onClick={w.disconnect}>
              Disconnect
            </button>
          </div>

          {!w.chainOk ? (
            <button type="button" className="btn btn-primary btn-sm mt-4 w-full" onClick={() => void w.switchNetwork()}>
              Switch to Studio Next
            </button>
          ) : (
            <dl className="mt-4 grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="body-sm text-slate">In the wallet</dt>
                <dd className="body-sm tabular font-semibold">{native === null ? "reading" : present.gen(native)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="body-sm text-slate">Claimable here</dt>
                <dd className="body-sm tabular font-semibold">{ledger ? present.gen(claimable) : "reading"}</dd>
              </div>
            </dl>
          )}

          {w.chainOk && native !== null && native < LOW_BALANCE_WEI ? (
            <button
              type="button"
              className="btn btn-neutral btn-sm mt-4 w-full"
              disabled={funding === "asking"}
              onClick={() => {
                setFunding("asking");
                void requestTestGen(w.address)
                  .then(() => { setFunding("done"); window.setTimeout(balances.reload, 4000); })
                  .catch(() => setFunding("failed"));
              }}
            >
              {funding === "asking" ? "Asking the faucet" : "Get 10 test GEN"}
            </button>
          ) : null}
          {funding === "done" ? <p className="body-sm mt-2 text-slate">Test GEN is on its way. It has no value.</p> : null}
          {funding === "failed" ? <p className="body-sm mt-2 text-orange">The faucet did not answer. Try again in a moment.</p> : null}

          {w.chainOk && claimable > 0n && kit ? (
            claiming ? (
              <div className="mt-4">
                <TxPanel
                  kit={kit}
                  tx={claimTx}
                  confirmText={`Claim ${present.gen(claimable)}`}
                  onClose={() => setClaiming(false)}
                />
              </div>
            ) : (
              <button type="button" className="btn btn-primary btn-sm mt-4 w-full" onClick={() => setClaiming(true)}>
                Claim {present.gen(claimable)}
              </button>
            )
          ) : null}
        </>
      )}
      {w.error ? <p className="body-sm mt-3 text-orange">{present.prose(w.error)}</p> : null}
    </div>
  );

  return (
    <div className="relative">
      {open ? (
        <button
          type="button"
          aria-label="Close the wallet panel"
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setOpen(false)}
        />
      ) : null}
      {w.address ? (
        <button type="button" className="pill relative z-50" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden className={`h-[7px] w-[7px] rounded-full ${w.chainOk ? "bg-green" : "bg-orange"}`} />
          <span className="tabular">{present.shortAddress(w.address)}</span>
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm relative z-50"
          aria-expanded={open}
          disabled={w.restoring}
          onClick={() => setOpen((o) => !o)}
        >
          {w.restoring ? "Reconnecting" : "Connect wallet"}
        </button>
      )}
      {open ? panel : null}
    </div>
  );
}
