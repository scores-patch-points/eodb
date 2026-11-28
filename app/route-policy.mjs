// route-policy.mjs: which routes a node may dial. Two origins:
//   'link'  the share link or the owner's own call: the person chose it, so it is dialed as given.
//   'log'   a locator entry read from the shared log: anyone who can write could have put it there, so it is vetted before it is dialed
//           (and the engine only offers it here if its author is verified and not a guest, see engine.mjs `learned`).
// A vetted route is never "safe", only "not a way to make this node reach somewhere it did not mean to": no private or loopback address
// reachable from a log entry, no local-bridge or raw-socket scheme unless it names loopback, no scheme this node has no adapter for.
// Not covered: DNS that resolves a public name to a private address later (rebinding); resolve-and-pin belongs in the carrier.

const LOGGABLE = new Set(['relay', 'http', 'mailbox', 'lora', 'reticulum']);   // schemes a log entry may add
const HEX32 = /^[0-9a-f]{32}$/;                                               // regex-ok: a destination hash, not language

const v4 = (h) => { const p = h.split('.'); return p.length === 4 && p.every((x) => x !== '' && String(Number(x)) === x && Number(x) < 256) ? p.map(Number) : null; };
/** true when a host is a loopback, private, link-local, metadata or otherwise internal address or name */
export function internalHost(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return true;
  const a = v4(h);
  if (a) return a[0] === 10 || a[0] === 127 || a[0] === 0 || (a[0] === 169 && a[1] === 254) || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || (a[0] === 192 && a[1] === 168) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) || a[0] >= 224;
  if (h.includes(':')) return h === '::1' || h === '::' || h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('::ffff:');
  return /^\d+$/.test(h) || /^0x/.test(h);   // regex-ok: numeric-host spellings (decimal/hex IPv4), not language
}

/** vet one route. Returns { ok: true } or { ok: false, why }. `trusted` are hosts already named by the share link (a log entry may repeat them). */
export function vetRoute(uri, { origin = 'log', trusted = [] } = {}) {
  const scheme = String(uri).split(':')[0];
  if (origin === 'link') return { ok: true };
  if (!LOGGABLE.has(scheme)) return { ok: false, why: `scheme "${scheme}" cannot be added from the log (only a share link or the owner may add it)` };
  if (scheme === 'reticulum') {
    const dest = uri.slice('reticulum:'.length).split('?')[0];
    if (!HEX32.test(dest)) return { ok: false, why: 'reticulum route is not a 32-hex destination hash' };
    if (new URLSearchParams(uri.split('?')[1] || '').has('bridge')) return { ok: false, why: 'a log entry may not name the local bridge' };
    return { ok: true };
  }
  const base = scheme === 'mailbox' ? uri.slice('mailbox:'.length) : scheme === 'lora' ? uri.slice('lora:'.length) : uri.slice(scheme.length + 1);
  let u; try { u = new URL(scheme === 'relay' || scheme === 'http' || scheme === 'lora' || scheme === 'mailbox' ? base.split('#')[0] : base); } catch { return { ok: false, why: 'not a parseable URL' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, why: `protocol ${u.protocol} not allowed from the log` };
  if (u.username || u.password) return { ok: false, why: 'credentials in a route URL are not allowed from the log' };
  if (internalHost(u.hostname) && !trusted.includes(u.host)) return { ok: false, why: `internal address ${u.hostname} cannot be added from the log` };
  return { ok: true };
}

/** the hosts a set of link routes names (so the log may repeat a private relay the person chose) */
export function hostsOf(routes) { const out = []; for (const r of routes) { try { const s = String(r).split(':')[0]; out.push(new URL(s === 'relay' || s === 'http' ? String(r).slice(s.length + 1) : String(r).replace(/^[a-z]+:/, '')).host); } catch { /* not a URL route */ } } return out; }   // regex-ok: scheme prefix of a route URI, not language
