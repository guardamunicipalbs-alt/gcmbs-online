import {MODULOS_GCMBS, normalizarPerfil, controleTotal} from './access-catalog.js';

const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6';
const PUSH_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-push-register';

export class AuthenticatedProvider {
  constructor(){ this.session=null; this.data=null; this.refs={viaturas:[],guardas:[]}; }

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

  async login(identificador,senha){
    const body=await this.call('login',{identificador,senha},false);
    localStorage.setItem('gcmbs.mobile.token',body.token);
    this.session=body.session;
    await this.load();
    return body.session;
  }

  async restore(){
    const token=localStorage.getItem('gcmbs.mobile.token');
    if(!token) return null;
    try{
      const body=await this.call('session');
      this.session=body.session;
      await this.load();
      return this.session;
    }catch{
      localStorage.removeItem('gcmbs.mobile.token');
      this.session=null;this.data=null;
      return null;
    }
  }

  async logout(){
    try{await this.call('logout')}catch{}
    localStorage.removeItem('gcmbs.mobile.token');
    this.session=null;this.data=null;
  }

  async load(){
    const body=await this.call('data');
    this.data=body;
    try{this.refs=await this.call('references')}catch{this.refs={viaturas:[],guardas:[]};}
    // O relatório usa prioritariamente a réplica integral do Desktop. Isso evita
    // divergência entre a tabela móvel resumida e a tabela real de escalas.
    if(this.pode('escalas') || this.pode('relatorios')){
      try{
        const mirror=await this.entityList('escalas',5000,0);
        const rows=(mirror.records||[]).map(r=>r.data||{});
        if(rows.length) this.data.escalas=rows;
      }catch(e){ console.warn('[GCMBS] relatório usando réplica móvel resumida:',e?.message||e); }
    }
    return this;
  }

  guardas(){return this.data?.guardas||[]}
  escalas(){return this.data?.escalas||[]}
  extras(){return this.data?.extras||[]}
  permutas(){return this.data?.permutas||[]}
  bancoHoras(){return this.data?.banco_horas||[]}
  notifications(){return this.data?.notifications||[]}
  actionRequests(){return this.data?.action_requests||[]}
  permutationCandidates(){return this.data?.permutation_candidates||[]}

  async branding(){return (await this.call('branding')).branding||[]}
  async entityCatalog(){return (await this.call('entity_catalog')).entities||[]}
  async entityList(entity,limit=500,offset=0){return this.call('entity_list',{entity,limit,offset})}
  async entityMutate(entity,record_key,operation,data,client_change_id=''){return this.call('entity_mutate',{entity,record_key,operation,data,client_change_id})}
  async quadro(data){return this.call('quadro_operacional',{data})}
  async relatorioEscalas(){return (await this.call('relatorio_escalas')).escalas||[]}
  async permutaCandidatesFor(data,turno){return this.call('permuta_candidates',{data,turno})}
  references(){return this.refs||{viaturas:[],guardas:[]}}

  async requestBankCorrection(request){const r=await this.call('request_bank_correction',{request});await this.load();return r}
  async requestPermuta(request){const r=await this.call('request_permuta',{request});await this.load();return r}
  async updatePermutaRequest(id,request){const r=await this.call('update_permuta_request',{id,request});await this.load();return r}
  async cancelPermutaRequest(id){const r=await this.call('cancel_permuta_request',{id});await this.load();return r}
  async sendInstitutionalMessage(message){const r=await this.call('send_message',{message});await this.load();return r}
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
