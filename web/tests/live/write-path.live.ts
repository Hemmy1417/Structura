/**
 * The app's write path, live on Studio Next: the same Transaction Kit, the
 * same claim wrapper and the same client construction as lib/kit.ts, signed
 * by a test key through an EIP-1193 provider instead of a browser wallet.
 * The client of the flagship project funds 0.5 GEN (a payable write), takes
 * it back (a plain write), and claims it (a transfer priced by simulation).
 *
 *   pnpm test:live       needs ../.data/keys.json (scripts/keys.mjs)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createTransactionKit, type SubmitInput, type TrackedStatus } from "@genlayer/transaction-kit";
import { createClient } from "genlayer-js";
import { privateKeyToAccount } from "viem/accounts";
import { expect, it } from "vitest";

import { CHAIN_ID, RPC_URL, STUDIO_NEXT } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { type TransferClient, withTransferAllocations } from "@/lib/kit";

const PROJECT = "pr-00001";
const HALF = 5n * 10n ** 17n;
const keys = JSON.parse(readFileSync(fileURLToPath(new URL("../../../.data/keys.json", import.meta.url)), "utf8")) as
  Record<string, { pk: `0x${string}`; addr: string }>;

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
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
function keyProvider(pk: `0x${string}`) {
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

const reader = createClient({ chain: STUDIO_NEXT });
const view = async (fn: string, args: (string | number)[]) =>
  JSON.parse(String(await reader.readContract({ address: CONTRACT_ADDRESS, functionName: fn, args }))) as Record<string, string>;
const walletBalance = async (addr: string) => BigInt(String(await rpc("eth_getBalance", [addr, "latest"])));

it("funds, withdraws and claims through the app's kit, each confirmed only when finalized and successful", async () => {
  const provider = keyProvider(keys.CLIENT!.pk);
  const account = provider.address;
  // Exactly what useTransactionKit builds for a connected wallet.
  const kit = withTransferAllocations(
    createTransactionKit({ chain: STUDIO_NEXT, provider, account }),
    createClient({ chain: { ...STUDIO_NEXT }, provider, account } as Parameters<typeof createClient>[0]) as unknown as TransferClient,
  );

  async function send(tx: SubmitInput, userValue = 0n): Promise<TrackedStatus> {
    const quote = await kit.estimate({ userValue }, tx);
    expect(quote.userValue).toBe(userValue);
    const { genlayerTxId } = await kit.submit(quote, tx);
    const done = await kit.track(genlayerTxId, () => {}, { until: "finalized" });
    console.log(`${tx.kind === "write" ? tx.method : "deploy"} ${genlayerTxId} ${done.phase} ${done.executionResultName ?? ""}`);
    return done;
  }
  type WriteArgs = Extract<SubmitInput, { kind: "write" }>["args"];
  const write = (method: string, args: WriteArgs = []): SubmitInput => ({ kind: "write", address: CONTRACT_ADDRESS, method, args });

  const before = await view("get_project", [PROJECT]);
  const funded = await send(write("fund_project", [PROJECT]), HALF);
  expect(funded).toMatchObject({ phase: "finalized", successful: true });
  const after = await view("get_project", [PROJECT]);
  expect(BigInt(after.escrow_wei!) - BigInt(before.escrow_wei!)).toBe(HALF);

  const owed = BigInt((await view("get_balance", [account])).claimable!);
  const withdrawn = await send(write("withdraw_escrow", [PROJECT, HALF.toString()]));
  expect(withdrawn).toMatchObject({ phase: "finalized", successful: true });
  expect(BigInt((await view("get_balance", [account])).claimable!) - owed).toBe(HALF);

  const wallet = await walletBalance(account);
  const claimed = await send(write("claim"));
  expect(claimed).toMatchObject({ phase: "finalized", successful: true });
  expect((await view("get_balance", [account])).claimable).toBe("0");
  const received = (await walletBalance(account)) - wallet;
  console.log(`the wallet received ${received} wei`);
  expect(received).toBeGreaterThan((HALF * 9n) / 10n);
});
