"use client";

import { useEffect, useState } from "react";

import { Chip, CopyRow, Fold, Loading, ReadFailure } from "@/components/bits";
import { Band, Hero, Section } from "@/components/Page";
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
    <>
      <Hero
        kicker="Verification"
        title={<>Check it yourself, without <span className="tint-blue">trusting</span> this app.</>}
        lead={
          <p>
            The contract on chain is byte for byte the contract in the repository, and every live proof below is a
            transaction anyone can open.
          </p>
        }
        actions={
          <>
            <a className="btn btn-primary no-underline" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
              Open the contract on the explorer
            </a>
            <a className="btn btn-neutral no-underline" href={SOURCE_URL} target="_blank" rel="noreferrer">Read the source</a>
          </>
        }
      />

      <Band tone="canvas" wide>
        <Section
          title="The deployment"
          aside={IS_RECORD ? <Chip tone="green">The deployment of record</Chip> : <Chip tone="orange">A test deployment</Chip>}
        >
          <div className="card">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="caption">Network</dt>
                <dd className="mt-1">GenLayer Studio Next, chain {CHAIN_ID}</dd>
              </div>
              <div>
                <dt className="caption">Rules</dt>
                <dd className="mt-1">{error ? <ReadFailure error={error} /> : cfg ? present.prose(cfg.ruleset) : "reading"}</dd>
              </div>
              <div>
                <dt className="caption">Source</dt>
                <dd className="mt-1">
                  <a className="link" href={SOURCE_URL} target="_blank" rel="noreferrer">contracts/structura.py</a>
                  {log.source_commit ? `, commit ${log.source_commit}` : ""}
                </dd>
              </div>
            </dl>
            <div className="mt-6">
              <Fold summary="Addresses and endpoints">
                <CopyRow label="Contract" value={CONTRACT_ADDRESS} href={addressUrl(CONTRACT_ADDRESS)} />
                {IS_RECORD ? null : <CopyRow label="Deployment of record" value={RECORD_ADDRESS} href={addressUrl(RECORD_ADDRESS)} />}
                <CopyRow label="Network endpoint" value={RPC_URL} />
                <CopyRow label="Repository" value={REPO_URL} href={REPO_URL} />
              </Fold>
            </div>
          </div>
        </Section>
      </Band>

      <Band tone="white" wide>
        <Section title="Check the bytes yourself">
          <ol className="grid gap-6">
            <li className="card-quiet">
              <p className="font-semibold">1. Fetch the deployed source and diff it against the repository</p>
              <pre className="mt-3 overflow-x-auto rounded-[10px] bg-obsidian p-4 text-[13px] leading-relaxed text-[#f5f5f7]">{`git clone ${REPO_URL}
cd Structura/scripts && pnpm install
node deploy.mjs verify ${CONTRACT_ADDRESS}`}</pre>
              <p className="body-sm mt-3 text-slate">It prints the digest of both, and says whether they are identical.</p>
            </li>
            <li className="card-quiet">
              <p className="font-semibold">2. Run the contract&apos;s tests</p>
              <pre className="mt-3 overflow-x-auto rounded-[10px] bg-obsidian p-4 text-[13px] leading-relaxed text-[#f5f5f7]">{`python -m pytest tests/direct -q
python tests/mutation/mutate.py`}</pre>
              <p className="body-sm mt-3 text-slate">
                A strict harness, the official GenLayer direct runner, a randomized invariant walk, and a sweep
                that breaks each safety check to prove the suite notices.
              </p>
            </li>
            <li className="card-quiet">
              <p className="font-semibold">3. Recompute a digest in your own browser</p>
              <p className="body-sm mt-3 text-slate">
                Open any round record and press recompute on an evidence item: this page reads the stored bytes
                back from the chain and hashes them here, then compares the result with the digest the contract
                recorded when the item was filed.
              </p>
            </li>
          </ol>
        </Section>
      </Band>

      <Band tone="canvas" wide>
        <Section
          title="Live proofs on this deployment"
          aside={proofs.length ? `${present.plural(proofs.length, "transaction")}, each asserted by the proof script` : undefined}
        >
          {proofs.length === 0 ? (
            <p className="text-slate">
              The proof run&apos;s log is published with the repository. Every round is also listed on{" "}
              <a className="link" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">the contract&apos;s page on the explorer</a>.
            </p>
          ) : (
            <ul className="grid gap-4">
              {proofs.map((pr) => (
                <li key={pr.hash} className="card-quiet">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-[60ch]">
                      <p className="font-semibold">{present.prose(pr.claim)}</p>
                      <p className="body-sm mt-1.5 text-slate">{present.prose(pr.outcome)}</p>
                    </div>
                    <a className="btn btn-neutral btn-sm no-underline" href={txUrl(pr.hash)} target="_blank" rel="noreferrer">
                      Open the transaction
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Band>

      <Band tone="white" wide>
        <Section title="Limits the contract enforces">
          {!cfg ? <Loading what="the limits" /> : (
            <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {[
                ["Smallest milestone payment", present.gen(cfg.min_payment_wei)],
                ["Appeal window", `${present.duration(cfg.min_appeal_window_seconds)} to ${present.duration(cfg.max_appeal_window_seconds)}`],
                ["An appeal lapses after its evidence period", present.duration(cfg.appeal_lapse_seconds)],
                ["Assessments per version of the terms", String(cfg.max_assessments_per_version)],
                ["Criteria per milestone", String(cfg.max_criteria)],
                ["Largest image", present.size(cfg.image_max_bytes)],
                ["Contractor's evidence per version", `${cfg.quotas.CONTRACTOR.IMAGE} images, ${cfg.quotas.CONTRACTOR.TEXT} texts`],
                ["Client's evidence per version", `${cfg.quotas.CLIENT.IMAGE} images, ${cfg.quotas.CLIENT.TEXT} texts`],
                ["Inspector's evidence per version", `${cfg.quotas.INSPECTOR.IMAGE} images, ${cfg.quotas.INSPECTOR.TEXT} texts`],
                ["The most one round reads", `${cfg.round_capacity.IMAGE} images, ${cfg.round_capacity.TEXT} texts`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-fog py-2">
                  <dt className="body-sm text-slate">{k}</dt>
                  <dd className="body-sm tabular text-right">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>
      </Band>
    </>
  );
}
