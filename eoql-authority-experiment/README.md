# EOQL authority and effects experiment (2026-11-18)

Run against a clone of the public `pharos` repo (EOQL spec stamped 2026-11-13). Nothing here modifies pharos.

- `build-log.mjs <pharos-clone> <new-dir>`: builds a log of 13 grants (root grant, delegations, an expiry, two escalations, a forged root, a bad signature, two revocations). Signature checks are written as `attest` entries by a separate writer, `kernel`.
- `q4.eoql`: the authority view: a recursive EOQL query. Run: `node <clone>/eoql/bin/eoql.mjs run lib:<dir> -f q4.eoql --param root=rootA --param now=2026-11-19T00:00:00Z`. Expected: rootA>devB, devB>devC, devB>devJ, devC>devE.
- `m1`..`m5.eoql`: mutants, each removing one rule (signature check, area attenuation, expiry, revocation, parent link). Each adds exactly the grant it should.
- `build-effects.mjs`, `owed.eoql`, `watcher.mjs`: the watcher. The view lists tombstoned items whose body file is still present; the watcher unlinks the file and appends a `gone` receipt; a second run does nothing.
- `show.mjs`: prints columns from an EOQL result.
