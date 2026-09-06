const VERSION='gcmbs-online-100075-communication-contract-ui3';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(/^gcmbs/i.test(key))await caches.delete(key);
  await self.clients.claim();
})()));

// O GCMBS é operacional e deve sempre consultar a publicação mais recente.
// Hotfix 10.0.75: o CSS complementar restaura somente estilos perdidos na
// consolidação; não altera dados, regras, permissões ou payloads.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.endsWith('/css/app.css')){
    event.respondWith((async()=>{
      const [base,hf]=await Promise.all([
        fetch(event.request,{cache:'no-store'}),
        fetch(new URL('css/hf-module-ui-v75.css?v=20260905ui3',self.registration.scope),{cache:'no-store'})
      ]);
      if(!base.ok)return base;
      const baseCss=await base.text();
      const hfCss=hf.ok?await hf.text():'';
      const headers=new Headers(base.headers);
      headers.set('content-type','text/css; charset=utf-8');
      headers.set('cache-control','no-store');
      headers.set('x-gcmbs-version','10.0.75-ui3');
      return new Response(`${baseCss}\n\n${hfCss}`,{status:200,statusText:'OK',headers});
    })());
    return;
  }

  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(!response.ok)return response;
    const headers=new Headers(response.headers);
    headers.set('cache-control','no-store');
    headers.set('x-gcmbs-version','10.0.75');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }));
});

console.info('[GCMBS SW] 10.0.75 contrato canônico + UI3 ativo',VERSION);
