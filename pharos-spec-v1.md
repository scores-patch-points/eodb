# Pharos network and EODB interface: spec v1.2 (wrap-up draft)

## Status at wrap-up (2026-11-18)

**Decided** (by you in this session): the signing identity is a device key with the account key delegating; grounds disputes use standpoints and root-asserted rules; storage is the pharos log, with Matrix demoted to accounts, membership, key delivery and optional notifications; permanent deletion is allowed with a tombstone, owners can always delete, and sharing is either a gift (a copy they own) or a lease (access that can be withdrawn); the core is the 27 cells and everything else is a concept inserted atop as a declared kind in a replaceable pack.

**Tried, with files** (`eoql-authority-experiment/`): a recursive authority view in EOQL (expiry, delegation, area narrowing, revocation) matched the expected result on a test log with every rule shown necessary by mutants; a watcher with receipts performed an owed delete idempotently; a budgeted peer request and a per-writer summary ran as EOQL reads. Signatures and keys were stand-ins.

**Read, with byte addresses** (`sources/`): Keyhive notes, Willow data model and Meadowcap, the local-first essay, and the cryptographic erasure paper (`sources/sok-erasure/THEORY.md`, an unreviewed single-author preprint).

**Prototyped later the same day in `facade/`** (109 tests passing on both the plain and the lazy store; see `facade/README.md`): say and ask with a fixed verb-to-cell table; a standpoint switch (writers, horizon, compare); sealed bodies with a separate key store and permanent delete (tombstone, destroy the key, remove the ciphertext, receipt; interrupted deletes are finished and are idempotent); a shared notebook for coding sessions installed by `db init`; signatures (device keys, audit-only verification) and a read-time index with a cost-based chooser (`facade/SIG.md`, which also records what your earlier synapse, expressway and wormhole experiments define; they are not the same as this index). Measured: on the plain log a write took 11 ms and was still rising at 15,000 entries; through the facade on the lazy store a write stays about 2.5 ms flat to 30,000 entries (the lazy store records no `seen`, so a cached frontier supplies it). At 30,000 entries the memo is about 3 times faster on a quiet log, a rare kind read directly about 3 times faster, a chain walk about 5 times; a common kind is no faster.

SIG marks (the three SIG kinds recorded as real entries in a separate store, off by default) with trails and a held-out promotion check for the read path were added and run end to end on a 6,000-entry log: a rare kind was promoted to the direct path, a common kind demoted, and promotion changed no decision because it agreed with the estimate.

**Not built or not tested:** marks from read paths other than kind reads, marks shared between writers, retention of marks, and the shortcuts the khora experiments define (consolidated synapse edges, identity wormholes, path-shortening expressways); gifts, leases and capability checks wired into the tool; the carriers and any networking; secure erase beyond overwriting a key file (the key store is a plain folder, not the OS keychain); whether independent writers give the same cell to the same event.

**Shelved:** the blind-agreement and perspective-shift study (`pack-agreement-test-prereg.md`, `pack-test/`). The cube is a design principle. The 14 empty-cell roles (`cube-roles.md`) are design notes.

**First release** (build order, section 11, steps 1 to 5): eodb exporter, `v:2` body store, fixtures, signatures and capability entries, real carriers. How people and programs use the result is in `interaction-design.md`. Everything is indexed in `INDEX.md`.

Date: 2026-11-18. Replaces v1. Reconciled against the public `scores-patch-points/pharos` (SPEC.md, entry format `v:1`) and `scores-patch-points/eodb` (README). Both were read through summarising fetches, not line by line. Items marked **[verify]** need a direct read.

## 0. What changed from v1

- A **pharos is not a replica** (my earlier invention). It is an existing thing: an append-only log of "wefts", stored as local files, with a fold. The network in this spec is the layer that replicates and protects pharos logs between machines. I only add what the real pharos lacks.
- The real pharos already has most of the properties v1 had to invent: content-addressed entries, merge by set union, deterministic fold order, conflicts reported rather than resolved, retraction without erasure, and a frame entry that records assumed cross-frame identity.
- The real pharos has **no signatures and no encryption**, and its `by` field "is never used to decide who acts". So authority, signatures and sealing are genuinely new and live in a layer above the weft, without changing it.
- Matrix is demoted (decided in v1, kept): accounts, membership and key distribution, plus an optional small-event carrier. It is not storage.

## 1. Terms

- **Pharos**: one append-only log of wefts under one frame. Stored as `<writer>.jsonl` (or binary `<writer>.phb`, format PHB1) under `$PHAROS` (default `~/.pharos/<name>/`). No server.
- **Weft**: one entry. Fields: `v`, `cell`, `kind`, `addr`, `body`, `of`, `basis`, `seen`, `by`, `at`, `id`. `id` is the SHA-256 of the canonical JSON of the entry without `id`. `cell` is one of 27 operator-by-grain ids (for example `INS·Figure`).
- **Writer**: owns exactly one file and never writes another's.
- **Frame entry**: first entry of a pharos: name, writer, epoch, and an `assumed` list of cross-frame identity claims made on merge.
- **EODB**: the interface onto a pharos. Today it is a browser client with nine operators and a fold, storing events in Matrix rooms. Target: the same interface over a pharos log, with Matrix no longer storing the data.
- **Door** (pharos term): the declared entry point and gate that lets a repo work with pharos. Not the same as a network adapter. Do not conflate; this spec avoids the word for network pieces.
- **Network**: the four seams (event schema, carrier, key, discovery) plus the carriers.
- **Capability**: a signed, delegable, time-bounded grant to read or write an area. Format: Meadowcap.
- **Standpoint**: the grounds-asserting accounts, plus the keys held, under which a fold is read.
- **Sealed region**: events a replica holds as ciphertext it cannot read.

## 2. Principles

1. The log is the only source of truth. Everything else is rebuildable.
2. **Never rewrite a weft**, with one sanctioned exception: compacting a legacy `v:1` weft to delete its body (section 7). New `v:2` wefts never need it. Signatures, encryption and capabilities are added beside wefts, not inside them, so existing `id`s never change.
3. No upstream type crosses an adapter. Wefts leave an adapter as plain bytes plus `v`.
4. Two protocol versions at a time. No shims.
5. Two carriers from day one. Run your own relay, lookup and homeserver.
6. **The core is the primitives.** Three triads (mode, domain, grain) make 27 cells. Everything else is a concept inserted atop them as a declared kind, shipped in replaceable packs (section 5c).

## 3. What pharos already gives the network

| Property in pharos | What the network can lean on |
|---|---|
| `id` = hash of canonical entry | Dedupe and integrity are free. A receiver recomputes `id` and rejects a mismatch |
| One file per writer, append-only | Sync is per writer: exchange each writer's head, send the missing suffix |
| Merge is grow-only set union by `id` | No locks, no conflicts at merge, any order of arrival |
| Causal order from `seen` and `of`; ties broken by cell rank then `id` | Deterministic fold across replicas. The golden-fixture test has a built-in oracle |
| `fold` reports conflicts on the same `addr` and cell, never resolves | Matches the dispute rule below |
| `retract` entries; nothing erased | Matches "events permanent, payloads deletable" once payloads are separated (section 7) |
| `frame.assumed` records cross-frame identity claims | The seed of the standpoint idea |
| PHB1 hash chain: `sha256(prevChain \|\| kind \|\| payload)[0:8]`, per file; chained entries attest descent from every earlier entry in that file; merges and conversions write unchained v1 | Local tamper-evidence per writer only. Never send chain values to peers or use them as sync heads, because deleting or compacting changes them. Use weft `id`s and counts |

## 4. What the network must add

1. **Signatures.** Weft has no signature field. Add a signature sidecar keyed by `id`: `{id, device_pk, sig}`. Because `id` excludes the sidecar, nothing existing changes. `by` stays provenance only, as pharos says.
2. **Authority.** Pharos never uses `by` to decide who acts. Authority therefore needs its own entries: capability issue, delegate and revoke are new `kind`s declared in the pharos, so they are ordinary wefts and fold deterministically.
3. **Sealing.** Encrypt `body` per namespace. Pharos has no encryption (section 6).
4. **Transport and discovery.** Pharos is local files with no server. Replication is new.
5. **Foreign receipt.** `weave` computes `seen`, `at` and `id` itself and refuses caller-supplied values. Receiving a remote weft is therefore a merge-style operation (verify `id`, dedupe, append to that writer's file), not a `weave`.

## 5. Interface mapping (EODB and pharos to peer calls)

| Peer call | Backed by |
|---|---|
| `hello` | Frame entry plus protocol IDs and versions |
| `prove` | Capability entries and sidecar signatures |
| `advertise` | Writers, namespaces held, per-writer heads. Only after `prove` |
| `summary(ns, area)` | Per-writer head (count and last `id`), or `askHeads`-style answers by `addr` |
| `get(ns, area)` | `fold` or raw read of wefts by writer and `addr` prefix |
| `subscribe(ns, area)` | `watch` over the area, relayed to the peer |
| `put(ns, wefts)` | Foreign receipt (section 4.5): verify, dedupe, append. Headers only; bodies travel separately |
| `body(bodyc)` | Fetch one detached body (`v:2`) by `bodyc`, checking `sha256(salt \|\| body)` on receipt. Refused if deleted or not covered by the caller's capability. A replica may keep headers only and fetch bodies lazily, which also saves space |
| `fold(question, standpoint)` | Local `fold` plus standpoint stamp, fold hash and sealed denominator |

`fold hash` is defined here as SHA-256 of the canonical folded output. Pharos does not define one **[verify]**.

### 5b. eodb event to pharos weft mapping (read from `USE_ME.md` and `cells.json`)

**Facts.** **Verified against `src/operators.js` and `src/fold.js` of the eodb repo (read 2026-11-19; the repo is `scores-patch-points/eodb`, package `matrix-events`).** eodb event types are `<namespace>.<op>` with lowercase op keys `ins def seg con syn eva rec`, namespace default `io.matrix-events` (`setNamespace`); NUL and SIG are ephemeral and never stored. Content fields: INS `anchor, entity_type, payload`; DEF `anchor, path, value`; SEG `anchor, partition`; CON `source_anchor, target_anchor, relation_type`; SYN `input_anchors, output`; EVA `anchor, criterion, result, note`; REC `scope, before_frame, after_frame`. Schema is a DEF with `anchor: null` and `path` starting `_schema.`. Anchors are `<entityType>_<cyrb53 hex>` where the hash (cyrb53, 53 bits, not cryptographic) is over `entityType \0 JSON(payload) \0 sender \0 ts`; a SYN's anchor is not in its content but derived by the fold as `syn_<eventId>` (or `syn_<ts>_<sender>` with no event id), so an exporter must keep the Matrix event id. Sender and timestamps are not in content; the fold reads them from Matrix event metadata (`_sender`, `_created`, `_eventId`). There is no version field in events; the schema version is a DEF at `_schema.version`. eodb stores seven operators; NUL and SIG are ephemeral.
Pharos `cells.json` (`v:1`) has 27 cells: id, rank, op, grain, mode, domain, terrain, stance. The grain names are labels only, and the file has no mapping to eodb.

**Proposed mapping (one-way, eodb to pharos).** eodb events carry no grain, so every entity-level event lands on the Figure grain. Rank order is preserved: INS 7, SEG 10, CON 13, SYN 16, DEF 19, EVA 22, REC 25, matching eodb's dependency order, so pharos's tie-break by cell rank agrees with eodb's skipped-dependency check.

| eodb | pharos cell | `addr` | `kind` | `body` |
|---|---|---|---|---|
| INS | `INS·Figure` | anchor | `entity_type` | `payload` |
| DEF (entity) | `DEF·Figure` | anchor plus `path` | `<ns>.def` | `value` |
| DEF (schema, anchor null) | `DEF·Ground` | `_schema.<path>` | `<ns>.schema` | `value` |
| SEG | `SEG·Figure` | anchor | `<ns>.seg` | `partition` |
| CON | `CON·Figure` | source anchor | `<ns>.con` | target, `relation_type` |
| SYN | `SYN·Figure` | output anchor | `<ns>.syn` | `input_anchors`, `output` |
| EVA | `EVA·Figure` | anchor | `<ns>.eva` | `criterion`, `result`, `note` |
| REC | `REC·Figure` | scope | `<ns>.rec` | `before_frame`, `after_frame` |

Schema DEF to `DEF·Ground` is my reading, not something either repo states. Every `kind` must first be declared by a `kind` entry in the pharos, so the exporter writes those first.

**Exported wefts are `v:2` (detached salted bodies, section 7).** In the table above, the `body` column is what goes into the detached blob store. The header holds `bodyc = sha256(salt || body)` and everything else (`cell`, `kind`, `addr`, `of`, `basis`, `by`, `at`). Small, non-sensitive bodies may stay inline as `v:1` only if the owner will never need to delete them; the default is `v:2` so anything can be deleted later without touching the chain.

**Provenance.** The Matrix sender goes into `by` (later tied to a device key by delegation). The Matrix event ID and original timestamp go into `basis`, so the origin is recorded.

**Problems this exposes:**
1. **Idempotent export. SETTLED 2026-11-19, no pharos change needed.** Measured on the pharos library: `weave` computes `at` and `seen` itself and refuses them from the caller, but its duplicate check keys on `{cell, kind, addr, body, of, basis, by}` and leaves them out. Re-weaving the same event later, through a new handle, returns the same entry (same `id`). So an importer is idempotent if `basis` carries the Matrix event id and original timestamp and each Matrix sender maps to one stable pharos writer. The original time is kept in `basis`, not `at`; order in pharos is causal, so events must be imported in the fold's chronological order, and measured import order did become the causal order (two writers' DEFs folded in import order, no conflict). The text below is the earlier analysis, kept for the record. eodb's anchors are idempotent by content hash. Pharos `id` includes `at` and `seen`, so re-exporting gives different ids unless `at` is the original Matrix timestamp and `seen` is derived deterministically. But `weave` refuses caller-supplied `at` and `seen`. So the exporter needs a foreign-receipt path (build the weft itself, compute `id` per the canonical-JSON rule, write it as its own writer file). The canonical JSON rule is not read yet **[verify]**. With `v:2` there is a second reason ids would differ: a fresh random salt changes `bodyc`. A deterministic salt (derived from a secret and the Matrix event ID) would fix that but would let the exporter re-derive a deleted body's salt, defeating deletion. So the exporter gets idempotence by lookup, not recomputation: it records the Matrix event ID in `basis`, and before exporting an event it looks for an existing weft (or tombstone) with that source. A deleted event is never re-exported. The pass condition becomes "a second export adds no new wefts", not "identical ids".
2. **One-way only.** Pharos can hold NUL and SIG cells and non-Figure grains, which eodb cannot express. The mapping works into pharos, but an eodb view of a pharos would drop those cells.
3. **No `of` in eodb.** eodb events carry no link to the entry they answer. The exporter leaves `of` empty, and REC does **not** identify what it replaces (it carries only `scope`, `before_frame`, `after_frame`; verified in `src/operators.js`), so `of` stays empty for every exported event.
4. **Namespace.** eodb's namespace prefix is global per app. Whether it becomes the pharos name, a `kind` prefix or a Meadowcap namespace is part of the namespace-granularity question.

### 5c. Primitives and concepts (decided 2026-11-18)

**Core.** The core is three triads: mode (Differentiate, Relate, Generate), domain (Existence, Structure, Interpretation) and grain (Ground, Figure, Pattern). Their product is 27 cells, and the nine operators are mode-by-domain. This is how `cells.json` is laid out: each cell has `op`, `grain`, `mode` and `domain`, and `rank = 9·domain + 3·mode + grain` (checked on four cells). The fold knows only cells and their order. A `cell` is validated as a coordinate in the three axes.

**Concepts.** Everything else is a concept, inserted atop the core: a `kind` entry that declares a kind. Pharos already boots `kind` at `DEF·Figure` and requires every kind to be declared with `{name, cell}` before any entry of it can be woven (re-declaring it at another cell is refused as `KIND_REDECLARED`); EOQL writes the same entry with `WRITE DEF(declare: ...)`. The concept's derivation is stored beside it as an EOQL view (`WRITE DEF(view: ...)`, an entry of kind `view`). Entries of the declared kind are ordinary wefts of the declared cell. A concept's meaning is its view, computed when read, never stored as a result. Concepts may be built on other concepts as views that use views (nested to depth 16; EOQL refuses cycles with `E_CYCLE`).

**Packs.** The project ships a starter pack, `network/1`, as signed declaration entries written when a pharos is installed. A pack is data. It can be replaced, versioned (a new pack version redefines each view with `WRITE DEF(view: ...; of: heads)`; two definitions without `of` are concurrent, and EOQL reports the view as held, not decided), forked or ignored. Which pack applies is part of the standpoint, and two packs that contradict are a ground dispute under section 8. The core never mentions any concept.

**Derivation language (proposed: EOQL, read 2026-11-18 from `pharos/eoql/SPEC.md`, A1 and A2).** EOQL/1 is a query-and-update language over the pharos log with nine verbs. It can name concepts as stored views (parameterised, nested to depth 16, acyclic), declare kinds with a cell literal (`WRITE DEF(declare: ...; cell: "INS·Figure")`, A2), recurse (`CON depth: "*"`, `DEF fix`), and walk `of` and `seen`. Its `SIG` sets the observer (perceiver, budget, return mode), `DEF` sets the frame and collapse rule, and a slot with several heads is reported as held, not decided, which is the standpoint and dispute behaviour of section 8. Read-only by default; writes only append; retraction is `WRITE NUL`. Limits that matter here: no `now()`, no regex, no UPDATE or DELETE, no triggers, no federation, and no column for signature validity or decryptability. So EOQL covers the view side of a concept (what is authorised, contested, sealed, deleted) but not effects (unlinking a body, sending, writing a dispute entry when one appears). **Tried, and what it showed (2026-11-18, files in `eoql-authority-experiment/`).** Against a clone of pharos, an authority view written as one recursive EOQL query gave the expected answer on a 13-grant test log: root grant, delegation, expiry, area attenuation, a forged root, a bad signature, two revocations (one with a child grant), and a grant citing the wrong parent. Two runs gave byte-identical output (a hash of both matched). Five mutant views, each missing one rule (signature, area, expiry, revocation, parent link), each added exactly the grant that rule excludes, so no rule in the view is idle on this log. The four limits found earlier resolve without changing EOQL:
1. **No signature or decryptability columns.** The kernel checks natively and writes an `attest` entry (`EVA·Figure`, `of` the checked entry, body `{check, ok}`) as its own writer. The view joins on `of` and trusts only `_by = "kernel"`, which is the standpoint idea applied to the kernel. Decryptability and body-present work the same way. No new columns.
2. **No clock.** `:now` is a host parameter; changing it from 2026-11-19 to 2026-11-26 correctly dropped the two grants that had expired. Every answer must record the `now` it used.
3. **No effects.** A watcher runs a view that lists owed effects, performs them natively, then appends a receipt entry so the view stops listing them. Demonstrated: a tombstoned item whose body file was still present was listed, the file was unlinked, a `gone` receipt was appended, and a second run did nothing.
4. **Peer requests.** A request is an EOQL read statement: `SIG(...; perceiver: {writers: [...]}; budget: {rows: N}; return: "pointers")`. A too-small budget returned `E_BUDGET` with no partial rows; a per-writer summary (`SYN ... by: ["_by"]`) returned counts and last position.
**What the trial did not show:** only the view side. Signatures were stand-ins (`ok` flags written by a script), the key and sealing layers were not exercised, and the delegation view checks the revoker only loosely. **Problems found:** (a) two grants from one issuer at the same `addr` were reported as held (`W_ANC_SLOT`, `determined: false`), so a many-per-issuer relation needs a unique `addr` per instance, not the issuer's key; (b) `_pos` is a global causal position, so a per-writer "head" needs another column; (c) a retracted entry stays visible under the default collapse (flagged), and disappears under `history`, so effect views must use the default; (d) bind names are not visible inside `in (...)` subqueries, so exclusion is written as an anti-join. The spec is stamped 2026-11-13 and says nothing in it has been run; the builder reports 80 passing unit tests (BUILD_NOTES.md). EOQL labels are `declared-by-writer` and unchecked, which is the gap the blind-agreement test addresses.

**`network/1` derivations (proposed; sections 7 and 8 are defined by these):**

| Concept | Cell | How |
|---|---|---|
| Capability rule | `DEF·Ground` | declares who may do what in an area |
| Grant, delegation | `CON·Figure` | link from a key to an area; `of` is the grant it delegates from |
| Revocation | `SEG·Figure` | cuts that link |
| Standpoint | `DEF·Ground` | declares whose grounds and which keys apply (in EOQL: `SIG` perceiver plus `DEF` frame and collapse) |
| Dispute | `EVA·Ground` | compares two grounds; result "contradict" |
| Settlement | `SYN·Figure` when it merges the held heads (EOQL resolves forks with `SYN`); `REC·Ground` only when it changes the rule itself | revised 2026-11-18 after reading EOQL; see `cube-roles.md` |
| Delete | `SEG·Figure` | cuts the content |
| Tombstone | `NUL·Figure` | holds the place where something was |
| Offer, receipt | `INS·Figure`, `EVA·Figure` | receipt tests the body against `bodyc` |
| Fold-hash agreement | `EVA·Pattern` | compares patterns across replicas |
| Sealed region | `NUL·Pattern` | held, not resolved; the denominator counts these |
| Peer requests | an EOQL read statement with `SIG` setting observer and budget | Revised after reading EOQL: its `SIG` sets the observer, so my earlier reading of requests as `SIG·Ground`, `SIG·Figure`, `SIG·Pattern` does not match it |

**Native, not meaningless (revised 2026-11-18).** The hash that makes `id`, the signature check, body encryption, wire framing, a clock tick and the choice of the **trust anchor** (the root key named in the frame entry) can each be described as a move and placed at a coordinate; choosing the root key is a declaration of a ground, and the recorded result of a signature check is an attestation entry. What they are not is something the log can implement on its own: a native kernel has to compute them. The root key adds one real regress, because the capability concept cannot authorise the first declaration of itself. So the earlier "outside the algebra" wording conflated three things: whether a move can be classified (probably yes for all of these), whether the log can implement it (no, the kernel does), and who is trusted first (an authority regress). The machinery events are in test set D to see whether independent readers place them consistently.

**The observation chain (stated 2026-11-18).** Every entry is a move on a perceiver, read in a context: what was reported (`of`), what the writer could have known when writing (`seen`, the causal frontier, the "lightcone"), who recorded it (`by`), and the reading replica's own position, which is where EOQL's `SIG perceiver` and `horizon` stand. A record of an entry is itself an entry with its own `seen`, so the chain continues; it is folded only as deep as a question needs. Entries outside each other's causal past are concurrent and, on the same slot, are reported as held. Identical bodies in different contexts are different entries (the `id` covers `by`, `at`, `basis` and `seen`), as with Menard's verbatim chapters. The claim that placement depends on this chain is tested by set P in the pre-registration (rule 8c), first two levels only.

**Rules.**
1. A concept whose derivation cannot be written in cells is not a concept; it joins the list above and needs a reason.
2. A replica with no pack still verifies ids, syncs and folds, but must **fail closed**: it refuses to serve any namespace whose access rule it cannot interpret.
3. Authority is never a primitive; it is a fold over the capability concept.
4. **Status of the cube claim (revised at wrap-up, 2026-11-18): a design principle, not a tested result.** A blind-agreement study was designed (`pack-agreement-test-prereg.md`, 140 items, written and then shelved) and not run, because nothing in the first release depends on it. Earlier label sets survived shuffling 95.7% of the time, so the derivation table is one reader's nomination. The one engineering reason to check labels is that the `cell` field changes fold order and conflict reporting, so a cheap check that independent writers give the same cell to the same event is still worth running on the pack concepts; the per-axis necessity test is design only.

## 6. Handshake

1. **Find** via discovery adapter.
2. **Connect** under a versioned protocol ID (`pharos-net/1`, `pharos-net/0`). Reliable, ordered, bidirectional bytes.
3. **Authenticate transport.** Iroh and Matrix already do. Otherwise Noise XX (WTP rule: encrypt if and only if the channel is not already encrypted).
4. **Hello.** Frame, versions, protocol IDs. Highest common version or close.
5. **Prove.** Capability chains; receiver key must equal the authenticated device key.
6. **Advertise and intersect.** Writers and namespaces covered by the caller's capabilities only.
7. **Sync.** Per writer: compare heads, send the missing suffix, verify each `id` and signature. Use range-based reconciliation (Willow-style) only for areas where per-writer heads are too coarse.
8. **Live.** `subscribe` for new wefts.

## 7. Storage, Matrix's role, and sealed regions (decided 2026-11-18)

- **Storage:** the pharos log on its own store. Matrix is not storage. eodb's own limits (no hard delete, client-side search, 500 MB browser heap) stop applying.
- **Matrix keeps:** accounts and login, group membership, delivery of namespace keys, optional notify channel or small-event carrier.
- **Authority sits in the log** (capability entries). Matrix membership is a synced view. If they disagree, the log wins.
- **Account link is signed:** a Matrix user ID is one account identity, tied to device keys by a signed delegation entry.
- **Encryption:** one key per namespace encrypts `body`. Stored form is the hashed form, so `id` covers the ciphertext. Key rotation therefore creates a new weft that points `of` the old one. It never rewrites it.
- **Sealed regions:** a replica without the key stores and relays ciphertext but does not fold it.
  - Sealed is not empty. Every answer carries a denominator: N readable, M sealed not read.
  - Sealed blocks hash identically on every replica, so replicas can agree on holding them without reading.
  - The keys held are part of the standpoint. Answers state which namespaces were readable.
  - The "stop at differences that make no difference" shortcut works only inside what you hold keys for.
- **Clear versus encrypted fields (open).** `cell`, `kind`, `addr`, `of`, `seen` and `by` in clear let relays route and verify but leak who did what to what and the causal shape. Encrypting more costs relay help with sync.
- **Permanent deletion (decided 2026-11-18):** deletion is allowed and real. The content is destroyed and a tombstone weft stays, saying what was deleted, by whom, when, and under which capability. Three mechanisms. The first is the default and fixes the two problems found in review (guess-confirmation, and the PHB1 hash chain); the others cover what it cannot:
  1. **Detached salted bodies (default for all new wefts, `v:2`).** The body never lives inside a chained record.
     - **Header and body.** The weft header carries `bodyc = sha256(salt || body)`, with a random salt of at least 16 bytes. `id` is the hash of the header including `bodyc`, not of the body. The salt and body are stored together in a hash-addressed blob store **outside** the chained `.phb` file, addressed by `bodyc` (never by a plain hash of the body).
     - **Deleting** is unlinking that one blob file, plus appending a tombstone weft whose `of` points at the target. The ENTRY record, its `id` and every later chain value stay exactly as they were. Nothing is stripped, nothing is recomputed, and no one's cached heads go stale.
     - **Guessing:** a stranger holding the header sees only `bodyc`. Without the salt (deleted with the body) a guess at the content cannot be tested, even for a low-entropy body such as "yes". The tombstone carries no hash of the body and no length. Sealed bodies already contain a random AEAD nonce, so they are salted too.
     - **Space:** reclaims the whole body and leaves a header of a few hundred bytes plus a short tombstone.
     - **Why not use pharos's own BLOB records:** they are chained records inside the same file, so deleting one breaks the chain for every later record. External storage avoids that. Pharos's own `putBlob` therefore must not be used for deletable content **[verify against the lib]**.
     - **Cost:** a new weft version, and every reader must handle bodies that are absent. Old v1 wefts stay as written and are read by a versioned reader (principle 3).
  2. **Crypto-shredding.** Encrypt bodies under per-object (or per-folder) keys. Deleting means destroying the key and appending a tombstone weft whose `of` points at the target. The ciphertext stays on disk unless also dropped, so this alone saves no space. Use it together with body drop on disks you control, and alone only where you cannot reach a copy (a peer's disk, an old backup), where the copy is unreadable for good. The original weft's `id` still verifies because its bytes did not change. This needs no change to the weft format, and it is why sealed namespaces should be the default wherever deletion matters. A single key per namespace can only delete the whole namespace, so keys must be finer-grained than v1.1's "one key per namespace".
  3. **Compacting a legacy `v:1` weft (the only exception to principle 2).** v1 bodies are inline and inside the chained record, so there is no clean way. Replace the body with a null marker and rewrite the writer file. Pharos's rules show what must change:
     - **Chain (read from SPEC.md):** each record's chain value is `sha256(prevChain || kind || payload)[0:8]`, per file, from a genesis derived from the writer name. Changing one payload changes that record's chain value and every later one, and a reader stops at the first mismatch. So the rewrite recomputes the chain for every record from the change onward. Chain values are local tamper-evidence only, never identities. **Rule: sync heads and anything sent to peers use weft `id`s and counts, never chain values**, so a rewrite invalidates nothing remote.
     - **`id` mismatch:** pharos "reports, never reads" an entry whose stored `id` does not match its content, so a stripped v1 entry would be rejected. The reader must be changed to accept a stripped entry that has a valid tombstone.
     - **Recorded transition:** the tombstone records `was` (old `id`), `now` (hash of the entry as stored after stripping), who deleted it and under which capability. Anyone holding the stripped entry can check `now`. Trust in `was` rests on the tombstone's signature and capability, since nobody can recompute it.
     - **Guessing cannot be fixed for plaintext v1.** Other wefts already cite the old `id` through `of` and `seen`, so `was` is public and cannot be hidden. An unsalted low-entropy plaintext v1 body can therefore be confirmed by anyone who can guess it and knows the header. Mitigation: do not use this path for sensitive plaintext. v1 bodies that were sealed carry an AEAD nonce and are fine.
     - **Space:** a rewrite copies the file, so budget temporary space equal to the writer file. It reclaims the bodies but costs time, which is why v2 is the default.
     - **Pharos has no compaction today** (SPEC.md says only that the log is append-only and that damage is handled by appending MARKER and RESYNC records). This is new work in pharos.
  - **What a purge claims:** the network stops holding the bytes and cannot read them. It does not claim the bytes are gone from a receiver's disk or from a backup someone took earlier. The interface says so.
  - **Who may delete:** the weft's author, or a holder of a capability that grants delete on that area. Both are checked from the log.
  - **Propagation:** a tombstone replicates like any weft. A replica that receives it destroys its key or bytes. A replica that never receives it keeps the content, so there is no guaranteed erasure.
  - **Pharos today:** only `retract`, which hides but erases nothing. Deletion is therefore new work, in the network layer (and in pharos if the body-drop path is used).
  - **Lifecycle:** offer, receipt, purge, tombstone from the pitch is recorded as wefts. An earlier erase design (payload removed, tombstone stays) appeared in session notes and was not re-read **[verify]**.
- **Ownership, gifts and leases (decided 2026-11-18).**
  - **Owner.** The account that authored an entry (in a communal namespace, the subspace owner). The owner may permanently delete their own entries at any time. Nobody else may, unless the owner delegates a delete capability. Whether a shared folder's owner may delete a collaborator's entry is open.
  - **Gift (given away).** The recipient gets a copy that becomes theirs: a new entry they author in their own space (`INS·Figure`), with `basis` citing the original id. The owner's later deletion does not affect it.
  - **Lease (access that can be withdrawn).** The recipient gets a revocable grant (`CON·Figure`) and a leased copy of the per-object key with an expiry, delivered out of band. Withdrawal (`SEG·Figure`) or the owner's delete ends it: compliant replicas destroy the leased key and stop serving, and at best the recipient keeps ciphertext they cannot read.
  - **Owner's delete** destroys the owner's key and appends the tombstone. Leases end with it; gifts survive.
  - **Limit, stated plainly.** Whatever a lessee decrypted or copied while the lease ran stays with them, and a hostile client can keep a leased key. The system guarantees only that compliant software loses access and that the owner's key and ciphertext are destroyed. A stronger lease (the key never leaves the owner or a custodian; each read asks the owner) is possible when the owner is online, at a cost in availability and metadata. The interface says: a gift means they keep it; a lease means they lose access but may keep what they already saw.
  - **Per-object keys live outside the log**, in a key store, delivered out of band. They are never wrapped inside the log, or every holder of the wrapping key could unwrap them forever and crypto-shredding would do nothing.
  - **Delete order:** append the tombstone, destroy the key and confirm, unlink the ciphertext, append a receipt. A crash at any step is safe (key gone and file present is unreadable; file gone and key present is harmless), and the watcher finishes the job.
- **Space is the main constraint (stated 2026-11-18).** Deletion has to free disk, so:
  - **Dropping the body is the default** on every replica you control. Crypto-shredding alone frees nothing.
  - **Keep bodies apart from headers** (mechanism 1). Pharos today keeps `body` inline, and an append-only file does not shrink in place. Detached `v:2` bodies make deletion one `unlink`, leaving a small header and a tombstone. Legacy v1 needs a file rewrite.
  - **Tombstones must stay small.** One short weft per deletion. Many deletions can be summarised by a signed range tombstone ("these N ids were deleted"). Compacting old tombstones is allowed only once every known replica has acknowledged them; deleting a tombstone loses the proof (open question).
  - **Relays and sealed blocks cost space too.** A relay holding ciphertext it cannot read may drop the body after receipts arrive (the blob lifecycle), keeping only the header.
  - **Slices bound the footprint.** A replica holds only its slice, so a small device never carries the whole log.
  - **Not measured:** pharos reports PHB1 at about 56.7% of JSONL size for 20,000 entries. Nobody has measured how much of a real log is body versus header, which decides how much deletion can save. Measuring that on a real log is the first thing to do.
- **Cost accepted:** we own sync, offline handling and key management.

## 8. Identity, capabilities and grounds

- **Signing identity: device key** (decided). It equals the Iroh EndpointId, so the transport-authenticated peer is the capability receiver. An account key delegates to device keys by capability. DIDs deferred.
- **Capability format: Meadowcap** (Final, 21 Nov 2025): delegable, restrictable by subspace, path and time. Owned namespaces for shared spaces, communal for per-person; one model per namespace.
- **Revocation (ours):** a signed revoke entry plus an expiry on every capability. It cannot unsend what a peer already holds. Say so in the UI.
- **Grounds and disputes (decided).** Inside a namespace the root key asserts the ground and the contradiction rule. Across owners there is no global winner: `fold(events, standpoint)` is pure and every answer is stamped with its standpoint. Pharos already reports conflicts without resolving them; the new part is that an unresolved clash also emits a dispute entry naming the conflicting ground entries and keys. "Contested" is a normal state to show.
- **Bylines carry the account key and the device key.** Grounds are asserted by accounts; devices sign for them. In pharos terms this goes in `by` plus the signature sidecar.
- **Frame and standpoint:** `frame.assumed` is where cross-frame identity claims already live. Open whether a standpoint is stored there or as its own entry (section 11).

## 9. Carriers

| Seam | Iroh | Matrix | Reticulum |
|---|---|---|---|
| Discovery | EndpointId via lookup service you run, relay fallback | Room or user ID | Destination hash via announce |
| Carrier | QUIC stream per request, routed by ALPN | Room events carrying wefts as ciphertext (small events, notify) | Links, small wefts only |
| Transport security | Endpoint key | Olm and Megolm | Built in; stack license blocks use |
| Swarm | iroh-gossip topic | Room membership | Announces |

## 10. Dependencies

| Dependency | State on 2026-11-18 | Policy |
|---|---|---|
| iroh core | 1.0.0 on 2026-06-15, latest 1.4.2, none yanked, a minor every 2 to 4 weeks | Pin a minor. Fixtures on each bump |
| iroh-blobs | 0.105.0 (2026-11-13); 0.99 to 0.103 yanked 2026-10-06 and replaced | Behind the blob adapter. Pin exact. Read yank notes **[verify]** |
| iroh-gossip | 0.103.0 (2026-11-16) | Behind discovery. Pin exact |
| Meadowcap | Spec Final | Adopt the format; library later |
| Willow Transfer Protocol | Proposal, 16 Oct 2026 | Borrow the design only |
| Confidential Sync | Proposal, paused | Reference only |
| Reticulum reference stack | License bars use in AI models and datasets, and in harmful systems; probably not OSI open source | Do not depend. Write to the protocol; ports **[verify licenses]** |
| matrix-js-sdk / Rust crypto | Used by eodb today | Pin. Only `client.js` touches auth, sync and crypto |

Iroh's roadmap page is stale; use crates.io.

## 11. Build order

0. **Storage seam in pharos (the foundation under all of it).** eodb runs in a browser; the pharos library is Node-only (23 `fs` calls in 443 lines, the rest pure: canonical JSON, `entryId`, `weave` logic, causal fold, merge). With Matrix no longer where the data is stored, the browser needs somewhere to keep a replica. The seam is two operations per writer (read the lines, append a line), so the same core can run over IndexedDB or OPFS. This is a change to the pharos repo, which every repo shares, so it needs the owner's yes and pharos's own tests. Pass: the existing pharos tests pass unchanged on the file backend, and the same fold hash comes out of a second backend.

1. **Exit ramp from Matrix.** eodb's `fold.js` takes timeline events and returns state without calling Matrix APIs, so it is the portable piece. Write an exporter that replays eodb Matrix events into pharos wefts. Mapping is in 5b (all Figure grain, schema DEF at Ground). First task: resolve the idempotent-export problem (5b item 1). Pass: the folded state from the original room and from the exported pharos agree, and a second export of the same room adds no new wefts (idempotence by lookup, see 5b).
2. **`v:2` weft and detached body store.** Define the header (`bodyc`, salt length, canonical JSON for `id`), the external hash-addressed blob store, and a reader that treats a missing body as "deleted or not fetched", never as corruption. Check that pharos's reader tolerates an unknown `v` **[verify]**. Pass: delete a body, append its tombstone; the entry's `id`, every later PHB1 chain value and the fold of everything else are unchanged, and the fold shows the deleted entry with a visible mark.
3. **Fixture harness.** Fixed weft set including `v:2` wefts with present, missing and deleted bodies, replayed through two mock carriers, fold hash must match. Pharos's deterministic ordering is the oracle.
4. **Signature sidecar and capability entries.** Pass: unsigned or wrongly signed wefts are refused at foreign receipt; a revoked device gets no new wefts on either carrier.
5. **Real carriers.** Iroh and Matrix carrying wefts (headers first, bodies on request). Pass: byte-identical fold hash.
6. **Sealing.** Per-object body encryption inside the detached body, sealed denominator in every answer. Pass: replica without key reports "M sealed not read" and agrees on sealed block hashes.
7. **Migration in.** Importers that turn an existing database into wefts with `basis` recording the source and instrument version. **Found:** this is EOQL amendment A1 (`pharos/eoql/SPEC-A1.md`): `parse` turns one SQL statement into EOQL and reports unsupported constructs as named gaps instead of guessing; `compile` turns EOQL into SQL for five dialects. BUILD_NOTES.md reports a translator covering 31 declared constructs, 80 passing unit tests, 46 of 48 sample queries matching SQLite, only SQLite executed, and SQL writes, `DISTINCT ON`, MongoDB and Pandas not built. The spec says it is a specification, not a result; its pre-registered claims (C1 to C4) have no reported results. This step becomes: use EOQL A1 as the importer for SQL sources, and write the data-row importer and the verification step around it.
8. **Delete lifecycle** on the body store: offer, receipt, purge, tombstone, signed range tombstones, and the legacy `v:1` compaction path (rewrite, recompute chain, tombstone with `was` and `now`) only if old data must be deleted.
9. **Third carrier** after the Reticulum license is settled; compute offload last.

Steps 1 to 5 are the first release.

## 12. Open questions

- [x] Signing identity: device key, account key delegating.
- [x] Grounds dispute: section 8.
- [ ] Device-key loss and rotation (and how that interacts with signature sidecars of old wefts).
- [ ] Standpoint: stored in `frame.assumed` or as its own entry; default standpoint per pharos.
- [ ] Clear versus encrypted weft fields.
- [x] eodb operator-to-cell mapping: proposed in 5b. Needs your sign-off on schema DEF at Ground, and on SYN and REC at Figure.
- [ ] Foreign-receipt path in pharos: can pharos accept wefts with caller-supplied `at` and `seen`, or must the exporter write writer files directly (5b item 1)?
- [x] Permanent deletion is allowed, with a tombstone (section 7).
- [ ] Tombstone lifetime and who may compact them. A tombstone that is itself deleted loses the proof that a deletion happened.
- [ ] Key granularity for crypto-shredding: per object, per folder, or per author. Finer keys mean more key management.
- [ ] How a deleted weft folds: as absent with a "deleted" mark (recommended), so dependents through `of` show a visible gap and not a silent hole.
- [ ] Namespace granularity: per person (communal) or per shared folder (owned). Also how a namespace relates to a pharos, a frame and `addr`.
- [ ] Is `advertise` ever public? Current answer: no.
- [ ] Revoke effect: from its position in the fold or retroactive.
- [ ] Padding policy for message sizes.
- [ ] Per-writer file model versus many devices per account: one file per device key?
- [x] Concept declaration cell: a `kind` entry at `DEF·Figure`, as pharos and EOQL both do (5c corrected 2026-11-18). Open: whether each concept's derivation view should be required, and whether a kind may be declared without one.
- [x] Kernel facts, time and effects: resolved without changing EOQL (kernel `attest` entries, a `:now` parameter, a watcher with receipts). See the trial in 5c.
- [x] A delegation chain with expiry, attenuation and revocation written as an EOQL view: works on a test log (5c). Still to do: real signatures, a revoker-authority rule, and the same view over `v:2` wefts.
- [ ] EOQL's slot grain is `(addr, kind)` while pharos-sqlite uses `(addr, cell)`; this decides what counts as a dispute.
- [ ] The 14 cells the pack leaves empty have proposed roles in `cube-roles.md` (nominations; the study that would test them is shelved, so treat them as design notes). Groups, bulk cuts, the membership graph and group re-keying are the main gaps.
- [ ] The cryptographic erasure paper is summarised with byte addresses in `sources/sok-erasure/THEORY.md`. It confirms the salted `bodyc` design (its "hiding anchors" rule), says an expiry alone is not erasure, and says backups are the real erasure window. It is a single-author preprint from a vendor; treat its claims as unreviewed.
- [ ] Pack trust: who signs the shipped `network/1` pack, and is it the default standpoint of a new pharos?
- [ ] Bootstrap: the frame writer's key is the trust anchor, so how does it hand authority to a pack, and how is a lost root key recovered?
- [x] Which cells pharos uses for its own kinds (read from `lib/pharos.mjs`): `frame` = `NUL·Ground`, `kind` = `DEF·Figure`, `holon` = `DEF·Pattern`, `retract` = `NUL·Figure`. So a concept declaration is a `kind` entry at `DEF·Figure` (not `INS·Ground`), a tombstone as `retract` at `NUL·Figure` matches the derivation table, and `network/1` kinds (`grant`, `revoke`, `attest`) declare their own cells with `{name, cell}`. 5c now matches.
- [ ] Optional, small: a label-consistency check on the `network/1` pack concepts (independent writers, same event, same cell?). The full blind-agreement and perspective-shift study is shelved (5c rule 4).
- [ ] `v:2` details: salt length (at least 16 bytes), exact header layout, and the canonical JSON rule shared by `id` and `bodyc`.
- [ ] Body store: where it lives on each device, whether peers replicate it by default or only on request, and how long a header-only replica waits before showing "body not fetched".
- [x] Delete authority: the author may always delete; a delegated delete capability is a `network/1` concept, since Meadowcap has only read and write modes.
- [ ] Shared folders: may the folder owner permanently delete a collaborator's entry, or only the author?
- [ ] Lease strength: cooperative (key leased to the recipient's device) or custodian-mediated (each read asks the owner), and which is the default.
- [ ] Threats still to write into the spec: clear-header metadata, authenticated encryption over the header, padding, key backups, derived-data purge, resurrection by a replica that missed the tombstone, and the two-phase delete.

## 13. Not verified

- The doors and gate code, any existing erase design, and pharos's canonical-JSON rule for `id`.
- (Settled 2026-11-19 from the eodb source: all seven event types, the anchor hash (cyrb53), and that REC identifies nothing it replaces. Still open: pharos's canonical-JSON rule for `id`, and whether `weave` can take a caller-supplied `at` and `seen`.)
- Whether pharos defines a fold hash.
- PHB1 BLOB record semantics and chain behaviour on merge (the chain formula itself was read from SPEC.md; whether pharos's reader tolerates an unknown weft `v` was not).
- The body-versus-header size split of a real log, which decides how much deletion saves.
- Reasons for the iroh-blobs yanks; private-interest-overlap spec; Reticulum port licenses.
- EOQL's source under `eoql/src` (I read SPEC, A1, A2 and BUILD_NOTES only; the last third of SPEC was read, but the PREREG claim results and the other roles' reports were not).
