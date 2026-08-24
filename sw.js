const CACHE='gcmbs-mobile-100067-hf10r12-guardas-rescue';
const AUDIT_FIX='<script type="module" src="./js/v62-auditoria-app-fix.js?v=20260824hf10r11"></script>';
const GUARDAS_FIX='<script type="module" src="./js/hf10-r12-guardas-rescue.js?v=20260824hf10r12"></script>';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith((async()=>{
    try{
      const r=await fetch(e.request,{cache:'no-store'});
      const type=r.headers.get('content-type')||'';
      if((e.request.mode==='navigate'||type.includes('text/html'))&&r.ok){
        let html=await r.text();
        if(html.includes('v62-auditoria-app-fix.js')){
          html=html.replace(/js\/v62-auditoria-app-fix\.js\?v=[^"']+/g,'js/v62-auditoria-app-fix.js?v=20260824hf10r11');
        }else{
          const appTag=html.match(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/app\.js[^"']*["'][^>]*><\/script>/i)?.[0]||'';
          html=appTag?html.replace(appTag,AUDIT_FIX+appTag):(html.includes('</body>')?html.replace('</body>',AUDIT_FIX+'</body>'):html+AUDIT_FIX);
        }
        if(!html.includes('hf10-r12-guardas-rescue.js')){
          const appTag=html.match(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/app\.js[^"']*["'][^>]*><\/script>/i)?.[0]||'';
          html=appTag?html.replace(appTag,GUARDAS_FIX+appTag):(html.includes('</body>')?html.replace('</body>',GUARDAS_FIX+'</body>'):html+GUARDAS_FIX);
        }else{
          html=html.replace(/js\/hf10-r12-guardas-rescue\.js\?v=[^"']+/g,'js/hf10-r12-guardas-rescue.js?v=20260824hf10r12');
        }
        return new Response(html,{status:r.status,statusText:r.statusText,headers:r.headers});
      }
      return r;
    }catch(err){
      const cached=await caches.match(e.request);if(cached)return cached;throw err;
    }
  })());
});
