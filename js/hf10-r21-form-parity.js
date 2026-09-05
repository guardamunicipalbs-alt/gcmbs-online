// GCMBS 10.0.73 - paridade visual
// Paridade visual dos formularios Online/App. Nao altera dados nem regras de gravacao.
let r21Frame=0;

const R21_LABELS={
  data_nascimento:'Data de nascimento',
  mes_ferias:'Mês de férias',
  endereco:'Endereço',
  resultado:'Resultado',
  renavam:'RENAVAM',
  potencia:'Potência',
  cnh:'Número da CNH',
  categoria_cnh_validade:'Validade da CNH',
  exige_motorista:'Exige motorista',
  exige_viatura:'Exige viatura',
  tipo_escala:'Tipo de escala',
  ordem_ciclo:'Ordem do ciclo',
  dia_inicio_servico:'Dia inicial do serviço',
  ciclo:'Ciclo',
  turno_inicio:'Turno inicial',
  modo_distribuicao:'Modo de distribuição',
  hora_inicio:'Hora inicial',
  hora_fim:'Hora final',
  intervalo1_inicio:'Intervalo 1 · início',
  intervalo1_fim:'Intervalo 1 · fim',
  intervalo2_inicio:'Intervalo 2 · início',
  intervalo2_fim:'Intervalo 2 · fim'
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

function r21Hide(field){
  document.querySelector(`#onlineCampos [data-online-field="${field}"]`)?.closest('label')?.remove();
}

function r21OrderSections(titles){
  const host=document.getElementById('onlineCampos');
  if(!host)return;
  for(const title of titles){
    const sec=r21Section(title);
    if(sec)host.appendChild(sec);
  }
}

function r21Bool(v){
  return ['1','SIM','TRUE'].includes(String(v??'').toUpperCase());
}

function r21BooleanSelect(field){
  const current=document.querySelector(`#onlineCampos [data-online-field="${field}"]`);
  if(!current||current.tagName==='SELECT')return current;
  const select=document.createElement('select');
  select.setAttribute('data-online-field',field);
  select.disabled=!!current.disabled;
  select.required=!!current.required;
  const sim=r21Bool(current.value);
  select.innerHTML=`<option value="1"${sim?' selected':''}>Sim</option><option value="0"${sim?'':' selected'}>Não</option>`;
  current.replaceWith(select);
  return select;
}

function r21CleanupEmpty(){
  document.querySelectorAll('#onlineCampos .module-editor-section').forEach(sec=>{
    const grid=sec.querySelector('.form-grid');
    if(grid&&!grid.children.length)sec.remove();
  });
}

function r21PatchVersion(){
  const onlineVersao=document.getElementById('onlineVersao');
  if(onlineVersao&&onlineVersao.textContent!=='Online/App 10.0.73')onlineVersao.textContent='Online/App 10.0.73';
  const card=document.getElementById('appAtualizacaoCard');
  if(card&&/10\.0\.(?:62|68|69)/.test(card.innerHTML))card.innerHTML=card.innerHTML.replace(/10\.0\.(?:62|68|69)/g,'10.0.73');
  document.querySelectorAll('[data-app-version],.app-version,.online-version').forEach(el=>{
    if(/10\.0\.(?:62|68|69)/.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/10\.0\.(?:62|68|69)/g,'10.0.73');
  });
  document.querySelectorAll('main *').forEach(el=>{
    if(el.children.length===0&&/^Online(?:\/App)?\s+10\.0\.(?:62|68|69)$/i.test(String(el.textContent||'').trim()))el.textContent='Online/App 10.0.73';
  });
}

function r21PatchForm(){
  const title=String(document.getElementById('onlineEditorTitulo')?.textContent||'');
  if(!document.getElementById('onlineCampos'))return;
  for(const [f,t] of Object.entries(R21_LABELS))r21SetLabel(f,t);

  if(/Cadastro de Guardas/i.test(title)){
    ['rg','data_nascimento','pai','mae','naturalidade','email','telefone'].forEach(f=>r21Move(f,'Dados pessoais'));
    r21Move('mes_ferias','Lotação e configuração operacional');
    ['cnh','categoria_cnh_validade'].forEach(f=>r21Move(f,'CNH e autorizações'));
    r21Move('observacao','Observações');
  }
  if(/Equipes/i.test(title)){
    ['tipo_escala_id','ordem_ciclo','ciclo','dia_inicio_servico','turno_inicio','modo_distribuicao'].forEach(f=>r21Move(f,'Jornada e ciclo'));
    r21Move('participa_gerador','Operação');
  }
  if(/Postos Operacionais/i.test(title)){
    r21BooleanSelect('exige_viatura');
    ['descricao','endereco'].forEach(f=>r21Move(f,'Localização e descrição'));
    ['exige_motorista','exige_viatura','viatura_id'].forEach(f=>r21Move(f,'Requisitos operacionais'));
    r21Move('observacao','Observações');
    r21OrderSections(['Identificação','Prioridade e efetivo','Funcionamento','Localização e descrição','Requisitos operacionais','Observações']);
  }
  if(/Tipos de Escalas/i.test(title)){
    ['jornada','intervalo_inicio','intervalo_fim'].forEach(r21Hide);
    ['tipo_escala','categoria'].forEach(f=>r21Move(f,'Tipo de escala'));
    ['hora_inicio','hora_fim'].forEach(f=>r21Move(f,'Horário'));
    ['intervalo1_inicio','intervalo1_fim','intervalo2_inicio','intervalo2_fim'].forEach(f=>r21Move(f,'Intervalos'));
    r21Move('observacao','Observações');
    r21OrderSections(['Tipo de escala','Horário','Intervalos','Descrição','Observações']);
  }
  if(/Cadastro de Viaturas/i.test(title)){
    ['renavam','chassi','motor'].forEach(f=>r21Move(f,'Documentação e identificação'));
    ['cor','potencia','cilindrada','categoria'].forEach(f=>r21Move(f,'Características'));
  }
  r21CleanupEmpty();
}

function r21Apply(){r21PatchVersion();r21PatchForm();}
function r21Schedule(){if(r21Frame)return;r21Frame=requestAnimationFrame(()=>{r21Frame=0;r21Apply();});}

const r21Obs=new MutationObserver(r21Schedule);
function r21Init(){r21Obs.observe(document.body,{childList:true,subtree:true,characterData:true});r21Apply();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r21Init,{once:true});else r21Init();
console.info('[GCMBS] Paridade visual 10.0.73 ativa');
