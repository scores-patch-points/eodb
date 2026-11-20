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

# 7. narrow screens: the sidebar becomes a compact sticky top bar with a menu button (it filled the first screen of a phone), content gets phone-sized
#    padding, wide things scroll or stack, touch targets grow, inputs stop triggering iOS zoom, and the status bar no longer covers content.
RESPONSIVE_CSS = """<style id="responsive">
@media (max-width:800px){
 .app{flex-direction:column}
 aside{width:auto;position:sticky;top:0;z-index:30;padding:6px 10px;max-height:52px;overflow:hidden;border-right:0;border-bottom:1px solid var(--line)}
 aside .brand{min-height:40px;padding-right:56px}aside .brand small{display:none}
 body.navopen aside{max-height:100vh;max-height:100dvh;overflow:auto;padding-bottom:24px}
 #navtoggle{position:absolute;right:8px;top:5px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);cursor:pointer;font:20px/1 system-ui}
 section.main{padding:12px 14px 72px}
 h1{font-size:22px}
 .row{gap:12px}.grow{min-width:0;flex-basis:100%}
 .types{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
 .paper{padding:24px 18px;min-height:0}
 .gbody{flex-direction:column}.gout{display:none}.gside{width:auto;border-left:0;border-top:1px solid var(--line)}
 .pop{left:8px;right:8px;max-width:none}.sheet{padding:14px}
 nav.tabs{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}nav.tabs button{white-space:nowrap;padding:11px 12px}
 input:not([type=range]):not([type=checkbox]):not([type=radio]),textarea,select{font-size:16px}
 button.b,.it,.wsh{min-height:40px}.wsh,.it{padding-top:9px;padding-bottom:9px}
 table{font-size:13px}
 #storebar{left:8px;right:8px;bottom:6px;text-align:center;font-size:11.5px;padding:5px 8px}
}
@media (max-width:420px){.crumb{font-size:12px}section.main{padding:10px 10px 72px}.types{grid-template-columns:1fr 1fr}}
@media (min-width:801px){#navtoggle{display:none}}
</style>
</head>"""
sub('responsive css', "</head>", RESPONSIVE_CSS)
sub('render hook', "function render(){", "function render(){render0();narrowNav();}\nlet NAVOPEN=false;\nfunction narrowNav(){const on=matchMedia('(max-width:800px)').matches;document.body.classList.toggle('navopen',on&&NAVOPEN);const a=document.querySelector('aside');if(!a)return;let t=document.getElementById('navtoggle');\n if(!t){t=document.createElement('button');t.id='navtoggle';t.type='button';t.setAttribute('aria-label','Menu');t.onclick=()=>{NAVOPEN=!NAVOPEN;narrowNav();};a.appendChild(t);}\n t.textContent=NAVOPEN&&on?'\\u00d7':'\\u2630';t.setAttribute('aria-expanded',String(NAVOPEN&&on));}\n"
    "document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('aside .it, aside .wsh, aside .link')&&matchMedia('(max-width:800px)').matches)NAVOPEN=false;},true);\naddEventListener('resize',()=>{if(document.querySelector('aside'))narrowNav();});\nfunction render0(){")

# 8. sharing: a link opens this space on another device; the page never asks how they connect.
sub('module join', "const log=await B.autoBackend('eodb-log'),blobs=await B.autoBackend('eodb-blobs');\nwindow.__ENGINE_READY=openSpace({name:'eodb',backend:log.backend,blobBackend:blobs.backend,cells}).then(e=>{window.ENGINE=e;return e;});",
    "const log=await B.autoBackend('eodb-log'),blobs=await B.autoBackend('eodb-blobs');\nconst join=new URLSearchParams(location.hash.slice(1)).get('join')||undefined;\nwindow.__ENGINE_READY=openSpace({name:'eodb',backend:log.backend,blobBackend:blobs.backend,cells,join}).then(e=>{window.ENGINE=e;if(join)history.replaceState(null,'',location.pathname+location.search);return e;},err=>{window.__ENGINE_ERROR=err;return null;});")
sub('boot error + guest', "async function boot(){ENGINE=await new Promise(r=>{(function w(){window.__ENGINE_READY?r(window.__ENGINE_READY):setTimeout(w,20);})();});refreshLog();",
    "async function boot(){ENGINE=await new Promise(r=>{(function w(){window.__ENGINE_READY?r(window.__ENGINE_READY):setTimeout(w,20);})();});\n"
    " if(!ENGINE){const m=window.__ENGINE_ERROR&&window.__ENGINE_ERROR.message||'unknown problem';document.body.innerHTML='<div style=\"max-width:520px;margin:12vh auto;padding:0 18px;font:15px/1.5 system-ui\"><h2>Couldn\\'t open this space</h2><p>'+esc(m)+'</p><p>Check the link and your connection, then reload this page.</p></div>';throw new Error('open failed: '+m);}\n"
    " refreshLog();")
sub('seed only solo', " if(!LOG.length)await seed();else{", " if(!LOG.length&&ENGINE.role==='solo')await seed();else{")
sub('storebar share', " b.className=bad?'bad':'';b.textContent=bad?'Not saved: '+(r.lastError||(r.damaged+' damaged, '+r.gaps+' missing'))+' ('+r.unpersisted+' waiting)':(r.unpersisted?'Saving…':'Saved on this device, encrypted')+' · '+r.backend+' · '+r.entries+' entries';}",
    " const sh=r.share?(r.share.routesUp?' · shared, connected':' · shared, reconnecting…'):'';b.className=bad?'bad':'';b.textContent=bad?'Not saved: '+(r.lastError||(r.damaged+' damaged, '+r.gaps+' missing'))+' ('+r.unpersisted+' waiting)':(r.unpersisted?'Saving…':'Saved on this device, encrypted')+' · '+r.backend+sh+' · '+r.entries+' entries';}")
sub('share card', "h+='<div class=\"gt\">TIME TRAVEL</div>", "h+=vShare();h+='<div class=\"gt\">TIME TRAVEL</div>")
sub('share funcs', "function storebar(){", r"""const DEFAULT_ROUTES=window.EODB_ROUTES||['relay:'+location.protocol+'//'+(location.hostname||'127.0.0.1')+':8853'];
function vShare(){const r=ENGINE.report().share;const up=r&&r.routesUp>0;const conn=r?'<span class="chip '+(up?'c-ok':'c-w')+'">'+(up?'connected':'reconnecting…')+'</span>':'';
 let h='<div class="gt">SHARING</div><div class="card">';
 if(ENGINE.role==='guest')h+='<div class="fh"><b>'+ic('users-three')+' You joined a shared space</b>'+conn+'</div><div class="note" style="margin-top:6px">What you change reaches everyone in the space, and what they change arrives here. '+ENGINE.peers().length+' device'+(ENGINE.peers().length===1?'':'s')+' so far.</div>';
 else if(ENGINE.role==='founder'){h+='<div class="fh"><b>'+ic('users-three')+' This space is shared</b>'+conn+'</div>';
  if(U.shareLink)h+='<div class="note" style="margin:6px 0">Anyone with this link can open this space on their own device, see everything in it and add to it.</div><input readonly style="width:100%" value="'+esc(U.shareLink)+'" onclick="this.select()"><div class="fh" style="margin-top:8px"><button class="b p" onclick="copyLink()">Copy link</button><button class="b" onclick="stopSharing()">Stop sharing</button></div>';
  else h+='<div class="note" style="margin-top:6px">Sharing was stopped. <button class="b p" onclick="shareSpace()">Create a new link</button></div>';}
 else h+='<div class="fh"><b>'+ic('users-three')+' Share this space</b></div><div class="note" style="margin:6px 0">Make a link. Anyone you give it to can open this space on their own device, see everything and add to it. Everything is encrypted before it leaves this device.</div><button class="b p" onclick="shareSpace()">Create a share link</button>';
 return h+'</div>';}
async function shareSpace(){const l=await ENGINE.share({routes:DEFAULT_ROUTES});U.shareLink=location.origin+location.pathname+'#join='+l;render();storebar();}
async function stopSharing(){await ENGINE.unshare();U.shareLink=null;render();}
function copyLink(){try{navigator.clipboard.writeText(U.shareLink);}catch(e){}}
function storebar(){""")
sub('founder link on boot', " ENGINE.onChange(()=>{refreshLog();D=fold();render();storebar();});", " if(ENGINE.role==='founder'){try{U.shareLink=location.origin+location.pathname+'#join='+await ENGINE.share();}catch(e){}}\n ENGINE.onChange(()=>{refreshLog();D=fold();render();storebar();});")

open(out, 'w', encoding='utf-8').write(s)
print('ok', len(s))
