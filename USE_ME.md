# USE ME — a build kit for AI coders

You are an AI coding agent. You have been pointed at this repo to build an app
on top of it. This file is everything you need to do that correctly the first
time: the mental model, the exact API, the wire format, the rules you must not
break, and how to ship it to the live URL.

Read this top to bottom once. Then build. For prose depth see
[`BUILDING.md`](./BUILDING.md); for the memory budget see
[`MEMORY.md`](./MEMORY.md); for the pitch see [`README.md`](./README.md).
**Live demo:** https://scores-patch-points.github.io/eodb/

---

## 0. What this is, in 30 seconds

This is **not** a chat client and **not** a framework you extend. It is a
finished data layer:

- **A room is a table.** You create one per workspace/customer/case.
- **An event is a row-change.** Every mutation is one of **seven typed
  operators** appended to the room's encrypted timeline.
- **State is never stored — it is folded.** `state = fold(timeline)`. Replay
  the log, get the current state. Same events in → same state out, on every
  device and in every app that shares the namespace.
- **There is no backend.** No API server, no database, no auth service, no
  secrets to leak. The user brings a Matrix account; the homeserver only ever
  stores ciphertext (Megolm E2EE is forced on every room this repo creates).

Your whole job: **pick a namespace + taxonomy, render `state`, emit operators
on user input.** Everything below `src/` is done — auth, crypto, sync,
federation, offline outbox, encrypted media, state projection.

```
  user action ──► emit(operator) ──► append to encrypted room timeline
                                              │
                                  sync / federation (handled)
                                              ▼
  render(state) ◄── state = fold(timeline) ◄── onTimeline / onDecrypted
```

If you ever reach for a second source of truth alongside the fold, or a
server-side anything, **stop** — you have left the model.

---

## 1. The minimum viable app (copy this)

```js
import { login, unlock, hasLocalAccount } from './src/client.js';
import { setNamespace, ins, def, seg, con, eva } from './src/operators.js';
import {
  createRoom, discoverRooms, getTimeline, loadFullTimeline,
  onTimeline, onDecrypted,
} from './src/rooms.js';
import { fold, initial, stateHash, entitiesOfType } from './src/fold.js';

// a. Identity of your app on the wire. Set once, at boot. (See §5.)
setNamespace('com.acme.tasks');

// b. Authenticate. You do not store credentials; there are no API keys.
if (await hasLocalAccount(userId)) await unlock(userId, password);
else await login('https://matrix.org', '@me:matrix.org', password, { persist: true });

// c. Create a workspace (first run) or find existing ones (returning user).
const existing = discoverRooms('tasks.workspace');           // → discovery records
const roomId = existing.length
  ? existing[0].roomId                                       // record → .roomId field
  : await createRoom('My tasks', 'tasks.workspace');         // returns the roomId string

// d. Seed: load full history, fold once, render.
await loadFullTimeline(roomId);
let state = fold(getTimeline(roomId));
render(state);

// e. Live: re-fold on every new event AND on late decrypts. Both matter.
let last = stateHash(state);
const refold = () => {
  state = fold(getTimeline(roomId));
  const h = stateHash(state);
  if (h !== last) { last = h; render(state); }   // skip no-op re-renders
};
const offA = onTimeline(roomId, refold);
const offB = onDecrypted(roomId, refold);

// f. Every UI action is an operator emission. Never mutate `state` by hand.
async function addTask(title)        { return ins(roomId, 'task', { title }); }
async function setStatus(a, s)       { return def(roomId, a, 'status', s); }
async function archive(a)            { return seg(roomId, a, 'archived'); }
async function blockedBy(a, b)       { return con(roomId, a, b, 'blocked_by'); }
async function review(a, ok)         { return eva(roomId, a, 'done', ok ? 'pass' : 'fail'); }

// g. Read for rendering — always derive from `state`, never from the network.
function render(s) {
  const tasks = entitiesOfType(s, 'task');   // → array of entity objects
  /* paint the UI from `tasks` */
}
```

`createRoom` returns `roomId` as a string; `discoverRooms(...)[i].roomId` is
the field on a discovery record (see §3). That is the entire loop. There is
nothing else to wire.

---

## 2. The seven operators — what to emit, when

`NUL` (observe) and `SIG` (attention/presence) are ephemeral and never hit the
log, so they are not exported. These seven are, from `src/operators.js`:

| Emitter | Op | Wire content | Use it when |
|---|---|---|---|
| `ins(roomId, entityType, payload?)` → `anchor` | INS ● | `{ anchor, entity_type, payload }` | Create a new entity. Returns a content-addressed anchor id. |
| `def(roomId, anchor, path, value)` | DEF ⊢ | `{ anchor, path, value }` | Set a field (dot-path) on an entity. **~80% of your emits.** |
| `seg(roomId, anchor, partition)` | SEG ｜ | `{ anchor, partition }` | Move an entity to a partition — column, bucket, `'archived'`, `'trash'`. |
| `con(roomId, srcAnchor, tgtAnchor, relType)` | CON ⤫ | `{ source_anchor, target_anchor, relation_type }` | Typed link between two existing anchors. |
| `syn(roomId, inputAnchors, output)` | SYN △ | `{ input_anchors, output }` | Merge several anchors into a new synthesized entity. |
| `eva(roomId, anchor, criterion, result, note?)` | EVA ⊨ | `{ anchor, criterion, result, note }` | Record a judgment (pass/fail/hold + note) against a criterion. |
| `rec(roomId, scope, beforeFrame, afterFrame)` | REC ◉ | `{ scope, before_frame, after_frame }` | The *meaning* of a field/frame changed (schema reinterpretation). Rare. |
| `defSchema(roomId, path, value)` | DEF ⊢ | `{ anchor:null, path:'_schema.'+path, value }` | Publish schema into the log (see §5.4). |

> REC's glyph is ◉ (a ring around a filled circle: the retraced run kept as record, inside a new open frame). It was ⊛ until 2026-10-06. Events stored earlier keep ⊛; read both as REC. See the EO wiki, "Operator Naming".

All emitters are `async` and return the local txn id (string) except `ins`,
which returns the new `anchor` (string). Anchors look like
`task_1a2b3c4d` — `\`${entityType}_${hash}\`` of the creation content, so an
identical INS is idempotent.

**Dependency order** `INS → SEG → CON → SYN → DEF → EVA → REC`. The fold is
permissive: it never blocks, but it records violations in `state._violations`
(e.g. `DEF`/`SEG`/`CON`/`EVA` on a missing anchor → `missing_ins`; `EVA`
before any `DEF` → `criterionless_judgment`; `CON` to a non-existent anchor →
`cartesian_product`). Treat `_violations` as your lint output.

---

## 3. API reference (the functions you will actually call)

### `src/operators.js` — emit + namespace
- `setNamespace(ns)` / `getNamespace()` — your wire identity. Set at boot.
- `ins`, `def`, `defSchema`, `seg`, `con`, `syn`, `eva`, `rec` — see §2.
- `emit(roomId, OP.X, content)` — low-level escape hatch; the helpers above
  are preferred.
- `OP` — the operator table (`OP.INS.glyph`, `.order`, `.stored`, …).
- `setOptimisticHook(fn)` — advanced: `main.js` installs a hook so emits apply
  to in-memory state before the server echoes. Not needed for a basic app; the
  `onTimeline` re-fold already shows your own writes once they round-trip.

### `src/client.js` — auth & session (you call, you don't implement)
- `login(homeserver, mxid, password, { persist=false })` — authenticate +
  init Rust crypto + bootstrap the local vault. `persist:true` keeps the
  session across reloads.
- `hasLocalAccount(userId)` / `hasSavedSession(userId)` — booleans for routing
  the boot flow.
- `unlock(userId, password, { persist })` — unlock an existing local vault.
- `restoreSession(userId)` — resume a persisted session (no password prompt
  when one was saved). `tryAutoUnlock()` attempts it silently.
- `lock()` / `logout()` / `wipeLocalData()` — end session / sign out / nuke
  local data.
- `getClient()` — the underlying `matrix-js-sdk` client, for anything this
  layer doesn't wrap (typing, receipts, redaction, profiles).

### `src/rooms.js` — rooms are tables
- `createRoom(name, roomType, meta?)` → `roomId` (string). Forces E2EE and
  stamps the app meta event used by discovery. Awaits encryption readiness.
- `discoverRooms(roomType?)` → `Array<{ roomId, name, roomType, membership,
  inviter, encrypted, meta }>`. Only rooms carrying **this namespace's** meta
  event. Other apps' rooms (and DMs) are invisible — this is the app boundary.
  Check `encrypted` before trusting a room someone else created.
- `getTimeline(roomId)` → `Array<MatrixEvent>` (the live timeline; may be just
  the last N events until you paginate).
- `loadFullTimeline(roomId)` → paginates all history, returns the count. Call
  before the first fold if you need complete state. `loadTimelineSince(roomId,
  ts)` and `loadMore(roomId, limit?)` for bounded loads.
- `onTimeline(roomId, handler)` → unsubscribe fn. `handler(event, room)` on new
  events.
- `onDecrypted(roomId, handler)` → unsubscribe fn. Fires when a previously
  encrypted event decrypts late (keys arrived after load). **Re-fold here too**
  or you will silently miss events.
- `onLocalEchoUpdated`, `onMembersChange`, `onRoomChanges` — more subscriptions.
- `acceptInvite(roomId)`, `invite(roomId, userId)`, `getMembers(roomId)`,
  `loadRoomMembers(roomId)`, `getDisplayName(userId)`, `myPowerLevel(roomId)`,
  `setMemberPowerLevel`, `kickMember`, `setName` — membership & federation.
  Inviting `@someone:any-homeserver.org` Just Works; the SDK shares Megolm keys.

### `src/fold.js` — state is derived
- `initial()` → empty state.
- `fold(events)` → full state from scratch (sorts chronologically first).
- `foldFrom(state, newEvents)` → incremental fold (mutates & returns `state`);
  use on hot paths instead of re-folding everything.
- `stateHash(state)` → number; cheap change-detection to gate re-renders.
- Query helpers: `entitiesOfType(state, type)`, `entitiesInPartition(state,
  partition)`, `connectionsFor(state, anchor)`, `currentFrame(state)`,
  `causalPartition(state, anchor)`.

### `src/media.js` — large data is a pointer, still E2EE
- `uploadFile(file, opts?)` → a `{ __media: 2, … }` reference (encrypted blob
  in the media repo; the key rides inside the encrypted event).
- `getMediaBytes(ref)` → decrypted `Uint8Array`. `resolveMediaReferences(content)`
  rehydrates refs inside event content.
- Events are small (≤ ~24 KB; string fields ≥ ~16 KB auto-hoist). Put blobs in
  media and store the ref in the entity:
  ```js
  const ref = await uploadFile(file);
  await ins(roomId, 'document', { title: file.name, file: ref });
  ```

### `src/dataset.js` — optional CSV/JSON import helpers
`parseCsv`, `parseJsonDataset`, `inferFields`, `planDatasetFromFile`, … for
turning a spreadsheet into INS+DEF emits. Use if your app ingests tables.

---

## 4. The shape of `state` (what `render` reads)

`fold()` returns this object. Underscore-prefixed fields are owned by the fold —
**read them, never write them via `def()`.**

```js
{
  entities: {                       // anchor → entity
    task_1a2b3c4d: {
      title: 'Do thing',            // your payload + every DEF field merged in
      status: 'active',
      _anchor: 'task_1a2b3c4d',
      _type: 'task',                // the entity_type from INS
      _created: 1730000000000,
      _updated: 1730000005000,
      _sender: '@me:matrix.org',    // provenance, preserved by the fold
      _updatedBy: '@me:matrix.org',
      _eventId: '$abc…',
      _partition: 'archived',       // set by SEG (also in state.partitions)
      _hwm: 6,                       // highest operator order seen (helix mark)
      _evaluations: [ { criterion:'done', result:'pass', note:'', _ts, _sender } ],
    },
    // SYN outputs appear here too, with _type:'_synthesis' and _inputs:[…].
  },
  partitions: { task_1a2b3c4d: 'archived' },  // anchor → partition name
  connections: [ { source, target, type, _ts, _sender, _eventId } ],
  frames: [ { scope, before_frame, after_frame, _ts, _sender } ],  // REC log
  schema: { /* materialized from defSchema, see §5.4 */ },
  cursor: 1730000005000,            // ts of last processed event
  _undecryptable: 0,                // events still encrypted (key not yet here)
  _violations: [ /* advisory lint, see §2 */ ],
}
```

Your renderer is a pure function of this object. If `_undecryptable > 0`, some
events are still locked — keep your `onDecrypted` re-fold wired and they will
fill in.

---

## 5. The interop contract (how two apps share a database)

Two independently-written clients see the **same** database iff they agree on
four things. This is the federation guarantee — there is no shared code, only a
shared agreement, and the homeserver still sees only ciphertext.

1. **Namespace.** Event type is `\`${namespace}.${op.key}\`` (e.g.
   `com.acme.tasks.ins`). `setNamespace(...)` once at boot. A fold ignores
   every event outside its namespace. Same app family → one namespace
   everywhere. Cross-app federation → agree on a shared namespace for the
   shared rooms only.
2. **Entity-type taxonomy.** The `entity_type` string in `ins(...)` (`'task'`,
   `'note'`, `'observation'`). Agree on the strings or you coexist invisibly.
3. **Field paths under DEF.** The `path` in `def(...)`. `'status'` and
   `'state'` are different fields. Document them like a public schema.
4. **Schema-as-log.** Publish your shape into the timeline at room-creation
   time with `defSchema(roomId, 'tables.task.fields.status', { type:'enum', … })`.
   The fold materializes it under `state.schema`, so a fresh client can render
   without prior knowledge. Versioning lives in the log
   (`defSchema(roomId,'version', 2)`), never in the namespace.

Before shipping an interoperating app, confirm: namespace stable & documented;
entity-types documented; field paths documented; `_schema.*` emitted on room
creation; UI degrades gracefully on unknown types/paths (never throws);
operator semantics preserved (don't overload `SEG` to mean "rename"); a `REC`
is emitted when a field's meaning changes.

---

## 6. Hard rules — do not break these

- **No backend.** No API server, no DB, no edge function, no secret env var. If
  you want one, you have the wrong model — find the operator that fits.
- **No second source of truth.** Derive everything from `state` in memoized
  selectors. The fold result is canonical.
- **Never write fold-owned fields** (`_anchor`, `_type`, `_created`, `_hwm`,
  `_updated`, `_sender`, … any `_`-prefixed) via `def()`.
- **No hard delete.** The log is append-only. Model deletion as
  `seg(anchor, 'trash')` or `def(anchor, 'deleted_at', ts)`. Use the SDK's
  `redactEvent` (via `getClient()`) only to tombstone; the position remains.
- **No secrets in event content.** "Members may read it" ≠ "private to you."
  Per-user secrets go through `src/vault.js` (device-only, never sent).
- **Re-fold on `onDecrypted`, not just `onTimeline`.** Late-arriving keys are
  normal in E2EE; skip this and entities vanish until reload.
- **Keep events small.** Blobs → `uploadFile` → store the ref. Oversized inline
  payloads bounce off the homeserver's `max_event_size`.
- **Treat `src/` as a library.** Replace `public/*.jsx` with your UI; don't
  fork `src/` (forking breaks the interop contract for everyone).

---

## 7. Run it & ship it

```bash
npm install
npm run dev      # http://localhost:5173, default homeserver matrix.org
npm run build    # → ./dist (plain static files, no server side)
```

### Live on GitHub Pages (already wired)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`:

- Builds with Node 22 + Vite, uploads `dist/`, deploys via
  `actions/deploy-pages`.
- First run auto-enables Pages with the **GitHub Actions** source
  (`actions/configure-pages` with `enablement: true`). If your org blocks that,
  enable it once under **Settings → Pages → Source: GitHub Actions**.
- The asset base is derived automatically from the repo name
  (`vite.config.js` reads `GITHUB_REPOSITORY`), so a project site served from
  `/<repo>/` resolves correctly — no hardcoding when you fork or rename.

Result for this repo: **https://scores-patch-points.github.io/eodb/**

`dist/` is static, so the same build also drops onto Netlify, Cloudflare Pages,
S3+CloudFront, or a thumb drive. Point the app at any homeserver by typing its
URL into the login field at runtime.

---

## 8. Where to go deeper

- [`BUILDING.md`](./BUILDING.md) — the long-form guide: read order for `src/`,
  federation in practice, the full interop checklist.
- [`MEMORY.md`](./MEMORY.md) — the in-browser heap budget, the room LRU, the
  `window.MatrixLive` memory API, and the single-large-room caveat.
- [`README.md`](./README.md) — the architecture diagram and the pitch.
- `src/main.js` — reference wiring (optimistic echo, live subscriptions).
- `public/*.jsx` — a working reference UI you replace with your own.

Pick a namespace. Pick a taxonomy. Render `state`. Emit operators. Ship.
