/**
 * Drive the STRUCTURA probe on Studio Next.
 *   node run-probe.mjs deploy                 deploy structura_probe.py, remember the address
 *   node run-probe.mjs classify <key>         one photo, one stage, every validator prints its reading
 *   node run-probe.mjs assess <set>           several photos, one criterion
 *   node run-probe.mjs dump <txhash>          per-node model, vote and [PROBE] lines from a receipt
 * Keys come from ../.data/keys.json (gitignored); nothing secret is printed.
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chain, rpc, waitFinal, leaderOf, resultText, FEE_FLOOR } from "./lib.mjs";

const KEYS = JSON.parse(readFileSync(fileURLToPath(new URL("../.data/keys.json", import.meta.url)), "utf-8"));
const STATE = fileURLToPath(new URL("../.data/probe.json", import.meta.url));
const client = createClient({ chain, account: createAccount(KEYS.OPERATOR.pk) });

const T = "https://thumb.wikimedia.org/wikipedia/commons/thumb";
const PHOTOS = {
  trenches: { url: `${T}/d/d2/Thai_House_Concrete_Footing_Trenches.JPG/1280px-Thai_House_Concrete_Footing_Trenches.JPG`, sha: "485f7ba6783518020f330f1ea6dea85887baec35e2a80cc38f2ccbdf98fa3a4a", expect: "EXCAVATION_ONLY" },
  rebar: { url: `${T}/d/d3/Thai_House_Column_Footing_Rebar.JPG/1280px-Thai_House_Column_Footing_Rebar.JPG`, sha: "9f5ee64ced72acc5978ab04e1b8f23911c487e4033f65eb40b6d0df9ca07580b", expect: "REBAR_OR_FORMWORK" },
  footing: { url: `${T}/d/d7/Thai_House_Concrete_Footing.JPG/1280px-Thai_House_Concrete_Footing.JPG`, sha: "965d6d708cf55315818691d2bc4071add8e2ceac9f0faf7dfff274d4fb99ea29", expect: "FOUNDATION_CONCRETE_POURED" },
  finished: { url: `${T}/0/0e/Thai_House_Formwork_Removed_2.JPG/1280px-Thai_House_Formwork_Removed_2.JPG`, sha: "0c61d851a9929d6e91b834428e6f32bf88fa4fb62a00de12d12414330fe56d5e", expect: "FOUNDATION_CONCRETE_POURED" },
  cat: { url: `${T}/3/3a/Cat03.jpg/1280px-Cat03.jpg`, sha: "6abda6611dab9d7d7754259c00575baba1d6c3e1b9cf7d61ef79a0fc67729ebe", expect: "NO_CONSTRUCTION" },
};
const CRITERION = "The foundation's footings and ground beams are cast in concrete and complete.";
const SETS = {
  complete: ["footing", "finished"],
  trenches: ["trenches"],
};

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf-8")) : {};
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

async function write(functionName, args) {
  const est = await client.estimateTransactionFees();
  const fees = { distribution: est.distribution, feeValue: est.feeValue > FEE_FLOOR ? est.feeValue : FEE_FLOOR };
  const hash = await client.writeContract({ address: state.address, functionName, args, value: 0n, fees });
  say(`${functionName} sent ${hash}`);
  const t0 = Date.now();
  let t;
  try {
    t = await waitFinal(hash, { label: functionName, tries: 200 });
  } catch (e) {
    say(`did not finalize: ${e.message}`);
    await dump(hash);
    return;
  }
  const leader = leaderOf(t);
  say(`${t.status} ${t.result_name} leader=${leader?.execution_result} in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (leader?.execution_result !== "SUCCESS") say(`leader said: ${resultText(leader).slice(0, 300)}`);
  await dump(hash);
}

async function dump(hash) {
  const t = (await rpc("eth_getTransactionByHash", [hash])).result;
  const rows = t?.consensus_data?.leader_receipt ?? [];
  const validators = t?.consensus_data?.validators ?? [];
  const all = [...rows.map((r) => ({ ...r, _from: "leader_receipt" })), ...validators.map((r) => ({ ...r, _from: "validators" }))];
  say(`receipt ${hash.slice(0, 10)}… status=${t?.status} result=${t?.result_name} rows=${rows.length} validators=${validators.length} rotations=${t?.rotation_count ?? t?.consensus_data?.rotation_count ?? "?"}`);
  for (const r of all) {
    const model = r?.node_config?.primary_model?.model ?? r?.node_config?.model ?? r?.model ?? "?";
    const out = String(r?.genvm_result?.stdout ?? r?.stdout ?? "");
    const lines = out.split("\n").filter((l) => l.includes("[PROBE]"));
    console.log(`  ${r._from}/${r?.mode ?? "?"} vote=${r?.vote ?? "?"} model=${model} exec=${r?.execution_result ?? "?"}`);
    for (const l of lines) console.log(`     ${l.slice(0, 700)}`);
    if (!lines.length && r?.genvm_result?.stderr) console.log(`     stderr: ${String(r.genvm_result.stderr).slice(-400)}`);
  }
  if (process.env.KEYS_DEBUG) console.log(Object.keys(rows[0] ?? {}), Object.keys(t?.consensus_data ?? {}));
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "deploy") {
  const code = readFileSync(fileURLToPath(new URL("./structura_probe.py", import.meta.url)), "utf-8");
  if (code.includes("\r")) throw new Error("contract carries CR bytes");
  const est = await client.estimateTransactionFees();
  const hash = await client.deployContract({ code, args: [], fees: { distribution: est.distribution, feeValue: est.feeValue > FEE_FLOOR ? est.feeValue : FEE_FLOOR } });
  say(`deploy sent ${hash}`);
  const t = await waitFinal(hash, { label: "deploy", tries: 120 });
  const leader = leaderOf(t);
  say(`${t.status} ${t.result_name} leader=${leader?.execution_result}`);
  if (leader?.execution_result !== "SUCCESS") { say(resultText(leader)); say(String(leader?.genvm_result?.stderr ?? "").slice(-1500)); process.exit(1); }
  state.address = t.data?.contract_address;
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  say(`probe contract ${state.address}`);
} else if (cmd === "classify") {
  const p = PHOTOS[arg];
  say(`classify ${arg} (a person expects ${p.expect})`);
  await write("classify", [p.url, p.sha]);
} else if (cmd === "assess") {
  const items = SETS[arg].map((k) => ({ url: PHOTOS[k].url, sha: PHOTOS[k].sha }));
  say(`assess ${arg}: ${SETS[arg].join(", ")}`);
  await write("assess", [JSON.stringify(items), CRITERION]);
} else if (cmd === "dump") {
  await dump(arg);
} else if (cmd === "put") {
  // node run-probe.mjs put <photo> <px>   store a browser-normalized JPEG on chain
  const px = process.argv[4] ?? "800";
  const data = new Uint8Array(readFileSync(fileURLToPath(new URL(`./img/norm-${arg}-${px}.jpg`, import.meta.url))));
  say(`put ${arg} at ${px}px: ${data.length} bytes`);
  await write("put_blob", [`${arg}-${px}`, data]);
  const info = await client.readContract({ address: state.address, functionName: "blob_info", args: [`${arg}-${px}`] });
  say(`stored: ${info}`);
} else if (cmd === "judge") {
  // node run-probe.mjs judge footing,finished
  const keys = arg.split(",").map((k) => `${k}-800`);
  const criteria = [
    { id: "C1", text: "The footings and ground beams are cast in concrete." },
    { id: "C2", text: "The work shown is consistent with the specification's layout: ground beams connecting the column bases." },
    { id: "C3", text: "The photographs show the same construction site." },
  ];
  const spec = "Foundation for a single-storey house on precast concrete columns. Reinforced concrete ground beams (strip footings) connect every column base in a grid. Milestone: all ground beams poured in concrete.";
  say(`judge ${keys.join(" + ")}`);
  await write("judge_blobs", [JSON.stringify(keys), JSON.stringify(criteria), spec]);
} else if (cmd === "look") {
  const px = process.argv[4] ?? "800";
  say(`look_blob ${arg}-${px} (a person expects ${PHOTOS[arg].expect})`);
  await write("look_blob", [`${arg}-${px}`]);
}
