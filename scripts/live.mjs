/**
 * Drive a STRUCTURA deployment on Studio Next, one signed transaction at a
 * time, printing every node's model, vote and diagnostic lines.
 *
 *   node scripts/live.mjs use 0x…                         target a deployment
 *   node scripts/live.mjs setup [window_s] [deadline_h] [inspector]  project + milestone, both signed
 *   node scripts/live.mjs image <ROLE> <file> <caption> [R1] [origin]  file an image
 *   node scripts/live.mjs doc <ROLE> <title> <text> [R2]   file a document
 *   node scripts/live.mjs decl <ROLE> <text>               file a declaration
 *   node scripts/live.mjs assess <ev-…> [ev-…]             the contractor requests an assessment
 *   node scripts/live.mjs appeal <ROLE> <reason>           open an appeal
 *   node scripts/live.mjs decide                           readjudicate (anyone; STRANGER signs)
 *   node scripts/live.mjs finalize | close                 settle (STRANGER signs)
 *   node scripts/live.mjs claim <ROLE>                     pull a credited balance
 *   node scripts/live.mjs read [milestone|round N|image ev-…|balance ROLE]
 *   node scripts/live.mjs dump <txhash>                    re-print a receipt
 *
 * Keys: .data/keys.json roles OPERATOR/CLIENT/CONTRACTOR/INSPECTOR/STRANGER
 * (gitignored, never printed). State: .data/live.json.
 */
import { createAccount, createClient } from "genlayer-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, dumpReceipt, leaderOf, loadKeys, plainFees, resultText, transferFees,
         waitFinal } from "./lib.mjs";

const STATE_PATH = fileURLToPath(new URL("../.data/live.json", import.meta.url));
const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf-8")) : {};
const save = () => writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
const KEYS = loadKeys();
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const clientFor = (role) => createClient({ chain, account: createAccount(KEYS[role].pk) });
// MID=ms-00002 node scripts/live.mjs … targets another milestone than the last one set up
const MID = () => process.env.MID || state.milestone_id;

const SPEC = "Foundation for a single-storey house on precast concrete columns. Reinforced "
  + "concrete ground beams (strip footings) connect every column base in a grid. "
  + "Milestone: all ground beams poured in concrete.";

function terms({ deadlineHours, inspector }) {
  const reqs = [{ text: "Photographs of the poured footings and ground beams", kind: "IMAGE",
                  from_role: "CONTRACTOR", min_count: 2 }];
  if (inspector) reqs.push({ text: "Site inspection report", kind: "DOCUMENT", from_role: "INSPECTOR", min_count: 1 });
  return {
    title: "Foundation completed",
    description: "Footings and ground beams for the house, poured and stripped.",
    requirements: "All footings and ground beams of the foundation are poured in concrete to the approved layout.",
    specification: SPEC,
    criteria: [
      { text: "The footings and ground beams are cast in concrete." },
      { text: "The work shown is consistent with the specification's layout: ground beams connecting the column bases." },
      { text: "The photographs show the same construction site." },
    ],
    evidence_requirements: reqs,
    payment_wei: (2n * GEN).toString(),
    deadline: new Date(Date.now() + deadlineHours * 3600_000).toISOString().replace(/\.\d+Z$/, "Z"),
  };
}

async function write(role, functionName, args, { value = 0n, transfer = false } = {}) {
  const client = clientFor(role);
  const fees = transfer
    ? await transferFees(client, { address: state.address, functionName, args, value })
    : await plainFees(client);
  const t0 = Date.now();
  const hash = await client.writeContract({ address: state.address, functionName, args, value, fees });
  say(`${role} ${functionName} sent ${hash}`);
  let t;
  try {
    t = await waitFinal(hash, { label: functionName });
  } catch (e) {
    say(`${functionName}: ${e.message}`);
    await dumpReceipt(hash);
    process.exit(1);
  }
  const leader = leaderOf(t);
  const secs = Math.round((Date.now() - t0) / 1000);
  say(`${t.status} ${t.result_name} leader=${leader?.execution_result} in ${secs} s  ${EXPLORER}/tx/${hash}`);
  const text = resultText(leader);
  if (leader?.execution_result !== "SUCCESS") say(`refused: ${text.slice(0, 400)}`);
  (state.log ??= []).push({ fn: functionName, role, hash, secs, ok: leader?.execution_result === "SUCCESS" });
  save();
  return { t, hash, text, ok: leader?.execution_result === "SUCCESS" };
}

async function read(functionName, args) {
  const client = clientFor("STRANGER");
  return client.readContract({ address: state.address, functionName, args });
}

function jsonFrom(text) {
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : null;
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "use") {
  state.address = rest[0];
  state.project_id = state.milestone_id = undefined;
  state.items = {};
  save();
  say(`target ${state.address}`);
} else if (cmd === "setup") {
  const window = Number(rest[0] ?? 600);
  const deadlineHours = Number(rest[1] ?? 48);
  const inspector = rest[2] === "inspector";
  const params = { title: "Residential building, foundation phase (demonstration)",
                   description: "Reconstructed from a public photo series of one house build.",
                   site: "Thailand", contractor: KEYS.CONTRACTOR.addr,
                   inspector: inspector ? KEYS.INSPECTOR.addr : "", appeal_window_seconds: window };
  const created = await write("CLIENT", "create_project", [JSON.stringify(params)], { value: 3n * GEN });
  state.project_id = jsonFrom(created.text)?.project_id;
  const added = await write("CLIENT", "add_milestone", [state.project_id, JSON.stringify(terms({ deadlineHours, inspector }))]);
  state.milestone_id = jsonFrom(added.text)?.milestone_id;
  save();
  await write("CONTRACTOR", "accept_project", [state.project_id]);
  if (inspector) await write("INSPECTOR", "accept_inspector_role", [state.project_id]);
  say(`project ${state.project_id}, milestone ${state.milestone_id}`);
} else if (cmd === "image") {
  const [role, file, caption, req = "R1", origin = "PHOTO"] = rest;
  const data = new Uint8Array(readFileSync(file));
  const head = Buffer.from(data.slice(0, 4)).toString("hex");
  say(`${file}: ${data.length} bytes, head ${head}, sha256 ${createHash("sha256").update(data).digest("hex").slice(0, 16)}…`);
  const meta = { requirement_id: req === "-" ? "" : req, caption, origin, claimed_capture: "2011-02", claimed_location: "Thailand" };
  const r = await write(role, "submit_image", [MID(), JSON.stringify(meta), data]);
  const id = jsonFrom(r.text)?.item_id;
  if (id) (state.items ??= {})[id] = { role, caption };
  save();
  say(`item ${id}`);
} else if (cmd === "doc") {
  const [role, title, text, req = ""] = rest;
  const r = await write(role, "submit_document", [MID(), JSON.stringify({ requirement_id: req, title }), text]);
  say(`item ${jsonFrom(r.text)?.item_id}`);
} else if (cmd === "decl") {
  const [role, text] = rest;
  const r = await write(role, "submit_declaration", [MID(), text]);
  say(`item ${jsonFrom(r.text)?.item_id}`);
} else if (cmd === "assess") {
  const r = await write("CONTRACTOR", "request_assessment", [MID(), JSON.stringify(rest)]);
  await dumpReceipt(r.hash);
  say(`result: ${r.text.slice(0, 300)}`);
} else if (cmd === "appeal") {
  const [role, reason] = rest;
  const r = await write(role, "open_appeal", [MID(), reason]);
  say(`result: ${r.text.slice(0, 300)}`);
} else if (cmd === "decide") {
  const r = await write("STRANGER", "decide_appeal", [MID()]);
  await dumpReceipt(r.hash);
  say(`result: ${r.text.slice(0, 300)}`);
} else if (cmd === "finalize" || cmd === "close") {
  const fn = cmd === "finalize" ? "finalize" : "close_milestone";
  const r = await write("STRANGER", fn, [MID()]);
  say(`result: ${r.text.slice(0, 300)}`);
} else if (cmd === "claim") {
  const r = await write(rest[0], "claim", [], { transfer: true });
  say(`result: ${r.text.slice(0, 300)}`);
} else if (cmd === "read") {
  const [what, arg] = rest;
  const t0 = Date.now();
  if (what === "round") console.log(await read("get_round", [MID(), Number(arg)]));
  else if (what === "image") {
    const bytes = await read("get_image", [arg]);
    // genlayer-js returns calldata bytes as a 0x-prefixed hex string
    const buf = typeof bytes === "string" && bytes.startsWith("0x")
      ? Buffer.from(bytes.slice(2), "hex") : Buffer.from(bytes);
    say(`returned as ${typeof bytes === "string" ? "a hex string" : bytes?.constructor?.name}`);
    say(`get_image ${arg}: ${buf.length} bytes in ${Date.now() - t0} ms, sha256 ${createHash("sha256").update(buf).digest("hex")}`);
  } else if (what === "balance") console.log(await read("get_balance", [KEYS[arg].addr]));
  else console.log(await read("get_milestone", [MID()]));
} else if (cmd === "call") {
  // node scripts/live.mjs call CONTRACTOR accept_project '"pr-00001"'   (each arg is JSON)
  const [role, fn, ...args] = rest;
  const r = await write(role, fn, args.map((a) => JSON.parse(a)));
  say(`result: ${r.text.slice(0, 300)}`);
} else if (cmd === "dump") {
  await dumpReceipt(rest[0]);
} else {
  console.error("see the header of scripts/live.mjs for commands");
  process.exit(1);
}
