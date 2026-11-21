// background.js — the EODB service worker: the sealed store + sync engine, always on, in the browser.
// This is the same engine the web app and the headless node run (engine.mjs), backed by IndexedDB in the worker.
import { openSpace } from './engine.mjs';
import * as B from './vendor/pharos/browser-store.mjs';

const cells = await (await fetch(chrome.runtime.getURL('vendor/pharos/cells.json'))).json();

let space = null;
async function boot() {
  const log = await B.autoBackend('eodb-log');
  const blobs = await B.autoBackend('eodb-blobs');
  space = await openSpace({ name: 'eodb', backend: log.backend, blobBackend: blobs.backend, cells, join: undefined });
  return space;
}
const ready = boot().catch((e) => { console.error('eodb background boot failed', e); return null; });

// The store is the one place that survives page loads; the popup / side panel / content scripts talk to it here.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const s = await ready; if (!s) return sendResponse({ ok: false, error: 'not booted' });
    if (msg && msg.t === 'status') return sendResponse({ ok: true, role: s.role, device: s.deviceName, peers: s.peers(), entries: s.report().entries, routesUp: s.report().share ? s.report().share.routesUp : null });
    if (msg && msg.t === 'page') return sendResponse({ ok: true, page: msg.page });   // the popup hands us page context; we hold it for the chat
    sendResponse({ ok: false, error: 'unknown message' });
  })();
  return true;   // async sendResponse
});
