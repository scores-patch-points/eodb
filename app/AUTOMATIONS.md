# Automations: the pharos as the empty hub

An automation is a graph of nodes. Each node is **one operation on one tool**, wrapped by a small adapter.
The graph is DATA (kind `auto`), so it is saved as entries and replayed. No one orchestrates anything: the
log is the hub, every peer reads it and writes to it, and every activity — the trigger, the claim, the run,
each node result, the ingested rows — is itself an entry. The full audit trail is in the pharos, so the
interweaving is never blind.

## The uniform model

- **Tool = `{ id, adapter, credentials? }`** reached by a locator — `https://…`, `mcp:…`, `relay:…`,
  `mailbox:…`, `model:`, `reader:` — the same idea as the pharos routes. No tool is special.
- **Adapter = `{ id, async call(operation, inputs, ctx) → outputs }`.** One call shape for every connector.
- **Credentials are sealed** (out of the log, like the device and share keys), referenced by locator, never
  written into a body.

## Nodes (`app/automation.mjs` → `NODE_TYPES`)

| node | drives | out |
|---|---|---|
| `http` | any REST API (`fetch`, method + headers + auth) | status, json, body |
| `rss` | any RSS/Atom feed | items, title |
| `file` | a URL or a local path (headless) | bytes, name, type |
| `json` | parse a string to JSON | data |
| `transform` | flatten / pick / filter / rename rows | rows, columns |
| `store` | the log itself — lands rows as a real table (`landTable`) | tableId, count |
| `webhook` | inbound payload (server intake) | data |
| `model` | the local model, only where a node names it | answer |

The ingest primitive is `toRows`: any JSON value → `{ columns, rows }`. A wrapper object like
`{ rows: […] }` / `{ data: […] }` unwraps; nested objects flatten with dot keys. The canonical chain is
`http`/`rss`/`file` → `transform` → `store`, and everything in between is data.

## The runner is a topo-sort; the audit is the log

`runAutomation(graph, ctx)` resolves each node once its inputs arrive. `space.runAutomation` then writes the
whole run as entries: one `auto-run` (start), one `auto-node` per node (ok, error, output), and a `$done`
marker. A run is never an overwrite — re-running under a better reader or model is new entries.

## Triggers are entries, workers are peers (stigmergy)

A trigger is an entry (`kind auto-trigger`): `manual`, `webhook` (`path`), `poll` (`intervalMs`), or
`schedule` (`cron`). Whether a trigger is *due* is derived from the run history, never stored. A worker
(`app/worker.mjs` `tick`) folds the log, finds due + unclaimed triggers, writes a claim entry, runs the
graph, and writes results back. Any number of workers can run; the claims coordinate them. The headless node
runs this loop with `node app/headless.mjs --worker`.

**Coordination is causal, not a clock.** Every entry the pharos weaves carries `seen` — the frontier of what
its writer had observed, its lightcone. A claim for a trigger is written at a stable address
(`auto-claim:<trigger>[:<event>]`), `of`-references the trigger it acts on, and is *satisfied* once a run
entry causally references the claim (`of`). So we know not just *when* a device wanted to act, but *what
world it believed it was acting in*: a device that had not yet seen another's claim claims concurrently, and
the two claims surface as a conflict on the shared address (deterministically ordered by id), fully audited.

## The relational projection and the server

`app/relational.mjs` folds the log into named tables (`materialize`) and answers a SQL subset
(`SELECT/WHERE/JOIN/GROUP BY/ORDER/LIMIT`), and exports SQLite (`toSQLite`) or JSON (`toJSON`). It is a
deletable cache — everything derives from the EOT. `app/server.mjs` is a peer with a mouth and an eye: it
serves `/api/tables`, `/api/query`, `/api/export`, and `/api/automations`, and its one write path is
`POST /webhook/:path`, which writes the event as an `auto-event` entry and runs any automation whose webhook
trigger matches. It never orchestrates; it reads the log and answers it.
