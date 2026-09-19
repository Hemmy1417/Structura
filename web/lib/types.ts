/**
 * The shapes the contract's views return, field for field. Wei amounts are
 * decimal strings (JSON has no big integers); timestamps are UTC ISO
 * strings written by the contract from the transaction datetime.
 */

export type Role = "CLIENT" | "CONTRACTOR" | "INSPECTOR";
export type ProjectState = "PROPOSED" | "ACTIVE" | "CANCELLED";
export type MilestoneState =
  | "AWAITING_TERMS"
  | "AWAITING_EVIDENCE"
  | "ACCEPTED"
  | "REJECTED"
  | "UNDETERMINED"
  | "APPEALED"
  | "FINALIZED"
  | "CLOSED";
export type Decision = "ACCEPTED" | "REJECTED" | "UNDETERMINED";
export type Status = "MET" | "NOT_MET" | "UNCLEAR";
export type ItemKind = "IMAGE" | "DOCUMENT" | "DECLARATION";
export type ImageOrigin = "PHOTO" | "VIDEO_FRAME" | "SCAN";
export type RequirementKind = "IMAGE" | "DOCUMENT";
export type RoundKind = "ASSESSMENT" | "APPEAL";
export type Bucket = "IMAGE" | "TEXT";

export interface ConfigView {
  ruleset: string;
  owner: string;
  min_payment_wei: string;
  max_milestones_per_project: number;
  max_versions_per_milestone: number;
  max_criteria: number;
  max_evidence_requirements: number;
  max_assessments_per_version: number;
  min_appeal_window_seconds: number;
  max_appeal_window_seconds: number;
  appeal_lapse_seconds: number;
  max_deadline_days_ahead: number;
  quotas: Record<Role, Record<Bucket, number>>;
  max_named: Record<Bucket, number>;
  appeal_additions: Record<Bucket, number>;
  round_capacity: Record<Bucket, number>;
  image_max_bytes: number;
  text_max_chars: number;
  declaration_max_chars: number;
}

export interface StatsView {
  projects: number;
  milestones: number;
  evidence_items: number;
  rounds: number;
  finalized: number;
  paid_wei: string;
}

export interface IdPage {
  total: number;
  project_ids: string[];
}

export interface Standing {
  round: number;
  decision: Decision;
  at: string;
  kind: RoundKind | "APPEAL_LAPSED";
  appealable: boolean;
  appealed: boolean;
  window_ends: string | null;
  item_mark: number;
}

export interface Appeal {
  against: "ACCEPTED" | "REJECTED";
  reviewed_round: number;
  appellant: string;
  appellant_role: Role;
  reason: string;
  opened_at: string;
  evidence_ends: string;
  lapsed_at?: string;
}

export interface MilestoneSummary {
  milestone_id: string;
  index: number;
  state: MilestoneState;
  title: string;
  payment_wei: string;
  deadline: string;
  current_version: number;
  latest_version: number;
  pending_version: number | null;
  standing: Standing | null;
  appeal: Appeal | null;
  rounds_count: number;
}

export interface ProjectView {
  project_id: string;
  ruleset: string;
  title: string;
  description: string;
  site: string;
  client: string;
  contractor: string;
  inspector: string;
  appeal_window_seconds: number;
  state: ProjectState;
  created_at: string;
  contractor_accepted_at: string | null;
  inspector_accepted_at: string | null;
  funded_wei: string;
  escrow_wei: string;
  reserved_wei: string;
  paid_wei: string;
  returned_wei: string;
  milestones: string[];
  milestone_summaries: MilestoneSummary[];
  unreserved_wei: string;
  events_count: number;
  now: string;
}

export interface Criterion {
  id: string;
  text: string;
}

export interface EvidenceRequirement {
  id: string;
  text: string;
  kind: RequirementKind;
  from_role: "CONTRACTOR" | "INSPECTOR";
  min_count: number;
}

export interface Version {
  version: number;
  title: string;
  description: string;
  requirements: string;
  specification: string;
  criteria: Criterion[];
  evidence_requirements: EvidenceRequirement[];
  payment_wei: string;
  deadline: string;
  proposed_at: string;
  accepted_at: string | null;
}

export interface ItemView {
  item_id: string;
  milestone_id: string;
  project_id: string;
  version: number;
  kind: ItemKind;
  requirement_id: string;
  submitter: string;
  role: Role;
  submitted_at: string;
  caption: string;
  sha256: string;
  bytes: number;
  /** images */
  origin?: ImageOrigin;
  origin_ref?: string;
  claimed_capture?: string;
  claimed_location?: string;
  format?: "PNG" | "JPEG";
  /** documents */
  reference?: string;
  chars?: number;
  /** documents and declarations, from get_item only */
  text?: string;
}

export interface MilestoneView {
  milestone_id: string;
  project_id: string;
  index: number;
  versions: Version[];
  current_version: number;
  pending_version: number | null;
  state: MilestoneState;
  reserved_wei: string;
  rounds_count: number;
  version_assessments: number;
  standing: Standing | null;
  appeal: Appeal | null;
  lapsed_appeals: Appeal[];
  finalized_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  evidence: Record<string, ItemView[]>;
  now: string;
}

export interface SnapshotRow {
  item_id: string;
  kind: ItemKind;
  origin: ImageOrigin | "";
  role: Role;
  requirement_id: string;
  sha256: string;
  bytes: number;
  caption: string;
  new: boolean;
}

export interface ImageFinding {
  item_id: string;
  role: Role;
  origin: ImageOrigin;
  visible_detail: string;
  readings: Record<string, "SUPPORTS" | "CONTRADICTS" | "NOT_SHOWN">;
  concerns: string[];
  readable: boolean;
}

export interface LeaderNotes {
  reasoning?: string;
  conflict_note?: string;
  basis?: Record<string, string[]>;
  images?: ImageFinding[];
}

export interface RoundView {
  round: number;
  kind: RoundKind;
  milestone_id: string;
  project_id: string;
  version: number;
  triggered_by: string;
  at: string;
  evidence: SnapshotRow[];
  submitters: Role[];
  criteria: { id: string; status: Status }[];
  decisive_criteria: string[];
  conflicts_detected: boolean;
  evidence_quality: "SUFFICIENT" | "INSUFFICIENT" | "CONFLICTING";
  decision: Decision;
  leader_notes: LeaderNotes;
  appeal: Appeal | null;
  appealable: boolean;
  window_ends: string | null;
  ruleset: string;
}

export interface BalanceView {
  claimable: string;
  claimed: string;
}

export interface EventView {
  n: number;
  kind:
    | "PROJECT_CREATED"
    | "ESCROW_FUNDED"
    | "PROJECT_ACCEPTED"
    | "INSPECTOR_ACCEPTED"
    | "PROJECT_CANCELLED"
    | "ESCROW_WITHDRAWN"
    | "MILESTONE_PROPOSED"
    | "VERSION_PROPOSED"
    | "VERSION_ACCEPTED"
    | "EVIDENCE_FILED"
    | "DECISION"
    | "APPEAL_OPENED"
    | "APPEAL_LAPSED"
    | "MILESTONE_PAID"
    | "MILESTONE_CLOSED";
  milestone_id: string;
  detail: string;
  by: string;
  at: string;
}

export interface EventsView {
  total: number;
  events: EventView[];
}
