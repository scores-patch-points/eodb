#!/usr/bin/env python3
"""lxmf_bridge.py: eodb sync and a remote-control inbox over LXMF (the message layer Sideband, MeshChat and NomadNet speak). pip install rns lxmf

Why LXMF and not only a Link (bridge.py): an LXMF *propagation node* holds a message until its recipient comes online, so two members who are
never online at the same time still sync. And a Sideband user can talk to an eodb node from their phone.

One daemon per node. It holds a local object store per space and its own LXMF address. A local eodb process talks to it over loopback, in the
same length-prefixed frames as app/tcp.mjs. The first frame chooses the role:

  {"t":"hello","tag":<32 hex>,"peers":[<32 hex>...]}   a CARRIER for one space: then list/get/put exactly as app/direct.mjs directServer.
       A put is stored here (create-only) and sent to every peer of the space. The tag is a secret from the share link: it is how a member
       proves membership. Objects arriving with an unknown tag, an invalid signature, or over the size limits are dropped.
  {"t":"bot"}    an INBOX: text messages with a valid signature are pushed as {"t":"msg","from":hex,"text":...}; the client may send
                 {"t":"send","to":hex,"text":...}. Who may command the node is decided by the client (allow-list), never here.

Gossip, for many members: a newly stored object is forwarded once to every other known peer of its space (create-only, so it cannot loop),
and a peer first heard from is sent everything the space holds. Members learn each other from signed traffic that carries the tag.
Contents are already AES-256-GCM sealed by eodb before they get here; LXMF also encrypts to the recipient.
"""
import argparse, base64, hashlib, json, os, socket, struct, sys, threading, time
import RNS, LXMF
from LXMF.LXMF import pn_announce_data_is_valid
from bridge import read_frame, write_frame, load_identity, start_reticulum, log as _log

T0 = time.time()
def log(*a):
    _log("%6.1fs" % (time.time() - T0), *a)

OBJ_TYPE, HI_TYPE = "eodb-obj/1", "eodb-hi/1"


class Store:
    """objects on disk, per space tag: <dir>/<tag>/<sha256(name)>.obj = u16 name length + name + bytes. Create-only, with a total quota."""

    def __init__(self, root, max_object, max_store):
        self.root, self.max_object, self.max_store = root, max_object, max_store
        self.lock = threading.Lock()
        self.objs = {}          # tag -> {name: path}
        self.total = 0
        os.makedirs(root, exist_ok=True)
        for tag in os.listdir(root):
            d = os.path.join(root, tag)
            if not os.path.isdir(d):
                continue
            for f in os.listdir(d):
                p = os.path.join(d, f)
                with open(p, "rb") as fh:
                    n = struct.unpack(">H", fh.read(2))[0]
                    name = fh.read(n).decode()
                self.objs.setdefault(tag, {})[name] = p
                self.total += os.path.getsize(p)

    def names(self, tag):
        with self.lock:
            return sorted(self.objs.get(tag, {}))

    def get(self, tag, name):
        with self.lock:
            p = self.objs.get(tag, {}).get(name)
        if not p:
            return None
        with open(p, "rb") as fh:
            n = struct.unpack(">H", fh.read(2))[0]
            fh.read(n)
            return fh.read()

    def put(self, tag, name, data):
        """'new' | 'same' | 'exists' (different bytes) | 'refused: why'"""
        if not isinstance(name, str) or not name or len(name.encode()) > 1024:
            return "refused: bad name"
        if len(data) > self.max_object:
            return "refused: object over %d bytes" % self.max_object
        had = self.get(tag, name)
        if had is not None:
            return "same" if had == data else "exists"
        with self.lock:
            if self.total + len(data) > self.max_store:
                return "refused: store full"
            d = os.path.join(self.root, tag); os.makedirs(d, exist_ok=True)
            p = os.path.join(d, hashlib.sha256(name.encode()).hexdigest() + ".obj")
            nb = name.encode()
            with open(p + ".tmp", "wb") as fh:
                fh.write(struct.pack(">H", len(nb)) + nb + data)
            os.replace(p + ".tmp", p)
            self.objs.setdefault(tag, {})[name] = p
            self.total += len(data) + 2 + len(nb)
        return "new"


class Daemon:
    def __init__(self, args, identity):
        self.args, self.identity = args, identity
        os.makedirs(args.storage, exist_ok=True)
        self.store = Store(os.path.join(args.storage, "objects"), args.max_object * 1024, args.max_store * 1024 * 1024)
        self.spaces_file = os.path.join(args.storage, "spaces.json")
        self.spaces = json.load(open(self.spaces_file)) if os.path.exists(self.spaces_file) else {}   # tag -> [peer hex]
        self.lock = threading.Lock()
        self.bots = set()
        self.pending = []          # (peer_hash, fields) waiting for the peer's identity to be known
        self.unverified = []       # (received at, packed bytes): signed by a sender we cannot verify yet
        self.router = LXMF.LXMRouter(identity=identity, storagepath=os.path.join(args.storage, "lxmf"),
                                     propagation_limit=args.propagation_limit, delivery_limit=args.delivery_limit)
        if args.propagation_node_enable:
            self.router.enable_propagation()
        self.dest = self.router.register_delivery_identity(identity, display_name=args.display_name)
        self.router.register_delivery_callback(self.on_message)
        if args.propagation_node:
            self.router.set_outbound_propagation_node(bytes.fromhex(args.propagation_node))
        self.address = self.dest.hash.hex()

    # ---- spaces and peers ----
    def save_spaces(self):
        with open(self.spaces_file + ".tmp", "w") as fh:
            json.dump(self.spaces, fh)
        os.replace(self.spaces_file + ".tmp", self.spaces_file)

    def add_peers(self, tag, peers):
        """register peers for a space; returns the ones that are new (they get a backfill)."""
        new = []
        with self.lock:
            known = self.spaces.setdefault(tag, [])
            for p in peers:
                if p != self.address and p not in known:
                    known.append(p); new.append(p)
            self.save_spaces()
        return new

    def announce_all(self):
        self.router.announce(self.dest.hash)
        if self.router.propagation_destination:
            self.router.announce_propagation_node()

    # ---- sending ----
    def pn_ready(self):
        """LXMF can stamp a propagated message only once it has heard the propagation node's announce (it carries the stamp cost); a message
        handed over before that fails for good. So hold such messages here until the announce has been heard."""
        if not self.args.propagation_node:
            return True
        return pn_announce_data_is_valid(RNS.Identity.recall_app_data(bytes.fromhex(self.args.propagation_node)))

    def send(self, peer_hex, fields=None, text=None):
        h = bytes.fromhex(peer_hex)
        ident = RNS.Identity.recall(h)
        if ident is not None and not self.pn_ready():
            RNS.Transport.request_path(bytes.fromhex(self.args.propagation_node))
            with self.lock:
                self.pending.append((peer_hex, fields, text))
            return False
        if ident is None:
            if self.args.verbose and peer_hex not in getattr(self, "_waiting", set()):
                self._waiting = getattr(self, "_waiting", set()) | {peer_hex}; log("waiting for the identity of", peer_hex)
            RNS.Transport.request_path(h)
            with self.lock:
                self.pending.append((peer_hex, fields, text))
            return False
        if self.args.verbose and peer_hex in getattr(self, "_waiting", set()):
            self._waiting.discard(peer_hex); log("identity known for", peer_hex)
        out = RNS.Destination(ident, RNS.Destination.OUT, RNS.Destination.SINGLE, "lxmf", "delivery")
        # objects follow --method; a text reply to a person always tries DIRECT first (a phone may not be collecting from our propagation node)
        method = LXMF.LXMessage.PROPAGATED if self.args.method == "propagated" and text is None else LXMF.LXMessage.DIRECT
        m = LXMF.LXMessage(out, self.dest, text or "", "", fields or {}, desired_method=method)
        if self.args.propagation_node and method == LXMF.LXMessage.DIRECT:
            m.try_propagation_on_fail = True
        self.router.handle_outbound(m)
        if self.args.verbose: log("sent", (fields or {}).get(LXMF.FIELD_CUSTOM_TYPE, "text"), "to", peer_hex, "method", "propagated" if method == LXMF.LXMessage.PROPAGATED else "direct")
        return True

    def send_object(self, peer_hex, tag, name, data):
        self.send(peer_hex, {LXMF.FIELD_CUSTOM_TYPE: OBJ_TYPE, LXMF.FIELD_CUSTOM_DATA: {"t": tag, "n": name, "b": data}})

    def send_hi(self, peer_hex, tag):
        self.send(peer_hex, {LXMF.FIELD_CUSTOM_TYPE: HI_TYPE, LXMF.FIELD_CUSTOM_DATA: {"t": tag}})

    def backfill(self, peer_hex, tag):
        for name in self.store.names(tag):
            data = self.store.get(tag, name)
            if data is not None:
                self.send_object(peer_hex, tag, name, data)

    def recheck_unverified(self):
        with self.lock:
            held, self.unverified = self.unverified, []
        keep = []
        for at, packed in held:
            m = LXMF.LXMessage.unpack_from_bytes(packed)
            if m.signature_validated:
                self.on_message(m)
            elif m.unverified_reason == LXMF.LXMessage.SOURCE_UNKNOWN and time.time() - at < 120:
                keep.append((at, packed))
            else:
                log("dropped: message whose signature could not be verified from", m.source_hash.hex())
        with self.lock:
            self.unverified.extend(keep)

    def retry_pending(self):
        now = time.time()
        if now - getattr(self, "_last_retry", 0) < 3:
            return
        self._last_retry = now
        with self.lock:
            todo, self.pending = self.pending, []
        for peer, fields, text in todo:
            self.send(peer, fields, text)

    # ---- receiving ----
    def on_message(self, m):
        if not m.signature_validated:
            if m.unverified_reason == LXMF.LXMessage.SOURCE_UNKNOWN and m.packed:
                # we have not heard this sender announce yet: ask for its identity and verify the SAME bytes again later, never accept them unverified
                RNS.Transport.request_path(m.source_hash)
                with self.lock:
                    if len(self.unverified) < 256:
                        self.unverified.append((time.time(), m.packed))
                if self.args.verbose: log("held: unverified until the sender's identity is known", m.source_hash.hex())
                return
            log("dropped: message with an invalid signature from", RNS.prettyhexrep(m.source_hash)); return
        src = m.source_hash.hex()
        fields = m.fields or {}
        if self.args.verbose: log("received", fields.get(LXMF.FIELD_CUSTOM_TYPE, "text"), "from", src)
        kind = fields.get(LXMF.FIELD_CUSTOM_TYPE)
        if kind in (OBJ_TYPE, HI_TYPE):
            d = fields.get(LXMF.FIELD_CUSTOM_DATA) or {}
            tag = d.get("t")
            if not isinstance(tag, str) or tag not in self.spaces:
                log("dropped: object for a space this node does not hold, from", src); return
            if src not in self.spaces[tag] and self.add_peers(tag, [src]):
                self.backfill(src, tag)                       # a member first heard from gets what the space holds
            if kind == OBJ_TYPE:
                data = d.get("b")
                if not isinstance(data, (bytes, bytearray)):
                    return
                r = self.store.put(tag, d.get("n"), bytes(data))
                if r == "new":                                  # forward once: create-only storage means it cannot loop
                    for p in list(self.spaces.get(tag, [])):
                        if p != src:
                            self.send_object(p, tag, d.get("n"), bytes(data))
                elif r.startswith("refused"):
                    log("dropped object from", src, "-", r)
            return
        text = m.content_as_string() if hasattr(m, "content_as_string") else (m.content or b"").decode("utf-8", "replace")
        msg = json.dumps({"t": "msg", "from": src, "text": text}).encode()
        for s in list(self.bots):
            try:
                write_frame(s, msg)
            except OSError:
                self.bots.discard(s)

    # ---- loopback clients ----
    def serve_client(self, sock):
        try:
            first = json.loads(read_frame(sock) or b"{}")
            if first.get("t") == "bot":
                self.bots.add(sock)
                write_frame(sock, json.dumps({"t": "up", "address": self.address}).encode())
                while True:
                    f = read_frame(sock)
                    if f is None:
                        break
                    req = json.loads(f)
                    if req.get("t") == "send" and isinstance(req.get("to"), str) and len(req["to"]) == 32:
                        self.send(req["to"], text=str(req.get("text", ""))[:4000])
                self.bots.discard(sock); return
            tag = first.get("tag")
            if first.get("t") != "hello" or not isinstance(tag, str) or len(tag) != 32 or any(c not in "0123456789abcdef" for c in tag):
                write_frame(sock, b'{"t":"err","m":"expected a hello frame with a 32-hex tag"}'); return
            self.announce_all()
            for p in self.add_peers(tag, [p for p in first.get("peers", []) if isinstance(p, str) and len(p) == 32]):
                self.send_hi(p, tag)                            # introduce ourselves: the peer learns us and backfills
            write_frame(sock, json.dumps({"t": "up", "address": self.address}).encode())
            while True:
                f = read_frame(sock)
                if f is None:
                    break
                m = json.loads(f)
                reply = lambda r: write_frame(sock, json.dumps({"i": m.get("i"), **r}).encode())
                if m.get("t") == "list":
                    reply({"t": "names", "v": self.store.names(tag)})
                elif m.get("t") == "get":
                    b = self.store.get(tag, m.get("n"))
                    reply({"t": "none"} if b is None else {"t": "bytes", "b": base64.b64encode(b).decode()})
                elif m.get("t") == "put":
                    data = base64.b64decode(m.get("b", ""))
                    r = self.store.put(tag, m.get("n"), data)
                    if r == "new":
                        for p in list(self.spaces.get(tag, [])):
                            self.send_object(p, tag, m["n"], data)
                    reply({"t": "ok"} if r in ("new", "same") else {"t": "exists"} if r == "exists" else {"t": "err", "m": r})
        except (OSError, ValueError, KeyError) as e:
            log("client ended:", e)
        finally:
            try:
                sock.close()
            except OSError:
                pass

    def run(self):
        srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        host, port = self.args.listen.rsplit(":", 1)
        srv.bind((host, int(port))); srv.listen(16)
        self.router.announce(self.dest.hash)
        log("lxmf address", self.address, "listening on", "%s:%d" % srv.getsockname()[:2])
        pn = self.router.propagation_destination.hash.hex() if self.router.propagation_destination else None
        if pn:
            self.router.announce_propagation_node()
        print(json.dumps({"address": self.address, "port": srv.getsockname()[1], "propagation": pn}), flush=True)

        # an announce sent before the interfaces are up reaches no one; say it again a few times while links come up, then rarely
        burst = [time.time() + d for d in (2, 5, 10, 20, 35)]

        def loop():
            last_ann = time.time()
            while True:
                time.sleep(1)
                if burst and time.time() >= burst[0]:
                    burst.pop(0); self.announce_all()
                self.retry_pending()
                if self.unverified:
                    self.recheck_unverified()
                if time.time() - last_ann > self.args.announce_every:
                    last_ann = time.time(); self.announce_all()
        def collect():
            # collect what a propagation node held for us while we were away; on its own thread so a slow call never stalls retries or announces
            while self.args.propagation_node:
                try:
                    self.router.request_messages_from_propagation_node(self.identity)
                except Exception as e:
                    log("collect failed:", e)
                time.sleep(self.args.sync_every)
        threading.Thread(target=loop, daemon=True).start()
        threading.Thread(target=collect, daemon=True).start()
        while True:
            c, _ = srv.accept()
            threading.Thread(target=self.serve_client, args=(c,), daemon=True).start()


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--rns-config"); p.add_argument("--identity"); p.add_argument("--loglevel", type=int, default=RNS.LOG_WARNING)
    p.add_argument("--require-shared", action="store_true", help="attach to a running rnsd/Sideband/MeshChat instance, or refuse")
    p.add_argument("--storage", required=True, help="directory for objects, known spaces and LXMF state")
    p.add_argument("--listen", default="127.0.0.1:7772")
    p.add_argument("--display-name", default="eodb")
    p.add_argument("--method", choices=["direct", "propagated"], default="direct", help="direct (falls back to the propagation node if set) or always propagated")
    p.add_argument("--propagation-node", help="hex address of an LXMF propagation node to send through and collect from")
    p.add_argument("--propagation-node-enable", action="store_true", help="also act as a propagation node (needs enable_transport in the Reticulum config)")
    p.add_argument("--sync-every", type=float, default=30.0)
    p.add_argument("--verbose", action="store_true")
    p.add_argument("--announce-every", type=float, default=900.0)
    p.add_argument("--max-object", type=int, default=200, help="largest object accepted, KiB (parts are 128 KiB by default)")
    p.add_argument("--max-store", type=int, default=512, help="total store, MiB")
    p.add_argument("--propagation-limit", type=int, default=256, help="KB per propagated message (LXMF default)")
    p.add_argument("--delivery-limit", type=int, default=1000, help="KB per directly delivered message (LXMF default)")
    args = p.parse_args()
    start_reticulum(args)
    Daemon(args, load_identity(args.identity or os.path.join(args.storage, "identity"))).run()


if __name__ == "__main__":
    main()
