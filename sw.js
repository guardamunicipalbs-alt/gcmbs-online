const VERSION='gcmbs-online-100161-smart-data-cache';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(/^gcmbs/i.test(key))await caches.delete(key);
  await self.clients.claim();
})()));

// HTML, JS e CSS sempre consultam a publicação mais recente; dados operacionais não ficam no Service Worker.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(!response.ok)return response;
    const headers=new Headers(response.headers);
    headers.set('cache-control','no-store');
    headers.set('x-gcmbs-version','10.0.161-prep');
    headers.set('x-gcmbs-banco-competencia','20-19-v294-paid-cutoff-20260930');
    headers.set('x-gcmbs-runtime','smart-data-cache-v161');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }));
});

console.info('[GCMBS SW] Runtime V161 + competencia 20-19',VERSION);