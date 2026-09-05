const VERSION='gcmbs-online-100071-hf12-permuta-mista';
const HF12_IMPORT="import './v71-permuta-mista.js?v=100071';\n";

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(/^gcmbs/i.test(key))await caches.delete(key);
  await self.clients.claim();
})()));

// O GCMBS é operacional e deve sempre consultar a publicação mais recente.
// HF12 injeta SOMENTE o import da camada v71 no js/app.js do Online.
// Nenhum HTML, dado operacional ou outro script é alterado pelo Service Worker.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const response=await fetch(event.request,{cache:'no-store'});
    if(!response.ok)return response;
    const headers=new Headers(response.headers);
    headers.set('cache-control','no-store');
    headers.set('x-gcmbs-version','10.0.71-hf12-online');
    if(url.pathname.endsWith('/js/app.js')){
      const original=await response.text();
      const body=original.includes("./v71-permuta-mista.js")?original:HF12_IMPORT+original;
      headers.set('content-type','application/javascript; charset=utf-8');
      return new Response(body,{status:response.status,statusText:response.statusText,headers});
    }
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  })());
});

console.info('[GCMBS SW] 10.0.71 HF12 Online ativo',VERSION);
