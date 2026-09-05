const VERSION='gcmbs-online-100071-hf13-pendencias';
const HF13_IMPORT="import './hf13-pendencias-v71.js?v=100071hf13';\n";
const LEGACY_GUARD_IMPORT="import './v62-permuta-loop-guard.js?v=100071';\n";

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(/^gcmbs/i.test(key))await caches.delete(key);
  await self.clients.claim();
})()));

// O GCMBS é operacional e deve sempre consultar a publicação mais recente.
// HF13 injeta SOMENTE o import da camada de fechamento de pendências no Online,
// mantendo a mesma ordem validada no pacote Android: guard legado -> HF13 -> app-core.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const response=await fetch(event.request,{cache:'no-store'});
    if(!response.ok)return response;
    const headers=new Headers(response.headers);
    headers.set('cache-control','no-store');
    headers.set('x-gcmbs-version','10.0.71-hf13');
    if(url.pathname.endsWith('/js/app.js')){
      const original=await response.text();
      let body=original;
      if(!original.includes('hf13-pendencias-v71.js')){
        body=original.includes(LEGACY_GUARD_IMPORT)
          ? original.replace(LEGACY_GUARD_IMPORT,LEGACY_GUARD_IMPORT+HF13_IMPORT)
          : HF13_IMPORT+original;
      }
      headers.set('content-type','application/javascript; charset=utf-8');
      return new Response(body,{status:response.status,statusText:response.statusText,headers});
    }
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  })());
});

console.info('[GCMBS SW] 10.0.71 HF13 ativo',VERSION);