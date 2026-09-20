# Evidence model

What a party can file, what the contract checks when it arrives, what it records, and what
it deliberately does not claim to know.

## Kinds

| kind | what it is | stored on chain | limit | checked when filed |
|---|---|---|---|---|
| IMAGE, origin PHOTO | a site photograph | the image bytes | 400,000 bytes | PNG signature, or JPEG beginning `FF D8 FF E0` |
| IMAGE, origin VIDEO_FRAME | a frame taken from a video, naming the video and the time | the frame's bytes | 400,000 bytes | same |
| IMAGE, origin SCAN | a scanned page: a report, a delivery note, a drawing | the page's bytes | 400,000 bytes | same |
| DOCUMENT | a document's text, with an optional reference such as a report or drawing number | the text | 6,000 characters | not empty |
| DECLARATION | a party's own statement for the record, shown to everyone and read by no round | the text | 2,000 characters | not empty |

The contract stores images itself. [PROBE-REPORT](PROBE-REPORT.md) sections 2 to 5 show why:
GenVM's model gateway accepts only PNG and JFIF JPEG, the runtime cannot decode JPEG to
convert anything, and a public image host throttled validators with HTTP 429 after one round.
Bytes held by the contract are the same bytes for every validator, in every round, forever,
and nothing has to be fetched.

The app prepares images in the browser before submission: it reads the capture date and
position from the photo's EXIF data (as the submitter's claim), then redraws the image at no
more than 1,024 pixels and re-encodes it as a JFIF JPEG, which removes the EXIF block. A video
is represented by frames the submitter picks; a PDF by its extracted text or by page scans.
The runtime cannot watch video and STRUCTURA does not pretend it can.

## What every item records

| field | source | meaning |
|---|---|---|
| `item_id` | contract | `ev-000042`, sequential |
| `milestone_id`, `project_id`, `version` | contract | the exact terms the item was filed against |
| `submitter`, `role` | contract | the transaction signer and their role in the project |
| `submitted_at` | contract | the transaction's own datetime |
| `sha256`, `bytes` | contract | computed over the stored bytes or the UTF-8 text |
| `format` | contract | PNG or JPEG, from the file signature |
| `requirement_id` | submitter | which evidence requirement the item is offered for (checked for kind and party) |
| `caption`, `origin_ref`, `reference` | submitter | descriptions, shown to the panel as the submitter's words |
| `claimed_capture`, `claimed_location` | submitter | the photo's own metadata as the submitter reports it |

Items never change. A correction is a new item.

## What the contract checks, and what it cannot

Checked in code, at filing:

- the signer is the client, the contractor or the inspector who accepted the role;
- the milestone is in a state where a round will read the item (see
  [state-machine](state-machine.md));
- the party has room left in its own quota for this version of the terms (contractor 12
  images and 6 texts, client 3 and 3, inspector 3 and 3), so no party can use up another's;
- during an appeal, the contractor adds at most 2 images and 2 documents (declarations do not
  count: no round reads them);
- an item offered for a requirement matches it: images for an image requirement, documents or
  scanned pages for a document requirement, from the party the requirement names;
- the terms never ask for evidence from an inspector the project did not name: nobody could
  file it, so the milestone could never be assessed and its payment could never be released;
- the image's format and size, and the text's length.

Checked by the panel, every round:

- what each image actually shows, criterion by criterion;
- whether an image shows what it is offered as (a mismatch counts against the case it was
  offered for);
- whether images appear to come from different sites, or an inspector's report contradicts
  the images. A caption or a document the client or the contractor wrote is that party's own
  account: it can neither establish a criterion nor create a conflict by itself.

Not knowable by anyone reading the record, and never claimed:

- where or when a photograph was taken. Capture dates and positions are metadata the
  submitter controls; they are recorded and shown as claims;
- that the work is structurally sound. STRUCTURA settles a contract on evidence; it does not
  replace a licensed inspection. A client who needs that assurance names an inspector and
  requires their report in the terms.

## How evidence reaches a round

- **An assessment** reads the contractor's named items (at most 4 images and 4 documents) and
  every image and document the client and the inspector filed for the version, automatically.
  The contractor cannot leave the other side's evidence out.
- **An appeal** reads the evidence recorded for the decision it reviews plus every image and
  document filed since that decision, from every party. The round record marks each item as
  reconsidered or new.
- **No round reads a declaration.** A declaration is a party's statement for the record:
  stored, hashed and shown to everyone. By the contract's own rule a party's word can neither
  establish nor contest a criterion, so it is kept out of the panel's reach by construction
  rather than by instruction; argument belongs in an appeal's reason, which the panel reads as
  argument. `request_assessment` refuses to name one.
- The most one round can read is 12 images and 12 texts: 4 named contractor items, 2 contractor
  appeal additions, and the client's and inspector's full quotas. Images go to the model two per
  prompt, the runtime's limit.

A declaration counts against the same text quota as a document, because the contract stores
and hashes it exactly like one. It is the only quota a party can spend on something no round
will read.

## The snapshot in each round record

Every round stores, before any validator runs, the list of items it reads: id, kind, origin,
role, requirement, sha256, size, caption and whether the item is new in an appeal. The digests
are the contract's own, computed when the items were filed, so the record proves which bytes
each round judged. Any reader can fetch an item and recompute its digest.
