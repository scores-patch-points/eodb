# Pharos and the network around it: handshake draft

Status: draft v0. Research read 2026-11-18, mostly search summaries, not full spec pages.

## 1. Definitions

- **Pharos**: one replica. It holds a declared slice of the EO///DB event log, folds it locally, and exposes only the EO///DB surface.
- **Network**: four seams (event schema, carrier, key, discovery) plus the carriers. The network moves signed bytes and never interprets them.

## 2. Pharos surface (what a peer may call)

| Call | Meaning |
|---|---|
| `hello` | Identity, schema versions, protocol versions (current + previous), carriers offered |
| `advertise` | Namespaces held, as a capability-gated commitment, not a plain list |
| `put(ns, events)` | Append signed events to a namespace |
| `get(ns, range)` / `subscribe(ns)` | Read or follow events the caller's capability allows |
| `fold(question)` | Optional: return answer + fold hash + byline set, for shadow-replica comparison |

`fold` is a convenience. A peer that trusts nothing can pull events and fold itself.

## 3. Handshake sequence

1. **Find**: discovery adapter yields a peer address (Iroh EndpointId, Matrix room, Reticulum destination).
2. **Connect**: carrier adapter opens a channel under a versioned protocol ID (e.g. `eodb/carrier/1`, `eodb/carrier/0`).
3. **Hello**: exchange identity (signing key), schema version, protocol versions. Pick the highest common version. No shim if none.
4. **Prove**: each side presents a capability chain for the namespaces it wants. Verified by the key adapter.
5. **Intersect**: exchange namespace commitments so neither side learns slices it has no capability for (Willow's private area intersection is the model).
6. **Sync**: ranged reconciliation of events in the intersection. Wave fold decides how much to pull.
7. **Receipt**: every blob transfer appends an offer / receipt event (see pitch, delete-after-download).

## 4. Mapping to what exists

| Seam | Iroh | Matrix | Reticulum |
|---|---|---|---|
| Discovery | EndpointId dial via DNS/Pkarr address lookup, or your own; relay as fallback | Room ID / user ID | Destination hash via announce |
| Carrier | QUIC stream per ALPN; Router dispatches by ALPN | Room events (ciphertext) | Links / packets, small events only |
| Key | Endpoint key authenticates the peer; group keys come from key adapter | Olm/Megolm, or matrix-sdk-crypto alone | Built-in link encryption |
| Swarm | iroh-gossip topic = 32-byte id; join via any member | Room membership | Announces |

## 5. Research findings that change the pitch

- **Iroh**: dialing by EndpointId works only if an address-lookup service is configured. The default preset uses n0-hosted DNS/Pkarr, so run your own to match rule 6. Traffic falls back to the relay when hole punching fails. 1.0.x is current (1.0.3 on docs.rs). Per the roadmap, blobs, docs and gossip live outside the core crate and ship on their own versions, still 0.x in what I found. So the 1.x pin covers the core transport only, and blobs and gossip should be pinned and tested separately.
- **Willow**: the sync protocol appears renamed from WGPS to "Confidential Sync", and a Go port says it is not yet implemented there. Borrow the namespace/path/capability model and private-area-intersection idea. Do not depend on a sync implementation yet. This supports the pitch's "borrow first".
- **Meadowcap**: capabilities are delegable tokens issued by the namespace owner and can be restricted by time range. That fits revocation and the key adapter well. A time-bound, delegable capability maps cleanly onto signed capability events.
- **Reticulum**: the founder stepped back (Dec 2025) and the reference stack now carries a custom Reticulum License. A FOSDEM 2026 deck says it blocks distribution in Debian, F-Droid and most package managers, and lists forks (RetiNet, AGPL) and ports (Reticulum-rs, MIT). The protocol itself is described as public domain. So the carrier should be written against the protocol, with a port chosen later. Treat the license question as answered "risky", not "check".

## 5b. Verification pass (primary sources, 2026-11-18)

Confirmed or corrected against crates.io, willowprotocol.org and the Reticulum LICENSE file:

- **Iroh core: confirmed and updated.** crates.io shows 1.0.0 on 2026-06-15, then 1.0.1 to 1.0.3, then 1.1.0 to 1.4.2 (latest). None yanked. So "1.x" is a moving range: minor releases land every 2 to 4 weeks. Pin to a minor and run the fixtures on each bump. (The iroh roadmap page still says 1.0 is unreleased, so it is stale. Use crates.io.)
- **iroh-blobs: confirmed 0.x, and unstable.** Latest is 0.105.0 (2026-11-13), eight releases since September. Versions 0.99 to 0.103 were yanked on 2026-10-06, and 0.99.1 to 0.103.1 were published that day to replace them. I did not find the reason. Treat it as a carrier-adjacent dependency, keep it behind the blob adapter, and read the yank notes before using it.
- **iroh-gossip: confirmed 0.x.** Latest is 0.103.0 (2026-11-16), with a gap between June and November.
- **Willow: terminology confirmed.** The site lists four specs: data model, Meadowcap, Confidential Sync, Drop Format. The site never mentions "WGPS", so Confidential Sync is the current name. Spec status was not stated on the page I read. Drop Format ("delivering data by any means") is worth reading for the offline and LoRa carrier.
- **Reticulum license: confirmed and sharper.** The LICENSE is MIT-style plus two use restrictions: no use in systems that can purposefully harm humans, and no direct or indirect use in creating AI models or datasets. Restrictions on field of use mean it is probably not OSI open source (my inference, not stated by the file). The AI-dataset clause matters for you directly: it may bar using the stack inside anything that feeds The Fold's models. Treat the reference implementation as unusable for this project until a lawyer says otherwise. The ports are separate licenses and were not verified.

Not verified: iroh blobs/gossip stability claims beyond version numbers, Meadowcap details beyond the summary, the iroh address-lookup defaults (the roadmap page did not state them), and the 1.4.2 date (listed as 2026-11-19, a day after today, probably a timezone effect).

## 5c. Willow specs read (willowprotocol.org, 2026-11-18)

**Meadowcap: status Final (21 Nov 2025).**
- Capabilities are unforgeable tokens that grant read or write on an area, narrowed by subspace, path and timestamp.
- Delegation: the holder signs the existing capability together with the recipient's public key. Validity is checked down the signature chain.
- Two namespace models, one per namespace, never mixed. Communal: each subspace is owned by its author and the public key is the SubspaceId. Owned: the namespace keypair is the root authority.
- Writes need a capability plus the receiver's signature over the entry. Reads are enforced by the replication layer, which sends entries only to peers presenting a valid read capability.
- **No revocation mechanism appears in the spec as I read it.** The spec's moderation example is for the owner to overwrite abusive entries with future-timestamped ones. Expiry has to be built in as a time bound when the capability is issued.

**Confidential Sync: status Proposal (21 Nov 2025), paused.**
- The page says design work is paused while the team focuses on the Willow Transport Protocol, many parts are outdated, and a new spec will replace it.
- Still useful as a design reference. It needs a reliable ordered byte channel (TCP, QUIC, a pipe) with a logical-channel multiplexer (LCMUX) on top. The handshake and encryption are out of scope.
- Private interest overlap: peers hash salted interests and exchange overlap announcements, so only shared interests are revealed.
- Reconciliation is 3D range-based set reconciliation: exchange fingerprints of ranges, then send entries and payloads. Payloads can be sent eagerly or lazily.
- Revocation: not covered in the part I read. The only time rule is that payload requests must fall inside both peers' capabilities. I read only the first 100k of about 150k characters.

**Consequences for the draft**
- Replace "revocation stops new reads" (build step 2) with "capability expiry plus a signed revoke event that honest pharoi honor." Meadowcap gives you the token format but not the revoke. That event is yours to define, and it lives in your log.
- Steps 5 and 6 of the handshake (intersect, sync) should be specified as your own protocol, modeled on private-interest overlap and range reconciliation. Do not wait for Willow's sync to stabilize. Iroh's QUIC streams already satisfy the transport requirement.
- Adopt Meadowcap's capability format as the capability-event schema. It is Final, small and language-independent.
- The Willow Transport Protocol is the thing to watch. Look at it before locking `advertise` and `hello`.

## 5d. Willow Transfer Protocol (WTP) and handshake read

Correction: the protocol is the Willow **Transfer** Protocol, not "Transport" as 5c said. Spec: willowprotocol.org/specs/wtp/. Status: **Proposal, dated 16 Oct 2026**, so it is current and active, unlike Confidential Sync.

- **Model:** two peers send and request entries and payloads over a reliable, ordered, bidirectional byte channel. Requests are one-shot or long-lived (streaming live changes). A peer can request a whole area, or just a hash summary, which is what enables range-based set reconciliation. Each request gets a response state machine: decline, fingerprint already matches, send metadata, send entries, or keep forwarding updates.
- **Messages:** RequestEntries / RespondToRequestEntries, RequestPayloadSlice / RespondToRequestPayloadSlice, SendEntry, SendPayloadSlice, CancelOwnRequest, UpdatePayloadLazyness. Stateful and stateless encodings are both offered.
- **Authorisation:** every entry request carries a read capability. Its receiver must be the peer authenticated in the handshake, and its area and namespace must cover the request. Meadowcap read capabilities are recommended. Invalid messages abort the session.
- **Handshake:** a Noise XX variant (Noise spec rev 34). Static keys are sent encrypted, and each side's static key is bound into the session. Ephemeral keys and chunk boundaries are visible, so the spec suggests padding. The spec says to encrypt if and only if the underlying channel is not already encrypted. Iroh's QUIC is already encrypted and authenticated, so a pharos on Iroh would skip the handshake and use the endpoint key.
- **Privacy:** capabilities and requests for specific areas are sent without extra protection, so they can leak. The spec says to account for this. There is no private interest overlap inside WTP itself (a separate spec exists: willowprotocol.org/specs/pio/).
- **Revocation:** not mentioned. Confirmed that none of the Willow specs gives you revocation.

**Consequences for the draft**
- WTP fits the `get` / `subscribe` / `fold` surface closely. Its request kinds (one-shot, long-lived, hash-summary-only) are a better starting point for `get`, `subscribe` and the sync step than Confidential Sync.
- `advertise` should be sent only after `prove`, since WTP says requests leak.
- WTP's "who is the authenticated peer" check is the same job as the key adapter's identity. That makes the open question "signing identity: account, device or DID?" concrete. The receiver key must equal the transport-authenticated key. On Iroh that is the EndpointId, so a device key is the easiest choice, with the account key delegating to it via capability.
- The spec is a Proposal, so keep any Willow-shaped message behind your own versioned protocol ID.

## 6. Gaps

- No primary-source read of the Willow spec, the Iroh 1.0 release notes or the Reticulum license text. Confirm before building.
- Not found: whether iroh-blobs or iroh-gossip has a stable 1.0.
- Still open from the pitch: signing identity, cross-owner ground disputes, tombstone lifetime, namespace granularity.
- Added by this draft: is `advertise` public, or only visible after `prove`? Choosing the latter reduces metadata leakage but costs a round trip.
