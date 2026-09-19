# Probe report: what Studio Next can actually judge (19 Sep 2026)

Before any STRUCTURA design was fixed, disposable probe contracts asked GenLayer
Studio Next the questions the whole product depends on. Every finding below has a
finalized transaction behind it; explorer: `https://explorer-studio-dev.genlayer.com/tx/<hash>`.
The probe source is [`probes/structura_probe.py`](../probes/structura_probe.py), driven by
[`probes/run-probe.mjs`](../probes/run-probe.mjs). Total cost of every probe: 0.0025 test GEN.

## 1. The runner still deploys

The runner pinned by the GenLayer boilerplate (`9b8kjyda…`) is rejected by Studio Next;
`5jycge4q…` (the one our previous build proved) deployed on every attempt, e.g. deploy
`0x658cadd3902dd4fbf801a8148fb89959771e6894bcf7407be97b157f8ca4db60`.

## 2. GenVM's rules for images, from its own source

`gl.nondet.exec_prompt(prompt, images=[...])` is the keyword on this runner. The limits
live in GenVM's LLM module (`modules/implementation/src/llm/handler.rs`, `prompt.rs`):

| rule | what happens otherwise |
|---|---|
| at most **2 images** per prompt | `TOO_MANY_IMAGES` |
| each image at most **5 MB** | `IMAGE_TOO_LARGE` |
| **PNG**, or **JPEG whose bytes begin `FF D8 FF E0`** (JFIF) | `INVALID_IMAGE` |

The third rule is stricter than "JPEG": camera photos usually begin `FF D8 FF E1` (EXIF)
and Wikimedia's thumbnails begin `FF D8 FF DB`. Both are rejected. Measured live: the
first probe round failed `NondetException: INVALID_IMAGE` in every leader and ended
UNDETERMINED after three rotations (`0x268f522c970a37e6d53a488e615a00275ea219d6751e302147216dccf589586d`).

## 3. The contract cannot convert images itself

The runner ships PIL, but without a JPEG decoder: `OSError: decoder jpeg not available`
on every node (`0x194cb0a37517564cc151670fd25a348b52a49bafa4d9bc88a4bd1b7fcb7f4a5b`).
Conversion therefore happens in the submitter's browser (a canvas re-encode produces a
JFIF JPEG), and the contract checks the first bytes deterministically at submission.

`gl.nondet.web.render(url, mode="screenshot")` does work as a fallback: it returns a PNG
the model accepts, and three validators classified a photo correctly from it
(`0x17cb3fe34cd7570d39e0aa8d1234529a342a2f115dd407147f3c2aa56ce99e35`).

## 4. Third-party image hosts throttle validators

After that first successful round, Wikimedia answered **HTTP 429** (a 1,965-byte error
page) to every validator on every photo. Consensus behaved correctly, since each node agreed
the evidence was unavailable and nothing was judged on a failed fetch, but the host is
unusable for evidence (`0x5c078ee543dc57d7398b533f3e518e995911c26f67dddb7eab8f4753645ab0a4`,
`0xc67d28530c005981110a4b842d184fb13a6423581a722a48d45f366938aa4682`,
`0x6fcc5c6e68b1ffb24e0020a7e5fd532e8446d4ef3151e96dc5bb4b50fc39de4a`,
`0xf4febb2d9fcf53e5eecdc71f5a6ed21ca035a235abc35eee31f5c502fcb86a5e`).

## 5. What works: evidence bytes held by the contract

A write storing the photo bytes in contract state, with the digest computed by the
contract itself, took one transaction per photo:

| stored | tx | time |
|---|---|---|
| 155,089 bytes (800 px JFIF) | `0x6fa93fc3f0b9194883e1e11b701f4829b9953da346141f13ec1ce8a8e08a70f8` | 35 s |
| 285,526 bytes (1,024 px JFIF) | `0xb0571f1ab7eecb33c5e02c4d0c6ee190d4c4aa2b318684458421f0620adef5f6` | 35 s |

About 0.00008 test GEN each. Every validator then reads the same bytes from state: no host
to throttle, nothing to drift, and the recorded evidence is agreed by construction.

## 6. Validators agree on what construction photos show

Photos: a real house build documented day by day in Feb 2011 by Khaosaming on Wikimedia
Commons (CC BY-SA 3.0), plus a cat as a control. Each round judged the stored bytes;
validators compared the stage.

| photo | expected | consensus | tx |
|---|---|---|---|
| poured concrete footing | concrete poured | concrete poured (4 of 5) | `0xb4b28fbce59c3990baaae477314e9f8f4ee6bc16eef7750fca2b3e232321729c` |
| trenches between standing columns | excavation only | excavation only (4 of 5) | `0xad6ef43cae44b64ca1167c80fe7b62db0d7d4b7360d2dacbca23975c4d0a52f8` |
| rebar cage at a column base | rebar or formwork | rebar or formwork (all) | `0x11890f7c2414f6308cbeb82c43419326ee293f9e7a8494434989a118d0c71d6f` |
| finished ground-beam grid | concrete poured | concrete poured (all) | `0xd8ee7f93be4b16661abf86227c7a061f4cf56c2dc47d2eb0d510a83d18e41e0d` |
| cat (control) | no construction | no construction (all) | `0x6b5cc81f0fb36a14d78a5a44c158b67589f864d16cf139bf1f2e091f4113d228` |

All five finalized `MAJORITY_AGREE` with no leader rotation, 45 to 60 seconds each.

## 7. Criterion-level judgment of two photos plus a specification

Three criteria (C1 footings and ground beams cast in concrete; C2 consistent with the
specification's layout; C3 photos show the same site), judged together; validators
compared every criterion's status.

| photos | C1 | C2 | C3 | agreement | tx |
|---|---|---|---|---|---|
| poured footing + finished grid | MET | MET | MET | every voting validator | `0x3f1d42279e62a7c2f35fd8404eedb7dbd20d73e22b7da54595c48b7e339c53f7` |
| trenches + rebar cage | NOT_MET | MET | MET | 4 of 6 (Grok and DeepSeek read C1 as MET) | `0xb4a8bb4ecc76cf493df7a8d42eb7e6a4a21d7bbf61790747ab3992cea94d7426` |

## 8. Not every validator sees images

Validator routes seen: gpt-5.4, claude-sonnet-4.6, gemini-3-flash, gemini, grok, mistral,
gpt-oss, deepseek. Two failure shapes, both absorbed by the majority:
- a route that reported "No image data was provided" (honest, answered UNCLEAR);
- the DeepSeek-routed validator once described a different photo than the one stored, and
  invented a "visible detail" in the criteria round while agreeing on every status.

## Design consequences for STRUCTURA

1. Photos are stored **on chain**, normalized to JFIF JPEG in the browser (at most 1,024 px),
   size-capped, with the first bytes checked by the contract when submitted.
2. A round sends photos **two per prompt**, then judges criteria in a final text prompt.
3. Validators compare **every criterion's status** (not only the headline decision), so a
   wrong reading needs a wrong majority to pass. *Superseded during the build:* exact
   agreement on every rating stalled the contested cases on the live panel, so validators now
   reproduce the decision and the grounds it rests on. See
   [consensus, "Why not require every rating to match"](consensus.md#why-not-require-every-rating-to-match).
4. Every node reports whether it received the images; a blind leader is disagreed with and
   rotated out.
5. The leader's prose (reasoning, visible details) is recorded as the leader's notes, never
   presented as consensus.
6. A decision that pays is followed by the counterparty's contest window, and a milestone
   can require an attestation from a named inspector.
