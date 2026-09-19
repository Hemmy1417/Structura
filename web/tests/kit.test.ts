import type { PolicyQuote, SubmitInput, TransactionKit } from "@genlayer/transaction-kit";
import { describe, expect, it, vi } from "vitest";

import { type TransferClient, withTransferAllocations } from "@/lib/kit";

const RECORD = "0x6cbE71156bE65847454F7064D31fC541fB0cA942" as const;
const ALLOCATIONS = [{ recipient: "0x56e71175C0772a21a6170E3D95184f126526e9f2", value: "2000000000000000000" }];

function distribution(over: Record<string, unknown> = {}): PolicyQuote["distribution"] {
  return {
    appealRounds: 1n, rotations: [2n], maxPriceGenPerTimeUnit: 5n, storageFeeMaxGasPrice: 6n,
    receiptFeeMaxGasPrice: 7n, totalMessageFees: 0n, ...over,
  } as unknown as PolicyQuote["distribution"];
}

function quote(over: Partial<PolicyQuote> = {}): PolicyQuote {
  return {
    distribution: distribution(), feeValue: 100n, userValue: 0n, total: 100n, source: "network-default",
    verification: { status: "verified" }, breakdown: { timeUnitFees: 60n, executionBudget: 40n, messageFees: 0n },
    caps: { genPerTimeUnit: 5n, storagePrice: 6n, receiptPrice: 7n }, refundable: true, ...over,
  };
}

function setup(sim: Partial<Awaited<ReturnType<TransferClient["estimateTransactionFeesForWrite"]>>> = {}, base = quote()) {
  const kit = {
    estimate: vi.fn(async () => base),
    submit: vi.fn(async () => ({ genlayerTxId: "0xk17" as `0x${string}` })),
    cancel: vi.fn(), topUp: vi.fn(), track: vi.fn(), verification: vi.fn(),
  } as unknown as TransactionKit;
  const client = {
    estimateTransactionFeesForWrite: vi.fn(async () => ({
      distribution: distribution({ totalMessageFees: 9n }), feeValue: 150n, messageAllocations: ALLOCATIONS, ...sim,
    })),
    writeContract: vi.fn(async () => "0xc1a1" as `0x${string}`),
  };
  return { kit, client, wrapped: withTransferAllocations(kit, client as unknown as TransferClient) };
}

const claim: SubmitInput = { kind: "write", address: RECORD, method: "claim", args: [] };
const finalize: SubmitInput = { kind: "write", address: RECORD, method: "finalize", args: ["ms-00001"] };

describe("writes that move no value out", () => {
  it("keep the kit's own quote and submission", async () => {
    const { kit, client, wrapped } = setup();
    const q = await wrapped.estimate({}, finalize);
    expect(q).toBe(await kit.estimate({}, finalize));
    expect(client.estimateTransactionFeesForWrite).not.toHaveBeenCalled();
    expect(await wrapped.submit(q, finalize)).toEqual({ genlayerTxId: "0xk17" });
    expect(client.writeContract).not.toHaveBeenCalled();
  });
});

describe("the claim", () => {
  it("is priced by simulation, carrying the measured allocations and message fees", async () => {
    const { client, wrapped } = setup();
    const q = await wrapped.estimate({}, claim);
    expect(client.estimateTransactionFeesForWrite).toHaveBeenCalledWith({
      address: RECORD, functionName: "claim", args: [], value: 0n, appealRounds: 1n, rotations: [2n],
    });
    expect(q.feeValue).toBe(150n);
    expect(q.total).toBe(150n);
    expect(q.breakdown.messageFees).toBe(9n);
    expect(q.verification.status).toBe("verified");
  });

  it("simulates and totals with any value the write carries", async () => {
    const { client, wrapped } = setup({}, quote({ userValue: 5n, total: 105n }));
    const q = await wrapped.estimate({}, claim);
    expect(client.estimateTransactionFeesForWrite).toHaveBeenCalledWith(expect.objectContaining({ value: 5n }));
    expect(q.total).toBe(155n);
  });

  it("does not claim a policy check the simulated caps no longer match", async () => {
    const { wrapped } = setup({ distribution: distribution({ maxPriceGenPerTimeUnit: 99n }) });
    expect((await wrapped.estimate({}, claim)).verification.status).toBe("unavailable");
  });

  it("signs nothing when the simulation finds no transfer to fund", async () => {
    const { client, wrapped } = setup({ messageAllocations: [] });
    await expect(wrapped.estimate({}, claim)).rejects.toThrow(/found no transfer/);
    expect(client.writeContract).not.toHaveBeenCalled();
  });

  it("submits the simulated allocations with the fees", async () => {
    const { kit, client, wrapped } = setup();
    const q = await wrapped.estimate({}, claim);
    expect(await wrapped.submit(q, claim)).toEqual({ genlayerTxId: "0xc1a1" });
    expect(kit.submit).not.toHaveBeenCalled();
    expect(client.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "claim", value: 0n,
      fees: { distribution: q.distribution, feeValue: 150n, messageAllocations: ALLOCATIONS },
    }));
  });

  it("refuses to submit a claim quote that did not come from the simulation", async () => {
    const { client, wrapped } = setup();
    await expect(wrapped.submit(quote(), claim)).rejects.toThrow(/not priced by simulation/);
    expect(client.writeContract).not.toHaveBeenCalled();
  });

  it("passes through untouched on a gasless network, estimate and submission alike", async () => {
    const gasless = quote({ gasless: true });
    const { kit, client, wrapped } = setup({}, gasless);
    const q = await wrapped.estimate({}, claim);
    expect(q).toBe(gasless);
    expect(await wrapped.submit(q, claim)).toEqual({ genlayerTxId: "0xk17" });
    expect(kit.submit).toHaveBeenCalledWith(gasless, claim);
    expect(client.estimateTransactionFeesForWrite).not.toHaveBeenCalled();
    expect(client.writeContract).not.toHaveBeenCalled();
  });
});
