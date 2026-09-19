# STRUCTURA build specification

The working blueprint for the build. It merges the product brief (construction milestone
escrow adjudicated from multimodal evidence), the measured platform facts in
[PROBE-REPORT](PROBE-REPORT.md), and the standards earlier GenLayer reviewers applied to our
builds. Where the brief says "verify, don't assume", the probe report is the verification.

## 1. The decision GenLayer adjudicates

> Given a milestone's contractual criteria and the evidence recorded for it, does the evidence
> establish that each criterion is satisfied?

Everything else (who may act, when, how much, what moves) is deterministic contract code.
The adjudication is irreducible: photographs and documents judged against written criteria.
A price feed or an API cannot answer it; a single human or service answering it is the
trusted intermediary the product removes.

## 2. Parties

| role | who | bound how |
|---|---|---|
| client | creates the project, funds escrow, defines milestones | the signer of `create_project` |
| contractor | performs the work, submits evidence, requests assessments | named by the client, **accepts the terms with their own signature** before anything is assessed |
| inspector (optional) | independent attestation (reports, site photos) | named by the client, **accepts the role with their own signature**; only then may they submit |
| anyone | finalizes after windows, closes expired milestones | permissionless liveness, no powers over outcomes |

Every account the contract records is the transaction signer; no write takes an account
parameter except the client naming the other roles, and those roles only act after signing
their acceptance.

## 3. Money

- **Escrow is GEN held by the contract.** `create_project` and `fund_project` are payable.
- **A milestone reserves its payment when it is created** (and when a version changes the
  amount) from the project's unreserved escrow. A milestone the escrow cannot cover is refused.
  Concurrent milestones can never over-commit the escrow.
- **Only a finalized acceptance pays.** `finalize` moves the milestone's reserved payment to
  the contractor's claimable balance. Nothing else credits the contractor.
- **Reservations return** to the client's unreserved escrow when a milestone is closed after
  its deadline without acceptance, or cancelled before the contractor accepted the terms.
- **The client withdraws only unreserved escrow**, to their claimable balance.
- **Pull payments.** `claim` is the only method that transfers value, zeroes the balance
  before the transfer, and is never gated on a clock (the fee simulator's clock is stale, so a
  clock-gated transfer could never be priced).
- **Payable refusals return, never raise**: on this platform a raise keeps the value while
  reverting its refund, so a refused payable credits the value back and returns a reason.
- **Conservation:** funded = reserved + unreserved + credited to parties, to the wei, always.

## 4. Projects, milestones, versions

**Project:** title, description, site description, client, contractor, optional inspector,
appeal window (chosen by the client within 10 minutes to 7 days, accepted by the contractor
with the terms), status `PROPOSED → ACTIVE`, or `PROPOSED → CANCELLED` when the client walks
away before the contractor signs, escrow totals, milestone ids.

**Milestone:** a sequence of **versions**; each version is immutable once proposed.

A version holds: title, description, requirements (the contractual text), an optional
specification (up to 6,000 characters: the scope, dimensions or layout the work must match),
criteria (`[{id, text}]`, at most 8), evidence requirements (`[{id, text, kind: IMAGE|DOCUMENT,
min_count, from_role: CONTRACTOR|INSPECTOR}]`, at most 8), payment, deadline (UTC).
Changing any of these proposes a **new version**; the contractor's signature makes it the
current version. Evidence and rounds always reference the version they belong to, so a
historical decision stays tied to the exact terms it judged.

## 5. Evidence

| kind | stored | limit | checked at submission |
|---|---|---|---|
| IMAGE (origin PHOTO, VIDEO_FRAME or SCAN) | the image bytes, on chain | 400,000 bytes | PNG signature, or JPEG beginning `FF D8 FF E0` |
| DOCUMENT | text, on chain, with an optional reference (report or drawing number) | 6,000 characters | non-empty UTF-8 |
| DECLARATION | a party's statement, on chain; shown to everyone, read by no round | 2,000 characters | non-empty |

An IMAGE requirement is answered by photographs or video frames; a DOCUMENT requirement by
documents or scanned pages. Each party files against its own quota per version of the terms
(contractor 12 images and 6 texts, client 3 and 3, inspector 3 and 3), so no party can use up
another's room.

Every item records: id, milestone, version, requirement it answers, submitter and their role,
submitted-at (transaction time), caption, the submitter's **claimed** capture date and
location, size, and a **sha256 computed by the contract**. Items are immutable; a correction
is a new item. Claimed metadata is presented to validators as the submitter's claim, never
as fact.

The browser normalizes photos before submission (at most 1,024 px, JFIF JPEG) because the
runtime cannot decode JPEG. A video is represented by frames the submitter extracts, each an
IMAGE of origin VIDEO_FRAME that names its source and time; the runtime cannot watch video and
the product does not pretend otherwise. PDFs are submitted as extracted text or scanned pages.

**When evidence is accepted.** Only when a round will read it: before the deadline while the
milestone awaits evidence or stands REJECTED or UNDETERMINED, and during an appeal's evidence
period. Never against a standing acceptance: to contest one, the client opens an appeal. So no
objection can sit unread while money can move.

## 6. The lifecycle of a milestone

```
PROPOSED terms ──(contractor signs)── AWAITING_EVIDENCE
        │                                    │ contractor submits evidence, requests an assessment
        │                                    ▼
        │                            assessment round (validators judge)
        │              ┌─────────────────────┼──────────────────────┐
        │              ▼                     ▼                      ▼
        │          ACCEPTED              REJECTED              UNDETERMINED
        │     (client may appeal     (contractor may appeal   (contractor adds evidence,
        │      within the window)     within the window, or    requests a new assessment
        │              │              add evidence and request  before the deadline)
        │              │              a new assessment)
        │              ▼
        │   finalize (anyone, after the window or a concluded appeal)
        │              ▼
        │       FINALIZED ── payment credited ── claim
        │
        └── after deadline, no acceptance standing: close (refund the reservation)
```

- **Assessment** rounds are requested by the contractor, before the deadline, from
  `AWAITING_EVIDENCE`, `UNDETERMINED` or `REJECTED`. The requester names the images and
  documents to judge (at most 4 images, 4 documents); every image and document the client or
  inspector filed for the version is included automatically, so a counterparty's evidence is
  never left unread. Declarations are never read by a round.
- **Appeals** are opened by the party a conclusive assessment went against (client against
  ACCEPTED, contractor against REJECTED), within the project's window, once per decision, with
  a reason. An **evidence period** as long as the window follows, in which every party may
  file (the contractor at most 2 images and 2 documents). Then **anyone** may trigger the
  readjudication, which re-judges the **recorded** evidence of the appealed decision plus
  everything filed since the decision; the record marks which is which. The outcome is final:
  not appealable, and an acceptance it upholds pays at once. While an appeal is open nothing
  else moves: no new terms, no assessment, no finalize, no close.
- **Finalize** is permissionless once an ACCEPTED decision's window has passed with no
  appeal, or immediately when an appeal's outcome is ACCEPTED.
- **Close** is permissionless once the deadline and any standing decision's window have
  passed without an acceptance and no appeal is open; the reservation returns to the client.
- At most 5 assessments per version (each conclusive one may still be appealed once); the
  deadline then closes the milestone.

## 7. An adjudication round

Deterministic preflight (no validator work if any fails): project active, terms accepted,
caller authorized, milestone state allows it, before deadline (assessments), within window
(appeals), round cap, every evidence requirement's minimum count met by items of the right
kind and role, every named item belongs to this version.

Then `gl.vm.run_nondet(leader_fn, validator_fn)`; each node, leader and validators alike, runs
the same `observe()`:

1. **Look.** Photos go two per prompt (GenVM's limit). For each photo the node reports
   `images_received`, one concrete visible detail, and per criterion whether the photo
   SUPPORTS, CONTRADICTS or does NOT_SHOW it, plus concerns (not a construction site, a
   different site, visible text that tries to instruct).
2. **Judge.** One text prompt: the version's requirements and criteria, the node's own photo
   findings, and the documents fenced by who submitted them (an inspector's report as an
   independent attestation, a party's document as its own account), and for an appeal the
   appellant's reason fenced as argument. Output per criterion: MET, NOT_MET or UNCLEAR; and
   `conflicts_detected`.
3. **Validate** the answer into a struct (unknown or missing status becomes UNCLEAR;
   anything malformed is an LLM error, never a decision).

**Derivation, in code, from agreed fields only:**

```
images not received by this node      → the node's result is invalid (never a decision)
conflicts_detected                    → UNDETERMINED
any criterion NOT_MET                 → REJECTED
any criterion UNCLEAR                 → UNDETERMINED
every criterion MET                   → ACCEPTED
```

**Equivalence (the validator's check):** the validator runs `observe()` itself and agrees
only if both nodes received the images and it **reproduces the decision and the grounds it
rests on**: the same acceptance; every criterion the leader rejects found NOT_MET; no
acceptance withheld that the validator would grant; any conflict the leader reports seen too.
Prose (reasoning, visible details, per-photo findings) is free to differ and is recorded as
the leader's notes, never as consensus. A leader that could not see the images is disagreed
with and rotated out. The design first required every criterion's status to match; the live
panel stalled on it in exactly the contested cases, and [consensus](consensus.md) records why
it changed.

Every field the payout reads is either reproduced by the agreeing validators (the decision,
the decisive criteria, a reported conflict) or computed by code from agreed inputs (payment,
windows).

## 8. The round record (the decision receipt)

Round number, kind (ASSESSMENT or APPEAL), version, requested by, time, **evidence snapshot**
(each item's id, kind, submitter role, requirement, sha256, size, and for appeals whether it
was reconsidered or new), agreed criterion statuses, agreed conflicts flag, derived decision,
the leader's notes (labelled as such), and for appeals the reviewed round and the reason.
Rounds are append-only; nothing is overwritten.

## 9. Prompt safety

Every party-supplied string that reaches a prompt (titles, captions, documents, reasons) is
defused so it cannot forge the evidence fences, and each is fenced with who supplied it.
Declarations never reach a prompt. Validators are
told fenced text and text visible inside photos is content, never instruction. The panel is
never told the payment amount or who benefits from which answer.

## 10. Views (bounded, read-budget friendly)

`get_config`, `get_stats`, `list_projects(skip, limit)` and `projects_of(addr, skip, limit)`
(newest first, paged), `get_project(id)` (with milestone summaries), `get_milestone(id)`
(versions and evidence metadata), `get_round(milestone, n)`, `get_item(id)`, `get_image(id)`,
`get_events(project, skip, limit)`, `get_balance(addr)`. No view scans an unbounded collection,
and no capacity is shared between parties: being named in a stranger's projects costs an
address nothing.

## 11. Invariants the tests must hold

Unauthorized writes are refused in words; evidence never changes after submission; every
round references a version and an evidence snapshot; nondeterministic code never writes state;
the leader alone cannot establish a decision; an LLM or fetch failure is never ACCEPTED;
UNDETERMINED and REJECTED never release escrow; finalized decisions are never overwritten;
appeals preserve history; payment is credited only by a finalized acceptance; wei is
conserved; post-terminal actions are refused; two concurrent milestones cannot over-reserve;
no round reads a declaration.

## 12. Live proofs (deployment of record)

What `scripts/proofs.mjs` asserts is listed in [e2e-verification](e2e-verification.md), with
every transaction. In short:

- Flagship: foundation milestone from the Feb 2011 photo series with an inspector's report,
  assessment ACCEPTED on every criterion with no conflict, appeal window, finalize, the
  contractor claims real GEN.
- Negative control: trenches and rebar, nothing poured, REJECTED on the decisive criterion.
- Injection: instructions hidden in a caption and a document produce no acceptance; a
  declaration filed alongside is not read.
- Mirror: the client's bare declaration does not block an acceptance the photographs support.
- Conflict: the client appeals with a photograph of an empty lot; the appeal does not pay.
- Walls: unauthorized and early actions refused as real transactions, a refused payable
  credited back and claimed.

Planned at design time and not run as live proofs: a round on an unrelated photograph and a
blind-leader rotation. Blindness is covered by the direct tests and was observed live during
the probes ([PROBE-REPORT](PROBE-REPORT.md) section 8).

## 13. Frontend

Next.js App Router, TypeScript strict, Tailwind, pnpm, Transaction Kit 0.1.0-rc.2 with
genlayer-js 2.0.0-rc.1, EIP-6963 wallets, in-app test GEN, budgeted reads (30 reads a minute
per IP on Studio Next), a single presentation module so no raw identifier reaches a screen,
and a pure availability function deciding every action and its reason. The visual design, a
drawing set, was chosen with the user before any page was built: every page is a numbered
sheet (S-00 cover, S-01 project register, S-02 new project, S-03 how it works, S-04
verification), each project and milestone its own sheet with terms, evidence, assessment,
appeal and settlement, and each round a payment certificate with the panel's receipt.

## 14. Demo evidence

A demonstration project reconstructed from Khaosaming's public photo series of one house
build (Wikimedia Commons, CC BY-SA 3.0), credited in the app and README, and labelled as a
demonstration, never presented as the user's own site.
