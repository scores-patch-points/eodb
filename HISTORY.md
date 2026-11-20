# History

This repository used to be **matrix-events**, a browser app that stored its data in Matrix rooms and deployed a live demo to GitHub Pages. That app is preserved, unchanged, at the tag `matrix-events-final` (`git checkout matrix-events-final`).

From here, EODB is the interface and meaning layer over a pharos: the log is the database, and everything else is derived. The Matrix app's ideas that carry over are the nine operators and `state = fold(events)`; what changes is where data lives (a pharos, with identity from device keys, not a homeserver) and that no server is special. See `README.md`, `pharos-spec-v1.md` and the pharos repository's `docs/` (`ONBOARDING.md`, `SYNC.md`, `BROWSER-STORE.md`).

The GitHub Pages deploy of the old app was removed with it; the live demo at the old URL no longer updates.

## Known gaps carried into this repo

- The SIG scanner (`facade/sig.mjs`) indexes byte-addressed `.jsonl` shards, which is what the lazy store writes. Pharos's binary `.phr` streams are not indexed, so on a plain pharos log the scanner sees no entries. It is marked `todo` in `facade/test-sig.mjs` (it passed only while the plain store wrote `.jsonl`). Reads and writes through the facade are unaffected: they fold from the pharos library.
- The facade still carries a workaround (`openRead`) from when EOQL could not read `.phr`; pharos now reads it natively, so the workaround can be removed.
