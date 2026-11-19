// pharosDoor.mjs: eodb's door onto a pharos (Node only). This repo reaches the pharos through ONE pinned pointer (door/pharos.json): the library is loaded
// only if its sha256 matches, and nothing else of any sibling repo is imported or called. What eodb writes it weaves as entries; what it reads it reads by kind.
// One pharos folder per Matrix room (a room is a base); one writer file per Matrix sender, so merge is a union and needs no lock.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath, pathToFileURL } from "node:url";
import { kindsFor } from "../src/pharosMap.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), DOOR = path.join(HERE, "..", "door");
export const INSTRUMENT = "eodb-pharos-import@1";
export class DoorError extends Error { constructor(code, message, extra = {}) { super(message); this.name = "DoorError"; this.code = code; Object.assign(this, extra); } }
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

/** the pharos library via the pinned pointer; throws a DoorError with the fix when it cannot be trusted */
export async function loadLib(doorDir = DOOR) {
  let ptr; try { ptr = JSON.parse(fs.readFileSync(path.join(doorDir, "pharos.json"), "utf8")); } catch { throw new DoorError("pharos_not_installed", `no pharos door in ${doorDir}. Install it: node <pharos>/bin/pharos.mjs install pharos-core --target "${doorDir}" --apply`); }
  if (ptr.kind !== "pharos-pointer" || !ptr.lib || !ptr.sha256) throw new DoorError("pharos_bad_pointer", "pharos.json is not a pharos pointer");
  const lib = path.resolve(doorDir, ptr.lib); let buf; try { buf = fs.readFileSync(lib); } catch { throw new DoorError("pharos_missing", `the pinned library ${lib} is not there (the pointer is relative to ${doorDir}: the pharos repo is expected beside this one)`); }
  if (sha(buf) !== ptr.sha256) throw new DoorError("pharos_drift", `the pharos library at ${lib} changed since this door was installed (sha256 mismatch). Review the change, then re-run install`, { expected: ptr.sha256, found: sha(buf) });
  return { P: await import(pathToFileURL(lib).href), lib, sha256: ptr.sha256 };
}

export class Door {
  constructor({ dir, lib }) { this.dir = path.resolve(dir); this.name = path.basename(this.dir); this.L = lib; this.handles = new Map(); this.declaredNs = new Set(); }
  handle(writer) { if (!this.handles.has(writer)) this.handles.set(writer, this.L.P.open(this.name, { dir: this.dir, writer })); return this.handles.get(writer); }
  reader() { return this.L.P.open(this.name, { dir: this.dir, writer: "eodb-reader", frame: false }); }
  count() { return this.L.P.status(this.reader()).entries; }
  /** declare the kinds of a namespace and the holon, once. A kind already declared with another cell is a typed refusal, never overwritten. */
  declare(ns) {
    if (this.declaredNs.has(ns)) return;
    const h = this.handle("eodb-import"), g = this.L.P.ground(h), have = new Map(g.kinds.map((k) => [k.name, k.cell])), kinds = kindsFor(ns);
    for (const { name, cell } of kinds) {
      if (have.has(name)) { if (have.get(name) !== cell) throw new DoorError("kind_conflict", `kind ${name} is already declared at ${have.get(name)}, not ${cell}`); continue; }
      this.L.P.weave(h, { cell: "DEF·Figure", kind: "kind", addr: `kind:${name}`, body: { name, cell }, basis: { instrument: INSTRUMENT } });
    }
    const names = kinds.map((k) => k.name), holon = { name: "eodb", ground: [], figure: [], pattern: names, out: names };
    if (!g.holons.some((x) => x.name === "eodb" && JSON.stringify([x.ground, x.figure, x.pattern, x.out]) === JSON.stringify([holon.ground, holon.figure, holon.pattern, holon.out]))) this.L.P.weave(h, { cell: "DEF·Pattern", kind: "holon", addr: "holon:eodb", body: holon, basis: { instrument: INSTRUMENT } });
    this.declaredNs.add(ns);
  }
  /** weave one mapped event as the writer for its sender */
  weave(w) { return this.L.P.weave(this.handle(w.writer), { cell: w.cell, kind: w.kind, addr: w.addr, body: w.body, of: [], basis: { ...w.basis, instrument: INSTRUMENT } }); }
  /** the live entries of this pharos (retractions applied), in pharos order */
  entries() { return this.L.P.fold(this.reader(), {}).entries; }
}
