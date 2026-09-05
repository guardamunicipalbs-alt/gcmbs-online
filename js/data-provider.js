import './login-security.js?v=100073';
import './v62-sync-ui.js?v=100073';
import './v58-ui.js?v=100073';
import {MODULOS_GCMBS, normalizarPerfil, controleTotal} from './access-catalog.js?v=100073';

const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v73';
const PUSH_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-push-register';
const ACTIONS_V58='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-actions-v62';
const QUADRO_V62='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-v62';
const CESSION_V58='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-assumption-v62';
const EXTRA_PERMUTAS_V68='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68';
const MIXED_PERMUTA_V71='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mixed-permuta-v71';
const PERMUTA_ADMIN_V72='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-permuta-admin-v72';

const PENDING_PERMUTA_STATUS=new Set(['AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO','ACEITE_PENDENTE_DESKTOP','DECISAO_PENDENTE_DESKTOP','CANCELAMENTO_PENDENTE','CANCELAMENTO_PENDENTE_DESKTOP','CANCELAMENTO_COMANDO_PENDENTE']);
function gcmbsServiceTime(x){const p=x?.payload&&typeof x.payload==='object'?x.payload:(x||{}),data=String(p.data||x?.data||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return Number.MAX_SAFE_INTEGER;const turno=String(p.turno||x?.turno||'').toUpperCase();let hora=String(p.horario_inicio||x?.horario_inicio||'').slice(0,5);if(!/^\d{2}:\d{2}$/.test(hora))hora=turno==='B'?'19:00':'07:00';const t=Date.parse(`${data}T${hora}:00-03:00`);return Number.isFinite(t)?t:Number.MAX_SAFE_INTEGER;}
function gcmbsSortPermutas(list){return [...(list||[])].sort((a,b)=>{const ap=PENDING_PERMUTA_STATUS.has(String(a?.status||a?.payload?.status||'').toUpperCase()),bp=PENDING_PERMUTA_STATUS.has(String(b?.status||b?.payload?.status||'').toUpperCase());if(ap!==bp)return ap?-1:1;if(ap&&bp){const d=gcmbsServiceTime(a)-gcmbsServiceTime(b);if(d)return d;return Number(a?.id||0)-Number(b?.id||0);}const ac=Date.parse(String(a?.processado_em||a?.created_at||a?.data||''))||Number(a?.id||0),bc=Date.parse(String(b?.processado_em||b?.created_at||b?.data||''))||Number(b?.id||0);return bc-ac;});}

export class AuthenticatedProvider {
  constructor(){ this.session=null; this.data=null; this.refs={viaturas:[],guardas:[],equipes:[],postos:[],tipos_escalas:[],eventos:[],oficios:[],grupos_ativacao:[],justificativas:[]}; }

  async call(action,payload={},authenticated=true){
    const headers={'Content-Type':'application/json'};
    const token=localStorage.getItem('gcmbs.mobile.token');
    if(authenticated && token) headers.Authorization=`Bearer ${token}`;
    const r=await fetch(API,{
      method:'POST',
      headers,
      body:JSON.stringify({action,...payload}),
      cache:'no-store'
    });
    let body={};
    try{body=await r.json()}catch{}
    if(!r.ok) throw new Error(body.message||`Erro ${r.status}`);
    return body;
  }

  async callV58(action,payload={}){
    const headers={'Content-Type':'application/json'};
    const token=localStorage.getItem('gcmbs.mobile.token');
    if(token) headers.Authorization=`Bearer ${token}`;
    const r=await fetch(ACTIONS_V58,{method:'POST',headers,body:JSON.stringify({action,...payload}),cache:'no-store'});
    let body={};try{body=await r.json()}catch{}
    if(!r.ok) throw new Error(body.message||`Erro ${r.status}`);
    return body;
  }

  async callCessionV58(request){const headers={'Content-Type':'application/json'};const token=localStorage.getItem('gcmbs.mobile.token');if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(CESSION_V58,{method:'POST',headers,body:JSON.stringify({request}),cache:'no-store'});let body={};try{body=await r.json()}catch{}if(!r.ok)throw new Error(body.message||`Erro ${r.status}`);return body;}
  async callExtraPermutasV68(action,payload={}){const headers={'Content-Type':'application/json'};const token=localStorage.getItem('gcmbs.mobile.token');if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(EXTRA_PERMUTAS_V68,{method:'POST',headers,body:JSON.stringify({action,...payload}),cache:'no-store'});let body={};try{body=await r.json()}catch{}if(!r.ok)throw new Error(body.message||`Erro ${r.status}`);return body;}
  async callMixedPermutaV71(action,payload={}){const headers={'Content-Type':'application/json'};const token=localStorage.getItem('gcmbs.mobile.token');if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(MIXED_PERMUTA_V71,{method:'POST',headers,body:JSON.stringify({action,...payload}),cache:'no-store'});let body={};try{body=await r.json()}catch{}if(!r.ok)throw new Error(body.message||`Erro ${r.status}`);return body;}

  async login(identificador,senha,remember=false){
    const body=await this.call('login',{identificador,senha,remember},false);
    localStorage.setItem('gcmbs.mobile.token',body.token);
    this.session=body.session;
    if(Number(this.session?.senha_trocada||0)!==0) await this.load();
    return body.session;
  }

  async restore(){
    const token=localStorage.getItem('gcmbs.mobile.token');
    if(!token) return null;
    try{
      const body=await this.call('session');
      this.session=body.session;
      if(Number(this.session?.senha_trocada||0)!==0) await this.load();
      return this.session;
    }catch{
      localStorage.removeItem('gcmbs.mobile.token');
      this.session=null;this.data=null;
      return null;
    }
  }

  async logout(preserveToken=false){
    if(!preserveToken){try{await this.call('logout')}catch{};localStorage.removeItem('gcmbs.mobile.token');}
    this.session=null;this.data=null;
  }

  async changePassword(senha_atual,nova_senha){return this.call('change_password',{senha_atual,nova_senha})}
  async resetPasswordAdmin(guarda_id){return this.call('reset_password_admin',{guarda_id:Number(guarda_id)})}

  async decideMirrorPermuta(desktopId,decisao,motivo=''){
    const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Sessão online não autenticada.');
    const r=await fetch(PERMUTA_ADMIN_V72,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'decide_mirror',desktop_id:Number(desktopId),decisao:String(decisao||'').toUpperCase(),motivo:String(motivo||'')}),cache:'no-store'});
    let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
  }
  async load(){
    const body=await this.call('data');
    this.data=body;
    try{this.refs=await this.call('references')}catch{this.refs={viaturas:[],guardas:[],equipes:[],postos:[],tipos_escalas:[],eventos:[],oficios:[],grupos_ativacao:[],justificativas:[]};}
    // v73: a ação data já é montada pela réplica integral canônica do Desktop.
    // Não há mais substituição parcial por módulo no cliente.
    return this;
  }

  guardas(){return this.data?.guardas||[]}
  escalas(){return this.data?.escalas||[]}
  extras(){return this.data?.extras||[]}
  permutas(){return gcmbsSortPermutas(this.data?.permutas||[])}
  bancoHoras(){return this.data?.banco_horas||[]}
  notifications(){return this.data?.notifications||[]}
  institutionalNotices(){return this.data?.institutional_notices||[]}
  actionRequests(){return gcmbsSortPermutas(this.data?.action_requests||[])}
  permutationCandidates(){return this.data?.permutation_candidates||[]}

  async branding(){return (await this.call('branding')).branding||[]}
  async entityCatalog(){return (await this.call('entity_catalog')).entities||[]}
  async entityList(entity,limit=500,offset=0){return this.call('entity_list',{entity,limit,offset})}
  async entityGet(entity,record_key){return this.call('entity_get',{entity,record_key})}
  async entityMutate(entity,record_key,operation,data,client_change_id=''){return this.call('entity_mutate',{entity,record_key,operation,data,client_change_id})}
  async quadro(data){const token=localStorage.getItem('gcmbs.mobile.token');const r=await fetch(QUADRO_V62,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action:'quadro_operacional',data}),cache:'no-store'});let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b}
  async syncStatus(){const token=localStorage.getItem('gcmbs.mobile.token');const r=await fetch(QUADRO_V62,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action:'sync_status'}),cache:'no-store'});let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b.sincronizacao||{}}
  async relatorioEscalas(){return (await this.call('relatorio_escalas')).escalas||[]}
  async ajustarEscalaComando(adjustment){const r=await this.callV58('admin_scale_adjust_v58',{adjustment});await this.load();return r}
  async permutaCandidatesFor(data,turno){return this.call('permuta_candidates',{data,turno})}
  async extraSwapCandidates(){return this.callExtraPermutasV68('candidates',{})}
  async frequencyServices(guarda_id,data){return this.call('frequency_services',{guarda_id,data})}
  async checklistContext(viatura_id){return this.call('checklist_context',{viatura_id})}
  async occurrenceContext(data,hora){return this.call('occurrence_context',{data,hora})}
  references(){return this.refs||{viaturas:[],guardas:[],equipes:[],postos:[],tipos_escalas:[],eventos:[],oficios:[],grupos_ativacao:[],justificativas:[]}}

  async requestBankCorrection(request){const r=await this.call('request_bank_correction',{request});await this.load();return r}
  async requestPermuta(request){const modalidade=String(request?.modalidade||'ASSUNCAO').toUpperCase();const r=modalidade==='TROCA_EXTRA'?await this.callExtraPermutasV68('request_swap',{request}):modalidade==='CESSAO_EXTRA'?await this.callExtraPermutasV68('request_assumption',{request}):modalidade==='TROCA_ORDINARIO_EXTRA'?await this.callMixedPermutaV71('request_mixed_swap',{request}):await this.call('request_permuta',{request});await this.load();return r}
  async acceptExtraSwap(id,aceitou,modalidade=''){const r=String(modalidade||'').toUpperCase()==='TROCA_ORDINARIO_EXTRA'?await this.callMixedPermutaV71('accept_mixed',{id,aceitou}):await this.callExtraPermutasV68('accept',{id,aceitou});await this.load();return r}
  async updatePermutaRequest(id,request){const r=await this.call('update_permuta_request',{id,request});await this.load();return r}
  async cancelPermutaRequest(id){const r=await this.call('cancel_permuta_request',{id});await this.load();return r}
  async decidePermutaRequest(id,decisao,motivo=''){const r=await this.call('decide_permuta_request',{id,decisao,motivo});await this.load();return r}
  async adminDeletePermutaRequest(id,motivo=''){const r=await this.call('admin_delete_permuta_request',{id,motivo});await this.load();return r}
  async decideBankRequest(id,decisao,ajustes={}){const r=await this.call('decide_bank_request',{id,decisao,ajustes});await this.load();return r}
  async sendInstitutionalMessage(message){const r=await this.callV58('send_message_v58',{message});await this.load();return r}
  async markNotificationRead(id){const r=await this.call('mark_notification_read',{id});if(r.success&&this.data){const n=this.data.notifications?.find(x=>Number(x.id)===Number(id));if(n&&!n.lida_em)n.lida_em=new Date().toISOString();}return r}
  async pushCall(payload={}){
    const token=localStorage.getItem('gcmbs.mobile.token');
    if(!token) throw new Error('Sessão móvel não autenticada.');
    const r=await fetch(PUSH_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(payload),cache:'no-store'});
    let b={};try{b=await r.json()}catch{}
    if(!r.ok) throw new Error(b.message||`Erro ${r.status}`);
    return b;
  }
  async registerPushToken(token,meta={}){return this.pushCall({action:'register',token,...meta})}
  async unregisterPushToken(token=''){return this.pushCall({action:'unregister',token})}
  meta(){return this.data?.meta||{}}
  permissoes(){return this.session?.permissoes||[]}
  perfil(){return normalizarPerfil(this.session||{})}
  controleTotal(){return controleTotal(this.session||{})}
  gestor(){const p=this.perfil();return p==='comandante'||p==='subcomandante'}
  permissoesEfetivas(){
    if(this.controleTotal()) return MODULOS_GCMBS.map(x=>({modulo:x.id,nivel:'EDICAO'}));
    return this.permissoes().filter(p=>p && p.modulo && p.modulo!=='*' && p.ativo!==false);
  }
  modulosAutorizados(){
    const mapa=new Map(this.permissoesEfetivas().map(p=>[p.modulo,String(p.nivel||'CONSULTA').toUpperCase()]));
    return MODULOS_GCMBS.filter(x=>mapa.has(x.id)).map(x=>({...x,nivel:mapa.get(x.id)}));
  }

  pode(modulo,nivel='CONSULTA'){
    if(modulo==='escalas' && !this.gestor()) return false;
    if(modulo==='relatorios_frota' && !this.gestor()) return false;
    if(this.controleTotal()) return true;
    const rank={CONSULTA:1,EDICAO:2};
    const alvo=rank[String(nivel).toUpperCase()]||1;
    return this.permissoes().some(p =>
      p?.ativo!==false && (p.modulo===modulo || p.modulo==='*') &&
      (rank[String(p.nivel).toUpperCase()]||0)>=alvo
    );
  }
}
