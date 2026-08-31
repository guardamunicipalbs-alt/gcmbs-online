const VERSION='gcmbs-online-100068-hf10r16-3-quadro';
const R15_TAG='<script type="module" src="./js/hf10-r15-online-stability.js?v=20260826hf10r15"></script>';
const R16_TAG='<script type="module" src="./js/hf10-r16-3-quadro-modal.js?v=20260831hf10r16r3"></script>';
const R12_TAG='<script type="module" src="./js/hf10-r12-guardas-rescue.js?v=20260824hf10r12"></script>';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(/^gcmbs/i.test(key))await caches.delete(key);
  await self.clients.claim();
})()));

function isMain(url,request){
  if(request.mode!=='navigate'||url.origin!==self.location.origin)return false;
  return /\/gcmbs-online\/(?:index\.html)?$/.test(url.pathname);
}
function cleanOldHotfixes(html){
  return html
    .replace(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/hf10-r13-guardas-search-stability\.js[^"']*["'][^>]*><\/script>/ig,'')
    .replace(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/hf10-r14-guardas-search-stability\.js[^"']*["'][^>]*><\/script>/ig,'')
    .replace(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/hf10-r15-online-stability\.js[^"']*["'][^>]*><\/script>/ig,'')
    .replace(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/hf10-r16-3-quadro-modal\.js[^"']*["'][^>]*><\/script>/ig,'');
}
function injectStability(html){
  html=cleanOldHotfixes(html);
  const audit=html.match(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/v62-auditoria-app-fix\.js[^"']*["'][^>]*><\/script>/i)?.[0]||'';
  const app=html.match(/<script\b[^>]*\bsrc=["'](?:\.\/)?js\/app\.js[^"']*["'][^>]*><\/script>/i)?.[0]||'';
  const first=audit||app;
  const stability=R15_TAG+R16_TAG;
  if(first)html=html.replace(first,stability+first);
  else if(html.includes('</body>'))html=html.replace('</body>',stability+'</body>');
  else html+=stability;

  if(html.includes('hf10-r12-guardas-rescue.js')){
    html=html.replace(/js\/hf10-r12-guardas-rescue\.js\?v=[^"']+/g,'js/hf10-r12-guardas-rescue.js?v=20260824hf10r12');
  }else if(app){
    html=html.replace(app,R12_TAG+app);
  }else if(html.includes('</body>')){
    html=html.replace('</body>',R12_TAG+'</body>');
  }else html+=R12_TAG;
  return html;
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const response=await fetch(event.request,{cache:'no-store'});
    if(!response.ok||!isMain(url,event.request))return response;
    const html=injectStability(await response.text());
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('cache-control','no-store');
    headers.set('x-gcmbs-hotfix','HF10-R16.3');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  })());
});

console.info('[GCMBS SW] HF10 R16.3 ativo',VERSION);
