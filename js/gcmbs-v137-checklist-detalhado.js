/* GCMBS V137 — Check-list de Viaturas detalhado e retrocompatível
   Baseado no formulário operacional histórico fornecido pela GCMBS.
   Não cria novas colunas no SQLite: detalhes ficam serializados no campo
   'equipamentos' e os campos antigos recebem um resumo de severidade.
*/
(()=>{
  'use strict';
  if(window.__GCMBS_V137_CHECKLIST_DETALHADO__)return;
  window.__GCMBS_V137_CHECKLIST_DETALHADO__=true;

  const $=id=>document.getElementById(id);
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  const CAMPOS={
    duracao_turno:{label:'Duração do turno',type:'select',options:['NÃO INFORMADO','24 HORAS','12 HORAS - TURNO A','12 HORAS - TURNO B','8 HORAS - TURNO A','8 HORAS - TURNO B','OUTRO']},
    nivel_abastecimento:{label:'Nível de abastecimento',type:'select',options:['NÃO INFORMADO','TANQUE CHEIO','3/4 DE TANQUE','MEIO TANQUE','1/4 DE TANQUE','RESERVA','ABASTECIDA (SEM NÍVEL)','NÃO ABASTECIDA (SEM NÍVEL)']},
    limpeza_recebimento:{label:'Viatura recebida limpa',type:'select',options:['SIM','NÃO']},
    oleo_motor:{label:'Óleo do motor',group:'Lubrificação / manutenção',options:['NORMAL','SOLICITAR TROCA/COMPLEMENTO','NÃO VERIFICADO']},
    oleo_freio:{label:'Óleo / fluido de freio',group:'Lubrificação / manutenção',options:['NORMAL','SOLICITAR TROCA/COMPLEMENTO','NÃO VERIFICADO']},
    liquido_arrefecimento:{label:'Líquido de arrefecimento',group:'Lubrificação / manutenção',options:['NORMAL','SOLICITAR TROCA/COMPLEMENTO','NÃO VERIFICADO','NÃO SE APLICA']},
    agua_reservatorio:{label:'Água do reservatório',group:'Lubrificação / manutenção',options:['NORMAL','SOLICITAR TROCA/COMPLEMENTO','NÃO VERIFICADO','NÃO SE APLICA']},
    pneus_conservacao:{label:'Pneus — conservação',group:'Pneus',options:['BOM','RUIM / SOLICITAR SUBSTITUIÇÃO','NÃO VERIFICADO','NÃO SE APLICA']},
    sirene:{label:'Sirene',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    intermitente:{label:'Intermitente / giroflex',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    farol_baixa:{label:'Farol — luz baixa',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    farol_alta:{label:'Farol — luz alta',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    luz_re:{label:'Luz de ré',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    luz_freio:{label:'Luz de freio',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    pisca_alerta:{label:'Pisca-alerta',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    radio:{label:'Rádio',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    ar_condicionado:{label:'Ar-condicionado',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    buzina:{label:'Buzina',group:'Funcionamento',options:['OK','INOPERANTE','NÃO SE APLICA']},
    chave_ignicao:{label:'Chave de ignição',group:'Itens obrigatórios / presença',options:['OK','AUSENTE','INOPERANTE','NÃO SE APLICA']},
    pneu_sobressalente:{label:'Pneu sobressalente',group:'Itens obrigatórios / presença',options:['OK','AUSENTE','INOPERANTE','NÃO SE APLICA']},
    kit_chave_roda:{label:'Kit chave de roda',group:'Itens obrigatórios / presença',options:['OK','AUSENTE','INOPERANTE','NÃO SE APLICA']},
    triangulo:{label:'Triângulo',group:'Itens obrigatórios / presença',options:['OK','AUSENTE','INOPERANTE','NÃO SE APLICA']},
    kit_macaco:{label:'Kit macaco',group:'Itens obrigatórios / presença',options:['OK','AUSENTE','INOPERANTE','NÃO SE APLICA']},
    cinto_seguranca:{label:'Cinto de segurança',group:'Itens obrigatórios / presença',options:['OK','AUSENTE','INOPERANTE','NÃO SE APLICA']}
  };

  const GRUPOS=['Lubrificação / manutenção','Pneus','Funcionamento','Itens obrigatórios / presença'];
  const ATENCAO_APENAS=new Set(['radio','ar_condicionado','pneu_sobressalente','kit_chave_roda','triangulo','kit_macaco']);

  function ids(){
    const online=!!$('chkForm');
    return online?{
      online:true,form:'chkForm',items:'chkItens',situacao:'chkSituacao',obs:'chkObs',
      coarse:{pneus:'chk_pneus',luzes:'chk_luzes',sirene:'chk_sirene',giroflex:'chk_giroflex',freios:'chk_freios',oleo:'chk_oleo',agua:'chk_agua',combustivel:'chk_combustivel',limpeza:'chk_limpeza',avarias:'chk_avarias',equipamentos:'chk_equipamentos'}
    }:{
      online:false,form:'form',items:'itens',situacao:'situacao',obs:'observacao',
      coarse:{pneus:'pneus',luzes:'luzes',sirene:'sirene',giroflex:'giroflex',freios:'freios',oleo:'oleo',agua:'agua',combustivel:'combustivel',limpeza:'limpeza',avarias:'avarias',equipamentos:'equipamentos'}
    };
  }

  function severity(key,value){
    const v=norm(value);
    if(!v||v==='OK'||v==='NORMAL'||v==='BOM'||v==='SIM'||v==='NAO SE APLICA'||v==='NÃO SE APLICA')return 0;
    if(v.includes('NAO VERIFICADO')||v.includes('SOLICITAR TROCA')||v.includes('SOLICITAR SUBSTITUICAO'))return 1;
    if(key==='nivel_abastecimento'){
      if(v.includes('RESERVA')||v.includes('1/4')||v.includes('NAO ABASTECIDA'))return 1;
      return 0;
    }
    if(key==='limpeza_recebimento'&&v==='NAO')return 1;
    if(v.includes('INOPERANTE')||v.includes('AUSENTE')||v.includes('RUIM'))return ATENCAO_APENAS.has(key)?1:2;
    return 0;
  }
  const oldStatus=n=>n>=2?'NÃO CONFORME':n===1?'ATENÇÃO':'OK';
  const worst=(det,keys)=>Math.max(0,...keys.map(k=>severity(k,det[k])));

  function selectHtml(key,cfg){
    return `<label class="gc137-field"><span>${esc(cfg.label)}</span><select id="gc137_${key}">${cfg.options.map((o,i)=>`<option value="${esc(o)}"${i===0?' selected':''}>${esc(o)}</option>`).join('')}</select></label>`;
  }

  function sectionHtml(){
    const top=['duracao_turno','nivel_abastecimento','limpeza_recebimento'];
    let html=`<section id="gc137ChecklistDetalhado" class="gc137-checklist"><div class="gc137-head"><div><strong>Check-list operacional detalhado</strong><small>Itens adaptados do formulário histórico da GCMBS. Para os itens de funcionamento/presença, altere somente o que estiver com problema ou ausente.</small></div><span>V137</span></div><div class="gc137-grid">${top.map(k=>selectHtml(k,CAMPOS[k])).join('')}</div>`;
    for(const g of GRUPOS){const ks=Object.keys(CAMPOS).filter(k=>CAMPOS[k].group===g);html+=`<div class="gc137-sub"><h3>${esc(g)}</h3><div class="gc137-grid">${ks.map(k=>selectHtml(k,CAMPOS[k])).join('')}</div></div>`;}
    html+=`<div class="gc137-note"><b>Compatibilidade:</b> os detalhes são preservados no mesmo registro do check-list. O sistema também gera automaticamente os campos resumidos usados pelas versões anteriores.</div></section>`;
    return html;
  }

  function style(){
    if($('gc137Style'))return;
    const s=document.createElement('style');s.id='gc137Style';s.textContent=`
      .gc137-checklist{margin:16px 0;padding:16px;border:1px solid #d8e2ee;border-radius:16px;background:#f8fbff}
      .gc137-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
      .gc137-head strong{display:block;color:#0b2a4a;font-size:16px}.gc137-head small{display:block;margin-top:4px;color:#5d7187;line-height:1.4}
      .gc137-head>span{background:#0b2a4a;color:#fff;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800}
      .gc137-sub{margin-top:16px}.gc137-sub h3{margin:0 0 8px;color:#173f67;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
      .gc137-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
      .gc137-field{display:flex;flex-direction:column;gap:5px}.gc137-field span{font-size:12px;font-weight:700;color:#35516e}
      .gc137-field select{width:100%;min-height:40px}
      .gc137-note{margin-top:14px;padding:10px 12px;border-radius:10px;background:#edf5fc;color:#35516e;font-size:12px;line-height:1.45}
      .gc137-coarse-hidden{display:none!important}
      @media(max-width:720px){.gc137-checklist{padding:12px}.gc137-grid{grid-template-columns:1fr}.gc137-head{flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function details(){
    const d={schema:'GCMBS_CHECKLIST_V137',schema_version:137};
    for(const k of Object.keys(CAMPOS))d[k]=$(`gc137_${k}`)?.value||'';
    return d;
  }

  function setCoarse(id,value){
    const el=$(id);if(!el)return;
    if(el.tagName==='SELECT'){
      let opt=[...el.options].find(o=>o.value===value);
      if(!opt){opt=document.createElement('option');opt.value=value;opt.textContent=value.startsWith('{')?'DETALHAMENTO V137':value;el.appendChild(opt);}
      el.value=value;
    }else el.value=value;
  }

  function prepare(){
    const map=ids(),d=details();
    const sev={
      pneus:severity('pneus_conservacao',d.pneus_conservacao),
      luzes:worst(d,['farol_baixa','farol_alta','luz_re','luz_freio','pisca_alerta']),
      sirene:severity('sirene',d.sirene),
      giroflex:severity('intermitente',d.intermitente),
      freios:severity('oleo_freio',d.oleo_freio),
      oleo:severity('oleo_motor',d.oleo_motor),
      agua:worst(d,['liquido_arrefecimento','agua_reservatorio']),
      combustivel:severity('nivel_abastecimento',d.nivel_abastecimento),
      limpeza:severity('limpeza_recebimento',d.limpeza_recebimento),
      avarias:worst(d,['radio','ar_condicionado','buzina','chave_ignicao','pneu_sobressalente','kit_chave_roda','triangulo','kit_macaco','cinto_seguranca'])
    };
    for(const [k,n] of Object.entries(sev))setCoarse(map.coarse[k],oldStatus(n));
    setCoarse(map.coarse.equipamentos,JSON.stringify(d));
    const geral=Math.max(...Object.values(sev));
    const sit=$(map.situacao);
    if(sit){
      const atual=norm(sit.value);
      if(geral>=2)sit.value='NÃO APTA';
      else if(geral===1&&atual!=='NAO APTA'&&atual!=='NÃO APTA')sit.value='APTA COM RESSALVA';
    }
  }

  function install(){
    const map=ids(),form=$(map.form),items=$(map.items);if(!form||!items)return false;
    style();
    if(!$('gc137ChecklistDetalhado')){
      const wrapper=items.closest('.form-section')||items;
      wrapper.insertAdjacentHTML('beforebegin',sectionHtml());
      wrapper.classList.add('gc137-coarse-hidden');
    }
    if(form.dataset.gc137!=='1'){
      form.dataset.gc137='1';
      form.addEventListener('submit',prepare,true);
    }
    return true;
  }

  const tick=()=>{try{install()}catch(e){console.error('[GCMBS V137] Falha ao instalar check-list detalhado:',e)}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
  [80,180,400,800,1500,3000].forEach(ms=>setTimeout(tick,ms));
  new MutationObserver(()=>queueMicrotask(tick)).observe(document.documentElement,{childList:true,subtree:true});
  console.info('[GCMBS] V137 check-list detalhado ativo');
})();
