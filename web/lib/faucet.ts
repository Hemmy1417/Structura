/**
 * Studio Next test GEN. `sim_fundAccount` counts in ATTO and credits only the
 * checksummed spelling of an address (measured 17 Sep: 500 → 500 atto; a
 * lowercase address never shows the balance). The wallet's native balance
 * is read with eth_getBalance, which sits in Studio Next's larger read
 * bucket, not the 30-per-minute gen_call budget contract reads share.
 */
import { RPC_URL } from "./chain";
import { accountOf } from "./wallet";

export const TEST_GEN_WEI = 10n * 10n ** 18n;
/** Below this a person cannot fund a milestone or pay a round's fees. */
export const LOW_BALANCE_WEI = 5n * 10n ** 16n;

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

export function faucetParams(address: string): [string, string] {
  const account = accountOf(address);
  if (!account) throw new Error("Connect a wallet first.");
  return [account, TEST_GEN_WEI.toString()];
}

export async function requestTestGen(address: string): Promise<void> {
  await rpc("sim_fundAccount", faucetParams(address));
}

export async function walletBalance(address: string): Promise<bigint> {
  return BigInt(String(await rpc("eth_getBalance", [accountOf(address), "latest"])));
}
