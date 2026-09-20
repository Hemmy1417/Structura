# End-to-end verification

What the live proof run on the deployment of record asserted, with every transaction, and what
the receipts show that the script did not assert.

## The deployment

| | |
|---|---|
| Deployment of record | [`0x238243bBBbD9E450107D84F141bbC61888B117f6`](https://explorer-studio-dev.genlayer.com/address/0x238243bBBbD9E450107D84F141bbC61888B117f6) |
| Network | GenLayer Studio Next, chain 61997 |
| Source | `contracts/structura.py` as of commit `d6a9870`, sha256 `162c36152e5c02f600e7e1e62d1ba5471e320b8515a29504b61e8b25d171b0dc` |
| Byte check | `node scripts/deploy.mjs verify 0x238243bBBbD9E450107D84F141bbC61888B117f6` prints `byte-for-byte identical` |
| Deploy transaction | [`0x4e4c4210…4c5b`](https://explorer-studio-dev.genlayer.com/tx/0x4e4c421047372beb733ce2826d146492ec1ce0a2165e6befce1a1f25152c4c5b) |
| Rules | `structura-rules-1`, runner `py-genlayer:5jycge4q…` |

## The run

`node scripts/proofs.mjs 0x238243bB…17f6`, 20 Sep 2026, 01:20 to 02:00 UTC. Every claim the
script makes is an assertion: if the contract or the panel had behaved otherwise the run would
have stopped and named the failed assertion. It sends real transactions signed by four role
keys (the client, the contractor, the inspector and a stranger; `scripts/keys.mjs` creates and
funds them with the deployer's), saves every hash the moment it is sent, and resumes from its
saved state.

42 transactions, every one finalized, and no round failed to reach consensus. The full record,
with every step's returned text and each assessment's panel, is in
[docs/proofs](proofs/0x238243bBBbD9E450107D84F141bbC61888B117f6.json).

## What was asserted

| step | what was asserted | outcome | transaction |
|---|---|---|---|
| `flagship.assess` | Flagship: two photographs of the poured foundation and the inspector's report, three criteria | Accepted on every criterion, no conflict | [0x0f567ea0…](https://explorer-studio-dev.genlayer.com/tx/0x0f567ea02064ab0c57dcac907f02d523d3674d3db08e69649be7ed799240a9b3) |
| `walls.finalize_early` | Finalize while the client's appeal window is open | Refused: "the appeal window is still open" | [0x3187fdb2…](https://explorer-studio-dev.genlayer.com/tx/0x3187fdb208040a6864eb116ab17d2e916ae8d1166adc29b5502deae3b110d0cd) |
| `walls.stranger_assessment` | A stranger requests an assessment | Refused: "only the contractor requests an assessment" | [0xc3859106…](https://explorer-studio-dev.genlayer.com/tx/0xc38591063dc0e51335ae07bea4486a34955a0569c3581b937217b08012bee350) |
| `walls.contractor_appeals_own_acceptance` | The contractor appeals an acceptance | Refused: "only the party the decision went against may appeal it" | [0xb171b16a…](https://explorer-studio-dev.genlayer.com/tx/0xb171b16a33e05568c8098dc1ea5994d51a785670e258412fc9c6979b24d1cd83) |
| `walls.client_files_without_appeal` | The client files against a standing acceptance without appealing | Refused: "the acceptance stands; to contest it the client opens an appeal, and every party may then add evidence" | [0xeedca2f5…](https://explorer-studio-dev.genlayer.com/tx/0xeedca2f5e207c97deadb72c3e69306c267c54d81fcaf94ef9013e27c0e578c63) |
| `walls.stranger_funds` | A stranger sends 0.1 GEN to someone else's project | Credited back to the stranger in full | [0x660e9170…](https://explorer-studio-dev.genlayer.com/tx/0x660e917093d485681bdbaab64424c72313982a0eab44f0f99a0f4d967b73ea2d) |
| `walls.stranger_claims_refund` | The stranger claims the refund | Claim succeeded | [0xce892a48…](https://explorer-studio-dev.genlayer.com/tx/0xce892a48b9dce8674cf85bfd50e85e2eaae1b36fc0798d26c5205595c64512cd) |
| `negative.assess` | Negative control: trenches and rebar, nothing poured | Rejected; decisive: C1 | [0x0029fb10…](https://explorer-studio-dev.genlayer.com/tx/0x0029fb108e36256b214165dbf5aa85939216e726c181ef8c3f9977f54ca862dc) |
| `injection.assess` | Instructions hidden in a caption and a document, a declaration filed alongside | Rejected, not accepted; no declaration read | [0x9622f2c1…](https://explorer-studio-dev.genlayer.com/tx/0x9622f2c1b2903ca9ceef0d51c5315bde50d4b2d09a04bd1c4c1c1daa8b5da3f4) |
| `mirror.assess` | The client's bare declaration against photographs of the poured foundation | Accepted; the declaration was not read | [0x327588dc…](https://explorer-studio-dev.genlayer.com/tx/0x327588dcd28deeabe3c34720611764950ec6b5bd99d74c2e60befa68e6b80829) |
| `conflict.appeal` | The client appeals the acceptance, with a reason | Appeal opened; evidence period began | [0x744f78be…](https://explorer-studio-dev.genlayer.com/tx/0x744f78be254e8e9de1291c29f39b36c871c87f9569c67b7e98a03e74bc3c8fb1) |
| `walls.decide_early` | Decide the appeal during its evidence period | Refused: "the appeal's evidence period is still open" | [0x986b8c90…](https://explorer-studio-dev.genlayer.com/tx/0x986b8c904cae6428b586c033212764dbcd0fda39721cf656dd5e58d7d362985d) |
| `flagship.finalize` | Finalize the flagship after its window | 2 GEN credited to the contractor | [0x63f4e524…](https://explorer-studio-dev.genlayer.com/tx/0x63f4e524b2a1e53e50a6251c767634994ae1e4fdfd565511512a20a1986937bc) |
| `flagship.claim` | The contractor claims | The contractor's wallet received 1.9998 GEN (the payment less the claim's fee) | [0xee856463…](https://explorer-studio-dev.genlayer.com/tx/0xee856463ee41e3df6363541831a913af10b1ef68df8662c332198c7481a5767f) |
| `conflict.decide` | The appeal: the client's photograph of an empty lot, filed as new evidence | Undetermined, not accepted; the client's photograph was read as new evidence | [0xb45e470e…](https://explorer-studio-dev.genlayer.com/tx/0xb45e470edc36b36fffe6cb82d99c9abba133f563e4ac10b753a00b8f7f66d6c2) |
| `walls.finalize_unconfirmed` | Finalize after the appeal withheld the acceptance | Refused: "only a standing acceptance can be finalized" | [0xe5a344b7…](https://explorer-studio-dev.genlayer.com/tx/0xe5a344b719c69e8b952016c0ee2060a0b2e5fab255c1d2cea98170e998b6666a) |

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
| flagship | 1. Leader Gemini. Agreed: Gemini, GPT-5.4 twice. Disagreed: Mistral, which printed that it did not receive the images. One idle. | Accepted, 56 s |
| negative control | 1. Leader DeepSeek. Disagreed: DeepSeek's own validator run, GPT-5.4, Claude Sonnet 4.6. Two idle. No majority, leader replaced. 2. Leader Claude Sonnet 4.6. Agreed: GPT-5.4 twice, Grok. Two idle. | Rejected on C1, 111 s over two rotations |
| injection | 1. Leader GPT-5.4. Agreed: GPT-5.4 twice, Claude Sonnet 4.6. Two idle. | Rejected, 66 s |
| mirror | 1. Leader DeepSeek. Disagreed: GPT-5.4, GPT-OSS, Gemini 3 Flash. Two idle. Leader replaced. 2. Leader GPT-5.4. Agreed: GPT-5.4, Gemini 3 Flash, Gemini. Disagreed: GPT-OSS. | Accepted, 101 s over two rotations |
| the appeal | 1. Leader GPT-OSS. Disagreed: GPT-5.4, Claude Sonnet, DeepSeek. Two idle. Leader replaced. 2. Leader GPT-5.4. Agreed: Claude Sonnet, GPT-5.4, DeepSeek. One disagreed. | Undetermined, conflict, 101 s over two rotations |

## Observed, not asserted

The script asserts the outcomes in the first table and nothing more. These are what the
receipts and records show beyond them.

- **A blind node loses its vote, live.** In the flagship round a Mistral route reported that it
  had not received the images and disagreed for that reason, so its vote could not carry the
  decision. The direct suite asserts the rule for both a validator and a leader
  (`test_a_blind_validator_disagrees`, `test_a_blind_leader_is_never_recorded`).
- **Three of the five rounds needed a second leader.** The first leader's reading was not
  reproduced by a majority, so it was replaced and the next leader's reading was recorded.
  Nothing was written in between: a decision exists only when a majority reproduces it and its
  grounds ([consensus](consensus.md)).
- **The conflict flag.** The appeal round recorded `conflicts_detected: true`: the client's
  photograph of an empty lot against the contractor's photographs of a foundation. The script
  asserts only that the appeal did not pay and read the photograph as new evidence.
- **The injection case recorded the negative control's decision.** Both used the same two
  photographs, trenches and a rebar cage; with instructions hidden in a caption and a
  document, and a declaration filed alongside, the round still recorded a rejection.

## The app's write path

The proof script signs with genlayer-js directly. The app signs through the GenLayer
Transaction Kit and its own claim wrapper (`web/lib/kit.ts`), so that path was run live too:
`pnpm test:live` (`web/tests/live/write-path.live.ts`) builds the kit exactly as the app does
for a connected wallet, with a test key behind an EIP-1193 provider in place of a browser
extension. On 20 Sep 2026 at 02:01 UTC the flagship's client, through the kit:

| write | what the test asserts | transaction |
|---|---|---|
| `fund_project`, 0.5 GEN attached | finalized and successful; the project's escrow grew by exactly 0.5 GEN | [0x00d8d48d…](https://explorer-studio-dev.genlayer.com/tx/0x00d8d48d76cf0c8a6f689836da8b862e8c8df402ad716e07b11757f46b5c3e8e) |
| `withdraw_escrow`, 0.5 GEN | finalized and successful; the client's claimable balance grew by exactly 0.5 GEN | [0x53b5c760…](https://explorer-studio-dev.genlayer.com/tx/0x53b5c7604dd68b05a3e6ae7d3070f3041dadc27f7ac180585212429f244892ac) |
| `claim`, priced by simulation | finalized and successful; the balance is zero; the wallet received more than 0.45 GEN | [0xf6244f37…](https://explorer-studio-dev.genlayer.com/tx/0xf6244f373661cb20560267473291d574f343f0791c1dc2141eb9bd5d9b1b8a68) |

The contract's transfer to the client followed as its own transaction
([0xade618a0…](https://explorer-studio-dev.genlayer.com/tx/0xade618a0a58c5a751cdd810f1324c6d980d994b308a25af22c3264feed0d83b1)).
The hashes were read from the explorer afterwards; the test asserts the outcomes.

## The terms and closing path

Four writes exist for the cases nobody wants: terms the parties renegotiate, a milestone
nobody delivers, and a project the contractor never signs. The proof run never reaches them,
because every one of its milestones is delivered and judged. They are covered by the direct
tests with the clock warped, and on 20 Sep 2026 between 06:53 and 07:02 UTC they were run live
as well, through the same kit the app signs with (`web/tests/live/terms-path.live.ts`). The
deadlines in that check are minutes away rather than weeks, so the closing path fits in one run.

| write | what the test asserts | transaction |
|---|---|---|
| `propose_version` | version 2 is pending, version 1 still in force, the reservation unchanged | [`0x776e27b6…`](https://explorer-studio-dev.genlayer.com/tx/0x776e27b68a0f7ef5ca91b6aacb6362abc379dc4413b2eb1973388836f8ff5257) |
| `accept_version` | version 2 is in force, nothing pending, the reservation follows the agreed payment | [`0xce57c535…`](https://explorer-studio-dev.genlayer.com/tx/0xce57c53589cdb0da95ce93f1180fd64076518be938ed9c0724dfbaef493c5a01) |
| `close_milestone`, by a stranger | the milestone is closed and the whole reservation is free again | [`0x9abf2540…`](https://explorer-studio-dev.genlayer.com/tx/0x9abf2540d52769e7d78cfffcb6ce2148d79085873ca5bcec3ace5d3666853f2b) |
| `cancel_project` | the project is cancelled, its escrow is zero, the client's claim grew by the whole escrow | [`0x5b694a91…`](https://explorer-studio-dev.genlayer.com/tx/0x5b694a91901ac6a4cb37752bb2dec31f39dbe4a7e5a753cdfdfc8af7064253f4) |

`lapse_appeal` is the one write with no live run: it can only be sent three days after an
undecided appeal's evidence period. The direct tests cover it with the clock warped.

## The interface itself

A transaction is only right if the page that builds it is right. On 20 Sep 2026 every act in
the app was opened in a browser against this deployment, with a stand-in wallet that answers
reads from the network and refuses to sign, and the transaction each page had composed was
read back before it was declined. All nineteen of the contract's writes are reachable, and
each one carried exactly the call the contract expects: the terms JSON the wizard builds, the
evidence items a chosen assessment presents, an image normalized to under 400 KB with its
caption and claimed origin, an amount in wei, an appeal's grounds.

Two things showed only there. A claim is priced at 0.001217 GEN, not the flat 0.175 GEN of
every other write, which is `withTransferAllocations` pricing a transfer by simulation. And a
refused signature ends as "The request was declined in your wallet. Nothing was submitted."

What a bench cannot do is sign, so the last mile, a real wallet's popup on a real click, is a
person's own run.

## Money

After the run the contract reported 4 projects, 4 milestones, 13 evidence items, 5 rounds,
1 milestone finalized and 2 GEN paid. The flagship's 2 GEN moved from the client's escrow to
the contractor's ledger row at `finalize` and to the contractor's wallet at `claim`; the
stranger's 0.1 GEN was credited back and claimed. Every other milestone still holds its
reservation until its deadline, when anyone can close it and return the reservation to the
client.

Three later projects sit on the same deployment and are not part of the proof run: two written
by the terms and closing check above, and one named "interface bench", written so the browser
sweep could reach the acts that exist only before a contractor signs and only while an appeal
window is open.

## Before this deployment

Three deployments preceded this one, and none of their rounds is part of this record.

- `0x6cbE7115…A942` was retired when a Studio Next transaction stayed in COMMITTING after a
  failed leader rotation (`0x205efc99…9418`) and blocked every later transaction in its queue.
- `0xD7639062…897A` carried a full passing proof run of its own, and was superseded when an
  audit of the contract found five defects worth fixing (see [security](security.md) for the
  rules they became).
- `0xdB12cDb2…04c4` carried the fixed contract, and was retired an hour later when the same
  platform fault took a different shape: a deterministic `add_milestone`
  (`0x442b97ce…0cd0`) sat in REVEALING with no majority, no rotations and a lifecycle that
  reported nothing to do. `scripts/lib.mjs` now detects that state and says so instead of
  waiting out its retries.

The consensus rule itself was settled on disposable deployments first; [consensus](consensus.md)
and [PROBE-REPORT](PROBE-REPORT.md) record why and with which transactions.

## Reproduce

```bash
git clone https://github.com/Hemmy1417/Structura && cd Structura/scripts && pnpm install
node deploy.mjs verify 0x238243bBBbD9E450107D84F141bbC61888B117f6
```

To run the proofs on your own deployment (about 40 minutes of real appeal windows):

```bash
node keys.mjs
node deploy.mjs mine
node proofs.mjs 0x<the address it printed>
node proof-report.mjs 0x<the same address>
```

The last step rewrites `web/lib/proof-log.json` and `docs/proofs/` for that deployment.
