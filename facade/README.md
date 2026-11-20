# db.mjs: say and ask over a pharos, and a shared notebook for coding sessions

Small dependency-free Node tools over the public pharos repo (`db.mjs` the commands, `store.mjs` the two stores, `sig.mjs` the derived SIG index, `vault.mjs` sealed bodies and keys, `stig.mjs` the shared notebook). Prototype, written 2026-11-18.

## Quick start: sessions that share notes (the one use case)

Several Claude Code sessions work in one project. Each leaves short notes about what it learned, what it is changing, and what was decided. A new session reads one short brief instead of re-reading the files.

```
# once per machine
git clone https://github.com/scores-patch-points/pharos.git ~/pharos
export PHAROS_SRC=~/pharos                  # put this in your shell profile

# once per project
cd your-project
node /path/to/facade/db.mjs init            # creates .pharos/ and adds a block to CLAUDE.md

# then: just start Claude Code sessions in that folder
```

`init` makes four things and changes nothing else: `.pharos/log/` (the notebook, on the lazy store), `.pharos/db` (a wrapper so you type `./.pharos/db`), `.pharos/hooks.example.json` (optional), and a marked block in `CLAUDE.md` that tells every session what to do. Run `init` again any time; it never duplicates the block.

What a session is told to do (from the CLAUDE.md block):

| When | Command |
|---|---|
| Start | `./.pharos/db brief` |
| Learned something others need | `./.pharos/db note <topic> "<one or two sentences>" --files a.js,b.js --session <task-name>` |
| Before a big change | `./.pharos/db claim "<what>" --session <task-name>`, then `release` when done |
| A note was right | `./.pharos/db verify <topic> --session <task-name>` |
| A decision was made | `./.pharos/db decide <topic> "<decision and why>" --session <task-name>` |

Why it works without anyone coordinating (the stigmergy part): sessions never talk to each other. They read and add marks.
- A note records the **hash of each file it names**, so the brief marks it `FRESH`, `STALE` (a file changed) or `MISSING` (a file is gone). A session can trust fresh notes and re-read only the rest.
- **Claims** carry an expiry. Two sessions claiming the same work show as a `CONFLICT` in the brief, not as one silently winning.
- Two sessions writing different notes on one topic show as `CONTESTED`. Nothing is overwritten.
- **Unverified notes fade** after 7 days; a note someone verified stays.
- Each session writes only its own files, so sessions never collide.

Optional: to inject the brief automatically at session start, copy the hook from `.pharos/hooks.example.json` into `.claude/settings.json`. It runs a command at every session start, so read it first. `init` does not edit your settings.

A run on a synthetic 3-file project (45,000 bytes of source): the brief covering all three was **564 characters**, about 80 times smaller than the files its notes stand in for. That is a size comparison on made-up files. Whether real sessions save tokens depends on whether they would have read those files in full, and on the notes being correct. The brief says "about N tokens at a rough 4 bytes per token" and nothing more precise.

## The general commands

| Verb | Cell it writes | Meaning |
|---|---|---|
| `add` | `INS·Figure` | make something exist |
| `set` | `DEF·Figure` | give it a value |
| `cut` | `SEG·Figure` | cut it off |
| `link` | `CON·Figure` | relate two things |
| `merge` | `SYN·Figure` | combine |
| `check` | `EVA·Figure` | test against a standard |
| `reread` | `REC·Figure` | read under a new meaning |
| `hold` | `NUL·Figure` | do nothing, on the record |

```
db say add contact:ana '{"name":"Ana"}' --dir ./data --writer me
db get contact:ana --dir ./data [--history]
db ask 'SEG(sources; kinds: ["contact"])' --dir ./data --card
db ask '...' --as w1,w2                     # standpoint: only these writers are visible
db ask '...' --horizon writer:w2            # only what w2's latest entry could have known
db ask '...' --cached                       # reuse the answer while the log is unchanged (expressway)
db compare '...' --as w1 --vs w2            # what only one standpoint sees
db who --dir ./data                         # writers you can choose from
db trace <id|addr> --dir ./data             # walk the of-chain by positioned reads (wormhole)
db view <name> '<expr>' --dir ./data --writer me
db forget <addr> --writer me                # hides your own entries
db say add secret:x '{"n":1}' --seal --writer me      # body encrypted under its own key, kept outside the log
db forget secret:x --permanent --writer me            # tombstone, destroy the key, remove the ciphertext, receipt
db finish --writer me                                  # completes an interrupted permanent delete
db kind <kind> --dir ./data                 # a kind, by whichever path is estimated cheaper; db review checks the estimates
db sig [status|rebuild] --dir ./data        # the derived read-time index (safe to delete)
db marks on --dir ./data                    # record attention as SIG marks (off by default); db trails, db promote read them
db keys --writer me --dir ./data            # create a signing key; later entries are signed
db verify --dir ./data                      # audit signatures (ordinary reads never check them)
```

A directory's store is detected from what is in it. A new directory is `plain` unless you set `DB_STORE=lazy` (`init` uses lazy). Your later statement of the same kind at the same address supersedes your earlier one; saying identical content again does nothing.

## Two stores

- **plain**: pharos's own writer files. Every write re-folds the log, so it slows as the log grows.
- **lazy**: pharos-lazy's placed store (vendored in the pharos repo). A write never loads the log. It does not compute `seen`, the writer's causal frontier, so the facade supplies it from a cached frontier kept by the SIG expressway. See [SIG.md](SIG.md): what the three kinds of SIG are, what your earlier synapse and wormhole work actually defines, what this index is and is not, and the measurements.

## Tests

109 tests, all passing on 2026-11-18 on **both stores**, against a clone of the pharos repo at that date:

```
DB_STORE=plain|lazy PHAROS_SRC=... node --test test.mjs test-vault.mjs test-stig.mjs test-sig.mjs test-sign.mjs test-marks.mjs test-shortcuts.mjs test-vfiles.mjs test-vfmanage.mjs test-plain.mjs
```

- **Say and ask (15):** the verb table points only at real cells; kinds are declared on first use; identical content is one entry; disagreement is contested; stored views; standpoint (one writer, contested versus determined, compare, a horizon excluding later entries, through views).
- **Sealing and delete (10):** a sealed body never appears in the log; the commitment is salted; ciphertext lengths fall in size classes; a moved or altered ciphertext is rejected; only the owner can permanently delete, and only sealed entries; an interrupted delete is finished by `db finish`, and running it again does nothing.
- **Shared notebook (11):** init is idempotent and keeps an existing `CLAUDE.md`; fresh, stale, missing; claims conflict, release and expire; unverified notes fade; the brief respects a size limit; the wrapper works from a subfolder.
- **Signatures (8):** a key is made once, kept outside the log with owner-only access, and pinned; entries written after a key exists are signed and verify; swapped, forged or re-keyed signatures are caught by the audit; ordinary reads never check signatures; adopting a published index is refused unless the publisher is trusted, the signature verifies, the position is current and adopting is cheaper than rebuilding.
- **Shortcuts (12, four of them for use-driven strengthening and pruning; derived entries live in the deletable `<log>.derived/` cache, and are forgotten when their evidence evaporates):** a planted synapse pair is promoted and random pairs are not; a name bound to a referent beats the null, scattered, rare and literal names become typed gaps; promoted entries sit at their own cells by the derive writer with evidence in `basis`, and a stale binding is retracted; expressway links give identical ancestors at about a sixth of the reads, a chain with a second parent still matches the full walk, a short log writes nothing; `db trace` uses live links.
- **The plain store on pharos's binary core (5):** the plain store is a pharos in pharos's own format, which became binary (`.phr`) on 2026-11-19. The EOQL engine inside the pharos repo still lists only legacy `.jsonl` files (`eoql/src/adapters/lib.mjs`), so on the binary core its `lib:` reader sees an empty log, and its `WRITE` (declarations, stored views) appends legacy `.jsonl` lines the core ignores. The facade works around both without touching the engine: it reads a plain log through pharos's own library and hands EOQL the entries (`E.openEntries`), it moves EOQL's `.jsonl` writes into the core with pharos's own `migrate`, `position()` covers `.phr` streams so the cache key moves, trace walks `of` in memory, the read-time chooser always scans (the `.jsonl` index cannot read binary), and derived stores are always lazy. Before this, 34 of 104 plain-store tests failed; now all pass on both stores. The workaround is the facade's; the two engine behaviours are bugs in the pharos repo (not fixed here).
- **Virtual files, read by kind (6):** `vfiles.mjs` reads the `vfile` and `vfile-check` entries that Proteus writes (Proteus makes the files, EODB manages them, the pharos is the ledger), with retractions applied: built or not, checked or not, whether the check is of the CURRENT recipe, contested addresses, and what each cites. It imports nothing from any other repo, and a test asserts that. Checked once end to end: a pharos written by the file-maker's own code in one process, read correctly by this in another. 
- **Managing them (5):** `vfmanage.mjs` weaves `vfile-pin` (DEF·Figure) and `vfile-evict` (SEG·Figure) entries; Proteus reads them by kind, drops only cached chunks nothing else needs, and answers with `vfile-evicted`. `db vf status|plan|sweep|pin|unpin|evict|withdraw`. A pinned file refuses an evict request; a pending request is not duplicated; an answered one can be asked again (each request carries a nonce, because the identical request twice is one entry). **The policy is stated, not learned:** `plan` keeps the newest 3 files per project (`--keep-last N`) and proposes the rest. Checked end to end in separate processes: Proteus built two files sharing a chunk, EODB pinned one and evicted the other, Proteus dropped only the unshared chunk, EODB read the acknowledgement. EODB does not know the cache sizes or when a file was last PLAYED; the policy uses ledger order only. I used new kinds, not the pharos's `keep` and `strike`, which mean a person's mark on a statement (and `strike`'s cell is an open question in the pharos notes).
- **SIG marks (16; adds `ask`/`get`/`trace` deposits, a difference-driven clock, evaporation):** off by default and nothing is created; with marks on a read records one mark of each SIG kind, each at its own cell; marks never change an answer or the log; trail strength is deterministic; the held-out check (pure function) promotes, demotes or leaves undecided as designed; a promoted verdict overrides an estimate that says scan, a demoted one overrides an estimate that says direct, and the rows stay right; only the reader's own marks count; every fifth read runs both paths and records both costs; a forced strategy is never overridden; a mark that cannot be written is reported and the answer is unaffected.
- **Read-time index (13):** the cached frontier equals heads worked out independently; a scan after one more write reads only the new bytes; saved state is reused and rebuilds to the same thing; a torn last line is not read, and a shrunk file or rewritten tail forces a rebuild; a memoised answer is reused only while the log is unchanged and always equals the uncached answer; reading by kind returns the same rows as a full scan; a walk along an `of` chain reaches the same ancestors as the query engine; the index never changes any answer.
- **Bugs the tests found and I fixed:** releasing a claim used to hide every session's claim at that address; two quick successive `set`s were ordered by clock time on the lazy store.

## Scale, measured on one machine (a probe, not a benchmark)

| | Plain log | Lazy store through this tool |
|---|---|---|
| Time per write | 0.4 ms at 500 entries, 2.3 ms at 5,000, **11.3 ms and still rising at 15,000** (170 s for 15,000) | **about 2.5 ms, flat to 30,000** (77 s for 30,000) |
| Read everything | 411 ms at 15,000 | 916 ms at 30,000 |

A raw probe of the lazy store without the facade (one EOQL write per entry) ran 100,000 entries in 48 s (0.26 ms rising to 0.72 ms per entry); one address read in 50 ms and all 100,000 rows in 3.9 s. Writes are now flat; reads still scan. Measured at 30,000 entries: a cached answer is about 3 times faster on a quiet log, a rare kind read directly is about 3 times faster than a scan, a 1,000-link chain walk is about 5 times faster, and a common kind is no faster (the chooser takes the scan). The index file is about half the size of the log. Details, and where the chooser's estimates were wrong, are in [SIG.md](SIG.md).

## What is not built

- **Signatures prove who wrote an entry, not that it is true,** and only entries written after `db keys` are signed. Key rotation and revoking a trusted writer are not built.
- **SIG marks are partial.** The three kinds are recorded as real entries and a held-out check promotes or demotes a read path, but only kind reads write marks, marks are not shared between writers, nothing prunes them, and the shortcuts your earlier work means (a consolidated synapse edge, an identity wormhole, a path-shortening expressway) are not built. See [SIG.md](SIG.md).
- **Gifts and leases (sharing with a withdrawable grant), and capability checks.** The authority view was tried in `../eoql-authority-experiment/` but is not wired into this tool.
- **Networking.** No sync between machines and no Iroh or Matrix carrier. Sessions share a notebook only by sharing a folder on one machine.
- **Real secure erase.** Destroying a key overwrites the file with zeros and removes it, but on an SSD or a snapshotted volume that does not guarantee the old bytes are gone. The real protection is that the key store is separate from the log and should be left out of backups and snapshots. It is a plain folder (`<log>.keys`, mode 0600), not the operating system keychain.
- **Permanent delete of unsealed entries.** Their content is inside the log; say them with `--seal`.
- **A standpoint-aware `brief`.** The brief reads everyone's marks.
- It uses pharos and EOQL as they were on 2026-11-18 and was not checked against later changes. EOQL's amendment A2 (a typed cell in `declare`) is refused by the current build, so kinds are declared through the library.
