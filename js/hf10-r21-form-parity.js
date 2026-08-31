// GCMBS 10.0.68 - HF10 R21
// Paridade visual dos formularios Online/App. Nao altera dados nem regras de gravacao.
let r21Frame=0;

const R21_LABELS={
  data_nascimento:'Data de nascimento',
  mes_ferias:'Mês de férias',
  endereco:'Endereço',
  resultado:'Resultado'
};

function r21SetLabel(field,text){
  const input=document.querySelector(`#onlineCampos [data-online-field="${field}"]`);
  const label=input?.closest('label');
  if(!label)return null;
  const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());
  if(node){if(node.nodeValue!==text)node.nodeValue=text;}
  else label.insertBefore(document.createTextNode(text),label.firstChild);
  return label;
}

function r21Section(title){
  return [...document.querySelectorAll('#onlineCampos .module-editor-section')]
    .find(s=>String(s.querySelector('h3')?.textContent||'').trim()===title)||null;
}

function r21EnsureSection(title,beforeTitle='Outros dados'){
  let sec=r21Section(title);if(sec)return sec;
  const host=document.getElementById('onlineCampos');if(!host)return null;
  sec=document.createElement('section');sec.className='form-section module-editor-section';
  sec.innerHTML=`<h3>${title}</h3><div class="form-grid"></div>`;
  const before=r21Section(beforeTitle);if(before)host.insertBefore(sec,before);else host.appendChild(sec);
  return sec;
}

function r21Move(field,title){
  const label=document.querySelector(`#onlineCampos [data-online-field="${field}"]`)?.closest('label');
  if(!label)return;
  const target=r21EnsureSection(title)?.querySelector('.form-grid');
  if(target&&label.parentElement!==target)target.appendChild(label);
}

function r21CleanupEmpty(){
  document.querySelectorAll('#onlineCampos .module-editor-section').forEach(sec=>{
    const grid=sec.querySelector('.form-grid');
    if(grid&&!grid.children.length)sec.remove();
  });
}

function r21PatchVersion(){
  const card=document.getElementById('appAtualizacaoCard');
  if(card&&/10\.0\.62/.test(card.innerHTML))card.innerHTML=card.innerHTML.replaceAll('10.0.62','10.0.68');
  document.querySelectorAll('[data-app-version],.app-version,.online-version').forEach(el=>{
    if(/10\.0\.62/.test(el.textContent||''))el.textContent=(el.textContent||'').replaceAll('10.0.62','10.0.68');
  });
}

function r21PatchForm(){
  const title=String(document.getElementById('onlineEditorTitulo')?.textContent||'');
  if(!document.getElementById('onlineCampos'))return;
  for(const [f,t] of Object.entries(R21_LABELS))r21SetLabel(f,t);

  if(/Cadastro de Guardas/i.test(title)){
    r21Move('data_nascimento','Dados pessoais');
    r21Move('mes_ferias','Lotação e configuração operacional');
    r21Move('observacao','Observações');
  }
  if(/Postos Operacionais/i.test(title)){
    r21Move('descricao','Localização e descrição');
    r21Move('endereco','Localização e descrição');
  }
  r21CleanupEmpty();
}

function r21Apply(){r21PatchVersion();r21PatchForm();}
function r21Schedule(){if(r21Frame)return;r21Frame=requestAnimationFrame(()=>{r21Frame=0;r21Apply();});}

const r21Obs=new MutationObserver(r21Schedule);
function r21Init(){r21Obs.observe(document.body,{childList:true,subtree:true});r21Apply();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r21Init,{once:true});else r21Init();
console.info('[GCMBS] HF10 R21 paridade visual 10.0.68 ativa');
