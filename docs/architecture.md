# Architecture

One contract on GenLayer Studio Next, one Next.js app that talks to it from the browser, and
scripts that deploy, verify and prove it. There is no server, no database and no stored secret:
everything a party does is a transaction their own wallet signs, and everything the app shows
is read from the chain.

```
  browser: web/ (Next.js)                            GenLayer Studio Next, chain 61997
 ┌───────────────────────────────┐   views         ┌──────────────────────────────────────────┐
 │ sheets        app/            │ ──────────────► │ STRUCTURA   contracts/structura.py       │
 │ what you can do  lib/acts     │  gen_call,      │                                          │
 │ words        lib/present      │  budgeted       │  projects, milestones, versions          │
 │ reads        lib/read         │                 │  evidence: metadata, image bytes, text   │
 │ signing      lib/kit          │ ──────────────► │  rounds, ledger, events, role index      │
 │ wallets      lib/wallet       │  writes signed  │                                          │
 │ receipts     lib/receipt      │  by the wallet  │  request_assessment, decide_appeal:      │
 └───────────────────────────────┘                 │    gl.vm.run_nondet(leader, validator)   │
               ▲                                   │    every node looks at the images and    │
               │  transaction receipts             │    judges the criteria itself            │
               └────────────────────────────────── │                                          │
                                                   └──────────────────────────────────────────┘
```

| part | what it is |
|---|---|
| `contracts/structura.py` | the contract: every rule, every record, every payment |
| `web/` | the app: a drawing set of sheets, served by Vercel, no API routes |
| `scripts/` | deploy, byte-verify, operate by hand, and run the live proofs |
| `tests/direct/` | the contract's tests: a strict stub harness and the official SDK runner |
| `tests/mutation/`, `web/tests/mutation/` | sweeps that break each rule and prove a test notices |
| `fixtures/` | the demonstration photographs, with their licences |

## The contract

### Records

Every record is canonical JSON (keys sorted), so a view returns the same bytes to every reader.

| storage | key | holds |
|---|---|---|
| `projects` | `pr-00001` | parties, appeal window, escrow and reserved totals, milestone ids, state |
| `milestones` | `ms-00001` | every version of the terms, the current and pending version, state, the standing decision, an open appeal |
| `items` | `ev-000001` | evidence metadata: signer and role, kind, version, requirement, the contract's sha256, the submitter's claims |
| `item_bytes` | `ev-000001` | an image's bytes, exactly as filed |
| `item_text` | `ev-000001` | a document's or a declaration's text |
| `version_items` | `ms-00001\|1` | the items filed against one version of the terms |
| `rounds` | `ms-00001\|1` | a round record: evidence snapshot, criterion statuses, decisive criteria, decision, the leader's notes, window |
| `ledger` | address | what the contract owes an address (claimable, claimed) |
| `events` | `pr-00001\|000001` | a project's history, newest first when paged |
| `role_index` | `address\|000001` | the projects an address is party to, paged |
| `counters` | name | sequence numbers and totals |

No view scans an unbounded collection: lists are paged newest first, at most 50 a call, and
each party's project list is its own index.

### Writes

| group | method | who |
|---|---|---|
| project | `create_project` (payable) | anyone; the signer becomes the client |
| | `fund_project` (payable), `withdraw_escrow` | the client (a stranger's value is credited back, not kept) |
| | `accept_project` | the named contractor, signing the project and the terms proposed so far |
| | `accept_inspector_role` | the named inspector |
| | `cancel_project` | the client, only before the contractor signs |
| terms | `add_milestone`, `propose_version` | the client; the payment is reserved from free escrow |
| | `accept_version` | the contractor |
| evidence | `submit_image`, `submit_document`, `submit_declaration` | the client, the contractor, the accepted inspector, each within its own quota |
| rounds | `request_assessment` | the contractor |
| | `open_appeal` | the party the decision went against, inside the window |
| | `decide_appeal` | anyone, once the evidence period has ended |
| | `lapse_appeal` | anyone, three days after an undecided evidence period |
| settlement | `finalize`, `close_milestone` | anyone, when their time comes |
| | `claim` | anyone the ledger owes; the only method that sends value |

Every account the contract records is a transaction signer. The deployer has no powers: the
`owner` field is recorded and shown by `get_config`, and no code reads it.

### Where judgment happens

Only `request_assessment` and `decide_appeal` run nondeterministic code, and only inside
`gl.vm.run_nondet`. Before it, deterministic code checks everything that can be checked
(roles, states, deadlines, caps, evidence coverage) and gathers the round's inputs from storage:
the terms, the image bytes, the texts. Inside it, each node looks at the images two per prompt,
judges every criterion, and the validator decides whether it reproduces the leader's decision
and grounds. After it, deterministic code derives the decision, writes the round record and
moves the milestone. The nondeterministic block reads only what was gathered and writes
nothing. [consensus](consensus.md) has the rule in full.

### Money

GEN is held by the contract. A milestone reserves its payment from the project's free escrow
when it is proposed; `finalize` moves an accepted milestone's reservation to the contractor's
ledger row; `close_milestone` returns an unaccepted one to the client's free escrow;
`withdraw_escrow` credits free escrow to the client. Value leaves only through `claim`, which
zeroes the row before the transfer and is never gated on a clock. [security](security.md) lists
the invariants and the tests that hold them.

## The app

| module | job |
|---|---|
| `lib/network.ts`, `lib/chain.ts` | one network definition shared by the wallet, genlayer-js and the Transaction Kit |
| `lib/wallet.tsx` | EIP-6963 discovery, connection and the network switch; the chosen wallet's provider is what signs |
| `lib/kit.ts` | the Transaction Kit bound to that provider; `claim` priced by simulation so its transfer carries the measured message allocations |
| `lib/read.ts`, `lib/useChain.ts` | typed views, budgeted to the network's 30 calls a minute, with retries and caches for what cannot change |
| `lib/acts.ts` | what each person can do next, as a pure function of the record, the address and the clock |
| `lib/present.ts` | the one place machine values become words: labels, amounts, dates, sheet numbers |
| `lib/images.ts` | photographs and video frames redrawn in the browser as JFIF JPEGs under 400 KB |
| `lib/receipt.ts` | a transaction's receipt decoded: the contract's refusal sentence, the panel that decided a round |
| `lib/txlog.ts` | which transaction decided which round: remembered by the browser that sent it, or read from the published proof log |

### Pages

Every page is a sheet of a drawing set, numbered in its title block.

| sheet | page |
|---|---|
| S-00 | cover: what STRUCTURA is and the deployment it reads |
| S-01 | the project register: every project, and yours |
| S-02 | a new project: parties, escrow, appeal window |
| P-001 | a project: parties, escrow, milestones, history, and the client's and contractor's acts |
| M-001 | a milestone: the terms and their versions, the evidence, the standing decision, every act available to the viewer and why any other is not |
| M-001/1 | a round's payment certificate: the evidence snapshot with digests recomputed in the browser, the criteria, the decision, and the panel from the transaction receipt |
| S-03 | how it works, and what it cannot know |
| S-04 | verification: the deployment, how to check its bytes, the live proofs |

### Reads and writes

Reads go straight from the browser to Studio Next. The network allows 30 `gen_call`s a minute
per IP and a wallet's fee estimates spend from the same bucket, so reads run under a rolling
budget of 22 with at most 4 in flight, retry transient failures, and cache images and
finished rounds for good.

Writes go through the Transaction Kit's headless flow: price, review, sign in the wallet,
track. The app says "confirmed" only when the transaction is FINALIZED with a successful
execution; an accepted write is shown as accepted, because the network can still walk it back.
A refused write shows the contract's own sentence, decoded from the leader's receipt.

An act the contract would refuse is never a button that fails. `lib/acts.ts` mirrors every
precondition the contract checks, closes acts that must land before a boundary a minute early,
and lists each unavailable act with its reason. Its tests walk both sides of every clock
boundary; its mutation sweep breaks each rule and requires a test to fail.

## Tooling

| command | does |
|---|---|
| `node scripts/deploy.mjs <label>` | deploys the contract and records the address with the source digest |
| `node scripts/deploy.mjs verify 0x…` | fetches the deployed source and diffs it byte for byte with the repository |
| `node scripts/live.mjs …` | one signed action at a time, by role, for manual operation |
| `node scripts/proofs.mjs 0x…` | the live proofs: every claim an assertion, resumable, every hash kept |
| `python -m pytest tests/direct -q` | the contract suite, stub harness and official SDK runner |
| `python tests/mutation/mutate.py` | the contract's mutation sweep |
| `pnpm test`, `pnpm mutate` (in `web/`) | the app's unit tests and its mutation sweep |

CI runs the linter, the contract suite, and the app's lint, types, tests, build and address
check on every push. The live proofs take real appeal windows on a shared network and run by
hand; [e2e-verification](e2e-verification.md) records the run for the deployment of record.

## Platform facts that shaped it

| fact (measured) | consequence |
|---|---|
| the model gateway reads only PNG and JFIF JPEG, and the runtime cannot decode JPEG | the browser redraws every image; the contract checks the first bytes when it is filed |
| a public image host throttled validators after one round | image bytes are stored by the contract; nothing is fetched |
| at most two images per prompt | a round looks at images in pairs, retrying singly, before one text judgment |
| validators span model families, and some cannot see images | every node reports whether it received the images; a blind node loses its vote instead of deciding |
| a payable write that raises keeps its value | a refused payable credits the value back and returns the reason |
| a transfer needs the message allocations the fee simulation measured | `claim` is priced by simulation, in the scripts and in the app |
| the fee simulator's clock is far behind | `claim` never depends on the time |
| a round can hang after a rotation fails, blocking the contract's queue | proofs resume from their saved state; a blocked deployment is replaced |

[PROBE-REPORT](PROBE-REPORT.md) has the measurements and their transactions.
