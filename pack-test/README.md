> **SHELVED 2026-11-18.** These items were written but the study will not be run for now. Set D still names no perceiver and set P was never written.

# Pack agreement test: items (status: written, NOT frozen)

Written 2026-11-18. See `../pack-agreement-test-prereg.md` for the design and the fixed verdict rules.

## Files

- `items-raters.json`: the 100 items in a random order (seed 20261118) with opaque ids `Q001`..`Q100`. This is the only item file a rater may see, together with its arm's definitions sheet (not yet built).
- `idmap.json`: opaque id to original id and set. **Never shown to raters.**
- `ideas.json`: which idea each A and A2 item illustrates. Never shown to raters.
- `key-c.json`: the correct cell for each of the 12 control items (set C), taken from `cells.json`. Never shown to raters.
- `items-D.json`: the 12 decoys, written by me. **Waiting for your review.**
- `source/`: the writers' original output. `writer-inputs/`: the exact briefs and word lists the two fresh writers were given.
- `HASHES.txt`: sha-256 of the files above. Provisional; redo at freeze.

## Sets (100 items)

A 24 pack concepts, A2 28 new-cell roles, B 24 everyday, C 12 known-answer controls, D 12 decoys.

## Checks done

- Leak check on all 100 items for the nine operator names, grain names, the rarer terrain and stance words, and project jargon (word-boundary match, plurals and common suffixes): no hits after one decoy was reworded (it contained "network" and "frames").
- Ids unique; counts as designed.

## Known issues, stated before any rating

- The writer avoided any word containing a banned string (for example "folder", "release", "model") that the check does not actually forbid. Wording is slightly constrained but natural.
- I gave the set B writer a list of kinds of event to include (check against a standard, merge, split, link, change how something is read, do nothing on purpose). The brief therefore deliberately spread B across the kinds of action; B is not a random sample of everyday events.
- Four B items check something against a standard, three attach or link things, and three create something. If agreement is high only on those, that will show in the per-item results.
- Set D wording is mine and unreviewed. D-05 (choosing a root of trust) is the most arguable.
- Set A and A2 items sometimes echo the idea wording (for example "not read" instead of "empty"), which makes them easier than a fully paraphrased item would be.

## Still to do before freeze

1. You review set D.
2. I write my labels for A, A2, B and D, hash them, and record the hash in the prereg.
3. Build the three sheets (definitions, names only, swapped) and the scorer, hash the scorer, and run no rater before all hashes are recorded.
