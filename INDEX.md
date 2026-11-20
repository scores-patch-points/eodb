# Index of this session's work (2026-11-18)

Start with the spec. Everything else supports it.

| File | What it is | Status |
|---|---|---|
| [pharos-spec-v1.md](pharos-spec-v1.md) | The spec (v1.2): the network around a pharos, EODB as its interface, deletion, leases and gifts, the 27-cell core and concept packs, build order, open questions. Starts with a status section | Draft; the working document |
| [interaction-design.md](interaction-design.md) | How people and programs use this as a database: six verbs, the answer card, surfaces, flows, first builds | Ideation |
| [facade/](facade/README.md) | `db.mjs` and friends: say, ask, standpoint switch, sealed bodies with a key store and permanent delete, the lazy store with a cached frontier, a read-time index with a cost-based chooser and the real definitions of SIG, synapse, wormhole and expressway ([SIG.md](facade/SIG.md)), and **a shared notebook for coding sessions** (`db init` installs it in a project). 109 tests pass on both stores; reads and manages the virtual files Proteus makes, through pharos entries only (`db vfiles`, `db vf`); scale measured to 30,000 entries through the tool; signatures; SIG marks with a held-out promotion check | Built; prototype. Marks only from kind reads; no real synapse, wormhole or expressway; no gifts, leases or networking |
| [eoql-authority-experiment/](eoql-authority-experiment/README.md) | Scripts and views run against a clone of the public pharos repo: authority chain, mutants, watcher with receipts, budgeted requests | Run; stand-in signatures |
| [cube-roles.md](cube-roles.md) | Proposed roles for the 14 cells the pack leaves empty | Design notes (nominations) |
| [sources/](sources/NOTES.md) | Downloaded sources as plain text with byte-addressed notes: Keyhive, Willow, local-first essay, the cryptographic erasure paper | Read |
| [sources/sok-erasure/THEORY.md](sources/sok-erasure/THEORY.md) | The erasure paper's theory, snipped with addresses | Read; an unreviewed preprint |
| [pack-agreement-test-prereg.md](pack-agreement-test-prereg.md) | Pre-registration for a blind-agreement and perspective-shift study | **Shelved**, not run |
| [pack-test/](pack-test/README.md) | The 100 written test items, hidden maps and hashes | **Shelved** |
| [pharos-handshake.md](pharos-handshake.md) | The first version of the spec | Superseded by the spec |

## Decisions recorded in the spec

Device key as identity; standpoint-tagged answers and a dispute rule; the log as storage with Matrix demoted; permanent deletion with tombstones and an owner who can always delete; gift versus lease; the 27-cell core with concepts in replaceable packs; the cube as a design principle.

## Not done

Signatures, keys and sealing (only stand-ins); the v:2 body store; the carriers; scale testing; the migration tool beyond what EOQL's own notes report.
