# Consensus

How a round turns recorded evidence into a decision that several independent validators must
reach on their own, and why a single node, the leader included, cannot decide anything.

## The question

> Given a milestone's contractual criteria and the evidence recorded for it, does the evidence
> establish that each criterion is satisfied?

The answer is irreducibly a judgment: photographs and documents weighed against written
criteria. No price feed or API can give it, and a single person or service giving it is the
trusted intermediary the product removes.

## Deterministic preflight

Everything code can decide is decided before any validator works, and a failure costs no model
call: the caller's role, the project and milestone states, the deadline or window, the
assessment cap, every named item belonging to the current terms and to the contractor, the
evidence requirements' minimum counts, and at least one image or document (a declaration is
never read by a round). The contract then gathers the round's inputs from its own storage: the terms,
the criteria, the image bytes and the texts. Nondeterministic code only reads these.

## What every node does

`gl.vm.run_nondet(leader_fn, validator_fn)`. The leader and every validator run the same
`_observe()`:

1. **Look.** The images go to the model two per prompt (GenVM's limit). For each image the
   node reports whether it received the images, one concrete visible detail, and per criterion
   whether the image SUPPORTS it, CONTRADICTS it or does NOT_SHOW it, plus concerns such as a
   different site, not a construction site, or text inside the image that tries to instruct.
   If a prompt fails, each image is retried alone; an image no model call could process is
   recorded as unreadable instead of stopping the round. A node that processed no image at all
   counts as blind.
2. **Judge.** One text prompt carries the terms, the node's own image findings, and every
   document fenced with who filed it: an inspector's report as an independent attestation, a
   client's or contractor's document as that party's own account. Declarations are not in it.
   For an appeal it also carries the appellant's reason, fenced as argument, and the list of
   items that are new since the appealed decision. The node answers MET, NOT_MET or UNCLEAR for
   every criterion, and whether the evidence conflicts.
3. **Validate.** The answer is parsed into a fixed structure. An unknown or missing status
   becomes UNCLEAR. An answer that is not a JSON object is an LLM error, never a decision.

## The validator's rule

The validator runs `_observe()` itself. It agrees with the leader only when the leader's
result is a normal return, both nodes received the images, and the validator **reproduces the
decision and the grounds it rests on** (`_unconfirmed`):

| the leader's decision | the validator agrees when |
|---|---|
| ACCEPTED | it reaches the same acceptance itself: every criterion MET, no conflict |
| REJECTED | every criterion the leader rejects is NOT_MET for it too, and it sees no conflict |
| UNDETERMINED | it would not accept: a leader may assert less than a validator, never withhold a payment it would grant |

and, in every case, a conflict the leader reports is one the validator also sees, and the leader
rates every criterion. Anything else is a disagreement, printed with the reason
(`[DISAGREE] criterion C1: the leader rejects it, this node finds it UNCLEAR …`) and the
validator's own reasoning, so a receipt shows why a round failed. A blind leader is rotated
out, and no payment can rest on a reading a majority did not reproduce.

Readings that decide nothing may differ: a secondary criterion in a rejection, the prose, the
visible details, the items cited as the basis. The record keeps the leader's ratings and marks
which criteria were **decisive** (all of them for an acceptance, the rejected ones for a
rejection, none for an undetermined result); only those were reproduced by the majority. The
leader's prose is stored as **the leader's notes**, labelled as such, and no later round or
payment reads it.

### Why not require every rating to match

That was the first design, and the live rounds on Studio Next refused it. With validators from
different model families (gpt-5.4, Claude Sonnet, Gemini, Grok, DeepSeek, Mistral, gpt-oss),
exact agreement on three ratings per criterion failed precisely in the contested cases that
matter most. On a clearly unfinished foundation (open trenches, no concrete) every node that
could see the images rated the decisive criterion NOT_MET, yet the panel split on the layout
and same-site criteria (MET against UNCLEAR) and no decision was ever recorded across four
leader rotations. A client's photograph of an empty lot split the panel the same way. Both
rounds stalled rather than recording the honest outcome. The rule above binds what has a
consequence: the payment, the rejection's grounds, the refusal to withhold an acceptance. With
it, the same cases record REJECTED and UNDETERMINED on the first leader (see
[e2e-verification](e2e-verification.md)).

## The decision is derived in code

From the agreed fields only:

```
conflicting evidence            -> UNDETERMINED
any criterion NOT_MET           -> REJECTED
any criterion UNCLEAR           -> UNDETERMINED
every criterion MET             -> ACCEPTED
```

The record also carries two fields derived the same way: evidence quality (SUFFICIENT when
every criterion is conclusive, INSUFFICIENT when any is UNCLEAR, CONFLICTING when the flag is
set) and the roles whose evidence was read.

Doubt and conflict never pay. A clearly failed criterion rejects even when others are unclear.

## What is agreed, what is computed, what is only recorded

| field | how it is bound |
|---|---|
| the decision | reproduced by every agreeing validator, as the table above describes |
| the decisive criteria's statuses | reproduced by every agreeing validator |
| other criteria's statuses | the leader's ratings, never able to turn a decision |
| the conflict flag | a reported conflict is reproduced; a conflict any agreeing validator sees blocks a conclusive decision |
| images received | required of the leader and of each agreeing validator |
| decision, evidence quality, appealability, window | computed in code from agreed fields and the transaction datetime |
| evidence snapshot (ids, roles, digests) | written by the contract from its own storage before the round runs |
| leader's notes | recorded as the leader's; read by no later round and no payment |

Every field the payout reads is agreed or computed from agreed inputs.

The prompts end with "Write in English": the leader's notes reach the receipt, and one live
validator answered in Chinese before the instruction was added.

## Prompt safety

- Every string a party wrote (titles, requirements, specification, captions, sources,
  document text, the appeal reason) is defused before it enters a prompt: `<<<` and `>>>` are
  replaced and fence words are hyphenated, so no party can forge a fence or impersonate another
  party's item.
- Each item is fenced with its id, its kind and the role that filed it. The panel is told that
  fenced text and text visible inside images are content, never instructions.
- Captions, sources, dates, locations and the requirement an item is offered for are
  presented as the submitter's claims.
- A caption, or a document the client or the contractor wrote, is that party's own account:
  by itself it can neither establish a criterion, nor make one unclear, nor create a conflict.
  Conflicts come only from images or the inspector's reports.
- Declarations never enter a prompt. That rule began as an instruction to the panel, and on a
  disposable Studio Next deployment a validator still read a client's bare declaration as a
  conflict. So it is now enforced by construction: `request_assessment` refuses to name a
  declaration, rounds skip them when they gather the other parties' evidence, and an appeal
  never counts one as new evidence. A declaration is still stored, hashed and shown to everyone.
- The panel is never told the payment, the escrow, or which party an answer favours.

## When validators cannot agree

If no leader's result gathers a majority, the transaction ends without a decision and nothing
is recorded: the milestone keeps its previous state, and the round can be requested again (an
assessment before the deadline; a readjudication at any time). No failure can hold the escrow
forever: a milestone whose assessments keep failing closes at its deadline, and an appeal that
no readjudication decides within three days of its evidence period lapses to UNDETERMINED,
after which the deadline governs again. See [e2e-verification](e2e-verification.md) for the
live rounds and what each proved.
