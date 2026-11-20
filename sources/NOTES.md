# Source notes (addresses and paraphrase only)

Offsets are byte offsets into `<source>/text.txt` (UTF-8), a plain-text derivative of the downloaded file. `text_sha256_16` is the first 16 hex of its SHA-256.
No source text is stored here. The SoK on cryptographic erasure (IACR 2026/1109, v2 as printed on the PDF) was saved from Downloads into sok-erasure/paper.pdf after the server refused a scripted download.

- **revocation limit** | `keyhive-nb-01/text.txt` bytes 11005-12060 | sha d9a22367956a6246
  Revocation stops future writes, but anyone who already holds data plus its symmetric key can still read it. Their answer is defence in depth: let only principals with "pull" access fetch ciphertext at all.
- **history is given** | `keyhive-nb-01/text.txt` bytes 9857-10699 | sha d9a22367956a6246
  Each key chunk carries the keys of its causal predecessors, so a member who gets a key can read the whole earlier history. They accept losing forward secrecy because a replica needs the full history anyway. Net effect: access granted so far is permanent for the past and only revocable for the future.
- **capabilities** | `keyhive-nb-01/text.txt` bytes 5583-5707 | sha d9a22367956a6246
  A capability model between object capabilities (fail-stop under partition) and certificate capabilities (stateless chains). Documents are public keys that delegate to other keys; revocation needs some shared state.
- **identity out of scope** | `keyhive-nb-01/text.txt` bytes 3834-4410 | sha d9a22367956a6246
  Identity is left to a layer above: principals are keys. Matches our choice of a device key as the signing identity.
- **groups and devices** | `keyhive-nb-05/text.txt` bytes 2295-2962 | sha 85d93419db6339a7
  A person is a group whose members are device keys; rotating a key means adding the new device and removing the old. Documents and folders are groups too.
- **sync as set reconciliation** | `keyhive-nb-05/text.txt` bytes 8760-9564 | sha 85d93419db6339a7
  Membership operations (create, delegate, revoke) are synced as a set-difference problem, then document state, then each document. Same shape as syncing wefts by id.
- **maturity** | `keyhive-nb-04/text.txt` bytes 404-468 | sha d2bd21317a10b43f
  Pre-alpha and unaudited as of March 2025. Source for the pitch's "do not depend yet".
- **prefix pruning** | `willow-data-model/text.txt` bytes 863-1128 | sha f8525dc6687110f5
  A newer entry at a path deletes every older entry beneath it, so one write removes a whole subtree. Deletion is part of the data model, not an afterthought.
- **merge is order-independent** | `willow-data-model/text.txt` bytes 9837-10435 | sha f8525dc6687110f5
  Stores form a join semi-lattice, so merging in any order and grouping gives the same result. Same property pharos has with union by id.
- **timestamps** | `willow-data-model/text.txt` bytes 7234-7384 | sha f8525dc6687110f5
  Willow uses claimed wall-clock time on purpose and says so, where pharos orders causally and EOQL forbids now(). A real design difference.
- **owner deletion by overwrite** | `willow-meadowcap/text.txt` bytes 4711-5195 | sha 1ab469040e658b63
  In an owned namespace the owner removes a bad actor's entries by writing newer entries over them (using future timestamps), and can limit capabilities to short validity windows. Moderation and expiry are built from the same overwrite rule.
- **hiding anchors** | `sok-erasure/text.txt` bytes 57585-57638 | sha 53ddb7547fd6388f
  A commitment kept on the ledger must be hiding: a salted hash of the plaintext (or a hash of the ciphertext under the destroyed key), with the salt destroyed together with the key. A plain hash of the plaintext lets anyone who later learns the plaintext prove the record concerned it, and that survives key destruction.
- **delay is not destruction** | `sok-erasure/text.txt` bytes 43960-44097 | sha 53ddb7547fd6388f
  A time-lock or timed release only keeps data confidential until the delay passes; it is a release policy, not an erasure policy. Time can legitimately trigger destruction (time-lock the destroy instruction), but the erasure itself must come from key custody.
- **backups are the residue** (sok-erasure): anchor not found, no address
- **metadata residue** | `sok-erasure/text.txt` bytes 58369-58494 | sha 53ddb7547fd6388f
  Timestamps, ciphertext length, graph position and the destruction certificate itself stay behind after key destruction; cryptographic erasure says nothing about them unless designed for. Ciphertext length leaks plaintext size and must be padded.
- **witness gate relocates custody** | `sok-erasure/text.txt` bytes 49982-50121 | sha 53ddb7547fd6388f
  A witness-gated scheme just moves the question to who holds the witness; erasure then needs extractable witness encryption, which no surveyed construction was built for.
- **limits of the claim** | `sok-erasure/text.txt` bytes 56645-56786 | sha 53ddb7547fd6388f
  The result covers the scheme, not bugs, misconfigured hardware, coercion or refusal to erase, and does not discharge retention duties from other laws. The controller must document the threat model it assumes.
- **ownership ideal** | `local-first/text.txt` bytes 23-64 | sha 9b96357010c24a47
  The thesis: keep cloud convenience while the user owns the data, as with old desktop software. Treats your copy as yours; says little about deleting data others already hold.
