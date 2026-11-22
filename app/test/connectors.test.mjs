// connectors: parseIcs, the ics/email node runners, and the CONNECTORS catalog. SMTP/IMAP via a plain-TCP mock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { parseIcs, parseRss, runAutomation, NODE_TYPES, CONNECTORS } from '../automation.mjs';
import { smtpSend, imapFetch } from '../mail.mjs';

test('parseIcs unfolds folded lines and reads VEVENTs into rows', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:Work',
    'BEGIN:VEVENT',
    'UID:1@x',
    'DTSTART:20260101T120000Z',
    'SUMMARY:Standup',
    'LOCATION:Room 4',
    'DESCRIPTION:Daily \\\\nSync',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Planning',
    'DTSTART;VALUE=DATE:20260102',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const r = parseIcs(ics);
  assert.equal(r.title, 'Work');
  assert.equal(r.events.length, 2);
  assert.equal(r.events[0].summary, 'Standup');
  assert.equal(r.events[0].location, 'Room 4');
  assert.equal(r.events[0].start, '20260101T120000Z');
  assert.equal(r.events[1].summary, 'Planning');
});

test('every connector node type exists in NODE_TYPES', () => {
  for (const c of CONNECTORS) {
    assert.ok(NODE_TYPES[c.node.type], `connector "${c.id}" node type "${c.node.type}" is defined`);
  }
  assert.ok(CONNECTORS.some((c) => c.quick === 'url'), 'rss/ics are quick one-click connectors');
});

test('the ics node fetches and parses a calendar URL', async () => {
  const ics = 'BEGIN:VCALENDAR\r\nX-WR-CALNAME:C\r\nBEGIN:VEVENT\r\nSUMMARY:All hands\r\nDTSTART:20260105T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const fetch = async () => ({ text: async () => ics });
  const r = await runAutomation({ nodes: [{ id: 'i', type: 'ics', fields: { url: 'https://x/basic.ics' } }], edges: [] }, { fetch });
  assert.equal(r.ok, true);
  assert.equal(r.results.i.output.events.length, 1);
  assert.equal(r.results.i.output.events[0].summary, 'All hands');
});

// ---- mail.mjs: SMTP send + IMAP fetch over a plain-TCP mock (no real Gmail in the test) ----------------------
// A line-based mock: the first response is written on connect (the greeting); each client line then pops the next.
function lineMock(responses) {
  const srv = net.createServer((sock) => {
    const q = responses.slice();
    sock.write(q.shift() || '');            // greeting
    let buf = '';
    const pump = () => {
      for (;;) {
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        buf = buf.slice(i + 2);
        const reply = q.shift();
        if (reply) sock.write(reply);
      }
    };
    sock.on('data', (d) => { buf += d.toString('utf8'); pump(); });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

test('smtpSend speaks EHLO -> AUTH LOGIN -> MAIL/RCPT -> DATA and reports acceptance', async () => {
  const srv = await lineMock([
    '220 mock ESMTP\r\n',                    // greeting
    '250-eodb\r\n250 PIPELINING\r\n',        // EHLO
    '334 VXNlcm5hbWU6\r\n',                  // AUTH LOGIN
    '334 UGFzc3dvcmQ6\r\n',                  // base64(user)
    '235 ok\r\n',                            // base64(pass)
    '250 ok\r\n',                            // MAIL FROM
    '250 ok\r\n',                            // RCPT TO
    '354 go\r\n',                            // DATA
    '250 queued\r\n',                        // message + "."
  ]);
  const r = await smtpSend({ host: '127.0.0.1', port: srv.address().port, user: 'user', pass: 'pass', from: 'a@x', to: 'b@x', subject: 'hi', body: 'body', plain: true });
  assert.equal(r.accepted, true);
  srv.close();
});

test('imapFetch logs in, selects, and parses the last messages', async () => {
  const hdr = 'From: Alice <alice@x>\r\nSubject: Hello\r\nDate: Tue, 1 Jan 2026\r\n\r\n';
  const body = 'the body text';
  const srv = await lineMock([
    '* OK mock\r\n',                         // greeting
    'a1 OK LOGIN done\r\n',                  // LOGIN
    '* 2 EXISTS\r\na2 OK [READ-WRITE] SELECT done\r\n', // SELECT
    '* SEARCH 101 102 103\r\na3 OK SEARCH\r\n',          // UID SEARCH
    `* 2 FETCH (UID 102 BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {${hdr.length}}\r\n${hdr} BODY[TEXT] {${body.length}}\r\n${body}\r\n)\r\na4 OK FETCH\r\n`, // UID FETCH
  ]);
  const messages = await imapFetch({ host: '127.0.0.1', port: srv.address().port, user: 'user', pass: 'pass', limit: 2, plain: true });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].subject, 'Hello');
  assert.equal(messages[0].from, 'Alice <alice@x>');
  assert.match(messages[0].text, /the body text/);
  srv.close();
});
