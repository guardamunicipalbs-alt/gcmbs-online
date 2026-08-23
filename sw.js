const CACHE='gcmbs-mobile-100064-hf8r2-utf8';
const AUDIT_FIX='<script type="module" src="./js/v62-auditoria-app-fix.js?v=20260823hf8r2"></script>';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith((async()=>{
    try{
      const r=await fetch(e.request,{cache:'no-store'});
      const type=r.headers.get('content-type')||'';
      if((e.request.mode==='navigate'||type.includes('text/html'))&&r.ok){
        const html=await r.text();
        if(!html.includes('v62-auditoria-app-fix.js')){
          const appTag=html.match(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/app\.js[^"']*["'][^>]*><\/script>/i)?.[0]||'';
          const body=appTag?html.replace(appTag,AUDIT_FIX+appTag):(html.includes('</body>')?html.replace('</body>',AUDIT_FIX+'</body>'):html+AUDIT_FIX);
          return new Response(body,{status:r.status,statusText:r.statusText,headers:r.headers});
        }
        return new Response(html,{status:r.status,statusText:r.statusText,headers:r.headers});
      }
      return r;
    }catch(err){
      const cached=await caches.match(e.request);if(cached)return cached;throw err;
    }
  })());
});
