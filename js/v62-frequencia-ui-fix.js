// GCMBS 10.0.62 — clareza operacional e responsividade da Frequência.
// Não cria nem altera frequência. A lista exibida nasce dos serviços gravados na escala;
// uma situação só é persistida quando o Comando usa a ação Salvar.
(function installV62FrequenciaUiFix(){
  const $=id=>document.getElementById(id);
  let scheduled=false;

  function ativo(){return String($('onlineTitulo')?.textContent||'').trim()==='Frequência';}

  function ensureStyle(){
    if($('v62FreqUiStyle'))return;
    const s=document.createElement('style');s.id='v62FreqUiStyle';
    s.textContent=`
      #onlineRegistros [data-gcmbs-frequencia-controle] { position:relative; }
      #onlineRegistros [data-gcmbs-frequencia-controle] table { min-width:1040px !important; }
      #onlineRegistros [data-gcmbs-frequencia-controle] th:last-child,
      #onlineRegistros [data-gcmbs-frequencia-controle] td:last-child {
        position:sticky; right:0; z-index:3; background:#fff; box-shadow:-8px 0 12px -12px rgba(15,23,42,.6);
      }
      #onlineRegistros [data-gcmbs-frequencia-controle] thead th:last-child { z-index:4; background:#f8fafc; }
      #onlineRegistros [data-gcmbs-frequencia-controle] td:nth-child(5),
      #onlineRegistros [data-gcmbs-frequencia-controle] td:nth-child(7) { white-space:normal; min-width:145px; }
      #v62FreqUiNotice { margin:10px 0 0; padding:10px 12px; border:1px solid #bfdbfe; border-radius:10px; background:#eff6ff; color:#1e3a5f; font-size:13px; line-height:1.45; }
      @media (max-width:900px){
        #onlineRegistros [data-gcmbs-frequencia-controle] table { min-width:940px !important; }
      }
    `;
    document.head.appendChild(s);
  }

  function trocarRotuloRegistros(){
    const total=$('onlineTotal');const card=total?.parentElement;if(!card)return;
    const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const n=walker.currentNode,txt=String(n.nodeValue||'').trim();
      if(txt==='REGISTROS'){n.nodeValue=n.nodeValue.replace('REGISTROS','SERVIÇOS');break;}
    }
  }

  function ajustarResumo(){
    const f=$('onlineFiltrados');if(!f)return;
    const atual=String(f.textContent||'');
    const novo=atual.replace(/registro\(s\)/gi,'serviço(s)').replace(/\bregistros\b/gi,'serviços');
    if(novo!==atual)f.textContent=novo;
  }

  function ensureNotice(){
    const controls=$('gcmbsFrequenciaDesktopLike');if(!controls)return;
    let n=$('v62FreqUiNotice');
    if(!n){n=document.createElement('div');n.id='v62FreqUiNotice';controls.appendChild(n);}
    const texto='Cada linha representa um serviço gravado na escala. “PRESENTE” é o padrão inicial quando ainda não existe lançamento de frequência; a situação só é confirmada ao clicar em Salvar. Justificativas ativas são aplicadas automaticamente como FALTA JUSTIFICADA e ficam bloqueadas para edição.';
    if(n.textContent!==texto)n.textContent=texto;
  }

  function ajustarAcoes(){
    const root=$('onlineRegistros');if(!root)return;
    root.querySelectorAll('[data-freq-save]').forEach(btn=>{
      if(!btn.title)btn.title='Gravar a situação de frequência deste serviço';
    });
    root.querySelectorAll('[data-freq-field="situacao"]:disabled').forEach(sel=>{
      sel.title='Situação determinada automaticamente por justificativa ativa.';
    });
  }

  function run(){
    if(!ativo())return;
    ensureStyle();trocarRotuloRegistros();ajustarResumo();ensureNotice();ajustarAcoes();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;run();});}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const root=$('appTela')||document.body;
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true,characterData:true});
})();
