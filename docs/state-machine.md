# State machine

Every state below is stored in the contract; the app only reads it. For each state the
tables name who can move it, what moves it, and what happens if nobody acts, because a state
whose only exit is an actor who may never act is a dead end.

## Project

```
            create_project (client, payable)
                    │
                    ▼
               ┌──────────┐   cancel_project (client): all escrow credited back,
               │ PROPOSED │──────────────────────────────────────────► CANCELLED
               └──────────┘   every open milestone closed
                    │ accept_project (the named contractor): signs the
                    │ project and every milestone version proposed so far
                    ▼
               ┌──────────┐
               │  ACTIVE  │   milestones run; the client funds, adds milestones,
               └──────────┘   and withdraws escrow no milestone has reserved
```

| state | who moves it | if nobody acts |
|---|---|---|
| PROPOSED | the contractor accepts; the client cancels | nothing is at stake that the client cannot take back by cancelling |
| ACTIVE | milestones settle one by one | each milestone closes after its deadline, returning its reservation |
| CANCELLED | terminal | escrow is already credited to the client |

## Milestone

```
AWAITING_TERMS ──accept_project / accept_version (contractor)──► AWAITING_EVIDENCE
      │                                                               │
      │                          request_assessment (contractor, before the deadline)
      │                                                               ▼
      │              ┌──────────────────────── assessment round ───────────────────────┐
      │              ▼                                ▼                                 ▼
      │          ACCEPTED                         REJECTED                        UNDETERMINED
      │     window: client may            window: contractor may             contractor adds evidence
      │     open_appeal                   open_appeal, or adds               and requests another
      │              │                    evidence and requests              assessment before
      │              │                    another assessment                 the deadline
      │              │                                │
      │              └──────────► APPEALED ◄──────────┘
      │                     evidence period: every party may file;
      │                     then decide_appeal (anyone): final outcome
      │                     ACCEPTED (pays at once), REJECTED or UNDETERMINED;
      │                     undecided three days after the evidence period,
      │                     lapse_appeal (anyone) ──► UNDETERMINED
      │
      │   finalize (anyone): ACCEPTED, window passed unappealed or upheld on appeal
      │              ▼
      │          FINALIZED ── payment credited to the contractor ── claim
      │
      └── close_milestone (anyone): the deadline and any open window have passed,
          no acceptance stands, no appeal is open ──► CLOSED, reservation back to the client
```

| state | who moves it | what moves it | if nobody acts |
|---|---|---|---|
| AWAITING_TERMS | contractor | signs the pending version | anyone closes it after the deadline |
| AWAITING_EVIDENCE | contractor | requests an assessment before the deadline | anyone closes it after the deadline |
| ACCEPTED | client, or anyone | the client appeals inside the window; anyone finalizes after it | finalize is always available once the window passes |
| REJECTED | contractor, or anyone | the contractor appeals inside the window or requests a new assessment before the deadline | anyone closes it after the deadline and the window |
| UNDETERMINED | contractor, or anyone | a new assessment before the deadline | anyone closes it after the deadline |
| APPEALED | anyone | decide_appeal once the evidence period ends | anyone can trigger the readjudication, and a round that fails leaves the appeal open for the next attempt; three days after the evidence period anyone can lapse it to UNDETERMINED, because a decision whose appeal was never decided is not confirmed, and the deadline then governs |
| FINALIZED | terminal | payment is credited; the contractor claims it | the credit waits in the ledger |
| CLOSED | terminal | the reservation is back in the client's unreserved escrow | the client withdraws it when they choose |

## Rules the state machine enforces

- **One decision stands at a time.** A new assessment replaces the standing decision; a
  standing decision's appeal is lost when the contractor signs new terms.
- **An appeal freezes the milestone.** While APPEALED: no new terms, no assessment, no
  finalize, no close. The appeal is decided against the state it was filed against.
- **Appeal outcomes are final.** They are not appealable, and an acceptance an appeal upholds
  pays at once.
- **Evidence is accepted only where a round will read it**: before the deadline in
  AWAITING_EVIDENCE, REJECTED and UNDETERMINED, and during an appeal's evidence period. Never
  against a standing acceptance. Declarations follow the same windows, and no round reads
  them.
- **Windows are wall-clock**, measured from the transaction datetime every validator reads.
  The appeal window is chosen per project (10 minutes to 7 days); an appeal's evidence period
  is as long as the window.
- **Caps.** Five assessments per version of the terms; each conclusive one may be appealed
  once. Six versions per milestone, twelve milestones per project.
- **Terminal states never change.** FINALIZED and CLOSED records are not rewritten by any
  later action, including cancelling the project.
