// Mutation sweep for the web rules (pnpm mutate): break one rule at a time
// in web/lib, run the tests that cover it, require a failure. Every file is
// restored from memory in a finally block, and the run ends by comparing
// each file with its contents before the sweep began.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const NODE = process.execPath;
const VITEST = join(WEB, "node_modules/vitest/vitest.mjs");

const M = [
  ["acts", "appeal overflow off by one", "images > cap.IMAGE || texts > cap.TEXT", "images > cap.IMAGE + 1 || texts > cap.TEXT"],
  ["acts", "appeal overflow counts declarations", `it.role === "CONTRACTOR" && it.kind !== "DECLARATION" && Number`, `it.role === "CONTRACTOR" && Number`],
  ["acts", "appeal overflow ignored", `: overflow ? no("open_appeal", overflow)`, `: false ? no("open_appeal", overflow)`],
  ["acts", "filing ignores the deadline margin", "} else if (nowMs > ms(terms.deadline) - MARGIN_MS) {", "} else if (nowMs > ms(terms.deadline)) {"],
  ["acts", "appeal ignores the window margin", `nowMs > ms(standing.window_ends) - MARGIN_MS ? no("open_appeal"`, `nowMs > ms(standing.window_ends) ? no("open_appeal"`],
  ["acts", "lapse on the boundary", "if (nowMs > lapse)", "if (nowMs >= lapse)"],
  ["acts", "decide on the boundary", `nowMs <= ends ? no("decide_appeal"`, `nowMs < ends ? no("decide_appeal"`],
  ["acts", "close ignores a standing window", `: windowOpen ? no("close_milestone"`, `: false ? no("close_milestone"`],
  ["acts", "a version is signed after its deadline", `nowMs > ms(pending?.deadline) - MARGIN_MS`, `false`],
  ["acts", "close kills a live renegotiation", `const renegotiating = !!pending && nowMs <= ms(pending.deadline);`, `const renegotiating = false;`],
  ["acts", "coverage counts declarations", `it.kind !== "DECLARATION" && (it.role !== "CONTRACTOR"`, `(it.role !== "CONTRACTOR"`],
  ["acts", "declarations use the appeal allowance", `m.standing && kind !== "DECLARATION") {`, `m.standing) {`],
  ["acts", "quota off by one", "if (quota !== undefined && mine.length >= quota)", "if (quota !== undefined && mine.length > quota)"],
  ["acts", "assessment cap off by one", "m.version_assessments >= max", "m.version_assessments > max"],
  ["acts", "strangers may file", `if (!who) return "Only the client`, `if (false) return "Only the client`],
  ["acts", "finalize inside the window", `standing.appealable && nowMs <= ms(standing.window_ends)`, `standing.appealable && nowMs < ms(standing.window_ends) - 999999999`],
  ["kit", "gasless claim refused at submit", "if (!isTransfer(tx) || quote.gasless) return kit.submit(quote, tx);", "if (!isTransfer(tx)) return kit.submit(quote, tx);"],
  ["kit", "empty allocations signed", "if (allocations.length === 0) {", "if (false) {"],
  ["kit", "policy check always claimed", "verification: capsMatch ?", "verification: true ?"],
  ["kit", "claim priced by the kit", "if (!isTransfer(tx) || quote.gasless) return quote;", "return quote;"],
  ["kit", "user value dropped from the total", "total: sim.feeValue + quote.userValue,", "total: sim.feeValue,"],
  ["read", "budget overrun by one", "if (starts.length >= READ_BUDGET) {", "if (starts.length > READ_BUDGET) {"],
  ["read", "no gap between starts", "(starts[starts.length - 1] ?? -Infinity) + MIN_GAP_MS", "(starts[starts.length - 1] ?? -Infinity)"],
  ["read", "old starts never forgotten", "while (starts.length && (starts[0] ?? 0) <= now - READ_WINDOW_MS) starts.shift();", ""],
  ["read", "tag byte left in a refusal", "while (start < decoded.length && decoded.charCodeAt(start) < 0x20) start++;", ""],
  ["receipt", "hyphens read as spaces", "c.charCodeAt(0) < 0x20", "c.charCodeAt(0) < 0x2e"],
  ["receipt", "reasoning cut at a second marker", `after(body.slice(cut), " why: ")`, `(body.slice(cut).split(" why: ")[1] ?? "")`],
  ["receipt", "a sat-out node's model unnamed", "cfg?.primary_model?.model ?? cfg?.model ?? \"\"", "cfg?.primary_model?.model ?? \"\""],
  ["receipt", "leader row taken from a validator", `rows.find((r) => r.mode !== "validator")`, `rows.find((r) => r.mode === "validator")`],
  ["images", "JFIF insert drops a byte", "out.set(jpeg.subarray(2), 2 + JFIF_APP0.length);", "out.set(jpeg.subarray(3), 2 + JFIF_APP0.length);"],
  ["images", "small images enlarged", "const scale = Math.min(1, edge / Math.max(width, height));", "const scale = edge / Math.max(width, height);"],
  ["images", "EXIF JPEG passes as JFIF", "b[3] === 0xe0", "(b[3] & 0xf0) === 0xe0"],
  ["present", "record ids printed in a model's prose", String.raw`\b(ev|ms|pr)-0*(\d+)\b`, String.raw`\b(ev|ms|pr)-NEVER(\d+)\b`],
  ["present", "tiny amounts read as zero", `if (!fracText && frac > 0n) fracText = "0001";`, ""],
  ["present", "relative time says now too long", "if (Math.abs(diff) < 45) return \"now\";", "if (Math.abs(diff) < 4500) return \"now\";"],
  ["present", "model tag left in refusals", String.raw`/\[EXPECTED\]|\[LLM_ERROR\]/g`, String.raw`/\[EXPECTED\]/g`],
  ["present", "dates in local time", "${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}", "${d.getDate()} ${MONTHS[d.getMonth()]}"],
  ["present", "hours in local time", "String(d.getUTCHours())", "String(d.getHours())"],
];

const files = { acts: "lib/acts.ts", kit: "lib/kit.ts", read: "lib/read.ts", receipt: "lib/receipt.ts", images: "lib/images.ts", present: "lib/present.ts" };
const tests = { acts: "tests/acts.test.ts", kit: "tests/kit.test.ts", read: "tests/read.test.ts", receipt: "tests/receipt.test.ts", images: "tests/images.test.ts", present: "tests/present.test.ts" };

function run(testFile) {
  const r = spawnSync(NODE, [VITEST, "run", testFile], { cwd: WEB, encoding: "utf8" });
  const tail = `${r.stdout}${r.stderr}`.match(/Tests\s+[^\n]+/)?.[0] ?? "no summary";
  return { ok: r.status === 0, tail: tail.replace(/\s+/g, " ").trim() };
}

const snapshot = Object.fromEntries(Object.values(files).map((f) => [f, readFileSync(join(WEB, f), "utf8")]));
let killed = 0;
const survivors = [];
for (const [area, name, from, to] of M) {
  const path = join(WEB, files[area]);
  const original = readFileSync(path, "utf8");
  const count = original.split(from).length - 1;
  if (count !== 1) {
    console.log(`BAD      ${name}: pattern found ${count} times`);
    survivors.push(name);
    continue;
  }
  try {
    writeFileSync(path, original.replace(from, to));
    const r = run(tests[area]);
    if (r.ok) { survivors.push(name); console.log(`SURVIVED ${name}  (${r.tail})`); }
    else { killed++; console.log(`killed   ${name}  (${r.tail})`); }
  } finally {
    writeFileSync(path, original);
  }
}
const control = run("tests");
console.log(`control, the code as written: ${control.ok ? "passes" : "FAILS"} (${control.tail})`);
const changed = Object.entries(snapshot).filter(([f, text]) => readFileSync(join(WEB, f), "utf8") !== text).map(([f]) => f);
console.log(`files after restore: ${changed.length ? `CHANGED ${changed.join(", ")}` : "as they were"}`);
console.log(`${killed}/${M.length} mutants killed${survivors.length ? `; survivors: ${survivors.join(", ")}` : ""}`);
console.log("exit");
