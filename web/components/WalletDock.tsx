"use client";

/**
 * The wallet, docked in the sheet index: connect (every wallet the browser
 * announces, EIP-6963), switch to Studio Next, get test GEN, and claim what
 * the contract has credited to this address. Claim is the only way value
 * leaves the contract, so it is always one click away.
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
  const [picking, setPicking] = useState(false);
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
  const refresh = balances.reload;

  const claimTx = useMemo(
    () => ({ kind: "write" as const, address: CONTRACT_ADDRESS, method: "claim", args: [] as unknown[] }),
    [],
  );

  if (!w.address) {
    return (
      <div className="text-sm">
        <p className="label">Your wallet</p>
        {w.restoring ? <p className="mt-1 text-ink-2">Reconnecting…</p> : (
          <>
            <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => setPicking((p) => !p)}>
              Connect a wallet
            </button>
            {picking ? (
              w.wallets.length ? (
                <ul className="mt-2 grid gap-1">
                  {w.wallets.map((d) => (
                    <li key={d.info.uuid}>
                      <button
                        type="button"
                        className="btn btn-line w-full justify-start"
                        disabled={w.connecting}
                        onClick={() => void w.connect(d).then(() => setPicking(false))}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- wallets announce their icon as a data URI */}
                        {d.info.icon ? <img src={d.info.icon} alt="" width={18} height={18} /> : null}
                        {d.info.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ink-2">No browser wallet announced itself. Install MetaMask, Rabby or another wallet, then reload.</p>
              )
            ) : null}
            <p className="mt-2 text-ink-3">Reading needs no wallet; signing does.</p>
          </>
        )}
        {w.error ? <p className="mt-2 text-fail">{w.error}</p> : null}
      </div>
    );
  }

  const claimable = BigInt(ledger?.claimable ?? "0");
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="label">Your wallet</p>
        <button type="button" className="label underline decoration-line underline-offset-2 hover:text-ink" onClick={w.disconnect}>
          disconnect
        </button>
      </div>
      <p className="figure mt-1 truncate" title={w.address}>{present.shortAddress(w.address)}</p>
      {!w.chainOk ? (
        <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => void w.switchNetwork()}>
          Switch to Studio Next
        </button>
      ) : (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
          <dt className="text-ink-2">In the wallet</dt>
          <dd className="figure text-right">{native === null ? "…" : present.gen(native)}</dd>
          <dt className="text-ink-2">Claimable here</dt>
          <dd className="figure text-right">{ledger ? present.gen(claimable) : "…"}</dd>
        </dl>
      )}

      {w.chainOk && native !== null && native < LOW_BALANCE_WEI ? (
        <button
          type="button"
          className="btn btn-line mt-2 w-full"
          disabled={funding === "asking"}
          onClick={() => {
            setFunding("asking");
            void requestTestGen(w.address)
              .then(() => { setFunding("done"); window.setTimeout(refresh, 4000); })
              .catch(() => setFunding("failed"));
          }}
        >
          {funding === "asking" ? "Asking the faucet…" : "Get 10 test GEN"}
        </button>
      ) : null}
      {funding === "done" ? <p className="mt-1 text-ink-3">Test GEN is on its way; it has no value.</p> : null}
      {funding === "failed" ? <p className="mt-1 text-fail">The faucet did not answer. Try again in a moment.</p> : null}

      {w.chainOk && claimable > 0n && kit ? (
        claiming ? (
          <div className="mt-2">
            <TxPanel
              kit={kit}
              tx={claimTx}
              confirmText={`Claim ${present.gen(claimable)}`}
              onClose={() => setClaiming(false)}
            />
          </div>
        ) : (
          <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => setClaiming(true)}>
            Claim {present.gen(claimable)}
          </button>
        )
      ) : null}
      {w.error ? <p className="mt-2 text-fail">{w.error}</p> : null}
    </div>
  );
}
