# EODB: instructions for AI agents

EODB is the interface and meaning layer over a pharos: the verbs, EOQL, standpoints, views, sealed bodies, permanent delete, and the read-time caches. The prototype is in `facade/` (start at `facade/README.md`, then `INDEX.md`). It also manages the virtual files Proteus makes (`facade/vfiles.mjs`, `facade/vfmanage.mjs`).

## Standing rules
These are carried from the folder this repo lives in, where they apply to every AI session. They are written here so they travel with the repo.

1. **Repos never call each other.** EODB reads and writes pharos entries by cell and kind, and nothing else crosses a repo boundary. Do not import another repo's code. A test asserts that `vfiles.mjs` and `vfmanage.mjs` import only the facade and node; keep it true.
2. **The log is the database; everything derived is a cache.** The index, the marks, the derived shortcuts and the keys sit beside a log and can be deleted without changing an answer (`*.sig/`, `*.marks/`, `*.derived/`, `*.keys/`). They are never committed. Retract by weaving, never erase. Permanent delete is only for the owner of sealed entries.
3. **Never make a clip file that is only a time-cut of a longer source.** EODB makes no media, so this should never come up; if a task would, stop and ask.
4. **A request about a person's statements, a recording, a clip or a quote goes through the editing pipeline's own tools.** EODB is not that pipeline.
5. **Keys and secrets stay out of the log, out of replies, and out of commits.** The sealed-body key store is outside the log by design.
6. **Do not push, merge or change user-level configuration without the owner's yes.** Commit only paths you can name. `sources/` holds other authors' papers: local only, never committed (only `NOTES.md` and `INDEX.tsv` are tracked).
7. **Say what you did not measure,** and record negative results with what would falsify them. Report failures with their output.

## Run
`PHAROS_SRC=<a clone of the pharos repo> DB_STORE=plain|lazy node --test facade/test*.mjs` (104 tests, both stores).
