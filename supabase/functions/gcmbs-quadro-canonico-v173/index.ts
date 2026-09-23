import postgres from 'npm:postgres@3.4.7';
// Paridade V173: servicos A/B incluem os extras automaticos que sao materializados em escalas.
// Servicos extras por evento continuam em rota separada e nao sao duplicados.
const VERSION='10.0.176-quadro-dedupe-alias';
const CORE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';
const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:3,max_lifetime:20,connect_timeout:5});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8'};
const reply=(s:number,b:any)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'X-GCMBS-Quadro-Version':VERSION}});
const norm=(v:any)=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const invalid=new Set(['CANCELADA','CANCELADO','EXCLUIDA','EXCLUIDO','INATIVA','INATIVO','SIMULADA','SIMULADO']);
function key(r:any){const id=Number(r?.guarda_id||0);return id?'ID:'+id:'NOME:'+norm(r?.nome);}
function listByTurn(records:any[],turn:string,prior:any[]){const chosen=new Map<string,any>();
 for(const old of Array.isArray(prior)?prior:[]){const k=key(old);if(k!=='NOME:')chosen.set(k,old);}
 // O quadro-base pode trazer nome completo enquanto a replica usa nome de guerra
 // (ex.: "ANTONIO CALIXTO DE SOUZA" x "CALIXTO"). A deduplicacao deve considerar
 // todos os aliases do mesmo guarda para nao contar a mesma pessoa duas vezes.
 const names=new Set([...chosen.values()].map((v:any)=>norm(v?.nome)).filter(Boolean));
 for(const r of records){
   const d=r.data||{},t=norm(d.turno);
   if(!(t===turn||t==='COMPLETO'))continue;
   const gid=Number(d.guarda_id||0);if(!gid)continue;
   const aliases=[
     r.nome_guerra,d.nome_guerra,d.nome_completo,d.hist_guarda_nome_guerra,
     d.guarda_nome,d.guarda
   ].map(norm).filter(Boolean);
   const name=String(r.nome_guerra||d.nome_guerra||d.hist_guarda_nome_guerra||d.guarda_nome||d.guarda||`GCM ${gid}`).trim();
   const k='ID:'+gid;
   if(chosen.has(k)||aliases.some((a:string)=>names.has(a)))continue;
   const extra=norm(d.origem)==='GERADOR_AUTOMATICO_EXTRA';
   const posto=String(d.posto_nome||d.hist_posto_nome||d.posto||'Servico').trim();
   const complemento=(extra?'Extra automatico':'Servico ordinario')+' · '+posto+' · '+(turn==='A'?'07:00–19:00':'19:00–07:00');
   chosen.set(k,{nome:name,guarda_id:gid,complemento,tipo_servico:extra?'EXTRA':'ORDINARIO',origem:d.origem||'',record_key:r.record_key});
   for(const a of aliases)names.add(a);names.add(norm(name));
 }
 return [...chosen.values()];}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply(405,{message:'Metodo nao permitido.'});try{
 const raw=await req.text();let body:any;try{body=JSON.parse(raw||'{}')}catch{return reply(400,{message:'JSON invalido.'})};if(String(body.action||'').toLowerCase()!=='quadro_operacional')return reply(404,{message:'Acao nao encontrada.'});
 const dia=String(body.data||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return reply(400,{message:'Data invalida.'});
 const authorization=req.headers.get('authorization');if(!authorization||!authorization.toLowerCase().startsWith('bearer '))return reply(401,{message:'Sessao nao autenticada.'});
 const remote=await fetch(CORE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':authorization},body:raw,cache:'no-store'});
 const original=await remote.text();if(!remote.ok)return new Response(original,{status:remote.status,headers:cors});let q:any;try{q=JSON.parse(original)}catch{return reply(502,{message:'Quadro base retornou resposta invalida.'})};if(!q?.efetivo?.detalhes)return reply(502,{message:'Quadro base incompleto; sem alteracao aplicada.'});
 const scales=await db`select e.record_key,e.data,p.nome_guerra from public.mobile_entity_records e left join public.mobile_profiles p on p.guarda_id=case when e.data->>'guarda_id' ~ '^[0-9]+$' then (e.data->>'guarda_id')::bigint else null end where e.entity='escalas' and e.deleted=false and left(e.data->>'data',10)=${dia}`;
 const valid=scales.filter((r:any)=>!invalid.has(norm(r.data?.status||'ATIVA')));
 const a=listByTurn(valid,'A',q.efetivo.detalhes.servicoA);const b=listByTurn(valid,'B',q.efetivo.detalhes.servicoB);
 q.efetivo.detalhes.servicoA=a;q.efetivo.detalhes.servicoB=b;q.efetivo.servicoA=a.length;q.efetivo.servicoB=b.length;
 q.meta={...(q.meta||{}),quadro_paridade:VERSION,fonte:'mobile_entity_records:escalas',inclui_extras_automaticos:true,extras_evento_separados:true};
 return reply(200,q);
 }catch(e){console.error('[gcmbs-quadro-v173]',e);return reply(500,{message:'Falha ao calcular Quadro canonico; escala nao foi alterada.'});}});
