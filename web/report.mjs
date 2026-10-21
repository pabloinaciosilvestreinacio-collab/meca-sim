// Relatório derivado dos contadores cumulativos do servidor, não dos objetos ainda no HIVE.
export function buildMatchReport(state,team){
  const score=state.scoring?.by_alliance||{},teamScore=score[team]||{},launcher=state.launcher_status||{};
  const tips=state.rules?.hive_tips_didactic?.[team]||0;
  const javaResult=state.status==='concluído'?'Java terminou normalmente (isso não comprova sucesso da missão).':
    state.status==='erro'?'Execução Java terminou com erro.':'Simulação encerrada antes do fim normal do Java.';
  return {format:'meca-sim-match-report',version:2,endedAt:new Date().toISOString(),javaResult,
    missionSuccess:'não avaliada',durationSeconds:Number(state.time||0),alliance:team,
    estimatedPoints:{...teamScore,hiveTipsDidactic:tips,partialTotal:teamScore.total||0,byAlliance:score,
      scope:'estimativa baseada nos estados; HIVE usa limiar didático'},
    activity:{collected:state.intake?.collected||0,launched:launcher.launch_count||0,
      emptyFeedAttempts:launcher.empty_feed_attempts||0,hits:launcher.hits||0,misses:launcher.misses||0,
      pending:launcher.pending||0,hiveTipsDidactic:tips,diagnostics:state.diagnostics?.length||0},
    diagnostics:state.diagnostics||[],javaLogs:state.logs||'',telemetry:state.telemetry||'',
    ruleStatus:state.rules||null,scoring:state.scoring||null,
    limitations:[...(state.scoring?.limitations||[]),'Ranking points, vitória/empate e decisão de missão não são calculados.',
      'Acertos e erros contam disparos; queda após um acerto não transforma o disparo em erro.',
      'Tiros em voo no encerramento permanecem sem resultado. Validação física do robô não incluída.']};
}
export function reportCsv(report){
  const rows=[['campo','valor']];
  function visit(value,path){
    if(value!==null&&typeof value==='object'&&Object.keys(value).length){
      for(const [key,item] of Object.entries(value))visit(item,path?path+'.'+key:key);
    }else rows.push([path,value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):value]);
  }
  visit(report,'');
  const quote=value=>{
    let text=String(value);
    if(typeof value==='string'&&/^[=+@-]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return rows.map(row=>row.map(quote).join(',')).join('\r\n');
}
