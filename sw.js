const VERSION='gcmbs-online-100071-hf13-pendencias';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(/^gcmbs/i.test(key))await caches.delete(key);
  await self.clients.claim();
})()));

// O GCMBS é operacional e deve sempre consultar a publicação mais recente.
// Não há injeção de scripts nem cache de HTML: Online e App usam o mesmo pacote.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(!response.ok)return response;
    const headers=new Headers(response.headers);
    headers.set('cache-control','no-store');
    headers.set('x-gcmbs-version','10.0.71');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }));
});

console.info('[GCMBS SW] 10.0.71 HF13 ativo',VERSION);