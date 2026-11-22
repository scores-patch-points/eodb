// mail.mjs: dependency-free email — SMTP send + IMAP fetch over TLS, using only node:net / node:tls.
// The server holds the app password (Gmail 2FA "app password", or an Outlook app password); the browser never sees it.
// This is the Tier-2 connector: no OAuth, no app approval. The email node in automation.mjs posts to serve.mjs's
// /mail/send and /mail/fetch, which call these functions.
import net from 'node:net';
import tls from 'node:tls';
import { Buffer } from 'node:buffer';

// ---- a tiny byte-level reader over a socket (IMAP/SMTP are line protocols; IMAP also has {N} literals) -------
function lineReader(sock) {
  let buf = Buffer.alloc(0);
  const waiters = [];
  sock.on('data', (d) => { buf = Buffer.concat([buf, d]); const w = waiters.shift(); if (w) w(); });
  sock.on('error', () => { const w = waiters.shift(); if (w) w(); });
  sock.on('end', () => { const w = waiters.shift(); if (w) w(); });
  const ensure = () => new Promise((r) => waiters.push(r));
  return {
    async readLine() {
      for (;;) {
        const i = buf.indexOf('\r\n');
        if (i >= 0) { const line = buf.slice(0, i).toString('utf8'); buf = buf.slice(i + 2); return line; }
        await ensure();
      }
    },
    async readLiteral(n) {
      for (;;) { if (buf.length >= n) { const b = buf.slice(0, n); buf = buf.slice(n); return b.toString('utf8'); } await ensure(); }
    },
    write: (s) => sock.write(s),
    end: () => sock.end(),
  };
}

function connect(host, port, tlsOpts, plain) {
  return new Promise((resolve, reject) => {
    const mod = plain ? net : tls;
    const sock = plain ? net.connect({ host, port }) : tls.connect({ host, port, servername: host, rejectUnauthorized: false, ...tlsOpts });
    sock.once('connect', () => resolve(sock));
    sock.once('secureConnect', () => resolve(sock));
    sock.on('error', reject);
  });
}

/** base64 without depending on a browser btoa (node has Buffer) */
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');

/** send one email. `from` defaults to `user`. Returns the final SMTP status line, or throws. */
export async function smtpSend({ host = 'smtp.gmail.com', port = 465, user, pass, from, to, subject, body, plain = false }) {
  if (!user || !pass || !to) throw new Error('smtpSend needs user, pass and to');
  const sock = await connect(host, port, null, plain);
  const r = lineReader(sock);
  let line = await r.readLine();                                 // 220 greeting
  if (!line || !/^220/.test(line)) { sock.destroy(); throw new Error('SMTP greeting: ' + line); }
  const cmd = async (s, expect = '250') => { r.write(s + '\r\n'); let l = await r.readLine(); while (l && /^\d{3}-/.test(l)) l = await r.readLine(); if (!l || !new RegExp('^' + expect).test(l)) throw new Error('SMTP ' + s + ' -> ' + l); return l; };
  await cmd('EHLO eodb');
  await cmd('AUTH LOGIN', '334');
  await cmd(b64(user), '334');
  await cmd(b64(pass), '235');
  await cmd('MAIL FROM:<' + from + '>');
  await cmd('RCPT TO:<' + to + '>');
  await cmd('DATA', '354');
  const msg = 'From: ' + from + '\r\nTo: ' + to + '\r\nSubject: ' + (subject || '') + '\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset="utf-8"\r\n\r\n' + (body || '') + '\r\n.';
  sock.write(msg + '\r\n');
  let l = await r.readLine(); while (l && /^\d{3}-/.test(l)) l = await r.readLine();
  const done = l || '';
  r.write('QUIT\r\n'); r.end();
  return { accepted: /^250/.test(done), status: done };
}

/** fetch the last `limit` messages from a folder. Returns [{uid, from, subject, date, text}]. */
export async function imapFetch({ host = 'imap.gmail.com', port = 993, user, pass, folder = 'INBOX', limit = 20, plain = false }) {
  if (!user || !pass) throw new Error('imapFetch needs user and pass');
  const sock = await connect(host, port, null, plain);
  const r = lineReader(sock);
  let line = await r.readLine();                                // * OK
  if (!line || !/^\* OK/.test(line)) { sock.destroy(); throw new Error('IMAP greeting: ' + line); }
  let tag = 0;
  const cmd = async (s) => {
    const t = 'a' + (++tag); r.write(t + ' ' + s + '\r\n');
    const out = [];
    for (;;) {
      const l = await r.readLine(); if (l == null) throw new Error('IMAP closed during ' + s);
      out.push(l);
      if (l.startsWith(t + ' ')) { if (/ (NO|BAD)\b/.test(l)) throw new Error('IMAP ' + s + ' -> ' + l); return out; }
    }
  };
  await cmd('LOGIN ' + user + ' ' + pass);
  await cmd('SELECT "' + folder + '"');
  const search = await cmd('UID SEARCH ALL');
  const ids = (search.join(' ').match(/\* SEARCH (.+)/i) || [])[1] || '';
  const uids = ids.trim().split(/\s+/).filter(Boolean).map(Number);
  if (!uids.length) { r.write('a' + (++tag) + ' LOGOUT\r\n'); r.end(); return []; }
  const want = uids.slice(-Math.max(1, Number(limit) || 20));
  const set = want.join(',');
  const t = 'a' + (++tag); r.write(`${t} UID FETCH ${set} (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] BODY.PEEK[TEXT])\r\n`);
  // Read the FETCH response with {N} literals expanded, then parse per-message blocks.
  const raw = [];
  for (;;) {
    const l = await r.readLine(); if (l == null) throw new Error('IMAP closed during FETCH');
    let exp = l, m;
    while ((m = exp.match(/\{(\d+)\}\s*$/))) exp = exp.replace(/\{(\d+)\}\s*$/, '{$1}\n' + await r.readLiteral(Number(m[1])));
    raw.push(exp);
    if (exp.startsWith(t + ' ')) { if (/ (NO|BAD)\b/.test(exp)) throw new Error('IMAP FETCH -> ' + exp); break; }
  }
  const joined = raw.join('\r\n');
  const messages = [];
  const blocks = joined.split(/\* \d+ FETCH /).filter((b) => /UID \d+/.test(b));
  for (const b of blocks) {
    const uid = (b.match(/UID (\d+)/) || [])[1];
    const header = (b.match(/HEADER\.FIELDS[^\]]*\]\s*\{(\d+)\}\n([\s\S]*?)(?:\r?\n BODY\[TEXT\]|\r?\n\)|$)/) || [])[2] || '';
    const text = (b.match(/BODY\[TEXT\]\s*\{(\d+)\}\n([\s\S]*?)(?:\r?\n\)|$)/) || [])[2] || '';
    const from = (header.match(/^From:\s*(.+)$/mi) || [])[1] || '';
    const subject = (header.match(/^Subject:\s*(.+)$/mi) || [])[1] || '';
    const date = (header.match(/^Date:\s*(.+)$/mi) || [])[1] || '';
    messages.push({ uid, from, subject, date, text: text.trim() });
  }
  r.write('a' + (++tag) + ' LOGOUT\r\n'); r.end();
  return messages;
}
