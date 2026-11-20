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

## Narrow screens
Below 800 px the sidebar becomes a compact sticky top bar with a menu button (it filled the whole first screen of a phone), content gets phone-sized padding, tables scroll inside their frame, document side panels stack, touch targets grow, inputs stop triggering iOS zoom, and the status bar no longer covers content. Checked at 320, 390 and about 750 px wide across the main views: no horizontal overflow, and the menu closes after a choice.

## Sharing between browsers
A space has **routes**. A share link carries the first ones, the space itself carries any announced later (as locator entries), and the app uses all of them at once: it writes to every route, reads from every route, repairs a route that fell behind, and shrugs off one that is down. The person is never asked how devices connect; the page shows only "shared, connected" or "reconnecting…". Today the one kind of route is a **blind relay** (`relay.mjs`: list, get, create-only put); more kinds plug into `adapters` in `engine.mjs`.
- **Encrypted before it leaves the device.** Segments and files are AES-256-GCM sealed with a space key that lives in the share link; the relay sees object names, sizes and timing, never contents. Whoever runs a relay learns nothing about what is in it, and no relay is built in: routes come from the page's `window.EODB_ROUTES` (default: a relay on port 8853 of the page's own host, for local trying).
- **Joining.** Opening a link on another device (or an incognito window) receives the founder's frame, schema and grants first, then takes its own grant from the invite key in the link. It never makes its own account, so everything it writes counts under the founder's account key.
- **Enforced on receipt.** Everything arriving from a route enters the log only if it counts (signed by a key the account granted); anything else waits in quarantine. Files are accepted only if their bytes hash to their name.
- **Stop sharing** revokes the link's invite. Devices already admitted lose their grants with it (revocation is strict, no time cut yet).

Try it with real separate browsers:
```
node app/relay.mjs 8853                       # a blind relay (memory only)
cd app && python3 -m http.server 8852         # serve the page
```
Open `http://127.0.0.1:8852` in a normal window, go to Pharos log, Create a share link, copy it, and paste it into an incognito window or another browser. In incognito the guest's local copy is discarded when the window closes (rejoining makes a new device); the founder's copy stays.

Tested: 12 Node tests against a real HTTP relay with fully separate storage per space (two spaces share nothing but the link), and in a real browser between two origins (`127.0.0.1` and `localhost`: separate storage, no shared state). **Not tested: actual incognito windows, other browsers, or a relay across a real network.** Limits: relay is in-memory and single-process; every member with the link can read everything (there are no per-person read scopes yet); two routes only if you run two relays; direct browser-to-browser (WebRTC), a shared folder and a file passed by hand are not built.
