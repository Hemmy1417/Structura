// One address everywhere: the deployment of record named by the app must be
// the one the proof log was recorded on and the one the README and the
// verification document name. A clean checkout reproduces the judged
// deployment, or this fails.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (path) => fileURLToPath(new URL(path, import.meta.url));
const problems = [];
const read = (path) => {
  if (existsSync(at(path))) return readFileSync(at(path), "utf8");
  problems.push(`${path.replace(/^(\.\.\/)+/, "")} is missing`);
  return "";
};

const config = read("../lib/config.ts").match(/RECORD_ADDRESS = "(0x[0-9a-fA-F]{40})"/)?.[1];
if (!config) {
  console.error("lib/config.ts names no RECORD_ADDRESS");
  process.exit(1);
}
const same = (a) => a.toLowerCase() === config.toLowerCase();

const log = JSON.parse(read("../lib/proof-log.json") || "{}");
if (!same(log.address ?? "")) problems.push(`lib/proof-log.json records ${log.address || "no address"}`);

// Every line that says "deployment of record" and carries an address must
// carry this one, and each document must say it at least once.
for (const doc of ["../../README.md", "../../docs/e2e-verification.md"]) {
  const text = read(doc);
  const lines = text.split("\n").filter((l) => /deployment of record/i.test(l) && /0x[0-9a-fA-F]{40}/.test(l));
  if (text && !lines.length) problems.push(`${doc.replace(/^(\.\.\/)+/, "")} never names the deployment of record`);
  for (const line of lines) {
    for (const addr of line.match(/0x[0-9a-fA-F]{40}/g) ?? []) {
      if (!same(addr)) problems.push(`${doc.replace(/^(\.\.\/)+/, "")} names ${addr} as the deployment of record`);
    }
  }
}

if (problems.length) {
  console.error(`The deployment of record is ${config}, but:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`one address everywhere: ${config}`);
