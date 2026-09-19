"use client";

import { useEffect, useState } from "react";

import { Copyable, Loading, ReadFailure } from "@/components/bits";
import { Section, Sheet } from "@/components/Sheet";
import { addressUrl, CHAIN_ID, RPC_URL, txUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS, IS_RECORD, RECORD_ADDRESS, REPO_URL, SOURCE_URL } from "@/lib/config";
import * as present from "@/lib/present";
import proofLog from "@/lib/proof-log.json";
import { getConfig } from "@/lib/read";
import type { ConfigView } from "@/lib/types";

interface ProofLog {
  address?: string;
  source_commit?: string;
  proofs?: { name: string; claim: string; hash: string; outcome: string }[];
}

export default function Verify() {
  const [cfg, setCfg] = useState<ConfigView | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { getConfig().then(setCfg).catch(setError); }, []);
  const log = proofLog as ProofLog;
  const proofs = log.address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() ? log.proofs ?? [] : [];

  return (
    <Sheet
      number="S-04"
      title="Verification"
      lead={<p>How to check, without trusting this app, that the contract you are reading is the one in the repository and behaves as described.</p>}
    >
      <div className="grid max-w-5xl gap-10">
        <Section n={1} title="The deployment">
          <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
            <dt className="text-ink-2">Contract</dt>
            <dd className="grid gap-1">
              <Copyable value={CONTRACT_ADDRESS} />
              <a className="underline" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">Open it on the Studio Next explorer</a>
            </dd>
            <dt className="text-ink-2">Standing</dt>
            <dd>{IS_RECORD ? "The deployment of record." : <>A test deployment. The deployment of record is <Copyable value={RECORD_ADDRESS} display={present.shortAddress(RECORD_ADDRESS)} />.</>}</dd>
            <dt className="text-ink-2">Source</dt>
            <dd><a className="underline" href={SOURCE_URL} target="_blank" rel="noreferrer">contracts/structura.py</a>{log.source_commit ? <span className="text-ink-3">, commit {log.source_commit}</span> : null}</dd>
            <dt className="text-ink-2">Rules</dt>
            <dd>{error ? <ReadFailure error={error} /> : cfg ? <span className="figure">{cfg.ruleset}</span> : <span className="text-ink-3">reading…</span>}</dd>
            <dt className="text-ink-2">Network</dt>
            <dd>GenLayer Studio Next, chain <span className="figure">{CHAIN_ID}</span>, <span className="figure break-all">{RPC_URL}</span></dd>
          </dl>
        </Section>

        <Section n={2} title="Check the bytes yourself">
          <ol className="grid gap-3 text-sm text-ink-2">
            <li>
              <p>1. Fetch the deployed source and diff it against the repository, byte for byte:</p>
              <pre className="panel mt-1 overflow-x-auto p-3 font-mono text-xs text-ink">{`git clone ${REPO_URL}
cd Structura/scripts && pnpm install
node deploy.mjs verify ${CONTRACT_ADDRESS}`}</pre>
            </li>
            <li>
              <p>2. Run the contract&apos;s tests: a strict harness, the official GenLayer direct runner, a randomized invariant walk, and a mutation sweep that breaks each safety check and proves the suite notices:</p>
              <pre className="panel mt-1 overflow-x-auto p-3 font-mono text-xs text-ink">{`python -m pytest tests/direct -q
python tests/mutation/mutate.py`}</pre>
            </li>
            <li>3. On any payment certificate, press recompute: the stored bytes are read back and hashed in your browser, and compared with the digest the contract recorded when the item was filed.</li>
          </ol>
        </Section>

        <Section n={3} title="Live proofs on this deployment" aside={proofs.length ? `${present.plural(proofs.length, "transaction")}, each asserted by the proof script` : undefined}>
          {proofs.length === 0 ? (
            <p className="text-sm text-ink-2">
              The proof run&apos;s log is published with the repository (docs/proofs). Every round is also listed on{" "}
              <a className="underline" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">the contract&apos;s explorer page</a>.
            </p>
          ) : (
            <div className="overflow-x-auto border border-ink">
              <table className="schedule min-w-[640px]">
                <thead><tr><th>Proof</th><th>What it shows</th><th>Outcome</th><th>Transaction</th></tr></thead>
                <tbody>
                  {proofs.map((pr) => (
                    <tr key={pr.hash}>
                      <td className="font-semibold">{pr.name}</td>
                      <td className="text-sm text-ink-2">{pr.claim}</td>
                      <td className="text-sm">{pr.outcome}</td>
                      <td><a className="figure text-sm underline" href={txUrl(pr.hash)} target="_blank" rel="noreferrer">{present.shortHash(pr.hash)}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section n={4} title="Limits the contract enforces">
          {!cfg ? <Loading what="the limits" /> : (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Smallest milestone payment", present.gen(cfg.min_payment_wei)],
                ["Appeal window", `${present.duration(cfg.min_appeal_window_seconds)} to ${present.duration(cfg.max_appeal_window_seconds)}`],
                ["Appeal lapses after its evidence period", present.duration(cfg.appeal_lapse_seconds)],
                ["Assessments per version of the terms", String(cfg.max_assessments_per_version)],
                ["Criteria per milestone", String(cfg.max_criteria)],
                ["Image size", present.size(cfg.image_max_bytes)],
                ["Contractor's evidence per version", `${cfg.quotas.CONTRACTOR.IMAGE} images, ${cfg.quotas.CONTRACTOR.TEXT} texts`],
                ["Client's evidence per version", `${cfg.quotas.CLIENT.IMAGE} images, ${cfg.quotas.CLIENT.TEXT} texts`],
                ["Inspector's evidence per version", `${cfg.quotas.INSPECTOR.IMAGE} images, ${cfg.quotas.INSPECTOR.TEXT} texts`],
                ["Most one round reads", `${cfg.round_capacity.IMAGE} images, ${cfg.round_capacity.TEXT} texts`],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line-soft py-1.5">
                  <dt className="text-ink-2">{k}</dt><dd className="figure text-right">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
