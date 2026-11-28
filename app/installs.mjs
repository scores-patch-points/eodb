// installs.mjs: every kind of app you can install or run around one eodb space, as DATA, and what makes them commensurable.
//
// Each kind is a different body (a browser tab, an extension, a headless node, a server, a carrier, a bridge), but they all hold the
// same thing: one pharos log, verified the same way, sealed the same way, reached through the same three-call carrier, folded the
// same way. So a row written in a phone's browser, a webhook landed by a server and a feed pulled by a headless worker are the same
// kind of entry, in the same order, answerable by the same SQL. This file names each kind, how to install and run it, which routes it
// can dial, and what it writes; `app/INSTALL.md` is generated from it (`node app/installs.mjs --write`) and `test/installs.test.mjs`
// holds both to the code (every file exists, every route scheme the engine builds in is named, the contract below is read from code).
//
// Status words: `tested` (a test in this repo exercises it), `kit` (written, not run where it is meant to run), `gap` (named, not built).
import { OPS } from './engine.mjs';
import { PROJECTORS } from './project.mjs';
import { CONNECTORS, NODE_TYPES } from './automation.mjs';

/** Routes: how two apps reach each other. A route is `<scheme>:<address>`; every route carries the same list/get/putNew calls on sealed bytes. */
export const ROUTES = [
  { scheme: 'relay', carrier: 'HTTP blind relay (list, get, create-only put)', runtimes: ['browser', 'node'], file: 'app/net.mjs', test: 'app/test/share.test.mjs', status: 'tested',
    address: 'relay:https://host  (app/relay.mjs, or app/serve.mjs which serves the page and the relay on one origin)' },
  { scheme: 'http', carrier: 'the same HTTP relay calls, named by plain scheme', runtimes: ['browser', 'node'], file: 'app/net.mjs', test: null, status: 'kit',
    address: 'http:https://host  (the relay URL after the scheme name; no test yet)' },
  { scheme: 'mailbox', carrier: 'mailbox server: token in a header, encrypted again at rest', runtimes: ['browser', 'node'], file: 'app/net.mjs', test: 'app/test/mailbox.test.mjs', status: 'tested',
    address: 'mailbox:https://host#<token>' },
  { scheme: 'lora', carrier: 'an HTTP relay behind a LoRa-class gateway: small frames, paced to a duty cycle', runtimes: ['browser', 'node'], file: 'app/net.mjs', test: 'app/test/lora.test.mjs', status: 'tested',
    address: 'lora:https://gateway?mtu=200&duty=0.01' },
  { scheme: 'direct', carrier: 'peer to peer over TCP, no relay', runtimes: ['node'], file: 'app/tcp.mjs', test: 'app/test/tcp.test.mjs', status: 'tested',
    address: 'direct:tcp://host:port' },
  { scheme: 'reticulum', carrier: 'Reticulum (LoRa, Wi-Fi, TCP, I2P mesh) through a local Python bridge', runtimes: ['node+python'], file: 'app/tcp.mjs', test: 'app/test/reticulum.test.mjs', status: 'tested',
    address: 'reticulum:<32-hex destination hash>' },
  { scheme: 'lxmf', carrier: 'LXMF store-and-forward over Reticulum (members need not be online together) through a local Python daemon', runtimes: ['node+python'], file: 'app/tcp.mjs', test: 'app/test/lxmf.test.mjs', status: 'tested',
    address: 'lxmf:<32-hex LXMF address of a member>?tag=<32 hex>  (share link only, never announced in the log)' },
  { scheme: 'webrtc', carrier: 'browser to browser, no relay (webrtcChannel in app/direct.mjs)', runtimes: ['browser'], file: 'app/direct.mjs', test: 'app/test/direct.test.mjs', status: 'gap',
    address: 'none yet: the channel exists, but no route scheme or signaler is wired into the engine' },
];

/** The kinds of app. `speaks`: route schemes it can dial. `serves`: route schemes it hosts for others. `files`/`tests`: repo paths, checked to exist. */
export const APPS = [
  {
    id: 'web-app', label: 'Web app (any browser)', role: 'surface', runtime: 'browser', status: 'tested',
    what: 'The full app: tables, files, documents, automations, chat, the log. Data is sealed in the browser (OPFS or IndexedDB) and synced over routes.',
    needs: ['a browser with WebCrypto (Chromium verified; Firefox and Safari not run)', 'one URL that serves the page, and one route both devices can reach'],
    install: ['nothing to install: open the page (add it to the home screen on a phone)'],
    run: ['node app/serve.mjs 8852            # the page and a blind relay on one origin', 'ngrok http 8852                     # or any HTTPS tunnel: one URL reaches both'],
    speaks: ['relay', 'http', 'mailbox', 'lora'], serves: [],
    writes: 'every op in the contract below, from its screens', joins: 'opens a share link (#join=...) as a guest; stored under the space name the link carries',
    files: ['app/index.html', 'app/serve.mjs', 'app/engine.mjs'], tests: ['app/test/share.test.mjs', 'app/test/engine.test.mjs'],
    limits: ['every member with the link reads everything (no per-person read scopes yet)', 'two libraries (parsing, formulas) still load from a CDN'],
  },
  {
    id: 'extension', label: 'Browser extension', role: 'surface', runtime: 'browser', status: 'tested',
    what: 'The same engine in a background service worker, with a content script that reads the page you are on when asked.',
    needs: ['Chrome, Edge or Firefox'],
    install: ['node extension/package.mjs          # writes extension/dist/eodb-extension.zip', 'unzip it, then chrome://extensions > Developer mode > Load unpacked (Firefox: about:debugging > Load Temporary Add-on)'],
    run: ['open the side panel: status, and "read this page"'],
    speaks: [], serves: [],
    writes: 'page readings into its own local space', joins: 'not yet: it opens a local space and never shares or joins',
    files: ['extension/manifest.json', 'extension/background.js', 'extension/package.mjs'], tests: ['extension/package.test.mjs'],
    limits: ['local only: no routes, so it does not yet sync with the other apps', 'the full app UI is not mounted in the side panel'],
  },
  {
    id: 'headless-node', label: 'Headless node (always on, no screen)', role: 'peer', runtime: 'node', status: 'tested',
    what: 'A space on disk, sealed under a passphrase, syncing for as long as it runs. With --worker it also runs automations that are due.',
    needs: ['Node 18+', 'a directory and a passphrase'],
    install: ['git clone the repo (no npm install: no dependencies)'],
    run: ['node app/headless.mjs --dir ./node --passphrase "$PW" --join "eodb-join:1:..."          # join a space', 'node app/headless.mjs --dir ./node --passphrase "$PW" --routes relay:https://host   # found one and print its link', 'add --worker to claim and run due automations'],
    speaks: ['relay', 'http', 'mailbox', 'lora', 'direct', 'reticulum', 'lxmf'], serves: [],
    writes: 'automation runs, node results and landed rows (with --worker); --note writes one marker entry; notes from allow-listed LXMF senders (with --lxmf-bot)', joins: 'yes (--join)',
    files: ['app/headless.mjs', 'app/fs-backend.mjs', 'app/peek.mjs'], tests: ['app/test/headless.test.mjs', 'app/test/worker.test.mjs'],
    limits: ['a space it founds is named "eodb" unless --name is given (a joined space takes the link\'s name)'],
  },
  {
    id: 'projection-server', label: 'Projection server (tables, SQL, export, webhooks)', role: 'peer', runtime: 'node', status: 'tested',
    what: 'A peer that folds the log into tables and answers HTTP: /api/tables, /api/query (SQL), /api/export, /api/automations. Its one write path is POST /webhook/:path.',
    needs: ['Node 18+', 'a directory and a passphrase'],
    install: ['git clone the repo'],
    run: ['node app/server.mjs --dir ./srv --passphrase "$PW" --join "eodb-join:1:..." --port 8852 [--worker]'],
    speaks: ['relay', 'http', 'mailbox', 'lora'], serves: [],
    writes: 'auto-event entries from webhooks, and the runs they trigger', joins: 'yes (--join)',
    files: ['app/server.mjs', 'app/relational.mjs', 'app/worker.mjs'], tests: ['app/test/server.test.mjs', 'app/test/relational.test.mjs'],
    limits: ['no direct or reticulum routes (the headless node has them)', 'the HTTP API has no auth of its own: put it behind one'],
  },
  {
    id: 'relay', label: 'Blind relay', role: 'carrier', runtime: 'node', status: 'tested',
    what: 'Holds sealed objects for a space and never reads them: list, get, create-only put. Memory only.',
    needs: ['Node 18+', 'an address every member can reach (an HTTPS tunnel is enough)'],
    install: ['git clone the repo'],
    run: ['node app/relay.mjs 8853 0.0.0.0     # relay only', 'node app/serve.mjs 8852             # the page plus a relay on one origin'],
    speaks: [], serves: ['relay', 'http', 'lora'],
    writes: 'nothing: it stores ciphertext and does not hold the key', joins: 'n/a',
    files: ['app/relay.mjs', 'app/serve.mjs'], tests: ['app/test/share.test.mjs'],
    limits: ['memory only: a restart empties it (the members still hold everything)', 'one process'],
  },
  {
    id: 'mailbox', label: 'Mailbox server', role: 'carrier', runtime: 'node', status: 'kit',
    what: 'A durable relay: token-guarded, encrypted again at rest under a server key, quota-bounded, with real deletion.',
    needs: ['a Linux server with systemd and Node 18+', 'a hostname behind HTTPS (e.g. Cloudflare Tunnel)'],
    install: ['copy app/mailbox/mailbox.mjs and app/deploy/mailbox/ to the server, then sudo ./install.sh'],
    run: ['systemctl status mailbox; put the route in app/config.js: mailbox:https://host#<token>'],
    speaks: [], serves: ['mailbox'],
    writes: 'nothing: ciphertext only', joins: 'n/a',
    files: ['app/mailbox/mailbox.mjs', 'app/deploy/mailbox/install.sh', 'app/deploy/mailbox/README.md'], tests: ['app/test/mailbox.test.mjs'],
    limits: ['the server is tested in Node and a browser; the deploy kit has not been run on a real server'],
  },
  {
    id: 'reticulum-bridge', label: 'Reticulum bridge (mesh, radio)', role: 'carrier', runtime: 'node+python', status: 'tested',
    what: 'Carries the same sealed frames over Reticulum, so a space can span LoRa, Wi-Fi and internet links with no IP or DNS.',
    needs: ['Python with pip install rns', 'a Reticulum interface both sides share: a LAN, a reachable TCP transport node, an RNode radio, or I2P'],
    install: ['pip install rns; configure ~/.reticulum/config (interfaces need enabled = yes)'],
    run: ['node app/reticulum/serve.mjs --rns-config ~/.reticulum      # the side that holds a store: prints reticulum:<hash>', 'python3 app/reticulum/bridge.py connect --listen 127.0.0.1:7770   # every joining machine, then a headless node'],
    speaks: ['reticulum'], serves: ['reticulum'],
    writes: 'nothing: frames pass through unread', joins: 'through a headless node',
    files: ['app/reticulum/bridge.py', 'app/reticulum/serve.mjs', 'app/reticulum/README.md'], tests: ['app/test/reticulum.test.mjs'],
    limits: ['browsers cannot use it (it needs the bridge)', 'tested on one machine over loopback, never over radio or two hosts'],
  },
  {
    id: 'lxmf-daemon', label: 'LXMF daemon (store-and-forward sync, phone remote control)', role: 'carrier', runtime: 'node+python', status: 'tested',
    what: 'One per node: its own LXMF address, a sealed object store per space, delivery to every member (through an LXMF propagation node when one is offline), and an inbox that a headless node with --lxmf-bot answers for allow-listed Sideband users.',
    needs: ['Python with pip install rns lxmf', 'a Reticulum path to the other members or to a shared LXMF propagation node'],
    install: ['pip install rns lxmf'],
    run: ['python3 app/reticulum/lxmf_bridge.py --storage ~/.eodb/lxmf [--propagation-node <hash>]   # prints its LXMF address', 'node app/headless.mjs ... --lxmf-bridge 127.0.0.1:7772 [--lxmf-bot --bot-allow <your LXMF address>]', 'python3 app/reticulum/lxmf_send.py --identity ~/.eodb/me --to <node address> --text status   # or use Sideband'],
    speaks: ['lxmf'], serves: ['lxmf'],
    writes: 'nothing itself: it stores and forwards sealed objects; the headless node writes the notes', joins: 'through a headless node (a join retries until the backfill arrives)',
    files: ['app/reticulum/lxmf_bridge.py', 'app/reticulum/lxmf_send.py', 'app/lxmf-bot.mjs', 'app/reticulum/README.md'], tests: ['app/test/lxmf.test.mjs'],
    limits: ['browsers cannot use it', 'tested on one machine with real processes, never with Sideband itself or over radio', 'LXMF proof-of-work stamps use every CPU core while they run'],
  },
  {
    id: 'coding-agent', label: 'Coding agent (OpenCode) through the app', role: 'tool', runtime: 'node', status: 'tested',
    what: 'The app drives an OpenCode server; serve.mjs proxies /oc/* so a phone reaches it through the same origin, and the server holds the password.',
    needs: ['an OpenCode server'],
    install: ['run OpenCode, then start serve.mjs with its address'],
    run: ['EODB_OPENCODE_URL=http://127.0.0.1:4096 EODB_OPENCODE_PASSWORD=... node app/serve.mjs 8852'],
    speaks: [], serves: [],
    writes: 'nothing yet: chats live in the page\'s memory, not in the log, so other apps cannot see them', joins: 'n/a (it is reached through a surface)',
    files: ['app/opencode.mjs', 'app/serve.mjs'], tests: ['app/test/opencode.test.mjs', 'app/test/ocproxy.test.mjs'],
    limits: ['chat is not commensurable yet: it is page state, not entries'],
  },
  {
    id: 'email-bridge', label: 'Email bridge (IMAP/SMTP)', role: 'tool', runtime: 'node', status: 'tested',
    what: 'serve.mjs sends and fetches mail with an app password it holds; the browser only names "send" or "fetch". The email automation node uses it.',
    needs: ['an app password (Gmail with 2FA, or Outlook)'],
    install: ['set the environment, then start serve.mjs'],
    run: ['EODB_MAIL_USER=you@example.com EODB_MAIL_PASS=<app password> node app/serve.mjs 8852'],
    speaks: [], serves: [],
    writes: 'fetched messages as rows, through an automation', joins: 'n/a',
    files: ['app/mail.mjs', 'app/serve.mjs'], tests: ['app/test/connectors.test.mjs'],
    limits: ['tested against a mock mail server, not a real provider'],
  },
  {
    id: 'node-red-flows', label: 'Node-RED flows', role: 'tool', runtime: 'browser', status: 'tested',
    what: 'Import a Node-RED flow export; its nodes map onto the app\'s automation nodes and its wires become edges. Function-node JavaScript is not run.',
    needs: ['a flow exported from Node-RED or flows.nodered.org'],
    install: ['nothing: paste the JSON into Automations > import'],
    run: ['the imported flow runs like any automation (by hand, or by a --worker node)'],
    speaks: [], serves: [],
    writes: 'an auto definition, then runs like any other', joins: 'n/a',
    files: ['app/nodered.mjs', 'app/automation.mjs'], tests: ['app/test/nodered.test.mjs'],
    limits: ['unknown node types fall back to the http node'],
  },
];

/** What makes every app above commensurable. Each item names where the code holds it; the ops, formats and connectors are read from code. */
export function contract() {
  return [
    { what: 'One log', how: 'Every app holds the same pharos log: content-addressed entries with a cell, a kind, an address and the causal frontier its writer had seen. The log is the database; tables, indexes and exports are deletable folds of it.', where: 'app/vendor/pharos/core.mjs' },
    { what: 'One vocabulary of writes', how: `Every surface writes the same ${Object.keys(OPS).length} ops, each a pharos kind: ${Object.entries(OPS).map(([op, [kind]]) => `${op} (${kind})`).join(', ')}.`, where: 'app/engine.mjs OPS' },
    { what: 'One identity', how: 'An account key grants each device a capability; every entry is signed by its device and counts only if a grant chain reaches the account. A guest device is granted through the invite in the link.', where: 'app/engine.mjs, app/vendor/pharos/access.mjs' },
    { what: 'One seal', how: 'Everything leaves a device AES-256-GCM sealed under the space key, bound to its object name. Relays, mailboxes and bridges carry ciphertext and never hold the key.', where: 'app/net.mjs sealedCarrier' },
    { what: 'One carrier contract', how: `Every route is the same three calls (list, get, create-only putNew), so a device writes to all its routes at once and repairs one that fell behind. Schemes: ${ROUTES.filter((r) => r.status !== 'gap').map((r) => r.scheme).join(', ')}.`, where: 'app/net.mjs, app/direct.mjs, app/tcp.mjs' },
    { what: 'One link', how: 'eodb-join:1:<...> carries the space name, routes, space key, account key and invite. Any app that can open a space can join from it, whatever it calls the space locally.', where: 'app/engine.mjs share, parseJoin' },
    { what: 'One fold', how: `The log folds to named tables answerable by SQL, and projects to any of ${Object.keys(PROJECTORS).length} formats (${Object.keys(PROJECTORS).join(', ')}); each projection is itself recorded as an entry.`, where: 'app/relational.mjs, app/project.mjs' },
    { what: 'One automation shape', how: `An automation is data: ${Object.keys(NODE_TYPES).length} node types and ${CONNECTORS.length} ready connectors. Any peer can run it; the claim, the run and every node result are entries, so who did what is in the log.`, where: 'app/automation.mjs, app/worker.mjs' },
  ];
}

const code = (s) => '`' + s + '`';
/** INSTALL.md, generated. */
export function renderMarkdown() {
  const L = [];
  L.push('# Installing eodb: the kinds of app, and what they share', '');
  L.push('> Generated from `app/installs.mjs` by `node app/installs.mjs --write`. Do not edit by hand: change the catalog; `app/test/installs.test.mjs` fails when they drift.', '');
  L.push('Every app below opens the same kind of space. They differ in where they run and which routes they can use, not in what they hold: a row typed in a phone\'s browser, a webhook landed by a server and a feed pulled by a headless worker are the same kind of entry, in one order, answered by the same SQL. The smallest working setup is **two browsers and one route both can reach** (`node app/serve.mjs` behind any HTTPS tunnel).', '');
  L.push('Status: **tested** means a test in this repo exercises it; **kit** means written but not run where it is meant to run; **gap** means named but not built.', '');
  L.push('## Pick one', '');
  L.push('| App | Runs on | Role | Dials | Hosts | Status |', '|---|---|---|---|---|---|');
  for (const a of APPS) L.push(`| [${a.label}](#${a.id}) | ${a.runtime} | ${a.role} | ${a.speaks.join(', ') || '-'} | ${a.serves.join(', ') || '-'} | ${a.status} |`);
  L.push('');
  for (const a of APPS) {
    L.push(`## ${a.label}`, `<a id="${a.id}"></a>`, '', a.what, '');
    L.push(`- **Needs:** ${a.needs.join('; ')}`);
    L.push(`- **Joins a shared space:** ${a.joins}`);
    L.push(`- **Writes:** ${a.writes}`);
    L.push(`- **Files:** ${a.files.map(code).join(', ')}; **tests:** ${a.tests.map(code).join(', ')}`);
    if (a.limits.length) L.push(`- **Limits:** ${a.limits.join('; ')}`);
    L.push('', 'Install:', '```', ...a.install, '```', 'Run:', '```', ...a.run, '```', '');
  }
  L.push('## Routes', '', 'A route is how two apps reach each other. Each is the same three calls on sealed bytes, so any mix works: a space can use several at once and every device writes to all of them.', '');
  L.push('| Scheme | Carrier | Runs in | Address | Status |', '|---|---|---|---|---|');
  for (const r of ROUTES) L.push(`| ${code(r.scheme)} | ${r.carrier} | ${r.runtimes.join(', ')} | ${r.address} | ${r.status} |`);
  L.push('', '## Why they are commensurable', '');
  for (const c of contract()) L.push(`- **${c.what}.** ${c.how} (${code(c.where)})`);
  L.push('', '## Connectors an automation can pull from', '');
  L.push('| Connector | Category | Credential |', '|---|---|---|');
  for (const c of CONNECTORS) L.push(`| ${c.label} | ${c.cat} | ${c.note} |`);
  L.push('');
  return L.join('\n');
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('installs.mjs')) {
  const { writeFileSync } = await import('node:fs');
  const out = new URL('./INSTALL.md', import.meta.url);
  if (process.argv.includes('--write')) { writeFileSync(out, renderMarkdown()); console.log('wrote app/INSTALL.md'); }
  else process.stdout.write(renderMarkdown());
}
