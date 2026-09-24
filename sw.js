const VERSION='gcmbs-online-100262-version-identity';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(/^gcmbs/i.test(key))await caches.delete(key);
  await self.clients.claim();
})()));

// HTML, JS e CSS sempre consultam a publicação mais recente; não armazenar bancos de horas.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(!response.ok)return response;
    const headers=new Headers(response.headers);
    headers.set('cache-control','no-store');
    headers.set('x-gcmbs-version','10.0.154');
    headers.set('x-gcmbs-banco-competencia','integral-v233-r2');
    headers.set('x-gcmbs-visual','paridade-cumulativa-v102');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }));
});

console.info('[GCMBS SW] Banco de Horas competência integral V233 R2',VERSION);
