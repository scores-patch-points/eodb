#!/usr/bin/env node
// pharosImport.mjs: leave Matrix as the place the data is stored. Replays an eodb room's stored operator events into a pharos (one folder per room), and rebuilds
// the events from a pharos. Lossless and idempotent: the pharos fold of the result equals the room's fold (tests/pharos-import.test.mjs checks the WHOLE state,
// with the repo's own fold.js, not a hash), and importing the same events again weaves nothing new.
//   node tools/pharosImport.mjs import --events room.json|room.jsonl --out <pharos folder> [--ns io.matrix-events] [--room '!id:server']
//   node tools/pharosImport.mjs export --pharos <pharos folder> [--ns io.matrix-events]      (prints the events as a JSON array)
// The input is a room's timeline events ({type, content, origin_server_ts, sender, event_id}). Undecryptable events, other namespaces and empty events are
// counted and skipped, never guessed. Events are woven in the fold's chronological order, so pharos's causal order matches the room's.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chronological, toWeft, fromWeft, kindsFor } from "../src/pharosMap.js"; import { Door, loadLib } from "./pharosDoor.mjs";

export const DEFAULT_NS = "io.matrix-events";

/** weave the stored operator events of a room into the pharos behind `door`. Returns what happened, with the reasons for anything skipped. */
export function importRoom(door, events, { ns = DEFAULT_NS, room = null } = {}) {
  door.declare(ns);
  const before = door.count(), skipped = {}, writers = new Set(); let mapped = 0;
  chronological(events).forEach((e, n) => {
    const w = toWeft(e, { ns, room, n });
    if (w.skip) { skipped[w.skip] = (skipped[w.skip] || 0) + 1; return; }
    door.weave(w); writers.add(w.writer); mapped++;
  });
  return { events: events.length, mapped, skipped, woven: door.count() - before, writers: [...writers].sort() };
}

/** the events a pharos holds for a namespace, as the fold reads them */
export function exportRoom(door, { ns = DEFAULT_NS } = {}) {
  const kinds = new Set(kindsFor(ns).map((k) => k.name));
  return door.entries().filter((e) => kinds.has(e.kind)).map((e) => fromWeft(e, { ns })).filter(Boolean);
}

export function readEvents(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  return text.startsWith("[") ? JSON.parse(text) : text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), cmd = a[0], f = {}; for (let i = 1; i < a.length; i++) if (a[i].startsWith("--")) f[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  try {
    const ns = f.ns || DEFAULT_NS;
    if (cmd === "import" && f.events && f.out) { const door = new Door({ dir: f.out, lib: await loadLib() }); console.log(JSON.stringify({ pharos: door.dir, ...importRoom(door, readEvents(f.events), { ns, room: f.room || null }) }, null, 2)); }
    else if (cmd === "export" && f.pharos) { const door = new Door({ dir: f.pharos, lib: await loadLib() }); console.log(JSON.stringify(exportRoom(door, { ns }), null, 2)); }
    else { console.error("usage: pharosImport.mjs import --events FILE --out PHAROS_DIR [--ns NS] [--room ID]\n       pharosImport.mjs export --pharos PHAROS_DIR [--ns NS]"); process.exit(2); }
  } catch (e) { console.error(`${e.code || "error"}: ${e.message}`); process.exit(1); }
}
