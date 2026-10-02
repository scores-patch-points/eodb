// Minimal browser shim so ESM modules that transitively touch window /
// navigator / indexedDB can be imported under node for falsification tests.
// Only shapes the code under test actually uses at import time.

const noop = () => {};

class FakeStore {
  constructor(name) {
    this.name = name;
    this.data = new Map();
  }
  createObjectStore(_name, _opts) { return { createIndex() {}, index() { return { getAll() { return Promise.resolve([]); } }; } }; }
  objectStoreNames = { contains: () => false };
  transaction() { return { objectStore: () => ({ get: () => ({ result: null }), getAll: () => ({ result: [] }) }), oncomplete: null }; }
}

class FakeIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.onupgradeneeded = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}
class FakeIDBFactory {
  open(_name, _version) {
    const req = new FakeIDBRequest();
    const db = { objectStoreNames: { contains: () => false }, createObjectStore() {}, transaction() {} };
    req.result = db;
    queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
    return req;
  }
  deleteDatabase() { return new FakeIDBRequest(); }
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    get length() { return m.size; },
    key: (i) => [...m.keys()][i],
  };
}
const store = makeStorage();
const listeners = {};
function makeEventTarget() {
  return {
    addEventListener(t, fn) { (listeners[t] ||= new Set()).add(fn); },
    removeEventListener(t, fn) { listeners[t]?.delete(fn); },
    dispatchEvent(e) { for (const fn of listeners[e.type] || []) { try { fn(e); } catch {} } return true; },
  };
}

const win = {
  ...makeEventTarget(),
  location: { href: 'http://localhost/', origin: 'http://localhost', search: '' },
  navigator: { onLine: true, userAgent: 'node-shim' },
  localStorage: store,
  sessionStorage: store,
  setTimeout, clearTimeout, setInterval, clearInterval,
  crypto,
  indexedDB: new FakeIDBFactory(),
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: clearTimeout,
};
globalThis.window = win;
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: store, configurable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: win.indexedDB, configurable: true });
Object.defineProperty(globalThis, 'requestAnimationFrame', { value: win.requestAnimationFrame, configurable: true });
Object.defineProperty(globalThis, 'cancelAnimationFrame', { value: clearTimeout, configurable: true });
globalThis.self = globalThis;