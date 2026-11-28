#!/usr/bin/env python3
"""bridge.py: carries eodb's direct-channel frames over Reticulum (https://reticulum.network, pip install rns).

eodb already syncs through a *carrier* (list / get / putNew) and already has a direct channel (app/direct.mjs, app/tcp.mjs): a
length-prefixed UTF-8 frame stream. This process is the whole of the Reticulum seam: it moves those frames, byte for byte, between a
loopback TCP socket and a Reticulum Link. It reads no frame, holds no key and keeps no state. Segments are already AES-256-GCM sealed
by eodb (sealedCarrier) before they get here, so Reticulum's own link encryption is a second layer, not the only one.

  serve    announce a destination; for each incoming Link open a TCP connection to --target (a local directServer) and pipe both ways
  connect  listen on loopback; a local client sends one {"t":"dial","dest":"<32 hex>"} frame, the bridge opens a Link to that
           destination, answers {"t":"up"} (or {"t":"err","m":...}), and then pipes both ways

Every frame crosses as one RNS.Resource (reliable, chunked, compressed, retried), never a bare Packet: a Link Packet is not
retransmitted, and a lost frame would hang an RPC on a slow radio link. The cost is a small advertisement per frame; measured, not tuned.

Not here: a frame is never read or rewritten; no peer discovery beyond an announce; no routing (that is Reticulum's, via a transport node).
"""
import argparse, json, os, socket, struct, sys, threading, time
import RNS

APP, ASPECTS = "eodb", ("space", "sync")
MAX_FRAME = 16 * 1024 * 1024          # a frame bigger than this is refused, not buffered (a hostile peer must not fill memory)


def log(*a):
    print("[eodb-rns]", *a, file=sys.stderr, flush=True)


def read_frame(sock):
    """one length-prefixed frame from a socket, or None at EOF."""
    head = b""
    while len(head) < 4:
        c = sock.recv(4 - len(head))
        if not c:
            return None
        head += c
    (n,) = struct.unpack(">I", head)
    if n > MAX_FRAME:
        raise ValueError("frame too large: %d" % n)
    body = b""
    while len(body) < n:
        c = sock.recv(n - len(body))
        if not c:
            return None
        body += c
    return body


def write_frame(sock, body):
    sock.sendall(struct.pack(">I", len(body)) + body)


def load_identity(path):
    if path and os.path.exists(path):
        return RNS.Identity.from_file(path)
    ident = RNS.Identity()
    if path:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        ident.to_file(path)
        os.chmod(path, 0o600)           # the private key: owner only, and never in the eodb log
    return ident


class Pipe:
    """one TCP socket <-> one Link. Frames in either direction are opaque bytes."""

    def __init__(self, sock, link):
        self.sock, self.link, self.closed = sock, link, False
        link.set_resource_strategy(RNS.Link.ACCEPT_ALL)
        link.set_resource_concluded_callback(self.from_link)
        link.set_link_closed_callback(lambda _l: self.close())
        threading.Thread(target=self.from_socket, daemon=True).start()

    def from_link(self, resource):
        if resource.status != RNS.Resource.COMPLETE or self.closed:
            return
        try:
            write_frame(self.sock, resource.data.read())
        except OSError:
            self.close()

    def from_socket(self):
        try:
            while not self.closed:
                body = read_frame(self.sock)
                if body is None:
                    break
                RNS.Resource(body, self.link)      # reliable; Reticulum chunks and retries it
        except (OSError, ValueError) as e:
            log("socket side ended:", e)
        self.close()

    def close(self):
        if self.closed:
            return
        self.closed = True
        try:
            self.sock.close()
        except OSError:
            pass
        try:
            if self.link.status != RNS.Link.CLOSED:
                self.link.teardown()
        except Exception:
            pass


def serve(args, identity):
    dest = RNS.Destination(identity, RNS.Destination.IN, RNS.Destination.SINGLE, APP, *ASPECTS)
    host, port = args.target.rsplit(":", 1)
    allow = {bytes.fromhex(h) for h in (args.allow or [])}

    def on_link(link):
        if allow:
            # a Link is anonymous until its peer identifies; with an allow-list, an unidentified or unlisted peer is dropped
            def identified(l, ident):
                if ident.hash not in allow:
                    log("refused identity", RNS.prettyhexrep(ident.hash)); l.teardown(); return
                attach(l)
            link.set_remote_identified_callback(identified)
            threading.Timer(args.identify_within, lambda: link.status == RNS.Link.ACTIVE and not getattr(link, "_eodb", False) and link.teardown()).start()
        else:
            attach(link)

    def attach(link):
        link._eodb = True
        try:
            s = socket.create_connection((host, int(port)), timeout=5); s.settimeout(None)
        except OSError as e:
            log("target unreachable:", e); link.teardown(); return
        Pipe(s, link)

    dest.set_link_established_callback(on_link)
    dest.announce()
    log("serving destination", RNS.prettyhexrep(dest.hash), "-> tcp", args.target)
    print(dest.hash.hex(), flush=True)                   # the one line a host reads: the address to put in a route
    while True:
        time.sleep(args.announce_every)
        dest.announce()                                  # announces are rate-limited on slow links: keep this long


def connect(args, identity):
    srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    host, port = args.listen.rsplit(":", 1)
    srv.bind((host, int(port))); srv.listen(8)
    log("dialing for local clients on", args.listen)
    print(srv.getsockname()[1], flush=True)

    def handle(sock):
        try:
            first = read_frame(sock)
            req = json.loads(first or b"{}")
            dest_hash = bytes.fromhex(req["dest"])
            if req.get("t") != "dial" or len(dest_hash) != RNS.Reticulum.TRUNCATED_HASHLENGTH // 8:
                raise ValueError("expected one dial frame with a %d-byte dest" % (RNS.Reticulum.TRUNCATED_HASHLENGTH // 8))
            end = time.time() + args.timeout
            if not RNS.Transport.has_path(dest_hash):
                RNS.Transport.request_path(dest_hash)
                while not RNS.Transport.has_path(dest_hash) and time.time() < end:
                    time.sleep(0.1)
            if not RNS.Transport.has_path(dest_hash):
                raise TimeoutError("no path to %s (it has not been announced where we can hear it)" % dest_hash.hex())
            remote = RNS.Identity.recall(dest_hash)
            out = RNS.Destination(remote, RNS.Destination.OUT, RNS.Destination.SINGLE, APP, *ASPECTS)
            up = threading.Event()
            link = RNS.Link(out, established_callback=lambda l: up.set())
            if not up.wait(max(0.1, end - time.time())):
                link.teardown(); raise TimeoutError("link to %s did not come up" % dest_hash.hex())
            if args.identify:
                link.identify(identity)
            write_frame(sock, b'{"t":"up"}')
            Pipe(sock, link)
        except Exception as e:
            log("dial failed:", e)
            try:
                write_frame(sock, json.dumps({"t": "err", "m": str(e)}).encode()); sock.close()
            except OSError:
                pass

    while True:
        c, _ = srv.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="mode", required=True)
    for name in ("serve", "connect"):
        s = sub.add_parser(name)
        s.add_argument("--rns-config", help="Reticulum config dir (default: the usual ~/.reticulum)")
        s.add_argument("--identity", help="identity file (created if missing); default: a fresh one each run")
        s.add_argument("--loglevel", type=int, default=RNS.LOG_WARNING)
    a = sub.choices["serve"]
    a.add_argument("--target", default="127.0.0.1:7771", help="local directServer to pipe each Link into")
    a.add_argument("--allow", action="append", help="identity hash (hex) allowed to link; repeat. Default: anyone (contents are sealed anyway)")
    a.add_argument("--identify-within", type=float, default=10.0)
    a.add_argument("--announce-every", type=float, default=900.0)
    c = sub.choices["connect"]
    c.add_argument("--listen", default="127.0.0.1:7770")
    c.add_argument("--timeout", type=float, default=30.0)
    c.add_argument("--identify", action="store_true", help="identify to the serving side (needed when it has --allow)")
    args = p.parse_args()
    RNS.Reticulum(args.rns_config, loglevel=args.loglevel)
    ident = load_identity(args.identity)
    if args.mode == "serve":
        serve(args, ident)
    else:
        connect(args, ident)


if __name__ == "__main__":
    main()
