// GCMBS 10.0.62 — paridade do Cadastro de Viaturas com o Desktop.
// A API/contrato deve fornecer os 19 campos funcionais. Este módulo apenas
// organiza e rotula esses campos; não cria colunas nem altera dados.

const VIATURA_LABELS={
  prefixo:'Prefixo',
  placa:'Placa',
  renavam:'RENAVAM',
  marca:'Marca',
  modelo:'Modelo',
  ano_fabricacao:'Ano de fabricação',
  ano_modelo:'Ano/modelo',
  tipo:'Tipo',
  status:'Status',
  cor:'Cor',
  combustivel:'Combustível',
  potencia:'Potência',
  cilindrada:'Cilindrada',
  categoria:'Categoria',
  chassi:'Chassi',
  motor:'Motor',
  intervalo_troca_oleo_km:'Intervalo troca de óleo (km)',
  km_ultima_troca_oleo:'KM da última troca de óleo',
  observacao:'Observação'
};

const VIATURA_SECOES={
  'Identificação da viatura':['prefixo','placa','renavam','marca','modelo','ano_fabricacao','ano_modelo','tipo','status'],
  'Características':['cor','combustivel','potencia','cilindrada','categoria','chassi','motor'],
  'Troca de óleo':['intervalo_troca_oleo_km','km_ultima_troca_oleo'],
  'Observações':['observacao']
};

function tituloViaturas(){
  return /Cadastro de Viaturas/i.test(String(document.getElementById('onlineTitulo')?.textContent||'')) ||
    /Cadastro de Viaturas/i.test(String(document.getElementById('onlineEditorTitulo')?.textContent||''));
}

function campo(host,nome){return host?.querySelector(`[data-online-field="${nome}"]`)||null;}
function labelCampo(host,nome){return campo(host,nome)?.closest('label')||null;}

function secao(host,nome){
  let s=[...host.querySelectorAll('.form-section')].find(x=>String(x.querySelector('h3')?.textContent||'').trim()===nome);
  if(!s){
    s=document.createElement('section');
    s.className='form-section module-editor-section';
    s.innerHTML=`<h3>${nome}</h3><div class="form-grid"></div>`;
    const substitutas=[...host.querySelectorAll('.form-section')].find(x=>/Substitutas operacionais/i.test(String(x.querySelector('h3')?.textContent||'')));
    if(substitutas)host.insertBefore(s,substitutas);else host.appendChild(s);
  }
  return s;
}

function trocarRotulo(label,texto){
  if(!label)return;
  const no=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());
  if(no)no.nodeValue=texto;
}

function ajustarFormulario(){
  const dialog=document.getElementById('onlineEditor'),host=document.getElementById('onlineCampos');
  if(!dialog?.open||!host||!/Cadastro de Viaturas/i.test(String(document.getElementById('onlineEditorTitulo')?.textContent||'')))return;

  for(const [nome,campos] of Object.entries(VIATURA_SECOES)){
    const grid=secao(host,nome).querySelector('.form-grid');
    for(const f of campos){
      const lab=labelCampo(host,f);if(!lab)continue;
      if(lab.parentElement!==grid)grid.appendChild(lab);
      trocarRotulo(lab,VIATURA_LABELS[f]||f);
    }
  }

  // Remove apenas seções genéricas que ficaram vazias depois da reorganização.
  for(const s of [...host.querySelectorAll('.form-section')]){
    const nome=String(s.querySelector('h3')?.textContent||'').trim();
    if(/^(Outros dados|Dados adicionais)$/i.test(nome)&&!s.querySelector('[data-online-field]'))s.remove();
  }

  // Tipos numéricos do Desktop: apenas melhora a entrada; não muda armazenamento.
  for(const f of ['ano_fabricacao','ano_modelo','intervalo_troca_oleo_km','km_ultima_troca_oleo']){
    const el=campo(host,f);if(el&&el.tagName==='INPUT'){el.inputMode='numeric';}
  }
}

function ajustarRotulosLista(){
  if(!tituloViaturas())return;
  const card=document.getElementById('onlineRegistrosCard');if(!card||card.classList.contains('hidden'))return;
  for(const item of card.querySelectorAll('.online-kv')){
    for(const b of item.querySelectorAll('b')){
      const atual=String(b.textContent||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const chave=Object.keys(VIATURA_LABELS).find(k=>k.replace(/_/g,' ')===atual || (k==='renavam'&&atual==='renavam') || (k==='potencia'&&atual==='potencia'));
      if(chave)b.textContent=VIATURA_LABELS[chave];
    }
  }
}

let agendado=false;
function aplicar(){
  if(agendado)return;agendado=true;
  queueMicrotask(()=>{agendado=false;ajustarFormulario();ajustarRotulosLista();});
}

new MutationObserver(aplicar).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',aplicar,{once:true});else aplicar();
