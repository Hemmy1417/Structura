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

**A process never ends.** Every non-terminal state has an exit anyone can take: milestones close
after their deadline and window; an appeal can be readjudicated by anyone once its evidence
period ends, and one that no readjudication decides within three days lapses to UNDETERMINED
(the appealed decision is not confirmed, so nothing pays on it). See
[state-machine](state-machine.md).

## Stated limits

- **Photographs prove what they show, not where or when.** Capture dates and positions are
  the submitter's claims. The panel is asked to notice images of different sites, but a
  contractor who photographs someone else's finished foundation, consistently, can mislead it.
  The defences are the client's contest window, the client's own evidence, and an inspector
  requirement in the terms.
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
