# How you interact with this as a database (ideas, 2026-11-18)

Status: ideation. Anything marked **exists** was seen in the pharos or eodb repos or run in the trial; everything else is a proposal.

## The one-sentence model

You do not update rows. You **say** something (append a move to a log you own) and you **ask** a question from a standpoint (a query over every log you can read). Tables are named questions. History, conflict, deletion and sharing are part of the data, not features bolted on.

## What the person or app sees: six verbs

| Verb | What it does | Underneath | Exists? |
|---|---|---|---|
| **say** | Record one move: add, set, cut, link, merge, check, re-read, hold | `weave` a weft with a cell, kind, address and body; the helper picks the cell from the verb (see below) | `weave` exists in the library; the verb helper does not |
| **ask** | Read: a question under a standpoint, a time and a budget | An EOQL statement; named questions are stored views | EOQL `run`, `view`, `explain` exist (80 unit tests passed per its build notes) |
| **watch** | Follow a question as it changes | A watcher that reruns a view and acts on the difference | `watch` exists in the library; the receipt convention was tried |
| **share** | Give something away (gift) or lend access (lease), and take a lease back | Copy-with-provenance entry, or a grant link plus a leased key, and a cut | Grants and revocation as views were tried; keys and leases are design only |
| **forget** | Permanently delete what you own | Tombstone, destroy the key, unlink the body, receipt | Watcher and receipt tried; key store and v:2 bodies not built |
| **bring in** | Move an existing database in | EOQL `parse` (SQL to EOQL, unsupported parts reported as gaps) and `import` | Exists per BUILD_NOTES (SQLite executed; other dialects not) |

**Which cell does a verb write?** A small, fixed table, so ordinary apps never pick one by hand: add = `INS·Figure`; set a value = `DEF·Figure`; cut or remove = `SEG·Figure`; link = `CON·Figure`; merge = `SYN·Figure`; check against a standard = `EVA·Figure`; re-read or re-key = `REC·Figure`; hold, do nothing on purpose = `NUL·Figure`. Declaring a new kind or rule uses the Ground cells; naming a whole group or network uses the Pattern cells. This is eodb's own seven stored operators plus the two it keeps ephemeral. If independent writers disagree on a cell, folds change, so the verb table is where consistency is enforced (the small label-consistency check in the spec would test exactly this).

## What an answer looks like: the answer card

A query returns rows plus the things a normal database hides:

- **Standpoint:** whose rules and which keys the answer was computed under, so two people's answers can be compared.
- **As of / now:** the time value passed in, and the causal frontier read (what we had seen).
- **Determined or contested:** if a place has several competing latest values, the card says "held", shows each, and links the entries that disagree. Contested is a normal state.
- **Unread:** "N rows, M sealed not read" (never silently skipped).
- **Deleted marks:** a removed item shows as deleted, not as a hole, so entries that pointed at it make sense.
- **Fold hash and cost:** a fingerprint of the result, and how much of the budget the question used.
- **Explain:** the plan, on request.

## Surfaces

1. **CLI** (exists in part: `eoql run | explain | view | import | export | serve | dump | sql | parse | compile`; a `say`/`share`/`forget` facade does not exist).
2. **Library** in JavaScript first, because pharos, EOQL and eodb are all JavaScript with no dependencies; an eodb-shaped client that targets a pharos in place of a Matrix room.
3. **Local HTTP**, read-only (EOQL `serve` exists, bound to localhost).
4. **A SQL door for existing tools.** EOQL compiles to SQLite today, so a BI tool or a spreadsheet can read a database that is written by appending. Read-only; writes always go through `say`.
5. **A viewer** (pharos ships a read-only log viewer on localhost; the answer card would live there).
6. **Agents.** An LLM turns a request into an EOQL statement, which is shown with `explain` and run read-only; writes go through the same verbs and, for pharos repos, the existing gate rules. The model never picks a cell directly.
7. **REPL or notebook**, for people who want to think in questions.

## Moments that need real design

- **Share dialog.** Two honest options, never a single "permission" toggle: *Give a copy* (they keep it) and *Lend access* (they lose access when you withdraw, but may keep what they already saw). Show who can currently reach the item, from the authority view.
- **Delete flow.** Preview before acting: what derived views, leases, gifts and entries that cite it will change. Two phases: hide first, destroy the key after a delay you can cancel. Say what a purge claims: the network stops holding the readable bytes; it does not reach copies already taken.
- **Schema.** A kind plus a view, not a table definition. Changing it appends a new view definition, so old data is read under the new meaning without being rewritten. A migration is a re-reading, not an ALTER.
- **Time and what-if.** Ask as of any past point, ask with one writer removed, ask under someone else's standpoint, and diff two answers. These are the same machinery (the frame arguments), shown as controls.
- **Sync made visible.** Offline work, arrival of other people's entries, and conflicts appear as states on the card, not as errors.
- **Attention and space.** Which items get looked at decides what stays on a small device; the storage view lists bodies by use and lets you evict, with deletion reserved for owners.
- **Audit (opt in).** Reads recorded as attention entries, because an audit trail is itself metadata.

## A sketch of a session (target, not built)

```
say   add   contact:ana    {name: "Ana Reyes", phone: "555-0101"}
say   set   contact:ana    phone "555-0144"
ask   contacts_with_phone                      # a stored view
ask   contacts_with_phone --as treasurer       # same question, another standpoint
share lend  contact:ana    to maya   until 2026-12-31
share give  contact:ana    to maya               # a copy she owns
forget contact:ana                               # preview, hide, destroy key after 7 days
```

Everything here maps to things that exist or were tried: `weave`, EOQL views with a `:now` parameter and a perceiver, the authority view for "who can reach this", and the watcher for the deferred destroy.

## What to build first

1. **A `say`/`ask` facade** over `weave` and EOQL with the fixed verb-to-cell table. Small, and it removes the cell choice from users. **Built 2026-11-18** as `facade/db.mjs` (say, ask, get, view, forget-as-hide, text answer card; 9 tests pass). Not yet: a standpoint switch, permanent delete, shares.
2. **An answer-card renderer** over EOQL's JSON result, using the flags it already returns (held, determined, retracted).
3. **SQL in, then ask:** take a small SQLite database, run it through EOQL `parse` and `import`, and ask the same questions both ways to compare. This also shows how much of the migration claim is real.
4. **The watcher as a service** with receipts, then the key store beside it.
5. **Share and forget flows** once capability entries and signatures exist (build-order steps 4 to 5).

## Open design questions

- **Who picks the cell** when a model or a person overrides the verb helper, and how to check it.
- **Scale.** EOQL's own build notes measured nothing past about 60,000 entries; budgets default to 2,000,000 rows and 512 MiB.
- **Learning curve.** "Views, not tables" and "held, not overwritten" are unfamiliar; the first screen has to teach them in the card itself.
- **Natural-language writes.** Reads through an LLM are cheap to check (show the statement); writes need a dry run and a diff before they are appended.
- **Contested at scale.** A card that shows every competing value cannot stay readable when thousands conflict; needs summarising by writer or by rule.
- **Who may see the audit trail,** and whether the trail itself can be forgotten.
