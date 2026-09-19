import { describe, expect, it } from "vitest";

import { contractRefusal, planStart, READ_BUDGET, READ_WINDOW_MS } from "@/lib/read";

describe("the read budget", () => {
  it("starts at once when nothing is planned", () => {
    expect(planStart([], 1_000)).toBe(1_000);
  });

  it("spaces consecutive starts apart", () => {
    const starts: number[] = [];
    const a = planStart(starts, 0);
    const b = planStart(starts, 0);
    expect(b).toBeGreaterThan(a);
  });

  it("never lets more starts into any rolling minute than the budget, however many are asked for at once", () => {
    const starts: number[] = [];
    const planned = Array.from({ length: 100 }, () => planStart(starts, 0));
    for (const t of planned) {
      const inWindow = planned.filter((s) => s > t - READ_WINDOW_MS && s <= t).length;
      expect(inWindow).toBeLessThanOrEqual(READ_BUDGET);
    }
    // The first read past the budget waits for the first one to leave the window.
    expect(planned[READ_BUDGET]).toBeGreaterThanOrEqual(planned[0]! + READ_WINDOW_MS);
    // Nothing waits longer than it must: every budget's worth of starts fits in a minute.
    expect(planned[READ_BUDGET - 1]).toBeLessThan(planned[0]! + READ_WINDOW_MS);
  });

  it("forgets starts that left the window", () => {
    const starts = Array.from({ length: READ_BUDGET }, (_, i) => i * 10);
    const later = 10 * READ_WINDOW_MS;
    expect(planStart(starts, later)).toBe(later);
    expect(starts).toEqual([later]);
  });
});

/** A gen_call refusal as genlayer-js surfaces it: the contract's text, base64, one tag byte first. */
function refusedRead(text: string): unknown {
  const b64 = btoa(String.fromCharCode(1, ...new TextEncoder().encode(text)));
  return { message: "Execution reverted", cause: { message: "call failed", cause: { data: { receipt: { result: b64 } } } } };
}

describe("a refused read", () => {
  it("gives the contract's own sentence, found however deep it is carried", () => {
    expect(contractRefusal(refusedRead("[EXPECTED] unknown milestone"))).toBe("[EXPECTED] unknown milestone");
  });

  it("reads a refusal the SDK already put in the message", () => {
    expect(contractRefusal(new Error("gen_call: [EXPECTED] unknown project"))).toBe("gen_call: [EXPECTED] unknown project");
  });

  it("returns nothing for an error that is not a refusal", () => {
    expect(contractRefusal(new Error("fetch failed"))).toBeNull();
    expect(contractRefusal({ data: { receipt: { result: "%%% not base64" } } })).toBeNull();
    expect(contractRefusal(null)).toBeNull();
  });
});
