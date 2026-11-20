# SIG, the read-time index, and the shortcuts (corrected 2026-11-18)

**Correction to the first version of this file.** It named three index structures after the three SIG cells and called them "expressway, synapse, wormhole". That was wrong. Your earlier work (the khora experiments in `identity/synapse/` and `identity/novels/wormhole.mjs`, read on 2026-11-18 with your permission) defines those words differently, and the three SIG kinds are something else again. This file separates them.

## 1. The three kinds of SIG

All three SIG cells in pharos's `cells.json` are Relate · Existence; only the grain differs. From `cube-roles.md` (my nomination, which you confirmed looks right):

| Cell | Terrain, stance | What it is | Matches the team's SIG design |
|---|---|---|---|
| `SIG·Ground` | Void, Tending | Declare interest in an area: "this device cares about this namespace and path range" (the slice declaration behind `advertise`) | The "complete to position P" claim is area-level |
| `SIG·Figure` | Entity, Binding | Attend to one entry: a read or fetch event (access audit; `body(bodyc)` fetches) | A pointer keyed by who asked and under which ground |
| `SIG·Pattern` | Kind, Tracing | Attend to a kind: usage trails by kind; drives retention and prefetch; "reinforce on verified use" | The trail, made of SIG marks (pheromone: it halves over time, section 3d) |

**Built (section 3b).** The facade can now record all three as real entries at their own SIG cells, in a separate marks store, off by default. What is in `sig.mjs` is still not SIG; it is the read-time index the marks help decide how to use.

## 2. What your earlier work means by the three shortcut words

From `PREREG-SYNAPSE-1/2`, `RESULTS-SYNAPSE-1/2` and `wormhole.mjs` (text and referent experiments, not a database):

- **Synapse.** A trail promoted to a consolidated edge: pheromone is deposited on every co-presence and decays; a pair is tagged in a round if its credit (co-presence above what independence predicts) beats a robust unit, and becomes a synapse only if tagged in at least two rounds; weights are reinforced by use and forgotten by non-use. Results: promoted edges are sparse (about 6 to 12 percent of candidates) and persist (held-out precision 0.79 against 0.18 for all positive-credit pairs); completion beat a rewired null but not a popularity baseline; basin claims were not supported.
- **Expressway.** A shortcut that must actually shorten distance. The test found synapses did **not** shorten paths (97 percent joined referents already adjacent), so "a synapse promoted from direct co-presence is a consolidated edge, not a shortcut". Expressways are promoted into the log as derived events only through a held-out check.
- **Wormhole.** An identity link between all the places a description occurs and one referent ("the girl" to one cast member), admitted only if its share beats a random-binding null by a stated margin; otherwise a typed gap. In the session notes: "wormholes are CON events computed over marks".

So the shortcuts are what SIG trails get promoted into, by a held-out check. They are learned, they are admitted or refused by a test, and they are not read caches.

## 3. What I built instead: a read-time index (`sig.mjs`), under your rule

Your rule: a shortcut is used only if it reduces read time. Everything here is derived (delete `<log>.sig/` and it rebuilds) and every use is checked against real entries.

- **Frontier.** A cached causal frontier, advanced by reading only newly appended bytes, supplies `seen` for writes on the lazy store (which does not compute it). This is what keeps writes flat.
- **Location map.** Every entry id to its file and byte offset, plus the ids of each kind. Gives direct reads and walks along `of` chains by one positioned read per hop.
- **Memo.** A stored answer valid only at the exact position (the byte size of every shard) it was computed at.
- **Chooser (`readKind`).** Estimates the cost of reading a kind directly against scanning, from costs measured on this log (µs per entry scanned, µs per positioned read), takes the cheaper path only when it is expected to cost under 70 percent of the other, falls back to the scan, and records every real run. `db review` compares the recorded times with the estimates. A retraction of a retraction forces the scan, because the direct path cannot reproduce it.

### Measured, 30,000 entries, lazy store, through the facade (one machine, one run each)

| | Plain query | Shortcut | Notes |
|---|---|---|---|
| Time per write | not applicable | 2.5, 2.5, 2.9, 2.7 ms by quarter (flat) | the plain log reached 11 ms and was still rising at 15,000 |
| Ask everything, quiet log | 938 ms | 312 ms on a memo hit | any write invalidates the memo |
| Read a rare kind (300 rows) | 285 ms | **85 ms** by the chooser (direct) | includes loading the saved index (about 46 ms) |
| Read a common kind (29,700 rows) | 755 ms | 652 ms (chooser took the scan) | direct would have cost about the same |
| Walk a 1,000-link `of` chain | 347 ms (query engine) | 69 ms | one positioned read per hop |
| Index size | | 4.9 MB for a 9.8 MB log | about half the log |

How accurate the chooser's numbers were: its **choices** were right in both cases, but its **estimates** were not good. It estimated the scan at 605 ms (actual 285 to 755 depending on the kind) and the direct read of the rare kind at 8 ms (actual 85 ms, because it left out the fixed cost of loading the index). The estimate needs that fixed cost added; I have not done that.

Also: the first forced direct read took 800 ms because it triggered the one-time measurement of costs (a full scan plus 200 reads). That number is not the cost of a direct read.

The earlier per-address "synapse" I built was a net loss and has been removed (see the first version of this file in the history: 454 ms against 289 ms for a rare kind, and 33 s against 0.7 s for a common one).

## 3b. SIG marks, trails and promotion (`marks.mjs`, built 2026-11-18)

Off by default (`db marks on`). When on, a read of a kind records, **after** the answer is computed:

| Mark | Cell | Content |
|---|---|---|
| `sig.pattern` | `SIG·Pattern` | the kind read, rows, time, path taken, why it was taken, and sometimes a probe (below) |
| `sig.figure` | `SIG·Figure` | a pointer set keyed by asker, standpoint and question: the ids (up to 50) that answered it, never the answer |
| `sig.ground` | `SIG·Ground` | "this area (the kind) was read completely, complete to this position" |

They live in `<log>.marks/` (a lazy pharos of their own), so they do not enlarge the log, change its folds or position, or travel with it. A test checks the log is byte-for-byte unchanged after marked reads. A mark that cannot be written never changes an answer and is **reported** (`markError`), not hidden.

**Trails.** Each read of a kind deposits 1; every later read of any kind decays all trails by 0.9. It depends only on the order of marks, never the clock (tested: reads A, A, B give A = 1.71, B = 1).

**Promotion by a held-out check.** Every fifth read of a kind with marks on, the reader runs both paths, compares their rows, and records both costs (the direct cost includes loading the index). From at least 6 probes: the earlier two thirds nominate the direct path (cheaper than 70 percent of the scan in 80 percent of probes), and the **later third, held out**, must agree for it to be promoted; if the held-out probes show it is not cheaper, or any probe showed different rows, it is demoted; otherwise undecided and the estimate decides. Only the reader's own marks count (tested: another writer's probes promote nothing). A forced strategy is never overridden.

**A real run** (6,000 entries, lazy store, marks on, 40 automatic reads of each kind, nothing injected):
- Marking cost: a forced-scan read took 72.8 ms with marks off and 76.1 ms with marks on, about 3 ms (4 percent). Every fifth read also pays for running the second path.
- Rare kind (30 entries): the estimate chose direct for the first 28 reads; after 8 probes the verdict was **promoted** ("cheaper in 100 percent of held-out probes"), and the last 12 reads were chosen on that basis. Direct took 11 to 18 ms against 56 to 123 ms for the scan.
- Common kind (5,970 entries): the estimate chose the scan throughout; the verdict was **demoted** (direct cheaper in 0 percent of held-out probes: 127 to 200 ms against 85 to 118 ms), and the last reads were chosen on that basis.
- All 16 probes returned identical rows.
- **Honest reading:** the learned verdicts agreed with what the estimator already chose, so in this run promotion changed no decision. Its value would be where the estimator is wrong, as it was before I added the index-load cost to it. That case has not been shown.

**Not built:** marks of other writers or other machines (they would need to be signed and trusted, and the cost rule applied); retention (the team's design removes whole segments, never truncates; nothing prunes the marks store); and the promoted objects your earlier work means (a consolidated synapse edge, an identity wormhole, a path-shortening expressway). What is promoted here is only the choice of a read path.

## 3c. The shortcuts, built from the primitives (`shortcuts.mjs`, built 2026-11-18)

Reads are transformations too, so `ask`, `get`, `trace` and `brief` now deposit marks (when marks are on): a figure mark of the addresses touched together, and pattern marks of the kinds. The three shortcuts are **ordinary entries**, derived from those marks (or from the `of` graph), written by a `derive-<who>` writer into the deletable `<log>.derived/` cache with `of: []` and the evidence in `basis`, and admitted only by a held-out check. When a later check fails, a retraction is written (the entry is hidden, not erased); when the evidence changes, the old entry is retracted and a new one written.

| Shortcut | Cell, kind | Built from | Admission rule | Use |
|---|---|---|---|---|
| Synapse | `INS·Pattern` `synapse` | pair credit `n_ij - n_i n_j / N` over question windows | tagged above median + 2 robust units in at least 2 of 4 training rounds, and the pair co-occurs again in the held-out last third; the whole set is refused if held-out precision is under 50% | `db related <addr>` |
| Wormhole | `CON·Figure` `wormhole` | words in questions, bound to the address they co-occur with | share beats a seeded, size-matched random-binding null by z >= sqrt(2 ln H), at least 3 events, held-out agreement at least 80%; otherwise a typed gap (`too_few`, `literal`, `not_concentrated`, `failed_heldout`) | `db resolve <name>` |
| Expressway | `CON·Pattern` `expressway` | a skip link every 32 ancestors along single-parent `of` chains, carrying descriptors of what it skips | on held-out traces the ancestors are identical and the cost (reads plus link lookups) is at most half | `db trace` uses live links automatically |

Run with `db shortcuts [synapse|wormhole|expressway|all]`.

**Measured.** Expressway, 6,000-link chain, lazy store: held-out cost 380 against 5,000 reads (8 percent), every probe identical; a trace from the tip took 6 ms against 157 ms, from depth 4,321 4 ms against 91 ms, from depth 1,500 3 ms against 31 ms. **Space cost: the 187 links came to 24.4 percent of the log's size** (entries here carry about 60 bytes of body; measured when they were still written into the log, now they sit in the deletable cache). Writing them took 2.0 s. That is a real price against your space concern, paid only where long single-parent chains are traced often.

**Not shown.** On a small run of 60 real `ask` rounds (12 topics, two planted pairs read together half the time), the synapse gate admitted nothing and no word was bound to a referent, so no shortcut was promoted. The unit tests show the mechanics on planted data; I did not tune the thresholds to make the real run produce something. The threshold multiplier (2 robust units) was chosen by hand on small synthetic rounds. Also: a synapse here is between addresses, and nothing yet shows a synapse shortens any read (your earlier result that direct co-presence is already adjacent is a warning); the expressway is the only one of the three with a measured read saving.

**Decided (2026-11-19):** marks and derived entries are caches beside the log, not part of it.

## 3d. Pheromone on a difference clock (built 2026-11-19)

Both the marks store (`<log>.marks/`) and the derived shortcuts (`<log>.derived/`) are **caches**: delete them and every answer is unchanged. Verdicts fall back to the estimator, synapses and wormholes are relearned from new marks, expressway links are rebuilt from the log (tested: a trace is identical with and without the cache). The main log is no longer touched by promotion or forgetting (tested).

Marks are pheromone, so they evaporate, but not on a calendar. **Time passes only when something makes a difference** (a difference that makes a difference):

- **Age** of a mark = the number of difference-making events since it was deposited. Reads that change nothing age nothing.
- **Half-life** = the median gap, in those events, between one difference on a kind and the next difference on the same kind: how fast a useful trail is actually returned to. Weight is 2^(-age / half-life).
- **Forgotten** once older than the longest such gap ever observed: nothing has ever returned to a trail that stale. Difference marks themselves are never dropped (they are the clock); everything else is.
- **No evidence, no decay.** With fewer than 5 observed gaps there is no rate, so nothing decays. The 5 is the one constant left, a minimum sample, chosen by hand.
- A difference is: milliseconds saved against the other path (measured only on probes that ran both), reads saved by an expressway (exact on a single-parent chain), or a verdict overriding the estimator. Trails report *attention* (every read) and *difference* (only what changed something) separately; a read that changed nothing ranks below one that did, and that is the honest accounting of the earlier finding that promotion changed no decision.
- Verdicts, synapses and wormholes use only live marks; when their evidence goes, the verdict returns to undecided and the derived entries are retracted.

**Consequences to know.** (1) Everything is a function of the marks alone: no clock, no `now`. (2) If nothing ever makes a difference, nothing ever ages, so attention-only marks accumulate without bound; that is a space cost I have not bounded. (3) Difference marks accumulate too, though only as fast as differences occur. (4) Only kind reads and expressway traces measure a difference; synapse and wormhole uses do not yet, so they cannot yet reinforce themselves. (5) The test for the chooser (`a 6-read direct path...`) failed once in a run with other suites alongside and passed on three reruns: it depends on measured timing.

## 3e. Neural rules: use strengthens, misprediction weakens (built 2026-11-19)

Modelled on how synapses work, not on a calendar. Every read that touches a live synapse checks its other end:

- **Hit** (both ends touched, "fire together"): the neighbour needed no lookup of its own, so one read was saved. That is a difference, so it ticks the difference clock and counts as potentiation.
- **Miss** (one end touched, the prediction failed): depression.
- A name used in a question is a hit when its wormhole's referent is touched and a miss when it is not.
- **Use over evidence.** A shortcut with at least 5 outcomes and more weighted misses than hits is *depressed* and retracted even if its original evidence still supports it. A shortcut with a live hit and hits at least equal to misses is *potentiated* and **kept even after the questions that created it have evaporated**. One that is never used and whose evidence evaporates is forgotten.
- Outcomes are pattern marks, so they live in the marks cache and age on the same difference clock.

Tests cover: hit and miss recording with the clock ticking only on hits; depression retracting a synapse the evidence still supports (and one miss not being enough); a used synapse outliving its evidence; a wormhole retracted after repeated misses.

**Not shown on real data.** These are unit tests on planted marks. The earlier real run produced no synapse or wormhole to reinforce, so there is no measured case yet of reinforcement keeping a useful shortcut alive on real reads. The expressway is not yet reinforced or depressed by use (it is a pure function of the log, so it needs no learning, but nothing prunes one that is never traced). The threshold of 5 outcomes is the same hand-chosen minimum as before.

## 3f. A multi-session workload (run 2026-11-19; simulated users, real read paths)

40 topics (4 addresses each plus a 120-entry edit chain), 6,000 entries, 2.0 MB log. 600 questions through the real `ask` and `trace`, marks on, `promoteAll` every 100. Three variants: **structured** (six planted tasks that read 2 to 3 topics together, 55 percent of reads), **random** (a control with no structure), **marks off**. The users are simulated by a seeded generator I wrote, not people.

| | Structured | Random control |
|---|---|---|
| Expressway links promoted (first checkpoint) | 120, ancestors identical | 120, identical |
| Trace reads actually done, against a plain walk | 3,930 against 10,680 (63% fewer) | 8,430 against 22,560 (63% fewer) |
| Cost to trace every topic with links | 1,200 against 4,800 reads (75% fewer) | same |
| Synapses live at the end | 24, **all within one topic** | **54, all within one topic** |
| Planted cross-topic pairs found | **0** (at address level and at topic level) | not applicable |

**Findings, including the bad ones.**
1. **The expressway earned its keep**: a real, identical-answer saving, at a derived cache of 383 KB (19 percent of the log).
2. **The synapse did not.** It found only pairs inside one topic, which are always read together because a read of a topic returns all its addresses (nothing to save), and it found none of the planted cross-topic tasks. The random control got *more* synapses (54) than the structured run (24): the gate does not separate structure from noise on this data. Its hits (19.8 weighted, 0 misses) are trivial for the same reason. I have not diagnosed why the cross-topic pairs were missed; a likely cause is that the evidence window is too short (below).
3. **The wormhole was not exercised**: structured queries carry no names.
4. **The difference clock made evidence evaporate too fast.** After the fix that makes one read one tick, the forget-after horizon was 17 events (structured) and 43 (random), leaving only 39 and 62 live questions of about 420, which is below what the synapse test needs to see cross-topic pairs. Counting a synapse hit as a difference also keeps the clock ticking quickly.
5. **Marks grew to 2.19 MB, 107 percent of the log**, because nothing runs `evaporate` automatically; after it, 849 KB (39 percent). Marks are the biggest cache.
6. **Marking cost is not isolated.** Total 48.9 s with marks and expressways against 54.5 s with neither; the trace saving hides the cost of marking.

**Two bugs this run found and I fixed:** re-promotion retracted and rewrote every link each time because the store reorders body keys (derived cache 2.6 MB then, 383 KB now; a test checks no churn), and one read deposited several difference marks and ticked the clock several times (a test checks one read is one tick).

**Binary (measured on a 300-question run, JSON as it is today):**

| Store | Bytes | Raw 32-byte ids would save | gzip of the JSON |
|---|---|---|---|
| Log | 2.05 MB | 23% | 15% of original (synthetic bodies are padded text; not representative) |
| `.sig` index | **3.02 MB (148% of the log)** | 42% | 51% |
| Marks | 0.43 MB (at 300 questions) | 14% | 24% |
| Derived | 0.38 MB | 37% | 42% |

The read-time index was larger than the log it indexes. The cause was my own change: each entry's location record gained the address and the `of`-chain sets, and the per-address read that used the address is no longer used.

**Done (same workload, 300 questions):**

| Store | Before | After | Change |
|---|---|---|---|
| `.sig` index | 3,024,465 | **480,426** (23% of the log) | **-84%**: address column dropped; ids raw 32-byte; offsets and lengths varints; id sets as indexes into the record table |
| Derived (links) | 382,558 | 290,278 | -24%: skipped ids as one base64 blob of raw ids, 16-bit table indexes |
| Marks | 430,947 | 417,419 | **-3%**: only the packed id list changed |

The index is a binary file (`<log>.sig/<who>.bin`, magic `SIG2`); a damaged one is discarded and rebuilt from the log; the published (signed) index carries it as base64, and tampering with one character is still refused. Tests check it reloads to identical structures and is under 60% of the JSON size.

**Not done.** The marks are still JSON lines and barely smaller: they are dominated by question text, repeated field names and timestamps, not ids. gzip alone would take them to about 25% of their size, so a dictionary-coded record format would pay there. The derived entries and the log itself are still stored by the pharos JSON-lines store; whether pharos's own binary form (PHB1) can hold them I have not tested. The measurements use padded synthetic bodies, so how well the log itself compresses on real data is unknown.

## 3g. The synapse gate, fixed and re-run (2026-11-19)

The first workload showed the gate failing its own control (section 3f). Three faults, three fixes:

1. **Adjacency is not a connection.** Addresses with identical read profiles in the training window (the entries of one topic, always returned together) are merged into one node. A pair inside a node is never a synapse. A synapse now connects two *groups* and its entry names the members of each side (`ga`, `gb`); a hit is any member of each side touched.
2. **A real null.** The threshold is a seeded permutation null, not a spread rule: each node keeps how often it was read, its reads are shuffled across the round's questions (100 draws), and a pair must beat the 95th percentile of the best chance pair. Rounds are at least about 12 questions (2 to 4 rounds), because a null on 6 questions has no power. Replication in at least 2 rounds and a held-out co-occurrence are still required.
3. **Evidence window.** A return-gap horizon (and the difference clock's horizon) cut the question evidence below what the test needs, so evidence is a sliding window of the last 400 reads. **That 400 is a stated constant, not self-emergent**; I chose it from the power measurement below. Statistical evidence needs a sample size, and trail evaporation by use cannot supply one.

Also: anything the evidence no longer supports is retracted unless use has potentiated it, and a synapse's identity is its pair (statistics that drift as the window slides no longer cause rewrites).

**Measured power (unit tests, seeded; planted pair read together every 3rd or 6th question, each also alone sometimes):** noise pair promoted in 0 of 240 runs; pair found in 21/40 runs at 60 questions (every 3rd), 40/40 at 120 (every 3rd), 2/40 at 120 (every 6th), 40/40 at 240 (every 6th). Across 30 random datasets with no structure, at most 2 produce any synapse (the test allows 2; the measured count was within that).

**Re-run of the workload (600 questions, 40 topics, 6 planted tasks, simulated users):**

| | Structured | Random control |
|---|---|---|
| Synapses live at the end | 10, **all cross-topic, all inside a planted task (precision 1.0)** | **0** |
| Captured at the best checkpoint | 12 of the 12 planted pairs | 0 |
| First promoted | after 200 questions | never |
| Hits against misses (weighted) | 11.5 against 1 | not applicable |

**Not shown.** The synapse is detected, but nothing yet *uses* it to read less: `related` is available, no read path consults it, and the "hit" count is an accounting claim of one saved lookup, not a measured saving. So the synapse still has no demonstrated read-time benefit; only the expressway does. Wormholes were again not exercised by this workload. The workload is simulated.

## 4. Signatures (`sign.mjs`), under the same rule

- A writer's ed25519 key is made once (`db keys`), kept outside the log (`<log>.keys`, mode 0600), and its public half is pinned at first sight. Entries the writer writes afterwards are signed automatically; the signature is over the entry id and goes in a sidecar, so no id changes. Entries written before the key, and other writers' entries, are simply unsigned.
- **Ordinary reads never verify.** A damaged signature file changes no answer and costs nothing (tested). Verification happens in an audit (`db verify`), which reports valid, invalid, signed by a different key than the pinned one, and unsigned.
- **The one place a signature is used to save work:** adopting another writer's published index instead of rebuilding your own. It is done only if the reader has explicitly trusted that writer, the signature verifies under the pinned key, the published claim "complete to this position" matches the log's position now, **and** adopting is estimated to cost under 70 percent of rebuilding. Otherwise the reader rebuilds and verifies nothing. At 30,000 entries a cold rebuild took 103 ms and loading a saved index took 46 ms, so adopting is a modest saving there and nothing at small sizes.
- Not built: sharing of SIG **marks** between writers (needs the marks to exist first), key rotation, revocation of a trusted writer, and anything that stops a writer from signing something false (a signature proves who wrote an entry, not that it is true).

## 5. What is left to make this the system you described

1. Deposits from writes (reads from `ask`, `get`, `trace` and `brief` are done, section 3c).
2. Promote more than a read path: the objects your earlier work defines (a consolidated edge from repeated co-reading, an identity link across distant mentions, a shortcut that must shorten distance on held-out reads). The earlier result that a synapse from direct co-presence shortens nothing is a warning: "read together often" will not by itself give a shortcut; a database expressway has to join things that are far apart in the existing `of` and `seen` graph.
3. Share marks between writers: sign them, trust explicitly, apply the cost rule, and count only verified ones.
4. Retention by whole segments.
5. Show promotion correcting a wrong estimate, which this run did not.
