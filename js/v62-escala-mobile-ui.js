// GCMBS 10.0.62 — melhoria de leitura do Relatório de Escala em telas pequenas.
// Não altera alocações, filtros, contagem, motorista, extras ou qualquer dado da escala.

function aplicarEscalaMobileUi(){
  if(document.getElementById('v62EscalaMobileStyle'))return;
  const style=document.createElement('style');
  style.id='v62EscalaMobileStyle';
  style.textContent=`
    /* Mantém a referência Posto/Horário visível durante a rolagem horizontal. */
    .report-matrix .col-posto,
    .report-matrix .posto-linha{
      position:sticky;
      left:0;
      background:#f8fafc;
      box-shadow:2px 0 0 #cbd5e1;
    }
    .report-matrix .posto-linha{z-index:3;}
    .report-matrix thead .col-posto{
      z-index:5;
      background:#e2e8f0;
    }

    @media(max-width:700px){
      .matrix-wrap{
        -webkit-overflow-scrolling:touch;
        overscroll-behavior-x:contain;
      }
      .report-matrix .col-posto{
        min-width:150px;
        max-width:150px;
      }
      .report-matrix .posto-linha{
        min-width:150px;
        max-width:150px;
        white-space:normal;
      }
      .report-matrix th,
      .report-matrix td{
        font-size:12px;
      }
    }
  `;
  document.head.appendChild(style);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',aplicarEscalaMobileUi,{once:true});
else aplicarEscalaMobileUi();
