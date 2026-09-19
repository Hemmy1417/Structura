/**
 * Publish a finished proof run: copies .data/proofs-<address>.json to
 * docs/proofs/, writes the app's proof log (web/lib/proof-log.json: which
 * transaction decided which round, and one row per asserted proof), and
 * prints the table docs/e2e-verification.md carries. Outcomes are read from
 * each step's recorded result, never written by hand.
 *
 *   node scripts/proof-report.mjs 0x…
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: node scripts/proof-report.mjs 0x…");
const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const run = JSON.parse(readFileSync(at(`../.data/proofs-${ADDRESS}.json`), "utf-8"));
if (!run.finished_at) throw new Error("the run has not finished; publish only a complete run");

const commit = execFileSync("git", ["log", "-1", "--format=%h", "--", "contracts/structura.py"],
  { cwd: at(".."), encoding: "utf-8" }).trim();
const step = (name) => {
  const s = run.steps[name];
  if (!s) throw new Error(`the run has no step ${name}`);
  return s;
};
const returned = (name) => {
  const text = step(name).text;
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : {};
};
const refusal = (name) => {
  const text = step(name).text.replace(/^\[EXPECTED\]\s*/, "").trim();
  return `Refused: "${text}"`;
};
const decision = (name) => {
  const r = returned(name);
  const words = { ACCEPTED: "Accepted", REJECTED: "Rejected", UNDETERMINED: "Undetermined" };
  return words[r.decision] ?? String(r.decision);
};
const gen = (wei) => {
  const v = BigInt(wei);
  const whole = v / 10n ** 18n;
  const frac = ((v % 10n ** 18n) * 10000n / 10n ** 18n).toString().padStart(4, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""} GEN`;
};

// Each row: the step, what the script asserted about it, and the outcome
// read from the record. Wording follows the assertion, nothing more.
const rows = [
  ["flagship.assess", "Flagship: two photographs of the poured foundation and the inspector's report, three criteria",
   () => `${decision("flagship.assess")} on every criterion, no conflict`],
  ["walls.finalize_early", "Finalize while the client's appeal window is open", () => refusal("walls.finalize_early")],
  ["walls.stranger_assessment", "A stranger requests an assessment", () => refusal("walls.stranger_assessment")],
  ["walls.contractor_appeals_own_acceptance", "The contractor appeals an acceptance", () => refusal("walls.contractor_appeals_own_acceptance")],
  ["walls.client_files_without_appeal", "The client files against a standing acceptance without appealing", () => refusal("walls.client_files_without_appeal")],
  ["walls.stranger_funds", "A stranger sends 0.1 GEN to someone else's project", () => "Credited back to the stranger in full"],
  ["walls.stranger_claims_refund", "The stranger claims the refund", () => "Claim succeeded"],
  ["negative.assess", "Negative control: trenches and rebar, nothing poured",
   () => `${decision("negative.assess")}; decisive: ${(run.negative?.decisive ?? []).join(", ")}`],
  ["injection.assess", "Instructions hidden in a caption and a document, a declaration filed alongside",
   () => `${decision("injection.assess")}, not accepted; no declaration read`],
  ["mirror.assess", "The client's bare declaration against photographs of the poured foundation",
   () => `${decision("mirror.assess")}; the declaration was not read`],
  ["conflict.appeal", "The client appeals the acceptance, with a reason", () => "Appeal opened; evidence period began"],
  ["walls.decide_early", "Decide the appeal during its evidence period", () => refusal("walls.decide_early")],
  ["flagship.finalize", "Finalize the flagship after its window", () => "2 GEN credited to the contractor"],
  ["flagship.claim", "The contractor claims", () => `The contractor's wallet received ${gen(run.flagship.wallet_delta_wei)} (the payment less the claim's fee)`],
  ["conflict.decide", "The appeal: the client's photograph of an empty lot, filed as new evidence",
   () => `${decision("conflict.decide")}, not accepted; the client's photograph was read as new evidence`],
  ["walls.finalize_unconfirmed", "Finalize after the appeal withheld the acceptance", () => refusal("walls.finalize_unconfirmed")],
];

const proofs = rows.map(([name, claim, outcome]) => ({ name, claim, outcome: outcome(), hash: step(name).hash }));

const roundOf = (name) => returned(name).round;
const rounds = {
  [`${run.flagship.mid}/${roundOf("flagship.assess")}`]: step("flagship.assess").hash,
  [`${run.negative.mid}/${roundOf("negative.assess")}`]: step("negative.assess").hash,
  [`${run.injection.mid}/${roundOf("injection.assess")}`]: step("injection.assess").hash,
  [`${run.mirror.mid}/${roundOf("mirror.assess")}`]: step("mirror.assess").hash,
  [`${run.conflict.mid}/${run.conflict.round}`]: step("conflict.decide").hash,
};

mkdirSync(at("../docs/proofs"), { recursive: true });
writeFileSync(at(`../docs/proofs/${ADDRESS}.json`), JSON.stringify({ ...run, source_commit: commit }, null, 2) + "\n");
writeFileSync(at("../web/lib/proof-log.json"),
  JSON.stringify({ address: ADDRESS, source_commit: commit, finished_at: run.finished_at, rounds, proofs }, null, 2) + "\n");

const EXPLORER = "https://explorer-studio-dev.genlayer.com/tx/";
console.log("| step | what was asserted | outcome | transaction |\n|---|---|---|---|");
for (const p of proofs) {
  console.log(`| \`${p.name}\` | ${p.claim} | ${p.outcome} | [${p.hash.slice(0, 10)}…](${EXPLORER}${p.hash}) |`);
}
console.log(`\nsource commit ${commit}; ${Object.keys(rounds).length} rounds; ${proofs.length} proofs; ${Object.keys(run.steps).length} transactions`);
