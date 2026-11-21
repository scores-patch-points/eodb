# Deploying the mailbox carrier

The mailbox (`app/mailbox/mailbox.mjs`) is a dumb pipe for the app's sealed segments and files: list, get, create-only put. Objects are sealed by the app before they arrive and encrypted again at rest under a server key. This folder is a kit for putting it on a Linux server with systemd. **Nothing here has been run on a real server**; the installer was tested only against a temporary directory prefix, and the server itself in Node tests and a real browser.

## What you decide
- **Quota.** `--quota` is set to 1 TB in the unit. Keep it below the free space of the disk it writes to (a quota larger than the disk cannot be enforced and can fill a shared disk).
- **Hostname.** Use a dedicated name (for example `mail.example.org`), not the apex of a site that already serves other things.
- **Reads.** The unit runs with `--private`: listing and reading need the token too, so nobody who finds the host can list writer ids and sizes. The app holds the token anyway to write.
- **Token and key.** Both are generated on the server into `/etc/mailbox/env` (root-only, never printed, never on a command line). Back up `MAILBOX_KEY`: without it stored objects cannot be read.

## Steps (as root, on the server)
1. Node 18+ must be installed (`node -v`).
2. Copy this repository's `app/mailbox/mailbox.mjs` and this folder to the server, then `sudo ./install.sh`. It creates the `mailbox` user, `/mnt/mailbox`, `/opt/mailbox/mailbox.mjs`, `/etc/mailbox/env`, and starts the service on `127.0.0.1:8792`.
3. Give it a public address that shields the box. For Cloudflare Tunnel:
   ```
   cloudflared tunnel login
   cloudflared tunnel create mailbox
   cloudflared tunnel route dns mailbox mail.example.org
   ```
   and point the tunnel at the service. Either straight at `http://127.0.0.1:8792`, or (to keep an existing nginx as the edge) install `nginx-mailbox.conf` as a new vhost listening on `127.0.0.1:8081` and point the tunnel at that. Add the vhost only; touch no existing one. Run `cloudflared` as a service.
4. Check: `curl https://mail.example.org/health` answers, and `curl https://mail.example.org/v1/list` answers `401`.

## Using it from the app
Put the route in `app/config.js` (not committed; see `config.example.js`):
```js
window.EODB_ROUTES = ['mailbox:https://mail.example.org#<the token from /etc/mailbox/env>'];
```
A share link then carries the route and token to every device you invite, so use a token you are willing to share with them, and rotate it (edit `/etc/mailbox/env`, `systemctl restart mailbox`, share new links) if it leaks.

## Limits to know
- One shared token: anyone holding it can fill the quota for every space on the server. Per-space tokens are not built.
- "Shuffle the bits on delete" overwrites the file and unlinks it. On cloud disks, snapshots and copy-on-write storage keep old blocks, so treat it as removal from the server, not as a guarantee against backups.
- `list` walks the whole object tree on every call; fine for a small store, to be cached or prefixed later.
- Cloudflare (or any front) sees object names, sizes, IP addresses and timing, never contents.
- Objects live on one disk on one machine: that is one replica, not durability. Spaces keep other routes and each device keeps its own copy.
