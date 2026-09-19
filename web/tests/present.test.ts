import { describe, expect, it } from "vitest";

import * as present from "@/lib/present";

describe("amounts", () => {
  it("reads wei as GEN with at most four decimals", () => {
    expect(present.gen("2000000000000000000")).toBe("2 GEN");
    expect(present.gen("50000000000000000")).toBe("0.05 GEN");
    expect(present.gen("1234500000000000000")).toBe("1.2345 GEN");
    expect(present.gen("1")).toBe("0.0001 GEN");
    expect(present.gen(0n)).toBe("0 GEN");
    expect(present.gen("12000000000000000000000")).toBe("12,000 GEN");
    expect(present.gen("not a number")).toBe("0 GEN");
  });

  it("parses what a person types, refusing what it cannot read", () => {
    expect(present.parseGen("2")).toBe(2n * 10n ** 18n);
    expect(present.parseGen("0.05")).toBe(5n * 10n ** 16n);
    expect(present.parseGen(" 1.5 ")).toBe(15n * 10n ** 17n);
    expect(present.parseGen("1e3")).toBeNull();
    expect(present.parseGen("-1")).toBeNull();
    expect(present.parseGen("")).toBeNull();
  });
});

describe("time", () => {
  it("spells dates by hand in UTC, the same in every browser", () => {
    // In a browser at UTC+14 these moments are already the next day locally.
    const zone = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
    try {
      expect(present.day("2026-09-19T23:30:00Z")).toBe("19 Sep 2026");
      expect(present.moment("2026-09-19T15:24:07Z")).toBe("19 Sep 2026, 15:24 UTC");
      expect(present.day(null)).toBe("");
      expect(present.day("garbage")).toBe("");
    } finally {
      process.env.TZ = zone;
    }
  });

  it("reads durations and relative times in words", () => {
    expect(present.duration(600)).toBe("10 minutes");
    expect(present.duration(3600)).toBe("1 hour");
    expect(present.duration(90 * 60)).toBe("1 hour 30 minutes");
    expect(present.duration(7 * 86400)).toBe("7 days");
    const now = Date.parse("2026-09-19T12:00:00Z");
    expect(present.relative("2026-09-19T12:42:00Z", now)).toBe("in 42 minutes");
    expect(present.relative("2026-09-19T09:00:00Z", now)).toBe("3 hours ago");
    expect(present.relative("2026-09-19T12:00:10Z", now)).toBe("now");
  });
});

describe("ids and enums never reach a screen raw", () => {
  it("turns record ids into sheet numbers", () => {
    expect(present.projectSheet("pr-00001")).toBe("P-001");
    expect(present.milestoneSheet("ms-00012")).toBe("M-012");
    expect(present.certificateNo("ms-00012", 2)).toBe("M-012/2");
    expect(present.itemName("ev-000013")).toBe("Item 13");
  });

  it("labels every contract enum in sentence case", () => {
    for (const s of ["AWAITING_TERMS", "AWAITING_EVIDENCE", "ACCEPTED", "REJECTED", "UNDETERMINED", "APPEALED", "FINALIZED", "CLOSED"]) {
      const text = present.milestoneState(s);
      expect(text).not.toMatch(/_/);
      expect(text[0]).toBe(text[0]!.toUpperCase());
      expect(text.slice(1)).toBe(text.slice(1).toLowerCase());
    }
    expect(present.status("NOT_MET")).toBe("Not met");
    expect(present.itemKind("IMAGE", "VIDEO_FRAME")).toBe("Video frame");
    expect(present.itemKind("DECLARATION")).toBe("Declaration");
    expect(present.eventKind("APPEAL_LAPSED")).toBe("Appeal lapsed");
  });

  it("falls back to words for anything unknown", () => {
    expect(present.milestoneState("SOMETHING_NEW")).toBe("Something new");
    expect(present.humanize("")).toBe("");
  });

  it("turns a contract refusal into a sentence", () => {
    expect(present.refusal("[EXPECTED] the appeal window has closed")).toBe("The appeal window has closed.");
    expect(present.refusal("[LLM_ERROR] the judgment must be a JSON object")).toBe("The judgment must be a JSON object.");
    expect(present.refusal("")).toBe("The contract refused this action.");
    expect(present.refusal("already a sentence.")).toBe("Already a sentence.");
  });

  it("shortens addresses and digests only where asked", () => {
    expect(present.shortAddress("0x6cbE71156bE65847454F7064D31fC541fB0cA942")).toBe("0x6cbE…A942");
    expect(present.shortHash("c8aa03e721ff8bbbec799ea3d797c1a3c6b1de4adc7bca8a7e930d71b5e048b1")).toBe("0xc8aa03e7…e048b1");
    expect(present.size(155089)).toBe("155 KB");
    expect(present.plural(1, "item")).toBe("1 item");
    expect(present.plural(3, "criterion", "criteria")).toBe("3 criteria");
  });
});
