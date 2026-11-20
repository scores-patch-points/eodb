// VERBATIM copy of fold() from the original page ("Your database: everything folded from the pharos log"), used as the oracle: the ported engine's
// log view, folded by THIS function, must give the same state as the original's own in-memory log. Not edited.
function fold(upto){
 const L=LOG.slice(0,upto==null?LOG.length:upto);
 const dead=new Set(L.filter(e=>e.op==='retract').map(e=>e.body.of));
 const S={ws:[],tb:[],files:[],docs:[],reads:{},maps:{},mapLog:[]};
 for(const e of L){if(e.op==='retract'||(dead.has(e.id)&&e.op!=='blk+'))continue;const b=e.body;
  const tb=()=>S.tb.find(x=>x.id===b.tb);
  switch(e.op){
   case 'ws+':S.ws.push({id:b.id,name:b.name,eid:e.id});break;
   case 'tb+':S.tb.push({id:b.id,ws:b.ws,name:b.name,std:b.std,f:[],r:[],eid:e.id});break;
   case 'fld+':{const t=tb();if(t)t.f.push({id:b.id,n:b.n,t:b.t,m:b.m,to:b.to,x:b.x});break;}
   case 'fld=':{const t=tb();const f=t&&t.f.find(x=>x.id===b.id);if(f)Object.assign(f,b.set);break;}
   case 'row+':{const t=tb();if(t)t.r.push({id:b.id,v:{...b.v},eid:e.id});break;}
   case 'rows+':{const t=tb();if(t)for(const r of b.rows)t.r.push({id:r.id,v:{...r.v},src:b.src,eid:e.id});break;}
   case 'cell=':{const t=tb();const r=t&&t.r.find(x=>x.id===b.rid);if(r)r.v[b.fid]=b.v;break;}
   case 'file+':S.files.push({...b,eid:e.id,seq:e.seq});break;
   case 'doc+':S.docs.push({id:b.id,ws:b.ws,title:b.title,kind:b.kind||'doc',blocks:[],voice:[],cmts:[],shares:[],eid:e.id,seq:e.seq,ts:e.ts});break;
   case 'doc=':{const d=S.docs.find(x=>x.id===b.id);if(d){if(b.title!=null)d.title=b.title;if(b.font)d.font=b.font;}break;}
   case 'cmt+':{const d=S.docs.find(x=>x.id===b.doc);if(d)d.cmts.push({...b,seq:e.seq});break;}
   case 'cmt=':{const d=S.docs.find(x=>x.id===b.doc);const c=d&&d.cmts.find(x=>x.id===b.id);if(c)c.resolved=b.resolved;break;}
   case 'share+':{const d=S.docs.find(x=>x.id===b.doc);if(d)d.shares.push({who:b.who,role:b.role});break;}
   case 'blk+':{const d=S.docs.find(x=>x.id===b.doc);if(d){const nb={id:b.id,t:b.t||'p',x:b.x||'',h:b.h||null,done:false,eid:e.id,dead:dead.has(e.id)};const i=b.after?d.blocks.findIndex(x=>x.id===b.after):-1;if(b.after&&i<0)d.blocks.push(nb);else d.blocks.splice(i+1,0,nb);}break;}
   case 'blk=':{const d=S.docs.find(x=>x.id===b.doc);const k=d&&d.blocks.find(x=>x.id===b.id);if(k){if(b.x!=null)k.x=b.x;if('h' in b)k.h=b.h;if(b.t)k.t=b.t;if(b.done!=null)k.done=b.done;}break;}
   case 'voice+':{const d=S.docs.find(x=>x.id===b.doc);if(d)d.voice.push({hash:b.hash,secs:b.secs,mime:b.mime});break;}
   case 'read':(S.reads[b.hash]=S.reads[b.hash]||[]).push({...b,eid:e.id,seq:e.seq});break;
   case 'map':{(S.maps[b.src]=S.maps[b.src]||{})[b.col]={...b,n:e.seq,eid:e.id};S.mapLog.push({...b,n:e.seq,ts:e.ts});break;}
  }}
 S.docs.forEach(d=>{d.blocks=d.blocks.filter(x=>!x.dead);});
 return S;}
