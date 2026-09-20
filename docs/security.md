# Security

The trust model, the threats STRUCTURA was designed against, and the limits it states rather
than hides. Every claim here names the code that enforces it; the tests named in brackets fail
if the code stops doing so.

## Trust model

| party | trusted for | not trusted for |
|---|---|---|
| client | defining the terms they fund | the outcome: they cannot decide, and their filings are evidence the panel weighs |
| contractor | performing the work | the outcome: they choose which of their own items to present, never whether the client's are read |
| inspector | the attestation the terms ask of them | anything else: they file evidence and nothing more |
| validators | independently judging the recorded evidence | acting alone: a result counts only when a majority reproduces the decision and the grounds it rests on |
| the app | presenting the chain's state | anything authoritative: every rule is in the contract |
| anyone | liveness: finalize, close, readjudicate, lapse | powers over outcomes: none of these writes can change what the evidence decides |

There is no operator, no owner power over projects, no backend and no stored secret.

## Threats and what stops them

**A party acts in another's name.** Every recorded account is the transaction signer. The
client names the contractor and the inspector, who act only after signing their acceptance.
[test_projects, test_evidence: only the three parties file]

**The leader fabricates a decision.** Every validator judges the same stored bytes itself and
agrees only when it reproduces the leader's decision and the grounds it rests on: an acceptance
needs the validator's own acceptance, a rejection needs every criterion the leader rejects
found not met, and no leader can withhold an acceptance a validator would grant or report a
conflict the validator does not see. A forged result, a malformed one, one that does not rate
every criterion, or one from a node that could not see the images is refused.
[test_assessment: test_a_forged_leader_result_is_refused,
test_an_acceptance_needs_every_criterion_reproduced…, test_a_conflict_a_validator_sees_stops…;
test_sdk_runner.py on the official runner]

**Evidence is swapped after judgment.** Items are immutable; their digests are computed by the
contract over the stored bytes; each round records the digests it read. An appeal re-reads the
same stored bytes. [test_evidence: test_filed_evidence_never_changes; invariant walk]

**Prompt injection.** Party text is defused so fences cannot be forged; items are fenced with
their filer's role; text inside images is declared scene content. A party's own document or
caption can neither establish a criterion nor create a conflict, and declarations never reach
a prompt at all. The panel never learns the payment or who benefits. [test_assessment:
test_party_text_cannot_forge_a_fence, test_the_panel_is_never_told_the_payment…,
test_declarations_are_recorded_but_no_round_reads_them, test_an_appeal_never_reads_a_declaration]
Model behaviour against injected
instructions is measured live, not assumed: see [e2e-verification](e2e-verification.md).

**A counterparty's objection is ignored.** An assessment always reads every item the client
and the inspector filed; the contractor cannot name them or leave them out. Nobody can file
against a standing acceptance without opening an appeal, and an appeal reads everything filed
since the decision, so no objection sits unread while money can move. [test_assessment:
test_counterparty_evidence_is_always_read; test_evidence:
test_nobody_files_against_a_standing_acceptance]

**One side uses up the other's room.** Every party has its own evidence quota per version of
the terms; the round capacity is the sum of the quotas, so the fullest appeal still fits one
round. Naming an address in any number of projects costs that address nothing: indexes are
paged, with no per-address cap. [test_evidence: test_each_party_has_its_own_quota…;
test_appeal: test_the_fullest_appeal_fits_one_round;
test_projects: test_being_named_in_many_projects…]

**Escrow is over-committed.** A milestone reserves its payment when proposed, and a new version
adjusts the reservation when signed, each against escrow no other milestone holds; the client
withdraws only unreserved escrow. [test_terms; invariant walk: reserved never exceeds escrow]

**Money is paid twice, or on doubt.** Only `finalize` credits the contractor, only from a
standing acceptance, only after its window or an appeal that upheld it, and it moves the
milestone to a terminal state. UNCLEAR and conflicting evidence derive UNDETERMINED, which
never pays. [test_settlement; invariant walk: paid equals the sum of finalized payments]

**Value is stranded.** On this platform a payable write that raises keeps the value while
reverting the state that would have recorded it, so every refusal of a payable call returns
normally and credits the value back. Value leaves only through `claim`, which zeroes the
balance before its single transfer and never waits on a clock (the fee simulator's clock is
stale, and a transfer behind a clock gate could not be priced). [test_projects:
test_a_refused_creation…; invariant walk: every payable call returns]

**A milestone is made impossible to satisfy.** Terms that ask for evidence from an inspector
the project never named are refused when they are proposed, because no address could file
that evidence and the escrow would sit reserved until the deadline. [test_terms:
test_terms_cannot_require_an_inspector_the_project_never_named]

**A renegotiation is killed, or a stale one is forced through.** A version is signed only
while its own deadline stands, and a milestone with a signable version cannot be closed by
anyone until that deadline passes. [test_terms:
test_a_version_whose_deadline_has_passed_is_never_signed_into_force; test_settlement:
test_close_waits_for_terms_the_contractor_can_still_sign]

**A reader crashes a view.** Every view answers or refuses in words, including one handed an
address it cannot read. [test_projects: test_views_refuse_an_address_they_cannot_read]

**A validator's own model fails.** It disagrees, printing why, instead of raising out of the
vote: a node that cannot judge can never confirm a leader. [test_assessment:
test_a_validator_that_cannot_judge_disagrees_in_words]

**A process never ends.** Every non-terminal state has an exit anyone can take: milestones close
after their deadline and window; an appeal can be readjudicated by anyone once its evidence
period ends, and one that no readjudication decides within three days lapses to UNDETERMINED
(the appealed decision is not confirmed, so nothing pays on it). See
[state-machine](state-machine.md).

## Review standards

Systems of this kind, an AI verdict that moves money on evidence a party supplies, draw the
same findings from reviewers. Each one below is a decision made at design time, not a later
patch, and each names the code that carries it.

| what reviewers look for | where this build answers it |
|---|---|
| Consensus binds every field the money depends on, not only the headline outcome | `_derive` computes the decision in code from the per-criterion ratings; `_unconfirmed` lets a leader's result stand only when this node reproduces that decision and the criteria it rests on; `_decisive` records which those were |
| Evidence is corroborated where it enters the record, not only where a later round re-reads it | no excerpt is ever chosen by a leader: the contract stores and hashes the bytes at `submit_image` and `submit_document`, and every node runs `_observe` over those same stored bytes |
| An appeal judges the state that was appealed | `decide_appeal` re-judges the version the appealed round judged, with that round's recorded items plus what was filed since, and tells the panel which items are new |
| A ruling's fields are validated before they can touch state | `_decide` keeps only recognised statuses, reads anything else as UNCLEAR, and bounds every string it stores |
| Party-declared labels are disclosed as claims and guardrailed | `_judge` fences every item with its filer's role and tells the panel that a caption or a party's own document can neither establish a criterion, nor make one unclear, nor create a conflict, whichever party wrote it |
| An obligation is reserved when it is accepted, not when it is paid | `add_milestone` reserves the payment from unreserved escrow, and `accept_version` adjusts the reservation when new terms are signed |
| Every hold has an exit somebody can actually reach | `close_milestone`, `decide_appeal` and `lapse_appeal` are permissionless |
| A recorded account is the transaction's signer | the contractor and the inspector are named as data and become parties only by their own signature |
| Views do not scan without bound | counters and paged indexes, a page ceiling, and per-project caps on milestones and versions |
| Conservation and post-terminal actions are tested as invariants | the randomized walk asserts that value is neither created nor destroyed, that no transfer exists without a claim, and that settled milestones, recorded rounds and filed items never change |
| Every act is reachable in the app, not only from scripts | all nineteen contract writes are reachable from a page, and availability is decided by one pure function in `web/lib/acts.ts` that is tested there |
| A clean checkout reproduces the judged deployment | one address in the app, the proof log and the documents, checked in CI by `web/scripts/check-address.mjs` |

## Stated limits

- **Photographs prove what they show, not where or when.** Capture dates and positions are
  the submitter's claims. The panel is asked to notice images of different sites, but a
  contractor who photographs someone else's finished foundation, consistently, can mislead it.
  The defences are the client's contest window, the client's own evidence, and an inspector
  requirement in the terms.
- **Independent corroboration is the client's option, not a floor the money path enforces.**
  The terms decide whether an inspector's report is required. Where they do not require one, an
  acceptance can rest on the contractor's own photographs, and nothing in the settlement path
  demands a second, independent source. The client chooses that when writing the terms and
  funds the escrow knowing it; their remedy is the contest window. Terms that require an
  inspector are the stronger shape, and the demonstration project uses them.
- **A clearly failed criterion rejects even when another is unclear.** Doubt withholds an
  acceptance, but it does not withhold a rejection: `_derive` returns REJECTED as soon as one
  criterion is found not met, whatever the others say, and the record marks only the unmet ones
  as decisive. A rejection pays nobody and takes nothing; the escrow stays reserved and the
  contractor may file more evidence and ask again, or appeal.
- **Counter-evidence can hold a payment.** A client who files images of another place creates
  a genuine conflict, and conflicts never pay. The record shows who filed what; the remedy is
  more evidence, ideally the inspector's.
- **An inspector requirement makes the inspector's cooperation a condition of payment.** The
  contractor accepts that when signing the terms.
- **STRUCTURA is not a structural inspection.** It settles a contract on evidence. It does not
  certify that work is safe or compliant with any code.
- **Model behaviour is empirical.** Validators run different model families; some cannot see
  images. The rules above make a blind or eccentric node lose its vote rather than decide, but
  the quality of judgments is measured, not guaranteed: see
  [e2e-verification](e2e-verification.md) and [PROBE-REPORT](PROBE-REPORT.md).
- **A party could file a text crafted to make models refuse to read it.** Images are isolated
  per image; a document that breaks every judgment prompt fails the round, nothing is
  recorded, and the milestone's deadline or the appeal lapse then governs. The item stays on
  the record, attributed to whoever filed it.
- **Studio Next is a test network.** Its GEN has no value, and its platform limits (30 contract
  reads a minute per IP, the fee simulator's clock, finality times) shape the app.
