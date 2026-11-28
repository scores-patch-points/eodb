#!/usr/bin/env python3
"""lxmf_send.py: send one LXMF text message and print the reply, as a phone running Sideband would. For trying an eodb node's remote control
from a terminal, and for its tests.

  python3 lxmf_send.py --identity ~/.eodb/me --print-address           # your LXMF address: give it to the node's --bot-allow
  python3 lxmf_send.py --identity ~/.eodb/me --to <node address> --text status --wait 30
Prints one JSON line: {"sent":true,"reply":"..."} or {"sent":true,"reply":null} when nothing came back in time.
"""
import argparse, json, os, sys, threading, time
import RNS, LXMF
from bridge import load_identity, start_reticulum


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--rns-config"); p.add_argument("--identity", required=True); p.add_argument("--loglevel", type=int, default=RNS.LOG_WARNING)
    p.add_argument("--require-shared", action="store_true")
    p.add_argument("--storage", help="LXMF state dir (default: beside the identity)")
    p.add_argument("--print-address", action="store_true")
    p.add_argument("--to"); p.add_argument("--text", default="status"); p.add_argument("--wait", type=float, default=30.0)
    args = p.parse_args()
    ident = load_identity(args.identity)
    if args.print_address:
        print(RNS.Destination.hash(ident, "lxmf", "delivery").hex()); return
    start_reticulum(args)
    router = LXMF.LXMRouter(identity=ident, storagepath=args.storage or (os.path.abspath(args.identity) + ".lxmf"))
    me = router.register_delivery_identity(ident, display_name="lxmf_send")
    got = threading.Event(); reply = {}
    router.register_delivery_callback(lambda m: (reply.setdefault("text", m.content_as_string()), got.set()))
    router.announce(me.hash)
    to = bytes.fromhex(args.to); end = time.time() + args.wait
    while not RNS.Identity.recall(to) and time.time() < end:
        RNS.Transport.request_path(to); time.sleep(1)
    if not RNS.Identity.recall(to):
        print(json.dumps({"sent": False, "reply": None, "why": "no path to the node"})); sys.exit(2)
    router.announce(me.hash)   # now that a path exists, announce again so the node can verify our signature (Sideband announces routinely)
    time.sleep(1)
    out = RNS.Destination(RNS.Identity.recall(to), RNS.Destination.OUT, RNS.Destination.SINGLE, "lxmf", "delivery")
    router.handle_outbound(LXMF.LXMessage(out, me, args.text, "", desired_method=LXMF.LXMessage.DIRECT))
    got.wait(max(0.1, end - time.time()))
    print(json.dumps({"sent": True, "reply": reply.get("text")}), flush=True)
    os._exit(0)   # LXMF and Reticulum keep non-daemon threads; a one-shot tool exits here


if __name__ == "__main__":
    main()
