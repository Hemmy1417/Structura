/**
 * What every live check shares: a wallet that signs with a test key instead
 * of opening a popup, and a kit built exactly the way lib/kit.ts builds one
 * for a connected wallet. Not a test file itself (the live config collects
 * only *.live.ts), so nothing here runs on its own.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createTransactionKit, type SubmitInput, type TrackedStatus } from "@genlayer/transaction-kit";
import { createClient } from "genlayer-js";
import { privateKeyToAccount } from "viem/accounts";

import { CHAIN_ID, RPC_URL, STUDIO_NEXT } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { type TransferClient, withTransferAllocations } from "@/lib/kit";

export const GEN = 10n ** 18n;

export const keys = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../.data/keys.json", import.meta.url)), "utf8"),
) as Record<string, { pk: `0x${string}`; addr: string }>;

export async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  for (let i = 0; ; i++) {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 structura-live-test" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const data = (await res.json()) as { result?: unknown; error?: { code?: number; message?: string } };
    if (data.error?.code === -32029 && i < 6) {
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    if (data.error) throw new Error(`${method}: ${data.error.message}`);
    return data.result;
  }
}

/** A wallet that signs with a test key: what a browser extension does, minus the popup. */
export function keyProvider(pk: `0x${string}`) {
  const account = privateKeyToAccount(pk);
  return {
    address: account.address,
    async request({ method, params = [] }: { method: string; params?: unknown[] }): Promise<unknown> {
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [account.address];
      if (method === "eth_chainId") return `0x${CHAIN_ID.toString(16)}`;
      if (method === "eth_sendTransaction") {
        const [tx] = params as [{ to: `0x${string}`; data?: `0x${string}`; value?: string; gas: string; nonce: string; gasPrice: string }];
        const raw = await account.signTransaction({
          type: "legacy", chainId: CHAIN_ID, to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : 0n,
          gas: BigInt(tx.gas), nonce: Number(BigInt(tx.nonce)), gasPrice: BigInt(tx.gasPrice),
        });
        return rpc("eth_sendRawTransaction", [raw]);
      }
      return rpc(method, params);
    },
  };
}

export type Signer = {
  role: string;
  account: string;
  send(tx: SubmitInput, userValue?: bigint): Promise<TrackedStatus>;
};

/** Exactly what useTransactionKit builds for a connected wallet, for one role. */
export function signer(role: string): Signer {
  const provider = keyProvider(keys[role]!.pk);
  const account = provider.address;
  const kit = withTransferAllocations(
    createTransactionKit({ chain: STUDIO_NEXT, provider, account }),
    createClient({ chain: { ...STUDIO_NEXT }, provider, account } as Parameters<typeof createClient>[0]) as unknown as TransferClient,
  );
  return {
    role,
    account,
    async send(tx, userValue = 0n) {
      const quote = await kit.estimate({ userValue }, tx);
      const { genlayerTxId } = await kit.submit(quote, tx);
      // Tracking only reads. A dropped socket says nothing about the
      // transaction, so watch the same one again rather than send another.
      let done;
      for (let i = 0; ; i++) {
        try {
          done = await kit.track(genlayerTxId, () => {}, { until: "finalized" });
          break;
        } catch (e) {
          if (i >= 3) throw e;
          console.log(`${role} ${genlayerTxId} lost the connection while watching, resuming`);
          await new Promise((r) => setTimeout(r, 10_000));
        }
      }
      const what = tx.kind === "write" ? tx.method : "deploy";
      console.log(`${role} ${what} ${genlayerTxId} ${done.phase} ${done.executionResultName ?? ""}`);
      return done;
    },
  };
}

export type WriteArgs = Extract<SubmitInput, { kind: "write" }>["args"];
export const write = (method: string, args: WriteArgs = []): SubmitInput =>
  ({ kind: "write", address: CONTRACT_ADDRESS, method, args });

const reader = createClient({ chain: STUDIO_NEXT });
export const view = async (fn: string, args: (string | number)[]) =>
  JSON.parse(String(await reader.readContract({ address: CONTRACT_ADDRESS, functionName: fn, args }))) as Record<string, string>;
export const walletBalance = async (addr: string) => BigInt(String(await rpc("eth_getBalance", [addr, "latest"])));

/** The contract's own clock is the transaction's datetime, so wait on the real one. */
export async function waitUntil(iso: string, label: string): Promise<void> {
  const target = Date.parse(iso) + 5_000;
  while (Date.now() < target) {
    const left = Math.ceil((target - Date.now()) / 1000);
    console.log(`waiting for ${label} (${left} s)`);
    await new Promise((r) => setTimeout(r, Math.min(30_000, target - Date.now())));
  }
}
