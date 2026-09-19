import { afterEach, describe, expect, it, vi } from "vitest";

import { decodeResult, modelName, noteOf, panelOf, refusalOf, returnedJson } from "@/lib/receipt";

/** A leader receipt's result as the network stores it: base64, one tag byte first. */
function receipt(text: string, tag = 0): string {
  const bytes = [tag, ...new TextEncoder().encode(text)];
  return btoa(String.fromCharCode(...bytes));
}

function serve(tx: unknown) {
  const fetchMock = vi.fn(async () => ({ json: async () => ({ jsonrpc: "2.0", id: 1, result: tx }) }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("decoding a receipt", () => {
  it("drops the tag byte and keeps every printable character, hyphens included", () => {
    const json = '{"milestone_id":"ms-00001","state":"UNDETERMINED"}';
    expect(decodeResult(receipt(json))).toBe(json);
    expect(decodeResult(receipt("[EXPECTED] the appeal window has closed", 1))).toBe("[EXPECTED] the appeal window has closed");
  });

  it("reads non-ASCII text as UTF-8", () => {
    expect(decodeResult(receipt("béton coulé"))).toBe("béton coulé");
  });

  it("returns nothing for anything that is not a receipt", () => {
    expect(decodeResult(undefined)).toBe("");
    expect(decodeResult(42)).toBe("");
    expect(decodeResult("%%% not base64 %%%")).toBe("");
  });
});

describe("reading a transaction", () => {
  it("returns the JSON a write returned, from the leader's row", async () => {
    serve({ consensus_data: { leader_receipt: [
      { mode: "validator", result: receipt('{"wrong":true}') },
      { mode: "leader", result: receipt('{"round":2,"decision":"REJECTED"}') },
    ] } });
    expect(await returnedJson("0xabc")).toEqual({ round: 2, decision: "REJECTED" });
  });

  it("gives the refusal sentence of a refused write", async () => {
    serve({ consensus_data: { leader_receipt: [{ mode: "leader", result: receipt("[EXPECTED] the deadline has passed", 1) }] } });
    expect(await refusalOf("0xabc")).toBe("[EXPECTED] the deadline has passed");
  });

  it("says so when the network does not know the transaction", async () => {
    serve(null);
    await expect(refusalOf("0xabc")).rejects.toThrow(/does not know this transaction/);
  });
});

describe("the panel", () => {
  it("names every node's model, vote and printed reasoning, rotation by rotation", async () => {
    const leaderOut = '[LOOK] pair failed: timeout\n[ROUND] leader {"images_received": true} why: The slab is cast and cured.\nnoise';
    const dissent = '[DISAGREE] the leader accepts; this node finds undetermined; mine={"C1": "UNCLEAR"} conflicts=False why: the rebar why: is hidden';
    serve({
      status: "FINALIZED",
      result_name: "AGREE",
      consensus_history: { consensus_results: [
        {
          consensus_round: "Leader Rotation",
          leader_result: [{ mode: "leader", node_config: { primary_model: { model: "openai/gpt-5.4" } }, genvm_result: { stdout: leaderOut } }],
          validator_results: [
            { mode: "validator", vote: "disagree", node_config: { primary_model: { model: "anthropic/claude-sonnet-4-6" } }, genvm_result: { stdout: dissent } },
          ],
        },
        {
          consensus_round: "Accepted",
          leader_result: [{ mode: "leader", node_config: { primary_model: { model: "policy:dev-gemini-3-flash" } } }],
          validator_results: [{ mode: "validator", vote: "agree", node_config: { primary_model: { model: "some/new-model" } } }],
        },
      ] },
    });
    const panel = await panelOf("0xabc");
    expect(panel.status).toBe("FINALIZED");
    expect(panel.rotations.map((r) => r.label)).toEqual(["Leader Rotation", "Accepted"]);
    const [first, second] = panel.rotations;
    expect(first!.nodes[0]).toEqual({ leader: true, model: "GPT-5.4", vote: "proposed", note: "pair failed: timeout The slab is cast and cured." });
    expect(first!.nodes[1]).toMatchObject({ leader: false, model: "Claude Sonnet 4.6", vote: "disagree" });
    expect(first!.nodes[1]!.note).toBe("The leader accepts; this node finds undetermined. Its reading: the rebar why: is hidden");
    expect(second!.nodes.map((n) => n.model)).toEqual(["Gemini 3 Flash", "some/new-model"]);
  });

  it("falls back to the final receipt when the network kept no history", async () => {
    serve({ statusName: "ACCEPTED", consensus_data: {
      leader_receipt: [{ mode: "leader", node_config: { primary_model: { model: "x/gpt-oss-120b" } } }],
      validators: [{ vote: "agree", node_config: {} }],
    } });
    const panel = await panelOf("0xabc");
    expect(panel.status).toBe("ACCEPTED");
    expect(panel.rotations).toHaveLength(1);
    expect(panel.rotations[0]!.nodes.map((n) => [n.model, n.vote])).toEqual([["GPT-OSS", "proposed"], ["Unnamed model", "agree"]]);
  });
});

describe("printed lines", () => {
  it("reads a disagreement without grounds as its reason alone", () => {
    expect(noteOf("[DISAGREE] the leader did not receive the images")).toBe("The leader did not receive the images.");
    expect(noteOf("[DISAGREE]")).toBe("Disagreed.");
  });

  it("maps model routes to their family names", () => {
    expect(modelName("openai/gpt-5-4")).toBe("GPT-5.4");
    expect(modelName("deepseek/deepseek-v3.2")).toBe("DeepSeek");
    expect(modelName("")).toBe("Unnamed model");
  });
});
