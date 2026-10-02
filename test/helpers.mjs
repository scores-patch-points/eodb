// Shared helpers for falsification tests: browser shim, engine eval,
// deterministic op-event builders, and an in-memory OPFS fake.

import { readFileSync } from 'node:fs';

export async function loadShim() {
  await import('./shim.mjs');
}

// Evaluate public/engine.js (self-contained, no imports) with a window shim
// and return the MatrixEngine surface it assigns to window.
export function evalEngine() {
  const src = readFileSync(new URL('../public/engine.js', import.meta.url), 'utf8');
  const events = {};
  const win = {
    addEventListener(t, fn) { (events[t] ||= new Set()).add(fn); },
    removeEventListener(t, fn) { events[t]?.delete(fn); },
  };
  // eslint-disable-next-line no-new-func
  const engine = new Function('window', src + '\n;return window.MatrixEngine;')(win);
  return engine;
}

let _seq = 0;
export function eventId() {
  return `$e_${(_seq++).toString(16).padStart(6, '0')}`;
}

export function mkEvent(type, content, ts, sender = '@a:test') {
  return { type, content, origin_server_ts: ts, sender, event_id: eventId() };
}

// A deterministic, chronologically-mixed but valid event log across several
// entity types, exercising every stored operator. Timestamps are assigned so
// that (a) the whole log is NOT in arrival order (out-of-order tails exist,
// which is what chronological() is for), and (b) the log still folds without
// spurious violations when read in the order we emit.
export function makeLog() {
  const t = 1000;
  const ins = (anchor, entity_type, payload = {}, ts = t) =>
    mkEvent('io.matrix-events.ins', { anchor, entity_type, payload }, ts);
  const def = (anchor, path, value, ts) =>
    mkEvent('io.matrix-events.def', { anchor, path, value }, ts);
  const seg = (anchor, partition, ts) =>
    mkEvent('io.matrix-events.seg', { anchor, partition }, ts);
  const con = (source_anchor, target_anchor, relation_type, ts) =>
    mkEvent('io.matrix-events.con', { source_anchor, target_anchor, relation_type }, ts);
  const syn = (input_anchors, output, ts) =>
    mkEvent('io.matrix-events.syn', { input_anchors, output }, ts);
  const eva = (anchor, criterion, result, ts) =>
    mkEvent('io.matrix-events.eva', { anchor, criterion, result, note: '' }, ts);
  const rec = (scope, before_frame, after_frame, ts) =>
    mkEvent('io.matrix-events.rec', { scope, before_frame, after_frame }, ts);

  return [
    def(null, '_schema.tables', ['task', 'note'], t + 10),
    def(null, '_schema.fields.task', [{ name: 'title', type: 'text' }], t + 20),

    ins('task_1', 'task', {}, t + 30),
    def('task_1', 'title', 'first', t + 40),
    ins('task_2', 'task', {}, t + 50),
    def('task_2', 'title', 'second', t + 60),
    ins('note_1', 'note', {}, t + 70),
    def('note_1', 'body', 'a note', t + 80),

    seg('task_1', 'done', t + 90),
    con('note_1', 'task_1', 'annotates', t + 100),
    syn(['task_1', 'task_2'], { type: 'summary', title: 'S' }, t + 110),
    eva('task_2', 'completeness', 'fail', t + 120),
    rec('priority', { p: 'fixed' }, { p: 'scored' }, t + 130),

    // A second wave with timestamps that arrive in order but interleave with
    // the first wave — the tail is appended after the head, so any checkpoint
    // taken at the first wave must still fold correctly when the tail lands.
    ins('task_3', 'task', {}, t + 55),
    def('task_3', 'title', 'third', t + 65),
    seg('task_3', 'backlog', t + 95),
    con('task_2', 'task_3', 'depends_on', t + 105),
  ];
}

// In-memory OPFS lookalike with the minimal surface store.js touches.
// Tracks per-file read counts so tests can falsify re-reads of the file.
export function makeFakeOPFS() {
  const files = new Map(); // name -> Uint8Array
  const reads = new Map(); // name -> count of getFile() calls
  class FakeFile {
    constructor(name) {
      this.name = name;
      this._bytes = files.get(name) || new Uint8Array(0);
    }
    get size() { return this._bytes.length; }
    async arrayBuffer() { return this._bytes.buffer.slice(this._bytes.byteOffset, this._bytes.byteOffset + this._bytes.byteLength); }
  }
  class FakeWritable {
    constructor(name) {
      this.name = name;
      this.pos = files.get(name)?.length || 0;
      this.calls = [];
    }
    async write(data) {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      this.calls.push({ kind: 'write', at: this.pos, len: bytes.length });
      const cur = files.get(this.name) || new Uint8Array(0);
      const next = new Uint8Array(Math.max(this.pos + bytes.length, cur.length));
      next.set(cur, 0);
      next.set(bytes, this.pos);
      files.set(this.name, next);
      this.pos += bytes.length;
    }
    async seek(pos) { this.calls.push({ kind: 'seek', to: pos }); this.pos = pos; }
    async close() { this.calls.push({ kind: 'close' }); }
  }
  const dir = {
    files,
    readCount(name) { return reads.get(name) || 0; },
    async getFileHandle(name, opts) {
      if (!files.has(name) && opts?.create) files.set(name, new Uint8Array(0));
      if (!files.has(name)) throw new Error('not found');
      return {
        name,
        getFile: async () => {
          reads.set(name, (reads.get(name) || 0) + 1);
          return new FakeFile(name);
        },
        createWritable: async () => new FakeWritable(name),
      };
    },
    async removeEntry(name) { files.delete(name); },
    async *[Symbol.asyncIterator]() {
      for (const name of files.keys()) {
        yield [name, { getFile: async () => new FakeFile(name) }];
      }
    },
  };
  return { files, dir };
}

export function installFakeStorage(fakeDir) {
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: { getDirectory: async () => fakeDir },
    configurable: true,
  });
}

export function stripIndex(state) {
  const copy = structuredClone(state);
  delete copy.entitiesByType;
  return copy;
}