# EODB

The interface and meaning layer over a pharos. The prototype is in [`facade/`](facade/README.md); [`INDEX.md`](INDEX.md) lists everything here, and [`pharos-spec-v1.md`](pharos-spec-v1.md) is the spec. Agents: read [`AGENTS.md`](AGENTS.md). To install or run the app in any of its forms (browser, extension, headless node, server, relay, mailbox, Reticulum bridge), and why they all hold the same space, see [`app/INSTALL.md`](app/INSTALL.md).

- the log is the database; everything derived (index, marks, shortcuts, keys) is a deletable cache
- it reads and manages the virtual files [Proteus](https://github.com/clovenbradshaw-ctrl/proteus) makes, through pharos entries only: repos never call each other

Tests: `PHAROS_SRC=<a clone of the pharos repo> DB_STORE=plain|lazy node --test facade/test*.mjs`.
