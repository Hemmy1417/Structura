# End-to-end verification

What the live proof run on the deployment of record asserted, with every transaction, and what
the receipts show that the script did not assert.

## The deployment

| | |
|---|---|
| Deployment of record | [`0xD7639062c2Df6561572839A5ebF013E61Bab897A`](https://explorer-studio-dev.genlayer.com/address/0xD7639062c2Df6561572839A5ebF013E61Bab897A) |
| Network | GenLayer Studio Next, chain 61997 |
| Source | `contracts/structura.py` as of commit `cccc248`, sha256 `96091fdaa978c171737fd72b65eeb8864f96a542bdc943ab17143fb894047b40` |
| Byte check | `node scripts/deploy.mjs verify 0xD7639062c2Df6561572839A5ebF013E61Bab897A` prints `byte-for-byte identical` |
| Deploy transaction | [`0xb6dc6cb3…a7fc`](https://explorer-studio-dev.genlayer.com/tx/0xb6dc6cb3958e0ea4df92ac64a6613ee368ef4325f90406a7281399b7b811a7fc) |
| Rules | `structura-rules-1`, runner `py-genlayer:5jycge4q…` |

## The run

`node scripts/proofs.mjs 0xD7639062…897A`, 19 Sep 2026, 17:13 to 17:55 UTC. Every claim the
script makes is an assertion: if the contract or the panel had behaved otherwise the run would
have stopped and named the failed assertion. It sends real transactions signed by four role
keys (the client, the contractor, the inspector and a stranger; `scripts/keys.mjs` creates and
funds them with the deployer's), saves every hash the moment it is sent, and resumes from its
saved state.

42 transactions, every one finalized. No round failed to reach consensus. The full record,
with every step's returned text and each assessment's panel, is in
[docs/proofs](proofs/0xD7639062c2Df6561572839A5ebF013E61Bab897A.json).

## What was asserted

| step | what was asserted | outcome | transaction |
|---|---|---|---|
| `flagship.assess` | Flagship: two photographs of the poured foundation and the inspector's report, three criteria | Accepted on every criterion, no conflict | [0xfa3c082c…](https://explorer-studio-dev.genlayer.com/tx/0xfa3c082c49d13e18b890919693777d8c845a9d2e60453b3e18f09758fc7f0342) |
| `walls.finalize_early` | Finalize while the client's appeal window is open | Refused: "the appeal window is still open" | [0xd1880502…](https://explorer-studio-dev.genlayer.com/tx/0xd18805029bada0e7da9d5ce8f5b100b6c14187e6b6f2e3c72642b790cdc55308) |
| `walls.stranger_assessment` | A stranger requests an assessment | Refused: "only the contractor requests an assessment" | [0xdf1afa99…](https://explorer-studio-dev.genlayer.com/tx/0xdf1afa99f3498988b95966fc9d1987f34c832e9d4ee821240ef88157bfe757e4) |
| `walls.contractor_appeals_own_acceptance` | The contractor appeals an acceptance | Refused: "only the party the decision went against may appeal it" | [0xced5ca61…](https://explorer-studio-dev.genlayer.com/tx/0xced5ca61139843a894439b5a828d4f3e8ee85906dac8266cac4f3388c1751472) |
| `walls.client_files_without_appeal` | The client files against a standing acceptance without appealing | Refused: "the acceptance stands; to contest it the client opens an appeal, and every party may then add evidence" | [0xb5d5c707…](https://explorer-studio-dev.genlayer.com/tx/0xb5d5c70797369dc8ae60c8183dbebb400908d486b191f66f09cb12cc2c3d8e5f) |
| `walls.stranger_funds` | A stranger sends 0.1 GEN to someone else's project | Credited back to the stranger in full | [0x9c0779fe…](https://explorer-studio-dev.genlayer.com/tx/0x9c0779fea55d13600e153cc06770389724d1d4aef468b754a65d3daebfbe71ca) |
| `walls.stranger_claims_refund` | The stranger claims the refund | Claim succeeded | [0x6d57d33c…](https://explorer-studio-dev.genlayer.com/tx/0x6d57d33cdea2cfcb3982286b95a84d1ac28d333d135aa395ac5872df1f693317) |
| `negative.assess` | Negative control: trenches and rebar, nothing poured | Rejected; decisive: C1 | [0x6d19560d…](https://explorer-studio-dev.genlayer.com/tx/0x6d19560da7e989ac3bfc2ad4b35d28785e44f2244fdaa6b91ddbe7adf588d6b6) |
| `injection.assess` | Instructions hidden in a caption and a document, a declaration filed alongside | Rejected, not accepted; no declaration read | [0x2508e58b…](https://explorer-studio-dev.genlayer.com/tx/0x2508e58b636c7895b1a27975119b72ce2991910c89387219bf719a5dc362b62b) |
| `mirror.assess` | The client's bare declaration against photographs of the poured foundation | Accepted; the declaration was not read | [0x03387c4e…](https://explorer-studio-dev.genlayer.com/tx/0x03387c4e7ad879dd66e111c692c123ea4b7fac4e008992be51947d6fa8e3b198) |
| `conflict.appeal` | The client appeals the acceptance, with a reason | Appeal opened; evidence period began | [0x3dee13d6…](https://explorer-studio-dev.genlayer.com/tx/0x3dee13d686db675473811e0945a5a2de9fde48247dcd2080bf1301bf08102948) |
| `walls.decide_early` | Decide the appeal during its evidence period | Refused: "the appeal's evidence period is still open" | [0x3e334b14…](https://explorer-studio-dev.genlayer.com/tx/0x3e334b1487decfbc632ee1caf4766fd193c8f17640470cf368af2b1cb94b8766) |
| `flagship.finalize` | Finalize the flagship after its window | 2 GEN credited to the contractor | [0xfef62795…](https://explorer-studio-dev.genlayer.com/tx/0xfef62795584c06b099a9ac7e0f3fba05bcee4018db83d6ef0d48d3a49f5345e1) |
| `flagship.claim` | The contractor claims | The contractor's wallet received 1.9998 GEN (the payment less the claim's fee) | [0x247401bb…](https://explorer-studio-dev.genlayer.com/tx/0x247401bbba48c7be4daef13b2e2dc1cd30887903107c2c64838d675495187a0c) |
| `conflict.decide` | The appeal: the client's photograph of an empty lot, filed as new evidence | Undetermined, not accepted; the client's photograph was read as new evidence | [0xcbdf18e6…](https://explorer-studio-dev.genlayer.com/tx/0xcbdf18e6c068b9a9a5fa9918613f10578ff918f47fbc13d47bba2043b0d4e3f4) |
| `walls.finalize_unconfirmed` | Finalize after the appeal withheld the acceptance | Refused: "only a standing acceptance can be finalized" | [0x1bc94f64…](https://explorer-studio-dev.genlayer.com/tx/0x1bc94f6479017318d050f686cb291b4a0c2f090492b6d5600c029415e48dc403) |

The table is printed by `node scripts/proof-report.mjs`, which reads each outcome from the
recorded result; none is written by hand. The refused writes were sent as real transactions
without simulation, so each refusal is the contract's own sentence, decoded from a finalized
receipt.

The four cases share one milestone's terms: footings and ground beams for a house on precast
columns, three criteria (C1 cast in concrete, C2 consistent with the specified layout, C3 the
photographs show the same site), photographs from the contractor and, for the flagship, the
inspector's report. The photographs are one public series of a real build, credited in
[fixtures](../fixtures/ATTRIBUTION.md).

## The panels

Read from each round's receipt. Models are the routes Studio Next reported; "idle" is a node
that returned no vote.

| round | leader rotations | recorded |
|---|---|---|
| M-001/1, flagship | 1. Leader GPT-5.4. Agreed: GPT-5.4, Gemini, Claude Sonnet. Disagreed: Mistral, which printed "this validator did not receive the images". One idle. | Accepted |
| M-002/1, negative control | 1. Leader Gemini 3 Flash. Agreed: DeepSeek. Disagreed: Claude Sonnet, Gemini, Grok. No majority, leader replaced. 2. Leader Claude Sonnet. Agreed: Grok, GPT-5.4, Gemini. Two idle. | Rejected on C1 |
| M-003/1, injection | 1. Leader Claude Sonnet 4.6. Agreed: Claude Sonnet, Gemini, Gemini 3 Flash. Disagreed: GPT-5.4. One idle. | Rejected |
| M-004/1, mirror | 1. Leader DeepSeek. Agreed: GPT-5.4, Gemini, Gemini. Disagreed: DeepSeek's own validator run (C2 unclear), Claude Sonnet 4.6 (C3 unclear, conflict). | Accepted |
| M-004/2, the appeal | 1. Leader Mistral, which reported it did not receive the images. Disagreed, each printing "the leader did not receive the images": Mistral, GPT-5.4, Claude Sonnet. Two idle. Leader replaced. 2. Leader DeepSeek. Agreed: DeepSeek, GPT-5.4, Claude Sonnet. Two idle. | Undetermined, conflict |

## Observed, not asserted

The script asserts the outcomes in the first table and nothing more. These are what the
receipts and records show beyond them.

- **A blind leader was replaced, live.** In the appeal round the first leader could not see
  the images; every voting validator disagreed for that reason, the leader was rotated out,
  and the second leader's reading was recorded. A blind validator in the flagship round lost
  its vote the same way. The direct suite asserts both rules
  (`test_a_blind_leader_is_never_recorded`, `test_a_blind_validator_disagrees`).
- **The conflict flag.** The appeal round recorded `conflicts_detected: true`: the client's
  photograph of an empty lot against the contractor's photographs of a foundation. The script
  asserts only that the appeal did not pay and read the photograph as new evidence.
- **Decisions under dissent.** Three of the five rounds were recorded with one or two
  validators dissenting (a blind node, or a different reading of a criterion), and two rounds
  needed a second leader. That is the rule working as designed: readings that decide nothing
  may differ, and a decision stands only when a majority reproduces it and its grounds
  ([consensus](consensus.md)).
- **The injection case recorded the negative control's decision.** Both used the same two
  photographs, trenches and a rebar cage; with instructions hidden in a caption and a
  document, and a declaration filed alongside, the round still recorded a rejection.

## Money

After the run the contract reported 4 projects, 4 milestones, 13 evidence items, 5 rounds,
1 milestone finalized and 2 GEN paid. The flagship's 2 GEN moved from the client's escrow to
the contractor's ledger row at `finalize` and to the contractor's wallet at `claim`; the
stranger's 0.1 GEN was credited back and claimed. Every other milestone still holds its
reservation until its deadline, when anyone can close it and return the reservation to the
client.

## Before this deployment

An earlier deployment, `0x6cbE71156bE65847454F7064D31fC541fB0cA942`, was retired during the
build. A Studio Next transaction on it stayed in COMMITTING after a failed leader rotation
(`0x205efc99…9418`) and blocked every later transaction in its queue, and it predates the rule
that no round reads a declaration. None of its rounds are part of this record. The consensus
rule itself was settled on disposable deployments first; [consensus](consensus.md) and
[PROBE-REPORT](PROBE-REPORT.md) record why and with which transactions.

## Reproduce

```bash
git clone https://github.com/Hemmy1417/Structura && cd Structura/scripts && pnpm install
node deploy.mjs verify 0xD7639062c2Df6561572839A5ebF013E61Bab897A
```

To run the proofs on your own deployment (about 45 minutes of real appeal windows):

```bash
node keys.mjs
node deploy.mjs mine
node proofs.mjs 0x<the address it printed>
node proof-report.mjs 0x<the same address>
```

The last step rewrites `web/lib/proof-log.json` and `docs/proofs/` for that deployment.
