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
evidence requirements' minimum counts, and at least one image or document (a declaration alone
proves nothing). The contract then gathers the round's inputs from its own storage: the terms,
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
   document and declaration fenced with who filed it. For an appeal it also carries the
   appellant's reason, fenced as argument, and the list of items that are new since the
   appealed decision. The node answers MET, NOT_MET or UNCLEAR for every criterion, and
   whether the evidence conflicts.
3. **Validate.** The answer is parsed into a fixed structure. An unknown or missing status
   becomes UNCLEAR. An answer that is not a JSON object is an LLM error, never a decision.

## The validator's rule

The validator runs `_observe()` itself and agrees with the leader only when all of these hold:

- the leader's result is a normal return, not an error;
- the leader received the images, and so did this validator;
- **every criterion's status is identical**;
- the conflict flag is identical.

Anything else is a disagreement, printed with the reason (`[DISAGREE] criteria C2 …`) so a
receipt shows why a round failed. A blind leader is therefore rotated out, and a leader that
reports a status no majority reproduces never reaches the record.

Prose is free to differ: reasoning, visible details, per-image readings and the items cited
as the basis. The leader's prose is stored as **the leader's notes**, labelled as such, and no
later round or payment reads it.

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
| every criterion's status | agreed in equivalence |
| the conflict flag | agreed in equivalence |
| images received | required of the leader and of each agreeing validator |
| decision, evidence quality, appealability, window | computed in code from agreed fields and the transaction datetime |
| evidence snapshot (ids, roles, digests) | written by the contract from its own storage before the round runs |
| leader's notes | recorded as the leader's; read by no later round and no payment |

Every field the payout reads is agreed or computed from agreed inputs.

## Prompt safety

- Every string a party wrote (titles, requirements, specification, captions, sources,
  document text, declarations, the appeal reason) is defused before it enters a prompt: `<<<`
  and `>>>` are replaced and fence words are hyphenated, so no party can forge a fence or
  impersonate another party's item.
- Each item is fenced with its id, its kind and the role that filed it. The panel is told that
  fenced text and text visible inside images are content, never instructions.
- Captions, sources, dates, locations and the requirement an item is offered for are
  presented as the submitter's claims.
- A declaration by either party can neither establish a criterion nor create a conflict by
  itself.
- The panel is never told the payment, the escrow, or which party an answer favours.

## When validators cannot agree

If no leader's result gathers a majority, the transaction ends without a decision and nothing
is recorded: the milestone keeps its previous state, and the round can be requested again (an
assessment before the deadline; a readjudication at any time). A milestone whose rounds keep
failing still closes at its deadline, so no failure can hold the escrow forever. See
[e2e-verification](e2e-verification.md) for the live rounds and what each proved.
