#!/usr/bin/env python3
"""Builds app/index.html from the original page ("Your database: everything folded from the pharos log.html") by a fixed list of replacements.
The UI code is otherwise untouched. Usage: python3 port-from-original.py <original.html> <out index.html>. Each replacement must match exactly once or the script fails."""
import re, sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()

def sub(label, old, new, regex=False, flags=0):
    global s
    n = len(re.findall(old, s, flags)) if regex else s.count(old)
    if n != 1: sys.exit(f'port failed: "{label}" matched {n} times (expected 1)')
    s = re.sub(old, lambda m: new, s, count=1, flags=flags) if regex else s.replace(old, new, 1)

# 1. the log and the file store are the engine's now
sub('globals', "const LOG=[],BLOBS=new Map();let KEY=null,PUB=null,WRITER='unsigned',CNT=0,D=null;",
    "const LOG=[];let CNT=0,D=null,ENGINE=null;const BLOBS={has:h=>ENGINE.blobs.has(h),get:h=>ENGINE.blobs.get(h),set(h,v){ENGINE.blobs.put(h,v.bytes,v.type);return BLOBS;}};")
# 2. hashing: WebCrypto when present, otherwise the engine's real SHA-256 (the original fell back to a 32-bit non-cryptographic hash)
sub('sha fallback', "catch(e){let h=2166136261,o='';for(const b of bytes){h^=b;h=Math.imul(h,16777619)>>>0;}for(let i=0;i<8;i++){h=Math.imul(h^i,16777619)>>>0;o+=h.toString(16).padStart(8,'0');}return o;}", "catch(e){return ENGINE.sha(bytes);}")
# 3. the key and the append: gone from the page, done by the engine (real pharos entries, Ed25519, encrypted store)
sub('initKey+appendQ', r"async function initKey\(\)\{.*?LOG\.push\(e\);return e;\}",
    "function refreshLog(){LOG.length=0;LOG.push(...ENGINE.view());}\nasync function appendQ(op,body){const e=ENGINE.append(op,body);refreshLog();return e;}", regex=True, flags=re.S)
sub('seed key', r"async function seed\(\)\{\s*await initKey\(\);", "async function seed(){", regex=True)
# 4. the device-key card tells the truth
sub('card chip', "<span class=\"chip '+(KEY?'c-ok':'c-w')+'\">'+(KEY?ic('shield-check')+' signing works':'not available here')+'</span>", "<span class=\"chip '+(ENGINE.report().unsigned?'c-w':'c-ok')+'\">'+(ENGINE.report().unsigned?ENGINE.report().unsigned+' signing':ic('shield-check')+' all signed')+'</span>")
sub('card text', "Writer <span class=\"tag\">'+esc(WRITER)+'</span>, ECDSA P-256 through Web Crypto. Every entry is hashed (SHA-256) and signed. One device in this demo, so there is nothing to merge yet.",
    "Writer <span class=\"tag\">'+esc(ENGINE.writer)+'</span>, Ed25519 through a device-key grant. Every entry is a pharos entry (content-addressed, SHA-256), signed, and saved encrypted on this device ('+esc(ENGINE.report().backend)+'). Another tab sees your changes live; a cell edited in two places at once keeps both edits in the log.")
# 5. start: open the stored space; seed the demo content only into an empty one
sub('start', "(async()=>{await seed();render();})();",
    "async function boot(){ENGINE=await new Promise(r=>{(function w(){window.__ENGINE_READY?r(window.__ENGINE_READY):setTimeout(w,20);})();});refreshLog();\n"
    " const ids=[...JSON.stringify(LOG.map(e=>e.body)).matchAll(/\"[a-z]{1,3}(\\d+)\"/g)].map(m=>+m[1]).filter(n=>n>=100);CNT=ids.length?Math.max(...ids):CNT;\n"
    " if(!LOG.length)await seed();else{SEED_HASH=await sha(enc.encode(SEED_CSV));D=fold();}\n"
    " ENGINE.onChange(()=>{refreshLog();D=fold();render();storebar();});ENGINE.onStatus(()=>{refreshLog();storebar();});storebar();}\n"
    "function storebar(){let b=document.getElementById('storebar');if(!b){b=document.createElement('div');b.id='storebar';document.body.appendChild(b);}const r=ENGINE.report();const bad=r.lastError||r.damaged||r.gaps;\n"
    " b.className=bad?'bad':'';b.textContent=bad?'Not saved: '+(r.lastError||(r.damaged+' damaged, '+r.gaps+' missing'))+' ('+r.unpersisted+' waiting)':(r.unpersisted?'Saving…':'Saved on this device, encrypted')+' · '+r.backend+' · '+r.entries+' entries';}\n"
    "(async()=>{await boot();render();storebar();setInterval(storebar,1000);})();")
# 6. the engine, loaded as a module, and the status bar's style
sub('head', "hyperformula.full.min.js\"></script>\n<style>", "hyperformula.full.min.js\"></script>\n<script type=\"module\">\nimport {openSpace} from './engine.mjs';\nimport * as B from './vendor/pharos/browser-store.mjs';\nconst cells=await (await fetch('./vendor/pharos/cells.json')).json();\nconst log=await B.autoBackend('eodb-log'),blobs=await B.autoBackend('eodb-blobs');\nwindow.__ENGINE_READY=openSpace({name:'eodb',backend:log.backend,blobBackend:blobs.backend,cells}).then(e=>{window.ENGINE=e;return e;});\n</script>\n<style>#storebar{position:fixed;right:10px;bottom:8px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:4px 10px;font-size:12px;color:var(--mut);z-index:50}#storebar.bad{background:var(--badbg);color:var(--bad);border-color:var(--bad)}")
open(out, 'w', encoding='utf-8').write(s)
print('ok', len(s))
