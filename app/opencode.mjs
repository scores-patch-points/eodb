// opencode.mjs: drive a local (or remote) OpenCode server over its HTTP API, from the browser. Browser-safe (fetch + btoa + TextDecoder).
// Auth is HTTP Basic (username defaults to "opencode", password from OPENCODE_SERVER_PASSWORD or a pairing session token).
//
//   info(config)                    -> server info (null if unreachable)
//   createSession(config, {cwd})    -> { id, ... }
//   prompt(config, sessionId, text) -> POST the message
//   chat(config, sessionId, text, { onDelta, onTool }) -> { text, tools, sessionId }  (streams deltas via the SSE /api/event)
//   listSessions(config) / getSession(config, id)

const base = (config) => String(config.url || '').replace(/\/+$/, '');
const auth = (config) => ({ Authorization: 'Basic ' + btoa((config.username || 'opencode') + ':' + (config.password || '')) });

async function j(r) {
  if (!r.ok) { let m = 'HTTP ' + r.status; try { const b = await r.json(); m = b.message || b.error || m; } catch { /* not json */ } throw new Error('opencode: ' + m); }
  return r.status === 204 ? null : r.json();
}

export async function info(config) { try { const r = await fetch(base(config) + '/api/info', { headers: auth(config) }); return r.ok ? r.json() : null; } catch { return null; } }
export async function createSession(config, { cwd = '.' } = {}) { return j(await fetch(base(config) + '/api/session', { method: 'POST', headers: { ...auth(config), 'content-type': 'application/json' }, body: JSON.stringify({ location: { directory: cwd } }) })); }
export async function prompt(config, sessionId, text) { return j(await fetch(base(config) + '/api/session/' + encodeURIComponent(sessionId) + '/prompt', { method: 'POST', headers: { ...auth(config), 'content-type': 'application/json' }, body: JSON.stringify({ text }) })); }
export async function listSessions(config) { return j(await fetch(base(config) + '/api/session', { headers: auth(config) })); }
export async function getSession(config, sessionId) { return j(await fetch(base(config) + '/api/session/' + encodeURIComponent(sessionId), { headers: auth(config) })); }

/** subscribe to the SSE event stream. onEvent(type, data). Returns an abort() function. */
export function stream(config, onEvent, onError) {
  const ctl = new AbortController();
  (async () => {
    try {
      const r = await fetch(base(config) + '/api/event', { headers: { ...auth(config), accept: 'text/event-stream' }, signal: ctl.signal });
      if (!r.ok) throw new Error('event HTTP ' + r.status);
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          for (const line of chunk.split('\n')) { const m = /^data:\s*(.*)$/.exec(line); if (m) { try { const ev = JSON.parse(m[1]); onEvent(ev.type, ev.data || {}, ev); } catch { /* partial/other */ } } }
        }
      }
    } catch (e) { if (e.name !== 'AbortError' && onError) onError(e); }
  })();
  return () => ctl.abort();
}

/** one prompt→response: opens the stream, sends the prompt, collects text deltas + tool calls for this session, resolves on idle. */
export async function chat(config, sessionId, text, { onDelta, onTool, timeoutMs = 300000 } = {}) {
  let full = ''; const tools = [];
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('opencode: timed out waiting for the session to go idle')); }, timeoutMs);
    const stop = stream(config, (type, data) => {
      if (data.sessionID !== sessionId) return;
      if (type === 'session.text.delta' && data.delta) { full += data.delta; if (onDelta) onDelta(data.delta); }
      else if (type === 'session.tool.called') { const t = data.tool || data.name || {}; tools.push(typeof t === 'string' ? t : (t.name || t.id || 'tool')); if (onTool) onTool(data); }
      else if (type === 'session.idle') { stop(); clearTimeout(timer); resolve({ text: full, tools, sessionId }); }
    }, (e) => { clearTimeout(timer); reject(e); });
  });
  await prompt(config, sessionId, text);   // sent after the stream is established, so no delta is missed
  return done;
}
