# Installing eodb: the kinds of app, and what they share

> Generated from `app/installs.mjs` by `node app/installs.mjs --write`. Do not edit by hand: change the catalog; `app/test/installs.test.mjs` fails when they drift.

Every app below opens the same kind of space. They differ in where they run and which routes they can use, not in what they hold: a row typed in a phone's browser, a webhook landed by a server and a feed pulled by a headless worker are the same kind of entry, in one order, answered by the same SQL. The smallest working setup is **two browsers and one route both can reach** (`node app/serve.mjs` behind any HTTPS tunnel).

Status: **tested** means a test in this repo exercises it; **kit** means written but not run where it is meant to run; **gap** means named but not built.

## Pick one

| App | Runs on | Role | Dials | Hosts | Status |
|---|---|---|---|---|---|
| [Web app (any browser)](#web-app) | browser | surface | relay, http, mailbox, lora | - | tested |
| [Browser extension](#extension) | browser | surface | - | - | tested |
| [Headless node (always on, no screen)](#headless-node) | node | peer | relay, http, mailbox, lora, direct, reticulum, lxmf | - | tested |
| [Projection server (tables, SQL, export, webhooks)](#projection-server) | node | peer | relay, http, mailbox, lora | - | tested |
| [Blind relay](#relay) | node | carrier | - | relay, http, lora | tested |
| [Mailbox server](#mailbox) | node | carrier | - | mailbox | kit |
| [Reticulum bridge (mesh, radio)](#reticulum-bridge) | node+python | carrier | reticulum | reticulum | tested |
| [LXMF daemon (store-and-forward sync, phone remote control)](#lxmf-daemon) | node+python | carrier | lxmf | lxmf | tested |
| [Coding agent (OpenCode) through the app](#coding-agent) | node | tool | - | - | tested |
| [Email bridge (IMAP/SMTP)](#email-bridge) | node | tool | - | - | tested |
| [Node-RED flows](#node-red-flows) | browser | tool | - | - | tested |

## Web app (any browser)
<a id="web-app"></a>

The full app: tables, files, documents, automations, chat, the log. Data is sealed in the browser (OPFS or IndexedDB) and synced over routes.

- **Needs:** a browser with WebCrypto (Chromium verified; Firefox and Safari not run); one URL that serves the page, and one route both devices can reach
- **Joins a shared space:** opens a share link (#join=...) as a guest; stored under the space name the link carries
- **Writes:** every op in the contract below, from its screens
- **Files:** `app/index.html`, `app/serve.mjs`, `app/engine.mjs`; **tests:** `app/test/share.test.mjs`, `app/test/engine.test.mjs`
- **Limits:** every member with the link reads everything (no per-person read scopes yet); two libraries (parsing, formulas) still load from a CDN

Install:
```
nothing to install: open the page (add it to the home screen on a phone)
```
Run:
```
node app/serve.mjs 8852            # the page and a blind relay on one origin
ngrok http 8852                     # or any HTTPS tunnel: one URL reaches both
```

## Browser extension
<a id="extension"></a>

The same engine in a background service worker, with a content script that reads the page you are on when asked.

- **Needs:** Chrome, Edge or Firefox
- **Joins a shared space:** not yet: it opens a local space and never shares or joins
- **Writes:** page readings into its own local space
- **Files:** `extension/manifest.json`, `extension/background.js`, `extension/package.mjs`; **tests:** `extension/package.test.mjs`
- **Limits:** local only: no routes, so it does not yet sync with the other apps; the full app UI is not mounted in the side panel

Install:
```
node extension/package.mjs          # writes extension/dist/eodb-extension.zip
unzip it, then chrome://extensions > Developer mode > Load unpacked (Firefox: about:debugging > Load Temporary Add-on)
```
Run:
```
open the side panel: status, and "read this page"
```

## Headless node (always on, no screen)
<a id="headless-node"></a>

A space on disk, sealed under a passphrase, syncing for as long as it runs. With --worker it also runs automations that are due.

- **Needs:** Node 18+; a directory and a passphrase
- **Joins a shared space:** yes (--join)
- **Writes:** automation runs, node results and landed rows (with --worker); --note writes one marker entry; notes from allow-listed LXMF senders (with --lxmf-bot)
- **Files:** `app/headless.mjs`, `app/fs-backend.mjs`, `app/peek.mjs`; **tests:** `app/test/headless.test.mjs`, `app/test/worker.test.mjs`
- **Limits:** a space it founds is named "eodb" unless --name is given (a joined space takes the link's name)

Install:
```
git clone the repo (no npm install: no dependencies)
```
Run:
```
node app/headless.mjs --dir ./node --passphrase "$PW" --join "eodb-join:1:..."          # join a space
node app/headless.mjs --dir ./node --passphrase "$PW" --routes relay:https://host   # found one and print its link
add --worker to claim and run due automations
```

## Projection server (tables, SQL, export, webhooks)
<a id="projection-server"></a>

A peer that folds the log into tables and answers HTTP: /api/tables, /api/query (SQL), /api/export, /api/automations. Its one write path is POST /webhook/:path.

- **Needs:** Node 18+; a directory and a passphrase
- **Joins a shared space:** yes (--join)
- **Writes:** auto-event entries from webhooks, and the runs they trigger
- **Files:** `app/server.mjs`, `app/relational.mjs`, `app/worker.mjs`; **tests:** `app/test/server.test.mjs`, `app/test/relational.test.mjs`
- **Limits:** no direct or reticulum routes (the headless node has them); the HTTP API has no auth of its own: put it behind one

Install:
```
git clone the repo
```
Run:
```
node app/server.mjs --dir ./srv --passphrase "$PW" --join "eodb-join:1:..." --port 8852 [--worker]
```

## Blind relay
<a id="relay"></a>

Holds sealed objects for a space and never reads them: list, get, create-only put. Memory only.

- **Needs:** Node 18+; an address every member can reach (an HTTPS tunnel is enough)
- **Joins a shared space:** n/a
- **Writes:** nothing: it stores ciphertext and does not hold the key
- **Files:** `app/relay.mjs`, `app/serve.mjs`; **tests:** `app/test/share.test.mjs`
- **Limits:** memory only: a restart empties it (the members still hold everything); one process

Install:
```
git clone the repo
```
Run:
```
node app/relay.mjs 8853 0.0.0.0     # relay only
node app/serve.mjs 8852             # the page plus a relay on one origin
```

## Mailbox server
<a id="mailbox"></a>

A durable relay: token-guarded, encrypted again at rest under a server key, quota-bounded, with real deletion.

- **Needs:** a Linux server with systemd and Node 18+; a hostname behind HTTPS (e.g. Cloudflare Tunnel)
- **Joins a shared space:** n/a
- **Writes:** nothing: ciphertext only
- **Files:** `app/mailbox/mailbox.mjs`, `app/deploy/mailbox/install.sh`, `app/deploy/mailbox/README.md`; **tests:** `app/test/mailbox.test.mjs`
- **Limits:** the server is tested in Node and a browser; the deploy kit has not been run on a real server

Install:
```
copy app/mailbox/mailbox.mjs and app/deploy/mailbox/ to the server, then sudo ./install.sh
```
Run:
```
systemctl status mailbox; put the route in app/config.js: mailbox:https://host#<token>
```

## Reticulum bridge (mesh, radio)
<a id="reticulum-bridge"></a>

Carries the same sealed frames over Reticulum, so a space can span LoRa, Wi-Fi and internet links with no IP or DNS.

- **Needs:** Python with pip install rns; a Reticulum interface both sides share: a LAN, a reachable TCP transport node, an RNode radio, or I2P
- **Joins a shared space:** through a headless node
- **Writes:** nothing: frames pass through unread
- **Files:** `app/reticulum/bridge.py`, `app/reticulum/serve.mjs`, `app/reticulum/README.md`; **tests:** `app/test/reticulum.test.mjs`
- **Limits:** browsers cannot use it (it needs the bridge); tested on one machine over loopback, never over radio or two hosts

Install:
```
pip install rns; configure ~/.reticulum/config (interfaces need enabled = yes)
```
Run:
```
node app/reticulum/serve.mjs --rns-config ~/.reticulum      # the side that holds a store: prints reticulum:<hash>
python3 app/reticulum/bridge.py connect --listen 127.0.0.1:7770   # every joining machine, then a headless node
```

## LXMF daemon (store-and-forward sync, phone remote control)
<a id="lxmf-daemon"></a>

One per node: its own LXMF address, a sealed object store per space, delivery to every member (through an LXMF propagation node when one is offline), and an inbox that a headless node with --lxmf-bot answers for allow-listed Sideband users.

- **Needs:** Python with pip install rns lxmf; a Reticulum path to the other members or to a shared LXMF propagation node
- **Joins a shared space:** through a headless node (a join retries until the backfill arrives)
- **Writes:** nothing itself: it stores and forwards sealed objects; the headless node writes the notes
- **Files:** `app/reticulum/lxmf_bridge.py`, `app/reticulum/lxmf_send.py`, `app/lxmf-bot.mjs`, `app/reticulum/README.md`; **tests:** `app/test/lxmf.test.mjs`
- **Limits:** browsers cannot use it; tested on one machine with real processes, never with Sideband itself or over radio; LXMF proof-of-work stamps use every CPU core while they run

Install:
```
pip install rns lxmf
```
Run:
```
python3 app/reticulum/lxmf_bridge.py --storage ~/.eodb/lxmf [--propagation-node <hash>]   # prints its LXMF address
node app/headless.mjs ... --lxmf-bridge 127.0.0.1:7772 [--lxmf-bot --bot-allow <your LXMF address>]
python3 app/reticulum/lxmf_send.py --identity ~/.eodb/me --to <node address> --text status   # or use Sideband
```

## Coding agent (OpenCode) through the app
<a id="coding-agent"></a>

The app drives an OpenCode server; serve.mjs proxies /oc/* so a phone reaches it through the same origin, and the server holds the password.

- **Needs:** an OpenCode server
- **Joins a shared space:** n/a (it is reached through a surface)
- **Writes:** nothing yet: chats live in the page's memory, not in the log, so other apps cannot see them
- **Files:** `app/opencode.mjs`, `app/serve.mjs`; **tests:** `app/test/opencode.test.mjs`, `app/test/ocproxy.test.mjs`
- **Limits:** chat is not commensurable yet: it is page state, not entries

Install:
```
run OpenCode, then start serve.mjs with its address
```
Run:
```
EODB_OPENCODE_URL=http://127.0.0.1:4096 EODB_OPENCODE_PASSWORD=... node app/serve.mjs 8852
```

## Email bridge (IMAP/SMTP)
<a id="email-bridge"></a>

serve.mjs sends and fetches mail with an app password it holds; the browser only names "send" or "fetch". The email automation node uses it.

- **Needs:** an app password (Gmail with 2FA, or Outlook)
- **Joins a shared space:** n/a
- **Writes:** fetched messages as rows, through an automation
- **Files:** `app/mail.mjs`, `app/serve.mjs`; **tests:** `app/test/connectors.test.mjs`
- **Limits:** tested against a mock mail server, not a real provider

Install:
```
set the environment, then start serve.mjs
```
Run:
```
EODB_MAIL_USER=you@example.com EODB_MAIL_PASS=<app password> node app/serve.mjs 8852
```

## Node-RED flows
<a id="node-red-flows"></a>

Import a Node-RED flow export; its nodes map onto the app's automation nodes and its wires become edges. Function-node JavaScript is not run.

- **Needs:** a flow exported from Node-RED or flows.nodered.org
- **Joins a shared space:** n/a
- **Writes:** an auto definition, then runs like any other
- **Files:** `app/nodered.mjs`, `app/automation.mjs`; **tests:** `app/test/nodered.test.mjs`
- **Limits:** unknown node types fall back to the http node

Install:
```
nothing: paste the JSON into Automations > import
```
Run:
```
the imported flow runs like any automation (by hand, or by a --worker node)
```

## Routes

A route is how two apps reach each other. Each is the same three calls on sealed bytes, so any mix works: a space can use several at once and every device writes to all of them.

| Scheme | Carrier | Runs in | Address | Status |
|---|---|---|---|---|
| `relay` | HTTP blind relay (list, get, create-only put) | browser, node | relay:https://host  (app/relay.mjs, or app/serve.mjs which serves the page and the relay on one origin) | tested |
| `http` | the same HTTP relay calls, named by plain scheme | browser, node | http:https://host  (the relay URL after the scheme name; no test yet) | kit |
| `mailbox` | mailbox server: token in a header, encrypted again at rest | browser, node | mailbox:https://host#<token> | tested |
| `lora` | an HTTP relay behind a LoRa-class gateway: small frames, paced to a duty cycle | browser, node | lora:https://gateway?mtu=200&duty=0.01 | tested |
| `direct` | peer to peer over TCP, no relay | node | direct:tcp://host:port | tested |
| `reticulum` | Reticulum (LoRa, Wi-Fi, TCP, I2P mesh) through a local Python bridge | node+python | reticulum:<32-hex destination hash> | tested |
| `lxmf` | LXMF store-and-forward over Reticulum (members need not be online together) through a local Python daemon | node+python | lxmf:<32-hex LXMF address of a member>?tag=<32 hex>  (share link only, never announced in the log) | tested |
| `webrtc` | browser to browser, no relay (webrtcChannel in app/direct.mjs) | browser | none yet: the channel exists, but no route scheme or signaler is wired into the engine | gap |

## Why they are commensurable

- **One log.** Every app holds the same pharos log: content-addressed entries with a cell, a kind, an address and the causal frontier its writer had seen. The log is the database; tables, indexes and exports are deletable folds of it. (`app/vendor/pharos/core.mjs`)
- **One vocabulary of writes.** Every surface writes the same 27 ops, each a pharos kind: ws+ (ws), tb+ (tb), fld+ (fld), fld= (fld-set), row+ (row), rows+ (rows), cell= (cell-set), file+ (file), doc+ (doc), doc= (doc-set), cmt+ (cmt), cmt= (cmt-set), share+ (share), blk+ (blk), blk= (blk-set), voice+ (voice), read (read), map (map), retract (retract), auto+ (auto), auto-run+ (auto-run), auto-node+ (auto-node), auto-trigger+ (auto-trigger), auto-event+ (auto-event), auto-claim+ (auto-claim), project+ (project), vfile+ (vfile). (`app/engine.mjs OPS`)
- **One identity.** An account key grants each device a capability; every entry is signed by its device and counts only if a grant chain reaches the account. A guest device is granted through the invite in the link. (`app/engine.mjs, app/vendor/pharos/access.mjs`)
- **One seal.** Everything leaves a device AES-256-GCM sealed under the space key, bound to its object name. Relays, mailboxes and bridges carry ciphertext and never hold the key. (`app/net.mjs sealedCarrier`)
- **One carrier contract.** Every route is the same three calls (list, get, create-only putNew), so a device writes to all its routes at once and repairs one that fell behind. Schemes: relay, http, mailbox, lora, direct, reticulum, lxmf. (`app/net.mjs, app/direct.mjs, app/tcp.mjs`)
- **One link.** eodb-join:1:<...> carries the space name, routes, space key, account key and invite. Any app that can open a space can join from it, whatever it calls the space locally. (`app/engine.mjs share, parseJoin`)
- **One fold.** The log folds to named tables answerable by SQL, and projects to any of 7 formats (csv, json, jsonl, sqlite, postgres, mysql, markdown); each projection is itself recorded as an entry. (`app/relational.mjs, app/project.mjs`)
- **One automation shape.** An automation is data: 10 node types and 13 ready connectors. Any peer can run it; the claim, the run and every node result are entries, so who did what is in the log. (`app/automation.mjs, app/worker.mjs`)

## Connectors an automation can pull from

| Connector | Category | Credential |
|---|---|---|
| RSS / Atom feed | Feeds | blog, Substack, podcast, YouTube, GitHub releases |
| Calendar (.ics URL) | Feeds | Google / Outlook private calendar link |
| Hacker News | Feeds | stories via the Algolia API (no key) |
| GitHub issues | Dev | fine-grained PAT |
| JSONPlaceholder | Dev | fake users/posts for testing (no key) |
| Crypto prices | Finance | CoinGecko markets (no key) |
| Notion | Productivity | internal integration secret |
| Airtable | Productivity | personal access token |
| Todoist | Productivity | API token |
| Weather (Open-Meteo) | Weather | no key needed |
| Email (IMAP/SMTP) | Comms | app password; server holds the secret |
| Slack webhook | Comms | incoming-webhook URL |
| Discord webhook | Comms | webhook URL |
