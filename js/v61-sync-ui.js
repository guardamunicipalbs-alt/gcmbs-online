const BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const QUADRO_V62=BASE+'gcmbs-quadro-v62';
const API_V6=BASE+'gcmbs-mobile-api-v6';
const _fetch=window.fetch.bind(window);
const hojeFortaleza=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
const hojeUTC=()=>new Date().toISOString().slice(0,10);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Compatibilidade imediata: clientes 10.0.61 passam a usar as rotas corrigidas v62.
window.fetch=async function(input,init){
  let original=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
  let url=original
    .replace('/gcmbs-quadro-v61','/gcmbs-quadro-v62')
    .replace('/gcmbs-actions-v58','/gcmbs-actions-v62')
    .replace('/gcmbs-extra-cession-v58','/gcmbs-extra-assumption-v62');
  let nextInit=init?{...init}:{};
  try{
    if(url.includes('/gcmbs-mobile-api-v6')&&typeof nextInit.body==='string'){
      const body=JSON.parse(nextInit.body);
      if(String(body?.action||'').toLowerCase()==='login'){
        body.remember=localStorage.getItem('gcmbs.login.remember')==='1';
        nextInit.body=JSON.stringify(body);
      }
    }
  }catch{}
  if(input instanceof Request){
    input=url===original?input:new Request(url,input);
  }else input=url;
  return _fetch(input,nextInit);
};

function fmtSync(iso){if(!iso)return 'ainda não registrada';try{return new Date(iso).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'});}catch{return String(iso)}}
function ensureBadge(){let el=document.getElementById('syncStatus');if(el)return el;const host=document.querySelector('.header-user')||document.querySelector('header');if(!host)return null;el=document.createElement('span');el.id='syncStatus';el.className='sync-status';Object.assign(el.style,{fontSize:'11px',color:'#cbd5e1',maxWidth:'330px',lineHeight:'1.25'});const first=host.querySelector('#headerUsuario');host.insertBefore(el,first||null);return el;}
async function atualizar(){const el=ensureBadge();if(!el)return;const token=localStorage.getItem('gcmbs.mobile.token');if(!token){el.textContent='Sincronização: aguardando login';return;}try{const r=await _fetch(QUADRO_V62,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action:'sync_status'}),cache:'no-store'});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.message||`HTTP ${r.status}`);const s=b.sincronizacao||{};el.textContent=`Última sincronização Desktop ↔ Online/App: ${fmtSync(s.ultima_sincronizacao)}${s.desktop_version?' · Desktop '+s.desktop_version:''}`;el.title=`Pendentes: ${Number(s.pendentes||0)} · Erros recentes: ${Number(s.erros_recentes||0)} · GCMBS Online/App 10.0.62`;el.style.color=Number(s.erros_recentes||0)>0?'#fecaca':Number(s.pendentes||0)>0?'#fde68a':'#bbf7d0';}catch(e){el.textContent='Sincronização: indisponível';el.title=e?.message||'Falha ao consultar sincronização';el.style.color='#fecaca';}}

function corrigirDataBoot(){
  const local=hojeFortaleza(),utc=hojeUTC();
  if(local===utc)return;
  let qMudou=false;
  for(const id of ['quadroData','escalaIni','escalaFim','pmData','bcData','chkData','occData','msgDataServico']){
    const el=document.getElementById(id);if(el&&el.value===utc){el.value=local;if(id==='quadroData')qMudou=true;}
  }
  if(qMudou)document.getElementById('quadroData')?.dispatchEvent(new Event('change',{bubbles:true}));
}
function corrigirDataNovo(id){setTimeout(()=>{const el=document.getElementById(id);if(el)el.value=hojeFortaleza();},20)}

function corrigirRotulos(){
  const n=document.getElementById('qViaturasBaixadas')?.closest('.dashboard-card');
  if(n){const span=n.querySelector('span'),small=n.querySelector('small');if(span)span.textContent='Baixadas / indisponíveis';if(small)small.textContent='Fora de operação e fora de manutenção';n.dataset.title='Baixadas / indisponíveis';}
}

function instalarLembrarAcesso(){
  const form=document.getElementById('loginForm');if(!form||document.getElementById('loginLembrar'))return;
  const btn=document.getElementById('entrar');
  const label=document.createElement('label');label.className='check';label.innerHTML='<input id="loginLembrar" type="checkbox"> Lembrar meu acesso neste dispositivo';
  form.insertBefore(label,btn||null);
  const lembrar=localStorage.getItem('gcmbs.login.remember')==='1';label.querySelector('input').checked=lembrar;
  const user=localStorage.getItem('gcmbs.login.usuario');if(lembrar&&user&&document.getElementById('loginUsuario'))document.getElementById('loginUsuario').value=user;
  form.addEventListener('submit',()=>{const on=!!document.getElementById('loginLembrar')?.checked;localStorage.setItem('gcmbs.login.remember',on?'1':'0');const u=document.getElementById('loginUsuario')?.value||'';if(on&&u)localStorage.setItem('gcmbs.login.usuario',u);else localStorage.removeItem('gcmbs.login.usuario');},true);
}

async function api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  const r=await _fetch(API_V6,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify({action,...payload}),cache:'no-store'});
  const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.message||`HTTP ${r.status}`);return b;
}

function instalarMinhaSenha(){
  const host=document.querySelector('.header-user');if(!host||document.getElementById('minhaSenha'))return;
  const b=document.createElement('button');b.id='minhaSenha';b.className='logout';b.type='button';b.textContent='Minha senha';
  const sair=document.getElementById('sair');host.insertBefore(b,sair||null);
  b.addEventListener('click',async()=>{
    const atual=prompt('Informe sua senha atual:','');if(atual===null)return;
    const nova=prompt('Informe a nova senha:','');if(!nova)return;
    const conf=prompt('Confirme a nova senha:','');if(conf!==nova)return alert('A confirmação da nova senha não confere.');
    try{await api('change_password',{senha_atual:atual,nova_senha:nova});alert('Senha alterada com sucesso.');}catch(e){alert(e.message||'Não foi possível alterar a senha.');}
  });
}

const OCC_LABELS={id:'ID',data:'Data',hora:'Hora',tipo:'Tipo',posto:'Posto',viatura_id:'Viatura',equipe:'Equipe',responsavel_id:'Responsável',local:'Local',descricao:'Descrição',resultado:'Resultado',criado_em:'Criado em',naturezas:'Naturezas',natureza_outro:'Outra natureza',recebida_via:'Recebida via',recebida_via_outro:'Outro meio',suspeitos_dados:'Suspeitos',suspeitos_sexo:'Sexo dos suspeitos',suspeitos_sexo_outro:'Descrição do sexo dos suspeitos',vitimas_dados:'Vítimas',vitimas_sexo:'Sexo das vítimas',vitimas_sexo_outro:'Descrição do sexo das vítimas',testemunhas_dados:'Testemunhas',uso_algemas:'Uso de algemas',justificativa_algemas:'Justificativa das algemas',materiais_apreendidos:'Materiais apreendidos',composicao_equipe:'Composição da equipe',condutor_ocorrencia_id:'Condutor',procedimentos_adotados:'Procedimentos adotados',historico_ocorrencia:'Histórico',demais_arquivos:'Demais arquivos'};
let occCache=null,refNomes=null;
function valorOcc(k,v){
  if(v===null||v===undefined||String(v).trim()==='')return '';
  if((/foto|arquivo/i.test(k))&&String(v).length>500)return 'Arquivo/foto preservado no registro';
  if(k==='composicao_equipe'){
    try{const a=Array.isArray(v)?v:JSON.parse(v);if(Array.isArray(a)&&refNomes)return a.map(x=>refNomes.get(Number(x))||`GCM ${x}`).join(', ');}catch{}
  }
  if(k==='condutor_ocorrencia_id'&&refNomes)return refNomes.get(Number(v))||String(v);
  if(typeof v==='object')return JSON.stringify(v);
  if(typeof v==='string'&&/^[\[{]/.test(v.trim())){try{const p=JSON.parse(v);return Array.isArray(p)?p.join(', '):JSON.stringify(p);}catch{}}
  return String(v);
}
async function carregarOccCache(){
  const [o,r]=await Promise.all([api('entity_list',{entity:'ocorrencias_operacionais',limit:500,offset:0}),api('references').catch(()=>({guardas:[]}))]);
  occCache=o.records||[];refNomes=new Map((r.guardas||[]).map(g=>[Number(g.id),g.nome_guerra||g.nome_completo||`GCM ${g.id}`]));
}
async function abrirOcorrenciaOnline(idx){
  try{if(!occCache)await carregarOccCache();const rec=occCache?.[idx],d=rec?.data||{};if(!rec)return;
    const keys=Object.keys(d).filter(k=>d[k]!==null&&d[k]!==undefined&&String(d[k]).trim()!=='');
    const titulo=document.getElementById('quadroModalTitulo'),meta=document.getElementById('quadroModalMeta'),lista=document.getElementById('quadroModalLista'),modal=document.getElementById('quadroModal');
    if(!titulo||!meta||!lista||!modal)return;
    titulo.textContent=`Ocorrência ${d.id||''}`.trim();meta.textContent=`${d.data||''} ${d.hora||''} · ${keys.length} campo(s) registrado(s)`;
    lista.innerHTML=keys.map(k=>`<div class="item"><small>${esc(OCC_LABELS[k]||k.replaceAll('_',' '))}</small><strong>${esc(valorOcc(k,d[k])||'—')}</strong></div>`).join('')||'<div class="empty">A ocorrência não possui campos preenchidos.</div>';
    modal.classList.remove('hidden');
  }catch(e){alert(e.message||'Não foi possível abrir a ocorrência completa.');}
}
function aprimorarOcorrencias(){
  const host=document.getElementById('occLista');if(!host)return;
  [...host.querySelectorAll('article.record-card')].forEach((card,idx)=>{if(card.dataset.v62Detalhe)return;card.dataset.v62Detalhe='1';card.style.cursor='pointer';card.title='Clique para ver a ocorrência completa';card.addEventListener('click',()=>abrirOcorrenciaOnline(idx));});
}

function aplicarCompatibilidade(){
  corrigirRotulos();instalarLembrarAcesso();instalarMinhaSenha();corrigirDataBoot();aprimorarOcorrencias();
  const occ=document.getElementById('occLista');if(occ&&!occ.dataset.v62Observer){occ.dataset.v62Observer='1';new MutationObserver(()=>{occCache=null;aprimorarOcorrencias();}).observe(occ,{childList:true});}
}

document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target:null;if(!t)return;if(t.closest('#occNovo'))corrigirDataNovo('occData');if(t.closest('#chkNovo'))corrigirDataNovo('chkData');},true);
window.addEventListener('DOMContentLoaded',()=>{atualizar();setInterval(atualizar,15000);setTimeout(aplicarCompatibilidade,80);setTimeout(aplicarCompatibilidade,600)});
window.addEventListener('gcmbs:sync-refresh',atualizar);
console.info('[GCMBS] compatibilidade Online 10.0.62 ativa');
