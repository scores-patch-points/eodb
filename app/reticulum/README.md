# Reticulum as an eodb route

A route `reticulum:<32-hex destination hash>` lets spaces sync over [Reticulum](https://reticulum.network) (`pip install rns`): addresses are hashes of keys (no IP, no DNS), and the same space can span LoRa, Wi-Fi and an internet tunnel. It is a second layer of encryption under eodb's own: every segment is AES-256-GCM sealed (`sealedCarrier`) before it reaches Reticulum.

```
engine - sealedCarrier - directCarrier - tcp (loopback) - bridge.py == Reticulum Link == bridge.py - tcp - directServer (store)
         (app/net.mjs)   (app/direct.mjs) (app/tcp.mjs)    connect                        serve        (app/reticulum/serve.mjs)
```

`bridge.py` is the whole Reticulum seam. It moves length-prefixed frames, byte for byte, and reads none of them; eodb imports nothing from Reticulum, and Reticulum knows nothing of eodb. Each frame is one `RNS.Resource` (reliable, chunked, retried), not a bare Packet.

## Use
```
# the machine that holds the store (reachable by hash, no open port needed)
node app/reticulum/serve.mjs --rns-config ~/.reticulum --identity ~/.eodb/rns-identity
#   {"route":"reticulum:ba8981b9..."}        <- put this in a share link

# every machine that joins: a local bridge, then a normal node
python3 app/reticulum/bridge.py connect --listen 127.0.0.1:7770
node app/headless.mjs --dir ./d --passphrase "$PW" --join "eodb-join:1:..."
```
`?bridge=host:port` on the route, or `EODB_RNS_BRIDGE`, names a different local bridge. `--allow <identity hex>` (serve) with `--identify` (connect) admits only listed identities. Reticulum interfaces (LoRa/RNode, AutoInterface, TCP, I2P) are configured in the usual `~/.reticulum/config`, not here.

## Tested (`app/test/reticulum.test.mjs`, `rns` 1.6.1, one machine)
Run: `EODB_RNS_PYTHON=<python with rns> node --test --test-force-exit app/test/reticulum.test.mjs` (`--test-force-exit` so a dead link fails at the 60 s test timeout instead of holding the process open).

Falsified (2026-11-28): each mutant was applied, the suite run, the file restored. Bridge drops every frame from the link -> test 1 fails (timed out after 60 s). Sealing removed from `sealedCarrier` -> test 1 fails (plaintext seen at the far store). Adapter ignores the bridge's refusal -> test 3 fails. Route gate bypassed (engine dials every announced locator) -> `route-policy.test.mjs` test 2 fails (13 connections reached the bait listener).

Two separate Reticulum instances joined by a loopback TCP interface; the real bridges; eodb's own engine: a founder shares, a joiner reads the founder's entry, and the serving store holds only ciphertext. A route with no bridge, and a destination nobody announced, fail with a stated reason. With `rns` absent the two bridge tests skip with `rns-absent`.

## Video (`app/reticulum/bench-video.mjs`; exploratory, one run, 2026-11-28, one machine, Reticulum over a loopback TCP interface)
H.264 clips (640x360, ffmpeg testsrc2) added to a space by a founder and synced to a joiner; every copy hashed back equal and decoded with no ffmpeg error.

| clip | MB | direct:tcp arrive s (x realtime) | reticulum arrive s (x realtime) | reticulum publish s |
|---|---|---|---|---|
| 10 s @ 800k | 1.14 | 0.33 (30) | 0.66 (15.2) | 13.0 |
| 30 s @ 2M | 7.82 | 1.97 (15.2) | 3.57 (8.4) | 34.1 |
| 60 s @ 2M | 15.65 | 4.07 (14.7) | 6.87 (8.7) | 21.2 |
| 120 s @ 2M | 31.2 | 11.39 (10.5) | 13.49 (8.9) | 13.2 |

Read it this way: a file is ONE sealed object, so playback can start only once the whole file has arrived; "x realtime" is clip length over arrival time, not a streaming rate. Publish includes the first dial (path request and Link setup), which varied 13 to 34 s across runs. Before parts were added, a 15.7 MB clip never arrived: one frame of it exceeded the bridge's 16 MiB cap. The adapter now sends objects in 1 MiB parts (`?mtu=` to change), and the 31 MB clip crosses. Falsifier for the table: a clip whose received hash differs or that ffmpeg cannot decode (the script exits 1). Loopback numbers say nothing about LoRa: at LoRa rates (hundreds of bytes per second to a few kB/s) a 1 MB clip takes minutes to hours; video belongs on the Wi-Fi/TCP/I2P segments of a Reticulum network.

## Not tested, not built
- True streaming (play while arriving): parts arrive in order, but the engine delivers a file only when complete. Not built.
- Any real radio or multi-hop path: no LoRa/RNode, no transport node, no second host. Frame sizes and latency over a slow link are unmeasured; a frame is one Resource with its handshake, which is likely costly at LoRa speeds. `politeCarrier`/`chunkedCarrier` are not composed here.
- Announce load as the network grows (the bridge re-announces every 900 s by default).
- The store is in memory (a restart empties it) and is a single serving peer, not a mesh of equals. Many-to-many is the next step: each node serving and dialing the others, with announced routes recorded as locator entries.
- `--allow` is written but has no test.
- Python is required beside Node; the browser app cannot use this route (it needs the bridge).
