#!/usr/bin/env bash
# Installs the EODB mailbox carrier as a systemd service. Run as root on the server, from this folder:   sudo ./install.sh
# It: makes a system user and the data folder, installs mailbox.mjs, creates a strong token and at-rest key in /etc/mailbox/env (root-only; reused if present),
# installs and starts the unit. It does NOT touch nginx or cloudflared (see README.md), and it never prints the token.
# Testing without root:   MB_PREFIX=/tmp/x MB_SKIP_SYSTEM=1 ./install.sh      (paths are rooted at the prefix; no user, chown or systemctl)
set -euo pipefail
P="${MB_PREFIX:-}"; SKIP="${MB_SKIP_SYSTEM:-0}"; HERE="$(cd "$(dirname "$0")" && pwd)"
SRC_JS="$HERE/../../mailbox/mailbox.mjs"; [ -f "$SRC_JS" ] || SRC_JS="$HERE/mailbox.mjs"
[ -f "$SRC_JS" ] || { echo "cannot find mailbox.mjs next to or above this script" >&2; exit 1; }
if [ "$SKIP" != 1 ] && [ "$(id -u)" != 0 ]; then echo "run as root (or set MB_SKIP_SYSTEM=1 MB_PREFIX=... to test)" >&2; exit 1; fi
NODE="$(command -v node || true)"; [ -n "$NODE" ] || { echo "node (18+) is required: install it first" >&2; exit 1; }
[ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -ge 18 ] || { echo "node 18 or newer is required" >&2; exit 1; }
DATA="$P/mnt/mailbox"; ETC="$P/etc/mailbox"; APP="$P/opt/mailbox"; UNIT="$P/etc/systemd/system/mailbox.service"
if [ "$SKIP" != 1 ]; then
  id mailbox >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin mailbox
  [ -d /mnt ] && mountpoint -q /mnt || echo "warning: /mnt is not a separate mount; check you mean to store data there" >&2
fi
mkdir -p "$DATA" "$ETC" "$APP" "$(dirname "$UNIT")"
install -m 0644 "$SRC_JS" "$APP/mailbox.mjs"
if [ ! -f "$ETC/env" ]; then
  ( umask 077; printf 'MAILBOX_TOKEN=%s\nMAILBOX_KEY=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > "$ETC/env" )
  echo "created $ETC/env (token and at-rest key; root-only). Back up MAILBOX_KEY: without it stored objects cannot be read."
else echo "kept the existing $ETC/env"; fi
chmod 600 "$ETC/env"
sed "s#@NODE@#$NODE#" "$HERE/mailbox.service" > "$UNIT"
if [ "$SKIP" != 1 ]; then
  chown -R mailbox:mailbox "$DATA"; chmod 750 "$DATA"; chown root:root "$ETC" "$ETC/env"; chmod 700 "$ETC"
  systemctl daemon-reload; systemctl enable --now mailbox
  sleep 1; systemctl is-active --quiet mailbox && curl -fsS http://127.0.0.1:8792/health && echo || { echo "service did not start: journalctl -u mailbox -n 50" >&2; exit 1; }
fi
echo "done. Token for share links:  sudo cat $ETC/env | grep MAILBOX_TOKEN   (route:  mailbox:https://<your hostname>#<token>)"
