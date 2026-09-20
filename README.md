<p align="center"><img src="https://raw.githubusercontent.com/Hemmy1417/Structura/main/web/app/icon.svg" width="140" alt="STRUCTURA"/></p>

# STRUCTURA - Construction milestone escrow

**A milestone's payment moves only when GenLayer's validators, each looking at the evidence
themselves, agree the work is done.**

A client escrows GEN against a milestone's written criteria. The contractor files photographs,
video frames and documents, which the contract stores and hashes itself; the client and a
named inspector can file too. Validators on GenLayer each look at the images and judge every
criterion, and the payment is released only after a majority reproduces the acceptance and the
client's window to contest it has passed.

## What it is

- **Escrow with signed terms:** the client funds a project and proposes milestones; each
  reserves its payment from the escrow, and the contractor signs the terms before anything is
  judged.
- **Evidence on the record:** images and documents are stored by the contract, hashed when
  filed, and read by every validator as the same bytes. Capture dates and places are recorded
  as the submitter's claims.
- **Judged by consensus:** each validator looks at the images itself and rates every criterion
  met, not met or unclear; a decision stands only when a majority reproduces it and its grounds.
- **Appeals with an evidence period:** the party a decision goes against may appeal once; every
  party may then file, and anyone triggers the readjudication.
- **Pull payments:** only a finalized acceptance pays; the contractor claims it, and anything
  never accepted returns to the client.

## How it works

### For clients

1. Create a project: name the contractor and, optionally, an inspector; escrow GEN; choose the
   appeal window.
2. Propose a milestone: requirements, a specification, up to eight criteria, the evidence each
   party must file, the payment and the deadline.
3. Watch the evidence arrive; file your own photographs or documents while the milestone awaits
   evidence.
4. If the validators accept and you disagree, appeal inside the window with your reason and new
   evidence.
5. Withdraw escrow no milestone has reserved; a milestone never accepted returns its
   reservation after its deadline.

### For contractors

1. Sign the project and each version of the terms.
2. File photographs, frames from a video, scanned pages and documents against the evidence
   requirements.
3. Request an assessment: the validators judge your evidence and everything the client and the
   inspector filed.
4. If the decision rejects the work, file more and request another assessment before the
   deadline, or appeal.
5. Once an acceptance is finalized, claim the payment to your wallet.

Inspectors accept their role and file reports the terms can require. Anyone can finalize,
close, readjudicate an appeal or lapse an undecided one when its time comes; none of those acts
can change what the evidence decides.

## Outcomes

| Outcome | Meaning | Money |
|---|---|---|
| Accepted | every criterion met, no conflict, reproduced by a majority | payable after the client's window, or at once when an appeal upholds it |
| Rejected | at least one criterion clearly not met | not payable; the contractor may add evidence and reassess, or appeal |
| Undetermined | some criterion unclear, or the evidence conflicts | not payable; the contractor may add evidence and reassess |
| Paid | finalized acceptance | credited to the contractor, who claims it |
| Closed | the deadline passed with no acceptance standing | the reservation returns to the client's escrow |

Doubt and conflict never pay.

## Lifecycle

```text
 AWAITING_TERMS ── contractor signs ──► AWAITING_EVIDENCE
                                             │ contractor requests an assessment
                                             ▼
                    ┌──────────────── assessment round ────────────────┐
                    ▼                        ▼                          ▼
                ACCEPTED                 REJECTED                  UNDETERMINED
          client may appeal        contractor may appeal,        contractor adds evidence
          inside the window        or reassess                   and reassesses
                    │                        │
                    └───────► APPEALED ◄─────┘
                          evidence period, then anyone decides:
                          ACCEPTED (pays at once), REJECTED, UNDETERMINED;
                          undecided for three days: lapses to UNDETERMINED
                    │
      finalize (anyone, after the window) ──► FINALIZED ── claim
      close (anyone, after the deadline, nothing accepted) ──► CLOSED
```

| State | Who moves it | If nobody acts |
|---|---|---|
| AWAITING_TERMS | the contractor signs, while those terms' own deadline stands | anyone closes it once no signable version is left |
| AWAITING_EVIDENCE | the contractor requests an assessment | anyone closes it after the deadline |
| ACCEPTED | the client appeals, or anyone finalizes after the window | finalize is open to anyone once the window passes |
| REJECTED, UNDETERMINED | the contractor reassesses or, from a rejection, appeals | anyone closes it after the deadline and any window |
| APPEALED | anyone decides once the evidence period ends | anyone lapses it three days later |
| FINALIZED, CLOSED | terminal | the ledger holds the credit until claimed |

## GenLayer consensus functions

| Function | Kind | What runs under consensus |
|---|---|---|
| `request_assessment` | write, nondeterministic | every node looks at the images two per prompt, judges each criterion, and the validators check the leader's decision and grounds against their own |
| `decide_appeal` | write, nondeterministic | the same, over the appealed round's recorded evidence plus everything filed since, marked new |
| every other write | deterministic | roles, states, clocks, quotas, reservations, finality and payment, in plain contract code |

## Contract

| | |
|---|---|
| Live app | https://struc-tura.vercel.app |
| Network | GenLayer Studio Next |
| Chain ID | 61997 |
| RPC | `https://studio-next.genlayer.com/api` |
| Explorer | https://explorer-studio-dev.genlayer.com |
| Deployment of record | [`0x238243bBBbD9E450107D84F141bbC61888B117f6`](https://explorer-studio-dev.genlayer.com/address/0x238243bBBbD9E450107D84F141bbC61888B117f6) |
| Source | [`contracts/structura.py`](contracts/structura.py), sha256 `162c3615…b0dc`, byte-identical to the deployment |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |

### Write methods

| Method | Who | Payable | Notes |
|---|---|---|---|
| `create_project(params_json)` | anyone, as client | yes | parties, site, appeal window (10 minutes to 7 days) |
| `fund_project(pid)` | the client | yes | a stranger's value is credited back, never kept |
| `accept_project(pid)` | the named contractor | no | signs the project and every version proposed so far |
| `accept_inspector_role(pid)` | the named inspector | no | required before the inspector files |
| `cancel_project(pid)` | the client | no | only before the contractor signs; escrow credited back |
| `withdraw_escrow(pid, amount_wei)` | the client | no | unreserved escrow only, to the client's balance |
| `add_milestone(pid, terms_json)` | the client | no | reserves the payment from free escrow; terms cannot require an inspector the project never named |
| `propose_version(mid, terms_json)` | the client | no | new terms; the current ones stand until signed |
| `accept_version(mid, version)` | the contractor | no | only while that version's deadline stands; adjusts the reservation |
| `submit_image(mid, meta_json, data)` | the parties | no | PNG or JFIF JPEG, at most 400,000 bytes, hashed by the contract |
| `submit_document(mid, meta_json, text)` | the parties | no | up to 6,000 characters |
| `submit_declaration(mid, text)` | the parties | no | a statement for the record; no round reads it |
| `request_assessment(mid, item_ids_json)` | the contractor | no | consensus round |
| `open_appeal(mid, reason)` | the party the decision went against | no | once per decision, inside the window |
| `decide_appeal(mid)` | anyone | no | consensus round, after the evidence period |
| `lapse_appeal(mid)` | anyone | no | three days after an undecided evidence period |
| `finalize(mid)` | anyone | no | credits the payment to the contractor |
| `close_milestone(mid)` | anyone | no | after the deadline with nothing accepted and no signable terms left; returns the reservation |
| `claim()` | anyone owed | no | the only method that sends value |

### Read methods

`get_config`, `get_stats`, `list_projects(skip, limit)`, `projects_of(addr, skip, limit)`,
`get_project(pid)`, `get_milestone(mid)`, `get_round(mid, n)`, `get_item(eid)`,
`get_image(eid)`, `get_events(pid, skip, limit)`, `get_balance(addr)`. Lists are paged; no view
scans an unbounded collection.

### Consensus guarantees

- An acceptance needs every agreeing validator's own acceptance: every criterion met, no
  conflict.
- A rejection needs every criterion the leader rejects found not met by the validator, and no
  conflict it sees.
- A leader may assert less than a validator would, never withhold an acceptance the validator
  would grant, and never report a conflict the validator does not see.
- A node that could not see the images cannot vote for any decision, and a leader that could
  not see them is replaced.
- The decision is derived in code from the agreed ratings; the leader's prose is recorded as
  its notes and moves nothing.
- A party's own caption or document cannot establish a criterion or create a conflict, and no
  round reads a declaration.

## Verified end-to-end

The live proofs ran on the deployment of record on 20 Sep 2026, every claim an assertion in
[`scripts/proofs.mjs`](scripts/proofs.mjs). Excerpt of the run's output (local path shortened):

```text
[01:20:56] proofs on 0x238243bBBbD9E450107D84F141bbC61888B117f6
[01:26:48] flagship.assess: FINALIZED MAJORITY_AGREE leader=SUCCESS in 56 s
[01:27:28] walls.finalize_early: FINALIZED MAJORITY_AGREE leader=ERROR in 35 s
[01:36:04] negative.assess: FINALIZED MAJORITY_AGREE leader=SUCCESS in 111 s
[01:42:03] injection.assess: FINALIZED MAJORITY_AGREE leader=SUCCESS in 66 s
[01:47:54] mirror.assess: FINALIZED MAJORITY_AGREE leader=SUCCESS in 101 s
[01:48:35] conflict.appeal: FINALIZED MAJORITY_AGREE leader=SUCCESS in 36 s
[01:49:58] walls.decide_early: FINALIZED MAJORITY_AGREE leader=ERROR in 36 s
[01:50:36] flagship.finalize: FINALIZED MAJORITY_AGREE leader=SUCCESS in 35 s
[01:51:18] flagship.claim: FINALIZED MAJORITY_AGREE leader=SUCCESS in 35 s
[01:59:50] conflict.decide: FINALIZED MAJORITY_AGREE leader=SUCCESS in 101 s
[02:00:35] walls.finalize_unconfirmed: FINALIZED MAJORITY_AGREE leader=ERROR in 41 s
[02:00:36] all proofs passed; results in .data/proofs-0x238243bBBbD9E450107D84F141bbC61888B117f6.json
```

| Case | Asserted outcome |
|---|---|
| Flagship: two photographs of the poured foundation and the inspector's report | Accepted on every criterion, no conflict; finalized after the window; the contractor's wallet received the 2 GEN less the claim's fee |
| Negative control: trenches and rebar, nothing poured | Rejected, decisive criterion C1 |
| Instructions hidden in a caption and a document | Not accepted (recorded: rejected); no declaration read |
| The client's bare declaration against the photographs | Accepted; the declaration was not read |
| The client appeals with a photograph of an empty lot | Not accepted (recorded: undetermined, conflict); the photograph read as new evidence |
| Walls | early finalize, a stranger's assessment, the contractor appealing their own acceptance, filing against a standing acceptance, deciding during the evidence period, finalizing an unconfirmed acceptance: each refused by the contract in a finalized transaction; a stranger's payment credited back and claimed |

What the flagship's leading validator wrote, recorded as its notes:

> The two contractor photographs visibly show concrete ground beams/footings already poured,
> and the inspector's report independently confirms that the footings and reinforced concrete
> ground beams have been poured and stripped. The visible arrangement in both images shows beams
> running between precast column bases in a grid, which matches the stated specification and is
> expressly confirmed by the inspector.

Every transaction, each round's panel, and what the receipts show beyond the assertions are in
[docs/e2e-verification.md](docs/e2e-verification.md).

The app's own write path ran live as well, on the same deployment: through the Transaction Kit
and claim wrapper the app itself uses, the flagship's client funded 0.5 GEN, withdrew it and
claimed it, and in a second check the parties renegotiated a milestone's terms, a stranger
closed one nobody delivered, and a client cancelled a project the contractor never signed
(`pnpm test:live`, transactions in the verification document). Every act in the interface was
then opened in a browser against this deployment and the call each page composed was read back
before it was declined: all nineteen of the contract's writes, each one exact.

Three of the five rounds needed a second leader: the first leader's reading was not reproduced
by a majority, so it was replaced and nothing was recorded in between.

**Tests:** 239 contract tests (a strict stub harness, 11 on the official GenLayer direct runner,
and a randomized invariant walk), 64 app tests, and two mutation sweeps that break each rule
and require a failing test: 69 of 69 in the contract, 38 of 38 in the app.

## Tech stack

| Layer | Technology |
|---|---|
| Contract | Python on GenVM, `py-genlayer` runner `5jycge4q…`, `genvm-lint` |
| Contract tests | pytest, genlayer-test direct runner |
| App | Next.js 16 (App Router), React 19, TypeScript 6 (strict), Tailwind CSS 4 |
| Chain access | genlayer-js 2.0.0-rc.1, GenLayer Transaction Kit 0.1.0-rc.2, EIP-6963 wallets |
| App tests | Vitest 5, Testing Library, jsdom |
| Tooling | pnpm, ESLint 9, GitHub Actions |
| Network | GenLayer Studio Next, chain 61997 |

## Repository

```text
contracts/structura.py     the contract
tests/direct/              contract tests: stub harness, official runner, invariant walk
tests/mutation/            the contract's mutation sweep
scripts/                   deploy, verify, keys, live operation, proofs, proof report
web/                       the app (Vercel root directory)
  app/                     the sheets
  components/              sheet parts, evidence, transaction panel, wallet dock
  lib/                     reads, acts, presentation, kit, receipts, images
  tests/                   unit tests and the app's mutation sweep
docs/                      architecture, consensus, evidence model, state machine,
                           security, verification, probe report, specification
fixtures/                  the demonstration photographs and their licences
```

## Getting started

The contract, with Python 3.12:

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
genvm-lint check contracts/structura.py
python -m pytest tests/direct -q
python tests/mutation/mutate.py
```

The app, with Node 22.12 or later and pnpm:

```bash
cd web
pnpm install
pnpm dev
```

It serves on `http://localhost:3141` and reads the deployment of record by default; set
`NEXT_PUBLIC_STRUCTURA_CONTRACT` to point it at another deployment. Checks: `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm mutate`, `pnpm build`.

Verify the deployment and rerun the proofs:

```bash
cd scripts && pnpm install
node deploy.mjs verify 0x238243bBBbD9E450107D84F141bbC61888B117f6
node keys.mjs && node deploy.mjs mine && node proofs.mjs 0x<address>
```

## Security

- Every account the contract records is the transaction signer; the deployer has no powers.
- Evidence is immutable and hashed by the contract; each round snapshots the digests it read,
  and the app recomputes them in the browser.
- The contractor names their own items; everything the client and the inspector filed is always
  read. Nobody can file against a standing acceptance without appealing it.
- Each party has its own evidence quota, so no side can use up another's room.
- Reservations make over-commitment impossible; conservation holds to the wei in the invariant
  walk.
- A refused payable credits the value back; value leaves only through `claim`, which zeroes the
  balance first and never waits on a clock.
- Every non-terminal state has an exit anyone can take.
- Terms no address could satisfy are refused when they are proposed, a version whose deadline
  has passed is never signed into force, and a permissionless close cannot end a renegotiation
  the contractor can still sign.
- Every view answers or refuses in words, and a validator whose own model fails disagrees
  rather than raising out of the vote.

The full trust model and threat list: [docs/security.md](docs/security.md).

## Design notes

- The validators answer one question: does the recorded evidence establish each criterion?
  Everything else is deterministic code.
- Images are stored on chain because the model gateway reads only PNG and JFIF JPEG, the runtime
  cannot decode JPEG, and a public host throttled validators after one round
  ([PROBE-REPORT](docs/PROBE-REPORT.md)). The browser redraws every image before filing.
- Validators first had to match every criterion's rating; the live panel stalled on exactly the
  contested cases, so the rule became "reproduce the decision and its grounds"
  ([consensus](docs/consensus.md)).
- Declarations were first kept out of judgments by instruction; a live validator still read a
  client's declaration as a conflict, so no round reads them now, by construction.
- The app never offers an act the contract would refuse: each unavailable act is listed with
  its reason, decided by a pure function tested on both sides of every clock boundary.
- The claim is priced by the network's fee simulation, because a transfer needs the message
  allocations it measures; every other write uses the network's live fee policy.
- The interface follows one product-page system: white cards on a grey canvas, one blue pill
  per page for the act a person is meant to take, accent colours only as a tinted word or an
  outlined status, hairlines instead of shadows, and every machine value behind a disclosure.

## Demonstration images

The demonstration projects use a public photo series of one house build in Thailand, February
2011, by Khaosaming (Wikimedia Commons,
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)), and a photograph of an empty
lot by Mx. Granger ([CC0](https://creativecommons.org/publicdomain/zero/1.0/)). Details in
[fixtures/ATTRIBUTION.md](fixtures/ATTRIBUTION.md). They show how the record works; they are
not anyone's real contract.

## Disclaimer

STRUCTURA runs on GenLayer Studio Next, a test network whose GEN has no value. It settles a
contract on the evidence the parties file; it does not certify that work is safe, sound or
compliant with any building code, and it does not replace a licensed inspection. Model
judgments are measured, not guaranteed; the verification document records how the live panel
behaved.
