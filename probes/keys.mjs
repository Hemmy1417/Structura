/**
 * Create the probe/operator key in .data/keys.json (gitignored) if absent and
 * fund it from the Studio Next faucet. Prints addresses and balances only,
 * never a key.
 */
import { createAccount } from "genlayer-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { rpc, sleep } from "./lib.mjs";

const DATA = fileURLToPath(new URL("../.data", import.meta.url));
const KEYS = fileURLToPath(new URL("../.data/keys.json", import.meta.url));
const ROLES = ["OPERATOR", "CLIENT", "CONTRACTOR", "INSPECTOR", "STRANGER"];
const TWENTY_GEN = (20n * 10n ** 18n).toString();

mkdirSync(DATA, { recursive: true });
const keys = existsSync(KEYS) ? JSON.parse(readFileSync(KEYS, "utf-8")) : {};
for (const role of ROLES) {
  if (!keys[role]) {
    const pk = "0x" + randomBytes(32).toString("hex");
    // viem's account address is EIP-55 checksummed, which is how the
    // contract records signers and the only form the faucet credits.
    keys[role] = { pk, addr: createAccount(pk).address };
    console.log(`created ${role} ${keys[role].addr}`);
  }
}
writeFileSync(KEYS, JSON.stringify(keys, null, 2));

for (const role of ROLES) {
  const addr = keys[role].addr;
  const before = BigInt((await rpc("eth_getBalance", [addr, "latest"])).result ?? "0x0");
  if (before < 5n * 10n ** 18n) {
    const r = await rpc("sim_fundAccount", [addr, TWENTY_GEN]);
    if (r.error) console.log(`${role}: faucet refused: ${JSON.stringify(r.error).slice(0, 120)}`);
    await sleep(3000);
  }
  const after = BigInt((await rpc("eth_getBalance", [addr, "latest"])).result ?? "0x0");
  console.log(`${role.padEnd(10)} ${addr} balance ${(Number(after) / 1e18).toFixed(4)} GEN`);
}
