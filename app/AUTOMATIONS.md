# Automations: connecting to and driving tools

An automation is a graph of nodes. Each node is **one operation on one tool**, wrapped by a small
adapter. Nodes run in the browser (or the headless node); the graph is data, so it is saved as entries
and can be replayed.

## The uniform model

- **Tool = `{ id, adapter, credentials? }`.** A tool is reached by a *locator* — `https://…`, `mcp:…`,
  `relay:…`, `mailbox:…`, `model:`, `reader:` — the same idea as the pharos routes. No tool is special.
- **Adapter = `{ id, async call(operation, inputs, ctx) → outputs }`.** One call shape for every connector.
- **Credentials are sealed** (kept out of the log, like the device key and the share key), referenced by
  locator, never written into an entry body.

## The connector families — what "connect to anything, drive anything" means

| adapter | drives | notes |
|---|---|---|
| `http`   | any REST API | the universal connector: if a tool has an HTTP API, an `http` node drives it (`fetch(url, {method, headers, body})`) |
| `model`  | the local model (`EODB_MODEL` / `askModel`) | reasoning only when asked; determinism stays with the reader/fold |
| `reader` | the khora reader (vendored) | deterministic parse into referents/relations — no model |
| `relay` / `mailbox` | the space's routes | read/write the log across devices |
| `store`  | the log itself | write a result back as an `auto` entry |
| `mcp`    | any MCP server | next: a Model Context Protocol client — the general "drive anything"; the premiere-pro MCP already proves the shape |

## Why this connects to *and* drives anything

A node is capability-shaped: it holds an operation on a tool, credentials sealed, so an automation is a
composed set of capabilities. The runner is a topo-sort — each node runs once its inputs are resolved, in
the browser or headless. Deterministic nodes (reader, fold) run with no model; a model runs only where a
node names it.

## Persistence and "always improving"

The graph is entries (kind `auto`). Re-running under a better reader or model is *new entries*, never an
overwrite — the same `reread`/`REC·Figure` loop the rest of the system uses.
