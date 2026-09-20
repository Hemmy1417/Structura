/**
 * What each person can do next, decided as a pure function of the record,
 * the viewer's address and the clock, mirroring the contract's own checks.
 * An act the contract would refuse is never a button that fails: it is
 * listed with the reason, in words. Acts that must land BEFORE a boundary
 * close a minute early, because a transaction signed at the last second can
 * execute after it.
 */
import type { ConfigView, ItemView, MilestoneSummary, MilestoneView, ProjectView, Role } from "./types";

export const MARGIN_MS = 60_000;

export type ActId =
  | "accept_project" | "accept_inspector_role" | "fund_project" | "withdraw_escrow"
  | "cancel_project" | "add_milestone"
  | "accept_version" | "propose_version" | "file_image" | "file_document" | "file_declaration"
  | "request_assessment" | "open_appeal" | "decide_appeal" | "lapse_appeal" | "finalize"
  | "close_milestone";

export interface Act {
  id: ActId;
  available: boolean;
  /** why it is unavailable, or what it will do */
  reason: string;
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
const same = (a: string, b: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function roleIn(p: ProjectView, addr: string): Role | null {
  if (same(addr, p.client)) return "CLIENT";
  if (same(addr, p.contractor)) return "CONTRACTOR";
  if (p.inspector && same(addr, p.inspector)) return "INSPECTOR";
  return null;
}

const ok = (id: ActId, reason: string): Act => ({ id, available: true, reason });
const no = (id: ActId, reason: string): Act => ({ id, available: false, reason });

/* ── project ── */

export function projectActs(p: ProjectView, addr: string, cfg: ConfigView | null): Act[] {
  const who = roleIn(p, addr);
  const acts: Act[] = [];
  if (who === "CONTRACTOR") {
    acts.push(p.state === "PROPOSED"
      ? ok("accept_project", "Sign the project and every milestone's terms proposed so far.")
      : no("accept_project", p.state === "ACTIVE" ? "You signed this project." : "The project was cancelled."));
  }
  if (who === "INSPECTOR") {
    acts.push(p.inspector_accepted_at
      ? no("accept_inspector_role", "You accepted the inspector role.")
      : p.state === "CANCELLED"
        ? no("accept_inspector_role", "The project was cancelled.")
        : ok("accept_inspector_role", "Accept the role so you can file inspection evidence."));
  }
  if (who === "CLIENT") {
    const unreserved = BigInt(p.unreserved_wei);
    const cancelled = p.state === "CANCELLED";
    acts.push(cancelled ? no("fund_project", "The project was cancelled.")
      : ok("fund_project", "Add escrow that milestones can reserve."));
    acts.push(unreserved > 0n
      ? ok("withdraw_escrow", "Take back escrow no milestone has reserved.")
      : no("withdraw_escrow", "Every unit of escrow is reserved by a milestone."));
    acts.push(p.state === "PROPOSED"
      ? ok("cancel_project", "Walk away with the whole escrow; the contractor has not signed.")
      : no("cancel_project", cancelled ? "The project was cancelled."
        : "The contractor signed; milestones close at their deadlines instead."));
    const max = cfg?.max_milestones_per_project ?? 12;
    const min = BigInt(cfg?.min_payment_wei ?? "10000000000000000");
    acts.push(cancelled ? no("add_milestone", "The project was cancelled.")
      : p.milestones.length >= max ? no("add_milestone", `A project holds at most ${max} milestones.`)
        : unreserved < min ? no("add_milestone", "Fund the escrow first: a milestone reserves its payment.")
          : ok("add_milestone", "Propose a milestone; its payment is reserved from the escrow."));
  }
  return acts;
}

/* ── milestone ── */

export interface MilestoneContext {
  project: ProjectView;
  milestone: MilestoneView;
  addr: string;
  nowMs: number;
  config: ConfigView | null;
}

const SETTLED = ["FINALIZED", "CLOSED"];
const TERMS_LOCKED = ["ACCEPTED", "APPEALED", "FINALIZED", "CLOSED"];

export function currentTerms(m: MilestoneView) {
  return m.current_version > 0 ? m.versions[m.current_version - 1] ?? null : null;
}

export function shownTerms(m: MilestoneView) {
  return currentTerms(m) ?? m.versions[m.versions.length - 1]!;
}

export function currentItems(m: MilestoneView): ItemView[] {
  return m.current_version > 0 ? m.evidence[String(m.current_version)] ?? [] : [];
}

const bucketOf = (kind: string) => (kind === "IMAGE" ? "IMAGE" : "TEXT");

/** Why filing is closed right now, for this role and kind, or "" if it is open. */
export function filingClosed(ctx: MilestoneContext, kind: "IMAGE" | "DOCUMENT" | "DECLARATION"): string {
  const { project: p, milestone: m, addr, nowMs, config } = ctx;
  const who = roleIn(p, addr);
  if (!who) return "Only the client, the contractor and the named inspector file evidence.";
  if (p.state !== "ACTIVE") return "Evidence is filed once the contractor has signed the project.";
  if (who === "INSPECTOR" && !p.inspector_accepted_at) return "Accept the inspector role first.";
  if (SETTLED.includes(m.state)) return "The milestone is settled.";
  const terms = currentTerms(m);
  if (!terms) return "The contractor has not signed the terms yet.";
  if (m.state === "ACCEPTED") {
    return who === "CLIENT"
      ? "The acceptance stands. To contest it, open an appeal; every party can then add evidence."
      : "The acceptance stands. Evidence is added only during an appeal.";
  }
  if (m.state === "APPEALED") {
    if (nowMs > ms(m.appeal?.evidence_ends) - MARGIN_MS) return "The appeal's evidence period has ended.";
  } else if (nowMs > ms(terms.deadline) - MARGIN_MS) {
    return "The deadline has passed; evidence is accepted only during an appeal.";
  }
  const items = currentItems(m);
  const bucket = bucketOf(kind);
  const quota = config?.quotas[who][bucket];
  const mine = items.filter((it) => it.role === who && bucketOf(it.kind) === bucket);
  if (quota !== undefined && mine.length >= quota) {
    return `You have filed the ${quota} ${bucket === "IMAGE" ? "images" : "documents and declarations"} these terms allow you.`;
  }
  if (m.state === "APPEALED" && who === "CONTRACTOR" && m.standing && kind !== "DECLARATION") {
    // A declaration is never read, so it never uses the appeal's allowance.
    const limit = config?.appeal_additions[bucket] ?? 2;
    const added = mine.filter((it) => it.kind !== "DECLARATION" && Number(it.item_id.split("-")[1]) > m.standing!.item_mark);
    if (added.length >= limit) return `An appeal reads at most ${limit} new ${bucket === "IMAGE" ? "images" : "documents"} from the contractor.`;
  }
  return "";
}

export function milestoneActs(ctx: MilestoneContext): Act[] {
  const { project: p, milestone: m, addr, nowMs, config } = ctx;
  const who = roleIn(p, addr);
  const acts: Act[] = [];
  const terms = currentTerms(m);
  const standing = m.standing;

  if (who === "CONTRACTOR" && m.pending_version) {
    const pending = m.versions[m.pending_version - 1];
    acts.push(p.state !== "ACTIVE" ? no("accept_version", "Sign the project first; it signs these terms too.")
      : TERMS_LOCKED.includes(m.state) ? no("accept_version", "The milestone no longer takes new terms.")
        : nowMs > ms(pending?.deadline) - MARGIN_MS
          ? no("accept_version", "That version's deadline has passed; the client proposes new terms.")
          : ok("accept_version", `Sign version ${m.pending_version} of the terms.`));
  }
  if (who === "CLIENT") {
    const maxV = config?.max_versions_per_milestone ?? 6;
    acts.push(p.state === "CANCELLED" ? no("propose_version", "The project was cancelled.")
      : TERMS_LOCKED.includes(m.state) ? no("propose_version", "Terms cannot change under a standing acceptance, an open appeal or a settled milestone.")
        : m.versions.length >= maxV ? no("propose_version", `A milestone holds at most ${maxV} versions.`)
          : ok("propose_version", "Propose new terms; the current ones stay in force until the contractor signs."));
  }
  if (who) {
    for (const [id, kind] of [["file_image", "IMAGE"], ["file_document", "DOCUMENT"], ["file_declaration", "DECLARATION"]] as const) {
      const closed = filingClosed(ctx, kind);
      acts.push(closed ? no(id, closed) : ok(id, "File it on the record, hashed by the contract."));
    }
  }
  if (who === "CONTRACTOR") {
    const max = config?.max_assessments_per_version ?? 5;
    acts.push(
      p.state !== "ACTIVE" ? no("request_assessment", "The project is not active.")
        : !["AWAITING_EVIDENCE", "UNDETERMINED", "REJECTED"].includes(m.state)
          ? no("request_assessment", m.state === "APPEALED" ? "An appeal is open; it is decided first."
            : m.state === "ACCEPTED" ? "An acceptance stands." : "The milestone is settled.")
          : !terms ? no("request_assessment", "Sign the terms first.")
            : nowMs > ms(terms.deadline) - MARGIN_MS ? no("request_assessment", "The deadline has passed.")
              : m.version_assessments >= max ? no("request_assessment", `These terms have had the ${max} assessments they allow.`)
                : ok("request_assessment", "Ask the validators to judge your evidence and everything the other parties filed."),
    );
  }
  if (standing && (m.state === "ACCEPTED" || m.state === "REJECTED")) {
    const adverse: Role = m.state === "ACCEPTED" ? "CLIENT" : "CONTRACTOR";
    if (who === adverse) {
      const overflow = adverse === "CONTRACTOR" ? appealOverflow(m, config) : "";
      acts.push(!standing.appealable ? no("open_appeal", "This decision is an appeal's outcome; it is final.")
        : nowMs > ms(standing.window_ends) - MARGIN_MS ? no("open_appeal", "The appeal window has closed.")
          : overflow ? no("open_appeal", overflow)
            : ok("open_appeal", "Contest the decision once; an evidence period follows for every party."));
    }
  }
  if (m.state === "APPEALED" && m.appeal) {
    const ends = ms(m.appeal.evidence_ends);
    acts.push(nowMs <= ends ? no("decide_appeal", "The evidence period is still open.")
      : ok("decide_appeal", "Anyone can ask the validators to decide the appeal now."));
    const lapse = ends + (config?.appeal_lapse_seconds ?? 259_200) * 1000;
    if (nowMs > lapse) acts.push(ok("lapse_appeal", "No decision in three days: the appealed decision was never confirmed."));
  }
  if (m.state === "ACCEPTED" && standing) {
    acts.push(standing.appealable && nowMs <= ms(standing.window_ends)
      ? no("finalize", "The client's appeal window is still open.")
      : ok("finalize", "Anyone can finalize: the payment is credited to the contractor."));
  }
  if (!["ACCEPTED", "APPEALED", "FINALIZED", "CLOSED"].includes(m.state)) {
    const deadline = ms(shownTerms(m).deadline);
    const windowOpen = standing?.window_ends && nowMs <= ms(standing.window_ends);
    // New terms the contractor can still sign keep the milestone alive, so a
    // permissionless close cannot end a renegotiation.
    const pending = m.pending_version ? m.versions[m.pending_version - 1] : null;
    const renegotiating = !!pending && nowMs <= ms(pending.deadline);
    acts.push(nowMs <= deadline ? no("close_milestone", "The deadline has not passed.")
      : windowOpen ? no("close_milestone", "A decision's appeal window is still open.")
        : renegotiating ? no("close_milestone", "New terms await the contractor's signature, and their deadline has not passed.")
          : ok("close_milestone", "Anyone can close it: the reservation returns to the client's escrow."));
  }
  return acts;
}

/**
 * Why the contractor cannot appeal because of what they filed since the
 * decision, or "". An appeal reads at most a few new contractor items; more
 * than that is a new assessment's work, and the contract refuses the appeal.
 */
function appealOverflow(m: MilestoneView, config: ConfigView | null): string {
  if (!m.standing) return "";
  const mark = m.standing.item_mark;
  const added = currentItems(m).filter((it) =>
    it.role === "CONTRACTOR" && it.kind !== "DECLARATION" && Number(it.item_id.split("-")[1]) > mark);
  const images = added.filter((it) => it.kind === "IMAGE").length;
  const texts = added.length - images;
  const cap = config?.appeal_additions ?? { IMAGE: 2, TEXT: 2 };
  return images > cap.IMAGE || texts > cap.TEXT
    ? `Since the decision you filed more than an appeal reads (${cap.IMAGE} images, ${cap.TEXT} documents). Request a new assessment instead.`
    : "";
}

/**
 * The coverage gap an assessment of these contractor items would hit, in
 * the contract's words, or "" when every evidence requirement is met. The
 * other parties' items always count; they are read automatically.
 */
export function coverageGap(m: MilestoneView, named: string[]): string {
  const terms = currentTerms(m);
  if (!terms) return "The terms are not signed yet.";
  const items = currentItems(m);
  const chosen = items.filter((it) => it.kind !== "DECLARATION" && (it.role !== "CONTRACTOR" || named.includes(it.item_id)));
  for (const req of terms.evidence_requirements) {
    const have = chosen.filter((it) =>
      it.requirement_id === req.id && it.role === req.from_role && (
        req.kind === "IMAGE"
          ? it.kind === "IMAGE" && (it.origin === "PHOTO" || it.origin === "VIDEO_FRAME")
          : it.kind === "DOCUMENT" || (it.kind === "IMAGE" && it.origin === "SCAN")
      )).length;
    if (have < req.min_count) {
      return `${req.text} needs ${req.min_count} item${req.min_count === 1 ? "" : "s"} from the ${req.from_role.toLowerCase()}.`;
    }
  }
  if (!chosen.length) return "Choose at least one image or document.";
  return "";
}

/**
 * The milestone of the featured project that shows the whole path, for the
 * cover: one a round has actually decided, a paid one first, then an
 * accepted one. A milestone still waiting on evidence demonstrates nothing,
 * so nothing is featured until one has been judged.
 */
export function workedExample(p: ProjectView | null | undefined): MilestoneSummary | null {
  const decided = (p?.milestone_summaries ?? []).filter((m) => !!m.standing && m.rounds_count > 0);
  return decided.find((m) => m.state === "FINALIZED")
    ?? decided.find((m) => m.standing?.decision === "ACCEPTED")
    ?? decided[0]
    ?? null;
}
