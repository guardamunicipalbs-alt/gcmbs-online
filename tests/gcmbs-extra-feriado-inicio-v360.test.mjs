import test from 'node:test';
import assert from 'node:assert/strict';
import {classificacaoFeriadoExtra, mesmaClasseFeriadoEmTodaJornada} from '../js/gcmbs-extra-feriado-inicio-v360.mjs';
test('vespera do feriado nao recebe 100 por atravessar meia-noite',()=>{
 const x=mesmaClasseFeriadoEmTodaJornada('2026-11-01','2026-11-02',['2026-11-02']);
 assert.equal(x.inicioEmFeriado,false); assert.equal(x.classePorFeriado,null);
});
test('Extra iniciada no feriado recebe 100 durante toda a jornada',()=>{
 const x=mesmaClasseFeriadoEmTodaJornada('2026-11-02','2026-11-03',['2026-11-02']);
 assert.equal(x.inicioEmFeriado,true); assert.equal(x.classeConstanteNaJornada,'100');
});
test('feriado cadastrado posteriormente reclassifica somente quando inicio coincide',()=>{
 assert.equal(classificacaoFeriadoExtra('2026-11-02',[]).classePorFeriado,null);
 assert.equal(classificacaoFeriadoExtra('2026-11-02',['2026-11-02']).classePorFeriado,'100');
});
test('feriado removido perde classificacao especial',()=>{
 assert.equal(classificacaoFeriadoExtra('2026-11-02',['2026-11-02']).classePorFeriado,'100');
 assert.equal(classificacaoFeriadoExtra('2026-11-02',[]).classePorFeriado,null);
});
test('regra autonoma de domingos preservada fora da funcao',()=>{
 assert.equal(classificacaoFeriadoExtra('2026-11-01',[]).classePorFeriado,null);
});
test('bloqueia datas invalidas e jornada invertida',()=>{
 assert.throws(()=>classificacaoFeriadoExtra('2026-02-30',[]),/DATA_INICIO_INVALIDA/);
 assert.throws(()=>mesmaClasseFeriadoEmTodaJornada('2026-11-03','2026-11-02',[]),/JORNADA_INVALIDA/);
});