> **SHELVED 2026-11-18.** Not run and not frozen: nothing in the first release depends on it. Kept as a record of the design. Reason and the one small check worth keeping: see spec 5c rule 4.

# Pre-registration: blind agreement on the `network/1` pack

Status: DRAFT, not frozen. Nothing has been run. Written 2026-11-18. Amended 2026-11-18, before freeze: added set A2 (28 items for the 14 proposed roles of the empty cells in `cube-roles.md`), a separate per-role rule (8b), a vocabulary-leak check, and a note on circularity. Amended again 2026-11-18, before freeze: set D is now machinery events placed like any other move (no longer expected not to fit); a perspective-shift set P is added, built on an observation chain (expression, recording, our observation), with its own rule in 8c; the closed-core pass condition is removed. Freeze means: items final, sheets built, scorer written, author labels sealed, and the sha256 of each recorded here before any rater sees a sheet.

## 1. Question

Spec section 5c claims every concept in the `network/1` pack is a declared kind with one cell, a coordinate in three triads: mode (Differentiate, Relate, Generate), domain (Existence, Structure, Interpretation), grain (Ground, Figure, Pattern). That claim is one reader's nomination (mine). This test asks whether independent readers, given only the definitions and a plain description of a move, land on the same coordinates more often than chance, and more often than names alone would explain.

It also tests the other half of the claim: things that are not supposed to reduce (hash, signature, encryption, framing, the root key) should be recognised as not fitting, not forced into a cell.

## 2. What is rated

Each item is a plain-language description of one move, written without any cell name, operator name or axis word. A rater assigns, per item:

- mode: one of 3, or NONE
- domain: one of 3, or NONE
- grain: one of 3, or NONE
- an overall flag FITS or DOES NOT FIT the three axes at all

Rating the axes separately gives three 3-way choices (chance 1/3 each) instead of one 27-way choice, which gives more statistical power with a modest item count. A derived cell is the triple; cell-level agreement is reported as secondary.

## 3. Items (target 100)

| Set | n | What | Why |
|---|---|---|---|
| A. Pack moves | 24 | The 12 `network/1` concepts, each described as two distinct moves (for example "a person gives another person permission to read a folder" and "that permission is later withdrawn") | The claim under test |
| A2. New-cell moves | 28 | The 14 proposed roles for the cells the pack leaves empty (`cube-roles.md`), each described as two distinct moves (for example "stop holding everything under one folder on this device" and "withdraw a permission together with every permission that was passed on from it") | Tests the nominations that extend the pack; scored separately and not part of the HOLDS verdict |
| B. Everyday moves | 24 | Ordinary record-keeping moves from eodb and pharos use (record a phone number, link two cases, merge duplicate contacts, mark a task done, re-open a case under a new rule) | Shows whether agreement is specific to our concepts or general |
| C. Known-answer controls | 12 | Paraphrases of cells whose terrain and stance are given in `cells.json` (one per cell, spread across all three axes) | Shows the raters can do the task at all; answers come from the file, not from me |
| D. Machinery events | 12 | Computing a hash, checking a signature, encrypting bytes, framing bytes on a wire, choosing a root key, a clock tick, and similar, each rewritten with a named perceiver (the current D file names none and must be revised before freeze) | Tests whether machinery events are placed reliably like any other move; they are no longer expected not to fit |
| P. Perspective-shift chains | 40 | 12 statements, each in 3 variants that differ in what the expresser and the recorder could have known at the time, plus 4 control variants where only an irrelevant detail changes (for example the time of day) | Tests whether placement depends on the observation chain, as claimed; scored by 8c |

**Who writes the items.** A fresh subagent writes sets A, A2 and B from the concept descriptions in spec sections 7 and 8, the eodb README, and for A2 only the plain role sentences from `cube-roles.md` (I first strip every cell id, coordinate, terrain and stance word and the notes column, rewriting each role in everyday words); it is never shown the cell column, the axes, or `cells.json`. **Vocabulary-leak check:** before freeze, every item is searched for the nine operator names, the grain names, the mode and domain words, and the terrain and stance words in `cells.json` (for example clearing, tending, cultivating, dissecting, binding, making, unraveling, tracing, composing); any hit is rewritten by a second fresh subagent. A second fresh subagent writes set C from `cells.json` only. Set D is written by me and reviewed by you before freeze, because decoys need judgment. Item order is randomised with a recorded seed and the same order is used for every rater except in the shuffled arm.

## 4. Arms

| Arm | What the rater gets | What it isolates |
|---|---|---|
| Definitions | `cells.json` fields (mode, domain, terrain, stance for every cell) plus the axis definitions | The real condition |
| Names only | The nine operator names and three grain names, no definitions | Whether names alone already suggest the answer |
| Swapped | The Definitions sheet with operator names permuted by a recorded permutation | Whether readers use the definitions or the names; labels are mapped back before scoring |

Each rater does all three arms in separate fresh sessions, in an order fixed by seed, so no session sees another arm's sheet.

## 5. Raters

- Four Claude models as fresh subagents: Opus, Sonnet, Haiku, Fable. These are one vendor, so they are not independent families. This is a stated limitation, and agreement among them is weaker evidence than agreement across families.
- Local models (for example the two Qwen models used in the earlier operator test) if available: strongly preferred, since they add a second family.
- You as a rater, blind to my labels, on the Definitions arm only. You have seen my table, so you are not independent either; report separately.

Each rater works in its own empty folder holding only its sheet and items. No rater sees the pre-registration, my labels, another rater's output, or this document.

## 6. Author labels

I write my own labels for sets A, A2, B and D (the nominations in spec 5c and `cube-roles.md`, extended to every item) into a file, hash it, and record the hash here before any rater runs. Agreement with my labels is reported, but kept separate: I am not blind, so it does not count toward the verdict.

## 7. Metrics

Per arm and per axis:
- Fleiss' kappa across raters (bootstrap 95% confidence interval over items, 2,000 resamples, fixed seed).
- Chance level for each axis is 1/3 (observed chance-corrected by kappa).
- Accuracy on set C against the file's answers.
- On set D: the share of items where a majority of raters say DOES NOT FIT or NONE.
- Which operators raters confuse (a confusion count over pairs), as candidates for "fewer than nine".
- Per item: disagreement flags, so the weak derivations in `network/1` are named.

Reported on sets A and B separately and together (the verdict uses A and B combined, 48 items, exactly as before the amendment). Set A2 is reported separately: pooled kappa per axis with its confidence interval, and the per-role outcome in 8b.

## 8. Verdict rule (fixed before any rating)

**HOLDS** requires all of:
1. On the Definitions arm, the lower 95% bound of kappa on sets A and B combined is at least 0.40 on each of the three axes.
2. Definitions-arm kappa exceeds Names-only-arm kappa by at least 0.15 on each axis (definitions add something).
3. Set C accuracy is at least 90% for every rater that is kept in the analysis (a rater below 90% is dropped and the drop is reported).
4. [Removed 2026-11-18: machinery events are placed like any other move, so a share of them failing to fit is not required. Set D is reported, and whether placement does any work is decided by rule 8c.]
5. Swapped-arm kappa, after mapping labels back, is within 0.10 of the Definitions arm.

**NAMES ONLY:** condition 1 holds but condition 2 fails on any axis. The coordinates are findable from the names but the definitions carry nothing extra.

**PARTIAL:** conditions 1 and 2 hold on one or two axes only. Name which axes.

**FAILS:** otherwise. High agreement on a vocabulary that absorbs everything is no longer a failure by itself; whether placement does any work is decided separately by rule 8c.

**What each verdict does to the spec:**
- HOLDS: `network/1` ships as defined, with this result cited in 5c.
- PARTIAL or NAMES ONLY: derivations on the failing axes are marked "nomination" in the pack and are not described as defined by the core.
- FAILS: the pack stays as optional documentation without cell claims; section 5c is reduced to a hypothesis.

## 8b. Rule for the 14 new roles (set A2; fixed before any rating)

Two items per role is too few for kappa per role, so each role gets a direct rule on the Definitions arm, using the majority label of the kept raters (excluding me and excluding you):
- An item **matches** if the majority label equals my nomination on all three axes and at least two thirds of kept raters agree on each axis.
- A role is **SUPPORTED** if both its items match, **WEAK** if one matches, **NOT SUPPORTED** if none does.
- Roles that are WEAK or NOT SUPPORTED are marked as such in `cube-roles.md` and in the spec; they are not deleted. Their result does not change the HOLDS, NAMES ONLY, PARTIAL or FAILS verdict for the original pack.
- The Names-only arm is run on A2 too. A role that matches on Names-only but not on Definitions is reported as "findable from names only".
- Also reported: how many of the 14 roles are SUPPORTED, and whether the supported ones cluster on a grain (the roles lean toward group and bulk operations, so a pattern is expected and would be a finding to check, not a result).

## 8c. Rule for the observation chain (set P; fixed before any rating)

**The claim.** Every statement is a move on a perceiver, and its placement depends on the chain: what was expressed, what the expresser could have known when expressing it (its reach of cause, the "lightcone"), what the recorder could have known when recording it, and our own observing of that record. The chain continues without end in principle; this test covers the first two levels only (the expression, and its recording). Deeper levels are not tested.

**Items.** Each P item gives one statement (the same words in every variant of that statement) and two context lines: what the expresser could have known, and what the recorder could have known. The rater places the move at two levels: Level E, what the expression does given what its expresser knew; Level R, what the recording does given what its recorder knew. Three variants of each statement change those contexts (for example: expresser knew nothing relevant / knew and agreed / believed the opposite). For 4 statements a fourth control variant changes only an irrelevant detail.

**Predictions.** Before any rater runs, my predicted placements (all three axes, both levels) and, if you provide them, yours are written to a file and hashed. A prediction states which axis is expected to shift between which variants.

**Scoring** (Definitions arm, majority label of the kept raters; the Names-only arm is run too).
- A statement **shifts as predicted** at a level if the majority labels differ between variants on the predicted axis in the predicted direction and are unchanged on the axes predicted not to move.
- **Controls pass** if the majority label does not change between a variant and its control.
- **SHIFT-HOLDS** requires all of: at least 8 of 12 statements shift as predicted at Level E; at least 8 of 12 at Level R; at least 3 of 4 controls pass; and the shift on the Definitions arm is larger than on the Names-only arm (names alone should not produce it).
- **SHIFT-FAILS** if fewer than 6 of 12 shift as predicted at either level, or if controls shift as much as the real variants. That means the perceiver and the chain add no information to the placement.
- Anything between is **INCONCLUSIVE**, reported with the per-statement table.
- Also reported: whether Level R placements are consistently of one mode relative to Level E (a candidate regularity, for example that a recording is a relating move). This is a hypothesis to look at after the result, not a pass condition.

**What each result does to the spec.** SHIFT-HOLDS: the observation chain is described in 5c as tested. SHIFT-FAILS: the chain stays a design principle without a claim that it changes placement. INCONCLUSIVE: no change.

## 9. Other things reported, not decided

- Operators raters cannot tell apart (a hint that the nine might be fewer).
- Whether agreement is higher on some axes (for example grain) than others.
- Whether the shipped pack's weakest derivations are the ones the spec already flagged (peer requests as `SIG`, standpoint at `DEF·Ground`).

## 10. Controls on my own conduct

- The scorer is written and its sha256 recorded before any label is opened.
- Items, sheets, permutation seed, item-order seed and author labels are hashed at freeze.
- Any slip (a wrong date, a sheet leaked to a rater, an item edited after freeze) goes into an errata file; stamped files are not edited.
- No item is added, dropped or reworded after freeze, whatever the result.
- The result is added to the spec whatever it is.

## 11. Known weaknesses

- One vendor among the Claude raters; local models would help.
- The earlier operator test (126 items) found label sets that survived shuffling 95.7% of the time, which is the reason the Names-only and Swapped arms exist. If this test shows the same pattern, that is a result, not an error.
- Items about concepts we invented could be easier or harder than everyday ones; sets A and B are reported separately for that reason.
- Writing the decoys requires judgment I cannot make blind. You review set D.
- The 48 items that decide the verdict (sets A and B) give wide confidence intervals; kappa near the 0.40 threshold will be inconclusive and should be read that way. The 28 added A2 items do not widen the verdict set, and two items per role is a small sample.
- **Circularity in A2.** I wrote the 14 roles by starting from each empty cell's coordinates and stance words in `cells.json`, then looking for a use for it. That is top-down, and it can make a role fit its cell by construction. The vocabulary-leak check removes the words from the items but not the shaping of the roles themselves. A SUPPORTED result therefore shows that independent readers place a plain-language move at the same coordinates, not that the project needs that role. Whether the project needs it is a separate judgment.
- The Willow forgetting-versus-pruning point behind one role comes from a search summary of a docs page I did not download.

## 12. Before freeze (to do)

1. You review this design, the thresholds and the decoy list.
2. The two item-writing subagents run.
3. Build sheets, permutations and the scorer; hash everything.
4. Seal author labels and record the hash.
5. Run raters, score, report.

## 13. Not decided

- Whether local Qwen raters are available on this machine.
- Whether you want to rate as a human, and on how many items.
- The thresholds (0.40, 0.15, 90%, 70%, 0.10) are my proposals, set from convention and the item count; change them now, not after.
