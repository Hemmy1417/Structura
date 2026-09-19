/**
 * The one place machine values become words. Every enum the contract
 * returns has a label here (with a humanize fallback so nothing ever renders
 * raw), dates are spelled by hand so every browser shows the same month,
 * amounts read as GEN, and record ids become sheet numbers.
 */
import type {
  Decision, EventView, ImageOrigin, ItemKind, MilestoneState, ProjectState, Role, RoundKind, Status,
} from "./types";

/* ── fallback ── */

export function humanize(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : "";
}

function label<T extends string>(map: Record<T, string>, value: string | null | undefined): string {
  if (!value) return "";
  return (map as Record<string, string>)[value] ?? humanize(value);
}

/* ── enums ── */

const PROJECT_STATE: Record<ProjectState, string> = {
  PROPOSED: "Awaiting the contractor",
  ACTIVE: "Active",
  CANCELLED: "Cancelled",
};
export const projectState = (s: string) => label(PROJECT_STATE, s);

const MILESTONE_STATE: Record<MilestoneState, string> = {
  AWAITING_TERMS: "Terms awaiting signature",
  AWAITING_EVIDENCE: "Awaiting evidence",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  UNDETERMINED: "Undetermined",
  APPEALED: "Under appeal",
  FINALIZED: "Paid",
  CLOSED: "Closed",
};
export const milestoneState = (s: string) => label(MILESTONE_STATE, s);

const DECISION: Record<Decision, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  UNDETERMINED: "Undetermined",
};
export const decision = (s: string) => label(DECISION, s);

const STATUS: Record<Status, string> = { MET: "Met", NOT_MET: "Not met", UNCLEAR: "Unclear" };
export const status = (s: string) => label(STATUS, s);

const READING: Record<string, string> = { SUPPORTS: "Supports", CONTRADICTS: "Contradicts", NOT_SHOWN: "Does not show" };
export const reading = (s: string) => label(READING, s);

const ROLE: Record<Role, string> = { CLIENT: "Client", CONTRACTOR: "Contractor", INSPECTOR: "Inspector" };
export const role = (s: string) => label(ROLE, s);
export const roleLower = (s: string) => role(s).toLowerCase();

const ORIGIN: Record<ImageOrigin, string> = { PHOTO: "Photograph", VIDEO_FRAME: "Video frame", SCAN: "Scanned page" };
const KIND: Record<ItemKind, string> = { IMAGE: "Image", DOCUMENT: "Document", DECLARATION: "Declaration" };
export function itemKind(kind: string, origin?: string | null): string {
  if (kind === "IMAGE" && origin) return label(ORIGIN, origin);
  return label(KIND, kind);
}

const REQUIREMENT_KIND: Record<string, string> = { IMAGE: "Images", DOCUMENT: "Documents" };
export const requirementKind = (s: string) => label(REQUIREMENT_KIND, s);

const QUALITY: Record<string, string> = {
  SUFFICIENT: "Sufficient",
  INSUFFICIENT: "Insufficient",
  CONFLICTING: "Conflicting",
};
export const quality = (s: string) => label(QUALITY, s);

const ROUND_KIND: Record<RoundKind, string> = { ASSESSMENT: "Assessment", APPEAL: "Appeal" };
export const roundKind = (s: string) => label(ROUND_KIND, s);

const EVENT: Record<EventView["kind"], string> = {
  PROJECT_CREATED: "Project created",
  ESCROW_FUNDED: "Escrow funded",
  PROJECT_ACCEPTED: "Contractor signed the project",
  INSPECTOR_ACCEPTED: "Inspector accepted the role",
  PROJECT_CANCELLED: "Project cancelled",
  ESCROW_WITHDRAWN: "Escrow withdrawn",
  MILESTONE_PROPOSED: "Milestone proposed",
  VERSION_PROPOSED: "New terms proposed",
  VERSION_ACCEPTED: "New terms signed",
  EVIDENCE_FILED: "Evidence filed",
  DECISION: "Decision recorded",
  APPEAL_OPENED: "Appeal opened",
  APPEAL_LAPSED: "Appeal lapsed",
  MILESTONE_PAID: "Milestone paid",
  MILESTONE_CLOSED: "Milestone closed",
};
export const eventKind = (s: string) => label(EVENT, s);

/* ── record ids as sheet numbers ── */

function tail(id: string): number {
  const n = Number(String(id).split("-")[1]);
  return Number.isFinite(n) ? n : 0;
}

/** pr-00001 reads "P-001", the project's sheet number. */
export const projectSheet = (pid: string) => `P-${String(tail(pid)).padStart(3, "0")}`;
/** ms-00012 reads "M-012". */
export const milestoneSheet = (mid: string) => `M-${String(tail(mid)).padStart(3, "0")}`;
/** A round's certificate number: "M-012/2". */
export const certificateNo = (mid: string, n: number) => `${milestoneSheet(mid)}/${n}`;
/** ev-000013 reads "Item 13". */
export const itemName = (eid: string) => `Item ${tail(eid)}`;
export const itemNumber = (eid: string) => tail(eid);

/* ── amounts ── */

const WEI = 10n ** 18n;

/** GEN with up to four decimals, trailing zeros trimmed: "2 GEN", "0.05 GEN". */
export function gen(wei: string | bigint | number | null | undefined, unit = true): string {
  let v: bigint;
  try {
    v = BigInt(wei ?? 0);
  } catch {
    v = 0n;
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / WEI;
  const frac = v % WEI;
  let fracText = (frac * 10000n / WEI).toString().padStart(4, "0").replace(/0+$/, "");
  if (!fracText && frac > 0n) fracText = "0001";
  const body = `${whole.toLocaleString("en-US")}${fracText ? `.${fracText}` : ""}`;
  return `${neg ? "-" : ""}${body}${unit ? " GEN" : ""}`;
}

/** Parse a GEN amount a person typed ("2", "0.05") into wei; null if unreadable. */
export function parseGen(text: string): bigint | null {
  const t = text.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return BigInt(whole!) * WEI + BigInt((frac + "0".repeat(18)).slice(0, 18) || "0");
}

/* ── time ── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "19 Sep 2026", in UTC like every time the contract records. */
export function day(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
}

/** "19 Sep 2026, 15:24 UTC". */
export function moment(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day(iso)}, ${hh}:${mm} UTC`;
}

/** "10 minutes", "1 hour", "7 days". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (s < 60) return unit(s, "second");
  if (s < 3600) return unit(Math.round(s / 60), "minute");
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${unit(h, "hour")} ${unit(m, "minute")}` : unit(h, "hour");
  }
  const d = Math.floor(s / 86400);
  const h = Math.round((s % 86400) / 3600);
  return h ? `${unit(d, "day")} ${unit(h, "hour")}` : unit(d, "day");
}

/** "in 42 minutes" or "3 hours ago", relative to a clock the caller supplies. */
export function relative(iso: string | null | undefined, nowMs: number): string {
  const d = parse(iso);
  if (!d) return "";
  const diff = (d.getTime() - nowMs) / 1000;
  if (Math.abs(diff) < 45) return "now";
  const text = duration(Math.abs(diff)).split(" ").slice(0, 2).join(" ");
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

/* ── words ── */

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** 0xAbCd…1234, for verification sections only. */
export function shortAddress(addr: string): string {
  return addr && addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** 0x1234ab…cdef for digests and hashes in verification sections. */
export function shortHash(hex: string): string {
  const h = hex.startsWith("0x") ? hex : `0x${hex}`;
  return h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}

/** Bytes as "155 KB". */
export function size(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * A contract refusal as a sentence: the machine tag stripped, capitalised,
 * ending in a full stop.
 */
export function refusal(text: string): string {
  const body = text.replace(/\[EXPECTED\]|\[LLM_ERROR\]/g, "").replace(/^[\s:]+/, "").trim();
  if (!body) return "The contract refused this action.";
  const sentence = body[0]!.toUpperCase() + body.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/** The first letter capitalised, the rest untouched. */
export function capital(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}
