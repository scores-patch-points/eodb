# The page on the real stack

`index.html` is the page "Your database: everything folded from the pharos log", ported so its log is a real pharos instead of an in-memory array. It is **built from the original by `port-from-original.py`**, a fixed list of exact replacements (each must match once, or the build fails): the UI and fold code are the original's. `test/oracle-fold.js` is the original's `fold()` copied verbatim and is the oracle for the tests.

## What changed underneath
| Original | Now |
|---|---|
| `LOG`: an array of the page's own entries (`op`, `body`, `prev` chain, `Date.now()`) | `LOG` is a live **view** over real pharos entries (`engine.mjs`): content-addressed, with cell, kind, address, `of` and `seen`. Creating things is `INS`, setting a value is `DEF` (so concurrent edits are held as conflicts), a retraction is `NUL`, reading a file is `EVA`, linking a column to a vocabulary term is `CON`. |
| ECDSA P-256, `ok` verified against its own key | Ed25519 through a device-key grant from an account key; `ok` means the entry counts under the access rules |
| Everything in memory: a reload loses it | Saved **encrypted** (AES-GCM) on OPFS when the device has it, IndexedDB otherwise; file contents too |
| `sha()` fell back to a 32-bit non-cryptographic hash when WebCrypto was missing | Falls back to the real SHA-256 |
| One writer | One writer id per tab (`<device>.<tab>`); another tab's changes arrive live |
| Bodies with `undefined` fields hashed by dropping them | The same normalisation, applied before the entry is made (pharos refuses `undefined`) |

## What it does not do yet
- **Seed data:** an empty space is filled with the original's demo content, as the original did.
- **Account key beside the device key:** the root seed is stored encrypted next to the device seed, so one stolen unlocked profile holds both. Recovery key, extra devices and sharing are engine work not yet wired to screens.
- **Conflicts** are kept and reported by pharos, but the page's fold shows the later edit and has no conflict screen.
- **Large files** are held in memory (all file contents load at open).
- **Verification cost:** the whole log is verified once at open; fine for hundreds of entries, to be made incremental for thousands.
- **Network:** the page still loads two libraries (parsing, spreadsheet formulas) from a CDN, as the original did.
- Run in one Chromium-based browser (OPFS and two live tabs verified); Firefox and Safari were not run.
