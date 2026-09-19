/**
 * Reading one transaction's consensus record straight from Studio Next:
 * the contract's refusal sentence for a refused write, and for a round, the
 * panel itself: every leader rotation, each node's model, its vote, and the
 * lines the contract printed (the leader's reading, a validator's reason
 * for disagreeing). Nothing here is inferred; it is the receipt, decoded.
 */
import { RPC_URL } from "./chain";

type Raw = Record<string, unknown>;

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (data.error) throw new Error(String(data.error.message ?? `${method} refused`));
  return data.result;
}

async function fetchTx(hash: string): Promise<Raw> {
  const tx = (await rpc("eth_getTransactionByHash", [hash])) as Raw | null;
  if (!tx) throw new Error("The network does not know this transaction.");
  return tx;
}

function leaderRow(rows: Raw[]): Raw | undefined {
  return rows.find((r) => r.mode !== "validator") ?? rows[0];
}

/** The text a leader receipt carries: base64, one tag byte first. */
export function decodeResult(result: unknown): string {
  if (typeof result !== "string") return "";
  try {
    const bytes = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    // Control characters (the tag byte among them) read as spaces.
    return Array.from(text, (c) => (c.charCodeAt(0) < 0x20 ? " " : c)).join("").trim();
  } catch {
    return "";
  }
}

/** The JSON a successful write returned, decoded from its receipt. */
export async function returnedJson<T>(hash: string): Promise<T | null> {
  const tx = await fetchTx(hash);
  const cd = tx.consensus_data as { leader_receipt?: Raw[] } | undefined;
  const text = decodeResult(leaderRow(cd?.leader_receipt ?? [])?.result);
  const i = text.indexOf("{");
  const j = text.lastIndexOf("}");
  if (i < 0 || j < i) return null;
  try {
    return JSON.parse(text.slice(i, j + 1)) as T;
  } catch {
    return null;
  }
}

/** The contract's sentence for a refused write. */
export async function refusalOf(hash: string): Promise<string | null> {
  const tx = await fetchTx(hash);
  const cd = tx.consensus_data as { leader_receipt?: Raw[] } | undefined;
  const text = decodeResult(leaderRow(cd?.leader_receipt ?? [])?.result);
  return text || null;
}

/* ── the panel ── */

export interface PanelNode {
  leader: boolean;
  model: string;
  vote: "agree" | "disagree" | "idle" | "proposed" | string;
  /** the leader's reading, or a validator's stated reason */
  note: string;
}

export interface PanelRotation {
  label: string;
  nodes: PanelNode[];
}

export interface PanelSummary {
  hash: string;
  status: string;
  result: string;
  rotations: PanelRotation[];
}

/** "openai/gpt-5.4", "policy:dev-gpt-5-4" -> "GPT-5.4"; unknown routes are shown as named. */
export function modelName(raw: string): string {
  const s = raw.toLowerCase();
  const known: [RegExp, string][] = [
    [/gpt-oss/, "GPT-OSS"],
    [/gpt-?5[.-]4/, "GPT-5.4"],
    [/claude-sonnet-?4[.-]6/, "Claude Sonnet 4.6"],
    [/sonnet/, "Claude Sonnet"],
    [/gemini-3-flash/, "Gemini 3 Flash"],
    [/gemini/, "Gemini"],
    [/deepseek/, "DeepSeek"],
    [/grok/, "Grok"],
    [/mistral/, "Mistral"],
  ];
  for (const [re, name] of known) if (re.test(s)) return name;
  return raw.replace(/^policy:dev-/, "") || "Unnamed model";
}

function linesOf(row: Raw): string[] {
  const out = String((row.genvm_result as Raw | undefined)?.stdout ?? "");
  return out.split("\n").filter((l) => l.includes("[ROUND]") || l.includes("[DISAGREE]") || l.includes("[LOOK]"));
}

/** Everything after the first marker, or "" when it is absent. */
function after(text: string, marker: string): string {
  const i = text.indexOf(marker);
  return i < 0 ? "" : text.slice(i + marker.length);
}

/** A printed line as a sentence a person can read. */
export function noteOf(line: string): string {
  if (line.includes("[ROUND]")) return after(line, " why: ").trim();
  if (line.includes("[DISAGREE]")) {
    const body = after(line, "[DISAGREE]");
    const cut = body.indexOf("; mine=");
    const reason = (cut < 0 ? body : body.slice(0, cut)).trim();
    const why = cut < 0 ? "" : after(body.slice(cut), " why: ").trim();
    return `${reason ? reason[0]!.toUpperCase() + reason.slice(1) : "Disagreed"}.${why ? ` Its reading: ${why}` : ""}`;
  }
  return line.replace(/^\s*\[LOOK\]\s*/, "").trim();
}

function nodeOf(row: Raw, leader: boolean): PanelNode {
  const cfg = row.node_config as { primary_model?: { model?: string } } | undefined;
  const lines = linesOf(row);
  const vote = leader ? "proposed" : String(row.vote ?? "idle");
  return {
    leader,
    model: modelName(String(cfg?.primary_model?.model ?? "")),
    vote,
    note: lines.map(noteOf).filter(Boolean).join(" "),
  };
}

export async function panelOf(hash: string): Promise<PanelSummary> {
  const tx = await fetchTx(hash);
  const history = (tx.consensus_history as { consensus_results?: Raw[] } | undefined)?.consensus_results;
  const rotations: PanelRotation[] = [];
  if (history?.length) {
    for (const r of history) {
      const leaders = (r.leader_result as Raw[] | undefined) ?? [];
      const lead = leaderRow(leaders);
      const validators = (r.validator_results as Raw[] | undefined) ?? [];
      rotations.push({
        label: String(r.consensus_round ?? ""),
        nodes: [...(lead ? [nodeOf(lead, true)] : []), ...validators.map((v) => nodeOf(v, false))],
      });
    }
  } else {
    const cd = tx.consensus_data as { leader_receipt?: Raw[]; validators?: Raw[] } | undefined;
    const lead = leaderRow(cd?.leader_receipt ?? []);
    rotations.push({
      label: "Final",
      nodes: [...(lead ? [nodeOf(lead, true)] : []), ...(cd?.validators ?? []).map((v) => nodeOf(v, false))],
    });
  }
  return {
    hash,
    status: String(tx.status ?? tx.statusName ?? ""),
    result: String(tx.result_name ?? ""),
    rotations,
  };
}
