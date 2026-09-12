// GCMBS V144 - corrige o seletor do reset administrativo de senha.
// O backend exige guarda_id numerico. Algumas cargas de guardas usam guarda_id,
// enquanto a tela antiga montava as opcoes apenas com g.id, produzindo value="NaN".
(() => {
  const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
  let carregando=false;

  async function carregarGuardasReset(){
    const dialog=document.getElementById('senhaEditor');
    const select=document.getElementById('senhaResetGcm');
    const botao=document.getElementById('senhaResetar');
    const msg=document.getElementById('senhaMsg');
    if(!dialog?.open || !select || !botao || carregando) return;

    const opcoes=[...select.options];
    const invalidas=opcoes.some(o=>o.value==='NaN' || (o.value && !(Number(o.value)>0)));
    const semIds=opcoes.length>1 && !opcoes.some(o=>Number(o.value)>0);
    if(!invalidas && !semIds) return;

    carregando=true;
    botao.disabled=true;
    try{
      const token=localStorage.getItem('gcmbs.mobile.token');
      if(!token) throw new Error('Sessão online não autenticada.');
      const r=await fetch(API,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({action:'references'}),
        cache:'no-store'
      });
      let body={}; try{body=await r.json();}catch{}
      if(!r.ok) throw new Error(body.message||`Erro ${r.status}`);
      const guardas=Array.isArray(body.guardas)?body.guardas:[];
      const atualTexto=select.selectedOptions?.[0]?.textContent?.trim()||'';
      select.innerHTML='<option value="">Selecione...</option>'+guardas
        .map(g=>({id:Number(g.guarda_id||g.id||0),nome:String(g.nome_guerra||g.nome_completo||'GCM')}))
        .filter(g=>Number.isInteger(g.id)&&g.id>0)
        .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
        .map(g=>`<option value="${g.id}">${g.nome.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</option>`)
        .join('');
      if(atualTexto && atualTexto!=='Selecione...'){
        const alvo=[...select.options].find(o=>o.textContent.trim()===atualTexto);
        if(alvo) select.value=alvo.value;
      }
      if(msg && !Number(select.value)) msg.textContent='Selecione o GCM que terá a senha redefinida.';
    }catch(e){
      if(msg) msg.textContent=e?.message||'Não foi possível carregar os GCMs.';
    }finally{
      botao.disabled=false;
      carregando=false;
    }
  }

  const observar=()=>{
    const dialog=document.getElementById('senhaEditor');
    if(!dialog) return;
    new MutationObserver(()=>{if(dialog.open) queueMicrotask(carregarGuardasReset);})
      .observe(dialog,{attributes:true,attributeFilter:['open']});
    dialog.addEventListener('click',()=>queueMicrotask(carregarGuardasReset),{capture:true});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observar,{once:true});
  else observar();
})();
