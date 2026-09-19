import { describe, expect, it } from "vitest";

import { coverageGap, filingClosed, MARGIN_MS, milestoneActs, projectActs, roleIn } from "@/lib/acts";
import type { ConfigView, ItemView, MilestoneView, ProjectView } from "@/lib/types";

const CLIENT = "0x691e25a08e00Fa16Fc95b159589ba563727d77a8";
const CONTRACTOR = "0x56e71175C0772a21a6170E3D95184f126526e9f2";
const INSPECTOR = "0x69730962CE945c8da10817A6aE53fBAff7675531";
const STRANGER = "0xD41fCA7210904C6D2f4e00c377E76F8Aad43eC9E";
const at = (iso: string) => Date.parse(iso);

const cfg = {
  ruleset: "structura-rules-1", min_payment_wei: "10000000000000000", max_milestones_per_project: 12,
  max_versions_per_milestone: 6, max_assessments_per_version: 5, appeal_lapse_seconds: 259200,
  quotas: { CONTRACTOR: { IMAGE: 12, TEXT: 6 }, CLIENT: { IMAGE: 3, TEXT: 3 }, INSPECTOR: { IMAGE: 3, TEXT: 3 } },
  max_named: { IMAGE: 4, TEXT: 4 }, appeal_additions: { IMAGE: 2, TEXT: 2 },
} as unknown as ConfigView;

function project(over: Partial<ProjectView> = {}): ProjectView {
  return {
    project_id: "pr-00001", client: CLIENT, contractor: CONTRACTOR, inspector: INSPECTOR, state: "ACTIVE",
    inspector_accepted_at: "2026-09-19T09:00:00Z", unreserved_wei: "3000000000000000000", milestones: ["ms-00001"],
    ...over,
  } as ProjectView;
}

function item(id: number, role: ItemView["role"], kind: ItemView["kind"] = "IMAGE", over: Partial<ItemView> = {}): ItemView {
  return { item_id: `ev-${String(id).padStart(6, "0")}`, role, kind, origin: kind === "IMAGE" ? "PHOTO" : undefined,
    requirement_id: role === "CONTRACTOR" && kind === "IMAGE" ? "R1" : "", ...over } as ItemView;
}

function milestone(over: Partial<MilestoneView> = {}, items: ItemView[] = []): MilestoneView {
  return {
    milestone_id: "ms-00001", project_id: "pr-00001", current_version: 1, pending_version: null,
    state: "AWAITING_EVIDENCE", version_assessments: 0, standing: null, appeal: null,
    versions: [{
      version: 1, title: "Foundation", deadline: "2026-10-20T12:00:00Z", payment_wei: "2000000000000000000",
      criteria: [{ id: "C1", text: "cast" }],
      evidence_requirements: [{ id: "R1", text: "Photographs", kind: "IMAGE", from_role: "CONTRACTOR", min_count: 2 }],
    }],
    evidence: { "1": items },
    ...over,
  } as unknown as MilestoneView;
}

const ids = (acts: { id: string; available: boolean }[]) =>
  Object.fromEntries(acts.map((a) => [a.id, a.available]));

describe("roles", () => {
  it("recognises the parties by any spelling of their address", () => {
    expect(roleIn(project(), CLIENT.toLowerCase())).toBe("CLIENT");
    expect(roleIn(project(), CONTRACTOR)).toBe("CONTRACTOR");
    expect(roleIn(project(), INSPECTOR)).toBe("INSPECTOR");
    expect(roleIn(project(), STRANGER)).toBeNull();
    expect(roleIn(project({ inspector: "" }), "")).toBeNull();
  });
});

describe("project acts", () => {
  it("offers the client funding, withdrawal and milestones, never cancellation once signed", () => {
    const a = ids(projectActs(project(), CLIENT, cfg));
    expect(a).toMatchObject({ fund_project: true, withdraw_escrow: true, cancel_project: false, add_milestone: true });
  });

  it("refuses a milestone the free escrow cannot reserve", () => {
    const a = projectActs(project({ unreserved_wei: "0" }), CLIENT, cfg);
    expect(a.find((x) => x.id === "add_milestone")).toMatchObject({ available: false });
    expect(a.find((x) => x.id === "withdraw_escrow")).toMatchObject({ available: false });
  });

  it("offers the contractor a signature only while the project is proposed", () => {
    expect(ids(projectActs(project({ state: "PROPOSED" }), CONTRACTOR, cfg)).accept_project).toBe(true);
    expect(ids(projectActs(project(), CONTRACTOR, cfg)).accept_project).toBe(false);
  });

  it("gives a stranger nothing to do", () => {
    expect(projectActs(project(), STRANGER, cfg)).toEqual([]);
  });
});

describe("filing", () => {
  const ctx = (m: MilestoneView, addr: string, now: string, p = project()) => ({ project: p, milestone: m, addr, nowMs: at(now), config: cfg });

  it("is closed against a standing acceptance, for every party", () => {
    const m = milestone({ state: "ACCEPTED" });
    for (const who of [CLIENT, CONTRACTOR, INSPECTOR]) {
      expect(filingClosed(ctx(m, who, "2026-09-20T09:00:00Z"), "IMAGE")).toMatch(/acceptance stands/);
    }
  });

  it("closes a minute before the deadline, not after it", () => {
    const m = milestone();
    const deadline = at("2026-10-20T12:00:00Z");
    expect(filingClosed({ ...ctx(m, CONTRACTOR, "2026-10-20T11:58:00Z") }, "IMAGE")).toBe("");
    expect(filingClosed({ ...ctx(m, CONTRACTOR, "2026-10-20T11:58:00Z"), nowMs: deadline - MARGIN_MS + 1 }, "IMAGE"))
      .toMatch(/deadline has passed/);
  });

  it("keeps each party within its own quota", () => {
    const clientImages = [1, 2, 3].map((n) => item(n, "CLIENT"));
    const m = milestone({}, clientImages);
    expect(filingClosed(ctx(m, CLIENT, "2026-09-20T09:00:00Z"), "IMAGE")).toMatch(/3 images/);
    expect(filingClosed(ctx(m, CONTRACTOR, "2026-09-20T09:00:00Z"), "IMAGE")).toBe("");
  });

  it("counts only documents against the contractor's appeal allowance", () => {
    const standing = { round: 1, decision: "REJECTED", item_mark: 2, appealable: true } as MilestoneView["standing"];
    const appeal = { evidence_ends: "2026-09-20T11:00:00Z" } as MilestoneView["appeal"];
    const m = milestone({ state: "APPEALED", standing, appeal },
      [item(3, "CONTRACTOR", "DOCUMENT"), item(4, "CONTRACTOR", "DOCUMENT"), item(5, "CONTRACTOR", "DECLARATION")]);
    const c = ctx(m, CONTRACTOR, "2026-09-20T10:00:00Z");
    expect(filingClosed(c, "DOCUMENT")).toMatch(/at most 2 new documents/);
    expect(filingClosed(c, "DECLARATION")).toBe("");
  });

  it("refuses strangers and an inspector who has not accepted", () => {
    const m = milestone();
    expect(filingClosed(ctx(m, STRANGER, "2026-09-20T09:00:00Z"), "IMAGE")).toMatch(/Only the client/);
    expect(filingClosed(ctx(m, INSPECTOR, "2026-09-20T09:00:00Z", project({ inspector_accepted_at: null })), "DOCUMENT"))
      .toMatch(/Accept the inspector role/);
  });
});

describe("milestone acts across the clock", () => {
  const standing = (over = {}) => ({ round: 1, decision: "ACCEPTED", at: "2026-09-20T09:00:00Z", kind: "ASSESSMENT",
    appealable: true, appealed: false, window_ends: "2026-09-20T10:00:00Z", item_mark: 2, ...over }) as MilestoneView["standing"];

  it("lets the client appeal an acceptance inside the window, and anyone finalize after it", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing() });
    const during = ids(milestoneActs({ project: project(), milestone: m, addr: CLIENT, nowMs: at("2026-09-20T09:30:00Z"), config: cfg }));
    expect(during).toMatchObject({ open_appeal: true, finalize: false });
    const after = ids(milestoneActs({ project: project(), milestone: m, addr: STRANGER, nowMs: at("2026-09-20T10:00:01Z"), config: cfg }));
    expect(after).toMatchObject({ finalize: true });
    expect(after.open_appeal).toBeUndefined();
  });

  it("refuses the contractor's appeal once they filed more since the decision than an appeal reads", () => {
    const rejected = (items: ItemView[]) => milestone({ state: "REJECTED", standing: standing({ decision: "REJECTED" }) }, items);
    const appeal = (items: ItemView[]) =>
      milestoneActs({ project: project(), milestone: rejected(items), addr: CONTRACTOR, nowMs: at("2026-09-20T09:30:00Z"), config: cfg })
        .find((a) => a.id === "open_appeal");
    const early = [item(1, "CONTRACTOR"), item(2, "CONTRACTOR")];
    const two = [...early, item(3, "CONTRACTOR"), item(4, "CONTRACTOR")];
    expect(appeal(two)).toMatchObject({ available: true });
    expect(appeal([...two, item(5, "CONTRACTOR")])).toMatchObject({ available: false, reason: expect.stringMatching(/new assessment/) });
    // Declarations and the other parties' items never count against it.
    const docs = [item(5, "CONTRACTOR", "DOCUMENT"), item(6, "CONTRACTOR", "DOCUMENT")];
    expect(appeal([...two, ...docs, item(7, "CONTRACTOR", "DECLARATION"), item(8, "CLIENT"), item(9, "CLIENT")]))
      .toMatchObject({ available: true });
    expect(appeal([...two, ...docs, item(7, "CONTRACTOR", "DOCUMENT")])).toMatchObject({ available: false });
  });

  it("closes the appeal a minute early so a late signature cannot land after the window", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing() });
    const late = milestoneActs({ project: project(), milestone: m, addr: CLIENT, nowMs: at("2026-09-20T09:59:30Z"), config: cfg });
    expect(late.find((a) => a.id === "open_appeal")).toMatchObject({ available: false });
  });

  it("finalizes an appeal's upheld acceptance at once", () => {
    const m = milestone({ state: "ACCEPTED", standing: standing({ kind: "APPEAL", appealable: false, window_ends: null }) });
    expect(ids(milestoneActs({ project: project(), milestone: m, addr: STRANGER, nowMs: at("2026-09-20T09:01:00Z"), config: cfg })).finalize).toBe(true);
  });

  it("decides an appeal only after its evidence period, and lapses it three days later", () => {
    const appeal = { evidence_ends: "2026-09-20T11:00:00Z" } as MilestoneView["appeal"];
    const m = milestone({ state: "APPEALED", standing: standing({ appealed: true }), appeal });
    const acts = (iso: string) => ids(milestoneActs({ project: project(), milestone: m, addr: STRANGER, nowMs: at(iso), config: cfg }));
    expect(acts("2026-09-20T11:00:00Z")).toMatchObject({ decide_appeal: false });
    expect(acts("2026-09-20T11:00:01Z")).toMatchObject({ decide_appeal: true });
    expect(acts("2026-09-23T11:00:00Z").lapse_appeal).toBeUndefined();
    expect(acts("2026-09-23T11:00:01Z")).toMatchObject({ lapse_appeal: true });
  });

  it("closes a milestone never accepted only after its deadline and any window", () => {
    const rejected = milestone({ state: "REJECTED", standing: standing({ decision: "REJECTED", window_ends: "2026-10-20T13:00:00Z" }) });
    const acts = (iso: string) => ids(milestoneActs({ project: project(), milestone: rejected, addr: STRANGER, nowMs: at(iso), config: cfg }));
    expect(acts("2026-10-20T12:00:00Z").close_milestone).toBe(false);
    expect(acts("2026-10-20T12:30:00Z").close_milestone).toBe(false);
    expect(acts("2026-10-20T13:00:01Z").close_milestone).toBe(true);
  });

  it("caps assessments per version", () => {
    const m = milestone({ version_assessments: 5 });
    const a = milestoneActs({ project: project(), milestone: m, addr: CONTRACTOR, nowMs: at("2026-09-20T09:00:00Z"), config: cfg });
    expect(a.find((x) => x.id === "request_assessment")).toMatchObject({ available: false });
  });
});

describe("coverage", () => {
  it("counts the contractor's named items and every counterparty item, never a declaration", () => {
    const items = [item(1, "CONTRACTOR"), item(2, "CONTRACTOR"), item(3, "CONTRACTOR", "DECLARATION")];
    const m = milestone({}, items);
    expect(coverageGap(m, ["ev-000001"])).toMatch(/needs 2 items from the contractor/);
    expect(coverageGap(m, ["ev-000001", "ev-000002"])).toBe("");
    const onlyWords = milestone({ versions: [{ ...milestone().versions[0]!, evidence_requirements: [] }] }, [item(3, "CONTRACTOR", "DECLARATION")]);
    expect(coverageGap(onlyWords, ["ev-000003"])).toMatch(/at least one image or document/);
  });
});
