/**
 * The app's write path, live on Studio Next: the same Transaction Kit, the
 * same claim wrapper and the same client construction as lib/kit.ts, signed
 * by a test key through an EIP-1193 provider instead of a browser wallet.
 * The client of the flagship project funds 0.5 GEN (a payable write), takes
 * it back (a plain write), and claims it (a transfer priced by simulation).
 *
 *   pnpm test:live       needs ../.data/keys.json (scripts/keys.mjs)
 */
import { expect, it } from "vitest";

import { signer, view, walletBalance, write } from "./harness";

const PROJECT = "pr-00001";
const HALF = 5n * 10n ** 17n;

it("funds, withdraws and claims through the app's kit, each confirmed only when finalized and successful", async () => {
  const client = signer("CLIENT");
  const account = client.account;

  const before = await view("get_project", [PROJECT]);
  const funded = await client.send(write("fund_project", [PROJECT]), HALF);
  expect(funded).toMatchObject({ phase: "finalized", successful: true });
  const after = await view("get_project", [PROJECT]);
  expect(BigInt(after.escrow_wei!) - BigInt(before.escrow_wei!)).toBe(HALF);

  const owed = BigInt((await view("get_balance", [account])).claimable!);
  const withdrawn = await client.send(write("withdraw_escrow", [PROJECT, HALF.toString()]));
  expect(withdrawn).toMatchObject({ phase: "finalized", successful: true });
  expect(BigInt((await view("get_balance", [account])).claimable!) - owed).toBe(HALF);

  const wallet = await walletBalance(account);
  const claimed = await client.send(write("claim"));
  expect(claimed).toMatchObject({ phase: "finalized", successful: true });
  expect((await view("get_balance", [account])).claimable).toBe("0");
  const received = (await walletBalance(account)) - wallet;
  console.log(`the wallet received ${received} wei`);
  expect(received).toBeGreaterThan((HALF * 9n) / 10n);
});
