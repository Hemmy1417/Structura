/**
 * The four writes the published proof run never reached, live on Studio
 * Next through the app's own kit: renegotiated terms (propose_version,
 * accept_version), a milestone nobody delivered (close_milestone) and a
 * project abandoned before it started (cancel_project). Ids come back the
 * way the app reads them, from the transaction's own receipt.
 *
 * Every deadline here is minutes away, not weeks, so the closing path can be
 * proven in one run; the contract reads the transaction's own datetime.
 *
 *   pnpm test:live       needs ../.data/keys.json (scripts/keys.mjs)
 */
import { expect, it } from "vitest";

import { returnedJson } from "@/lib/receipt";

import { GEN, signer, view, waitUntil, write } from "./harness";

const SPEC = "Foundation for a single-storey house on precast concrete columns. Reinforced concrete "
  + "ground beams (strip footings) connect every column base in a grid.";

function terms(paymentWei: bigint, minutesAhead: number, title: string) {
  return JSON.stringify({
    title,
    description: "Footings and ground beams for the house, poured and stripped.",
    requirements: "All footings and ground beams of the foundation are poured in concrete to the approved layout.",
    specification: SPEC,
    criteria: [{ text: "The footings and ground beams are cast in concrete." }],
    evidence_requirements: [
      { text: "Photographs of the poured footings and ground beams", kind: "IMAGE", from_role: "CONTRACTOR", min_count: 2 },
    ],
    payment_wei: paymentWei.toString(),
    deadline: new Date(Date.now() + minutesAhead * 60_000).toISOString().replace(/\.\d+Z$/, "Z"),
  });
}

const project = (title: string, contractor: string) => JSON.stringify({
  title,
  description: "A short-lived record written by the live check for the terms and closing paths.",
  site: "Thailand (demonstration)",
  contractor,
  inspector: "",
  appeal_window_seconds: 600,
});

interface Project {
  state: string;
  escrow_wei: string;
  reserved_wei: string;
  unreserved_wei: string;
  milestone_summaries: { milestone_id: string; deadline: string; state: string }[];
}
interface Milestone {
  state: string;
  current_version: number;
  pending_version: number | null;
  reserved_wei: string;
}

const project_ = async (pid: string) => (await view("get_project", [pid])) as unknown as Project;
const milestone_ = async (mid: string) => (await view("get_milestone", [mid])) as unknown as Milestone;

it("renegotiates terms, closes an undelivered milestone and cancels an unsigned project", async () => {
  const client = signer("CLIENT");
  const contractor = signer("CONTRACTOR");
  const stranger = signer("STRANGER");

  /* ── a project with terms nobody has signed yet ── */

  const created = await client.send(write("create_project", [project("Renegotiated terms (live check)", contractor.account)]), GEN / 20n);
  expect(created).toMatchObject({ phase: "finalized", successful: true });
  const pid = (await returnedJson<{ project_id?: string }>(created.genlayerTxId!))?.project_id;
  expect(pid).toMatch(/^pr-\d+$/);

  const added = await client.send(write("add_milestone", [pid!, terms(GEN / 100n, 30, "Foundation completed")]));
  expect(added).toMatchObject({ phase: "finalized", successful: true });
  const mid = (await returnedJson<{ milestone_id?: string }>(added.genlayerTxId!))?.milestone_id;
  expect(mid).toMatch(/^ms-\d+$/);

  expect(await contractor.send(write("accept_project", [pid!]))).toMatchObject({ phase: "finalized", successful: true });
  expect((await milestone_(mid!)).state).toBe("AWAITING_EVIDENCE");

  /* ── the client proposes new terms; the contractor signs them ── */

  // Short enough to close inside this run, long enough for the signature to land.
  const proposed = await client.send(write("propose_version", [mid!, terms(GEN / 50n, 6, "Foundation completed (revised)")]));
  expect(proposed).toMatchObject({ phase: "finalized", successful: true });
  const pending = await milestone_(mid!);
  expect(pending.pending_version).toBe(2);
  expect(pending.current_version).toBe(1);
  expect(pending.reserved_wei).toBe((GEN / 100n).toString());

  expect(await contractor.send(write("accept_version", [mid!, 2]))).toMatchObject({ phase: "finalized", successful: true });
  const signed = await milestone_(mid!);
  expect(signed.current_version).toBe(2);
  expect(signed.pending_version).toBeNull();
  // The reservation followed the payment the parties actually agreed.
  expect(signed.reserved_wei).toBe((GEN / 50n).toString());
  expect((await project_(pid!)).reserved_wei).toBe((GEN / 50n).toString());

  /* ── nobody delivers, so anyone may close it ── */

  const held = await project_(pid!);
  const summary = held.milestone_summaries.find((s) => s.milestone_id === mid);
  expect(summary?.state).toBe("AWAITING_EVIDENCE");
  await waitUntil(summary!.deadline, "the milestone's deadline");

  expect(await stranger.send(write("close_milestone", [mid!]))).toMatchObject({ phase: "finalized", successful: true });
  const closed = await milestone_(mid!);
  expect(closed.state).toBe("CLOSED");
  expect(closed.reserved_wei).toBe("0");
  const freed = await project_(pid!);
  expect(freed.reserved_wei).toBe("0");
  expect(freed.unreserved_wei).toBe(freed.escrow_wei);

  /* ── a project the contractor never signed ── */

  const second = await client.send(write("create_project", [project("Cancelled before it started (live check)", contractor.account)]), GEN / 25n);
  expect(second).toMatchObject({ phase: "finalized", successful: true });
  const pid2 = (await returnedJson<{ project_id?: string }>(second.genlayerTxId!))?.project_id;
  expect(pid2).toMatch(/^pr-\d+$/);
  const owed = BigInt((await view("get_balance", [client.account])).claimable!);

  expect(await client.send(write("cancel_project", [pid2!]))).toMatchObject({ phase: "finalized", successful: true });
  const cancelled = await project_(pid2!);
  expect(cancelled.state).toBe("CANCELLED");
  expect(cancelled.escrow_wei).toBe("0");
  // The whole escrow came back to the client as a claim, never a push.
  expect(BigInt((await view("get_balance", [client.account])).claimable!) - owed).toBe(GEN / 25n);

  console.log(`terms path proven on ${pid} / ${mid}, cancellation on ${pid2}`);
});
