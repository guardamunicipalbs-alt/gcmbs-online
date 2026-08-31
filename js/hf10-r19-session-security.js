// GCMBS 10.0.68 - HF10 R19
// Segurança de sessão: "Lembrar acesso" mantém sessão entre fechamentos normais,
// mas o clique explícito em Sair sempre invalida e remove o token local.
const R19_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';

function r19LogoutExplicito(){
  const token=localStorage.getItem('gcmbs.mobile.token')||'';
  if(token){
    fetch(R19_API,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body:JSON.stringify({action:'logout'}),
      cache:'no-store',
      keepalive:true
    }).catch(()=>{});
  }
  localStorage.removeItem('gcmbs.mobile.token');
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('#sair'))r19LogoutExplicito();
},true);

console.info('[GCMBS] HF10 R19 logout explícito revoga sessão lembrada');
