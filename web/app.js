import {rotate, launcher, heightAt, flight, gamepadValues, keyboardGamepadValues, DEFAULT_KEYMAP, targetSolution, encoderScale, connectedPlayers, speedFromForce, forceFromSpeed, shotFeasibility, shotElapsed, hiveShotImpact, registerPollen, SIM_TIP_POLLS} from './model.mjs';
import {FIELD_METERS, ARENAS, validStart, drawArenaTop, drawArenaSide, hiveCellAt, hiveCellById, hiveSideGeometry, HIVE_SIDE} from './arena.mjs';
import {candidates, diagnostics, highlightJava} from './editor.mjs';
import {routeSteps, routeWarnings, makeRouteJava, MAX_WAYPOINTS} from './route.mjs';
const $ = id => document.getElementById(id);
const num = id => Number($(id).value);
let state = {x:1.83,y:.65,yaw:0,width:.45,length:.45,trail:[],motors:{},time:0,status:'pronto'};
let matchStarted=false,finalReport=null;
const REPORT_KEY='meca-sim-final-report-v1';
let focused = document.hasFocus();
let shot = null, javaShots = [], lastJavaLaunchId = 0, examples = {}, javaFiles = {}, zipOpModes = [], selectedJavaPath = '', lastPad = 0, polling = false, padBusy = false, pickingStart = false;
let lastDraw=0,lastLog='',lastMotorSignature='',lastDiagnosticSignature='',lastShotPoseKey='',highlightJob=0,routePicking=false;
let routePoints=[],replayRows=[],replayIndex=-1,replayPlaying=false,replayLast=0,scoredShots=[],selectedHiveId='red-lower',tippedHives=new Set(),hiveCounts={red:0,blue:0},hiveFlips={red:0,blue:0},hiveMotion={},auto35StartPose=null,auto35Moved=false;
const LIBRARY_KEY='meca-sim-library-v1',LOGO_KEY='meca-sim-logo-v1',KEYMAP_KEY='meca-sim-keymap-v1';
const keys = new Set(), virtualKeys=new Map(), top = $('top'), side = $('side');
const keymapActions=[
  ['lsxNeg','LS X −'],['lsxPos','LS X +'],['lsyNeg','LS Y −'],['lsyPos','LS Y +'],
  ['rsxNeg','RS X −'],['rsxPos','RS X +'],['rsyNeg','RS Y −'],['rsyPos','RS Y +'],
  ['a','A'],['b','B'],['x','X'],['y','Y'],['lb','LB'],['rb','RB'],['lt','LT'],['rt','RT'],
  ['dpadUp','D-pad ↑'],['dpadDown','D-pad ↓'],['dpadLeft','D-pad ←'],['dpadRight','D-pad →'],
  ['start','Start'],['back','Back'],['leftStick','LS click'],['rightStick','RS click']
];
function loadKeymap(){
  try{
    const saved=JSON.parse(localStorage.getItem(KEYMAP_KEY)||'null');
    if(!saved||typeof saved!=='object')return {...DEFAULT_KEYMAP};
    const map={...DEFAULT_KEYMAP};
    for(const [action,key] of Object.entries(saved))if(action in map&&typeof key==='string'&&key.length>0&&key.length<=24)map[action]=key;
    if(new Set(Object.values(map)).size!==Object.keys(map).length)return {...DEFAULT_KEYMAP};
    return map;
  }catch{return {...DEFAULT_KEYMAP};}
}
let keyMap=loadKeymap(),capturingKey=null;
const displayKey=key=>key===' '?'Space':key==='ArrowUp'?'↑':key==='ArrowDown'?'↓':key==='ArrowLeft'?'←':key==='ArrowRight'?'→':key;
function renderKeymap(){
  const root=$('keymap');if(!root)return;root.replaceChildren();
  for(const [action,label] of keymapActions){
    const row=document.createElement('label');row.className='keymap-row';row.append(document.createTextNode(label));
    const button=document.createElement('button');button.type='button';button.textContent=action===capturingKey?'Pressione uma tecla…':displayKey(keyMap[action]);
    button.setAttribute('aria-label','Tecla para '+label);button.addEventListener('click',()=>{capturingKey=action;renderKeymap();notice('Pressione uma tecla para '+label+'; Esc cancela.');});
    row.append(button);root.append(row);
  }
}
$('reset-keymap').addEventListener('click',()=>{keyMap={...DEFAULT_KEYMAP};capturingKey=null;keys.clear();localStorage.removeItem(KEYMAP_KEY);renderKeymap();notice('Mapa padrão restaurado.');});

const configIds = ['arena','drivetrain','robot-color','left','right','front_left','front_right','back_left','back_right','width','length','track','max_speed','ticks_per_m','duration','match-mode','timer-enabled','x','y','initial-yaw','invert_left','invert_right','acceleration','left_gain','right_gain','left_slip','right_slip','imu_delay','imu_drift','walls','alliance','intake_reach','intake_capacity','imu_frozen','left_encoder_frozen','right_encoder_frozen'];
const launchIds = ['offset-x','offset-y','height','shot-mode','force','speed','projectile-mass','acceleration-stroke','shot-efficiency','target-radius','target-tolerance','elevation','azimuth','target-x','target-y','target-h','feed-interval'];
function config() {
  const data = {};
  configIds.forEach(id => { const input=$(id); data[id==='initial-yaw'?'yaw':id]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value; });
  data.launcher=Object.fromEntries(launchIds.map(id=>[id,id==='shot-mode'?$(id).value:num(id)]));
  data.launcher.hive=selectedHiveId;
  return data;
}
function persist() {
  try { const values={}; [...configIds,...launchIds].forEach(id=>values[id]=$(id).type==='checkbox'?$(id).checked:$(id).value);
    localStorage.setItem('meca-sim-v02',JSON.stringify({source:$('source').value,files:javaFiles,values,route:routePoints,hive:selectedHiveId})); } catch {}
}
function notice(text) {$('message').textContent=text;}
function setShotResult(text,kind='info'){const item=$('shot-result');if(item){item.textContent=text;item.dataset.kind=kind;}notice(text);}
function selectedHive(){return hiveCellById(selectedHiveId);}
function hiveOrientation(team){const initial=team==='blue'?1:-1;return initial*(hiveFlips[team]%2?-1:1);}
function activeCellId(team){return team+'-'+(hiveOrientation(team)>0?'upper':'lower');}
function hiveStatus(team,now){
  const motion=hiveMotion[team],end=hiveOrientation(team)*HIVE_SIDE.angleDeg;
  let angle=end;
  if(motion){
    const t=Math.min(1,Math.max(0,(now-motion.start)/650));
    const ease=1-Math.pow(1-t,3);
    angle=motion.from+(motion.to-motion.from)*ease+Math.sin(t*Math.PI*3)*(1-t)*2;
    if(t>=1)delete hiveMotion[team];
  }
  return {angle,count:hiveCounts[team],tips:hiveFlips[team],activeCellId:activeCellId(team)};
}
function recordImpact(shot,now){
  const cell=hiveCellById(shot.cellId);
  if(!cell||!shot.impact?.hit)return;
  const result=registerPollen(hiveCounts[cell.team],SIM_TIP_POLLS);
  hiveCounts[cell.team]=result.count;
  shot.registered=true;shot.tipped=result.tipped;
  if(result.tipped){
    const previous=hiveOrientation(cell.team)*HIVE_SIDE.angleDeg;
    hiveFlips[cell.team]++;
    hiveMotion[cell.team]={start:now,from:previous,to:-previous};
    tippedHives.add(cell.id);
    // Ao virar, a CELL anterior descarrega as bolas acumuladas.
    scoredShots=scoredShots.filter(b=>b.cellId!==cell.id);
    setShotResult('HIVE TOMBOU · '+SIM_TIP_POLLS+' POLLEN na '+cell.name+'; gangorra invertida.','hit');
  }else setShotResult('POLLEN CAPTURADO · '+hiveCounts[cell.team]+'/'+SIM_TIP_POLLS+' na '+cell.name+'.','hit');
}
function currentShotBall(now,candidate=shot){
  if(!candidate)return null;
  const t=shotElapsed(now,candidate.start);
  const impact=candidate.impact?.hit?candidate.impact:null;
  const time=impact?Math.min(t,impact.time):Math.min(t,flight(candidate.height,candidate.speed,candidate.elevation).time);
  const along=candidate.speed*Math.cos(candidate.elevation*Math.PI/180)*time;
  const dir=rotate(0,1,candidate.yaw+candidate.azimuth);
  let z=heightAt(along,candidate.height,candidate.speed,candidate.elevation);
  const fall=impact&&t>=impact.time?Math.min(1,(t-impact.time)/.42):0;
  const eased=fall*fall*(3-2*fall),cell=hiveCellById(candidate.cellId);
  const index=candidate.restIndex||0;
  const landingX=cell?cell.x+cell.w*(.26+(index%3)*.24):candidate.origin[0]+dir[0]*along;
  const landingY=cell?cell.y+cell.h*(.25+Math.floor(index/3)*.28):candidate.origin[1]+dir[1]*along;
  const restZ=cell?hiveSideGeometry(cell,candidate.hiveAngle).floorHeight+.060:impact?.height||0;
  if(fall>0)z=impact.height+(restZ-impact.height)*eased;
  const ix=candidate.origin[0]+dir[0]*along,iy=candidate.origin[1]+dir[1]*along;
  return {x:ix+(landingX-ix)*eased,y:iy+(landingY-iy)*eased,
    z,along:along+(-.075+(index%4)*.05)*eased,fall};
}
function selectHive(cell,announce=true){
  if(!cell)return;
  selectedHiveId=cell.id;
  $('target-x').value=(cell.x+cell.w/2).toFixed(3);
  $('target-y').value=(cell.y+cell.h/2).toFixed(3);
  // A boca muda de altura quando a gangorra troca de lado.
  const angle=hiveOrientation(cell.team)*HIVE_SIDE.angleDeg;
  $('target-h').value=hiveSideGeometry(cell,angle).openingHeight.toFixed(4);
  refreshShot();if(announce)setShotResult('MIRA SELECIONADA · '+cell.name+'. A linha pontilhada termina nesta CELL.','selected');
}
function refreshMatchLimit(){
  const mode=$('match-mode').value==='teleop'?'teleop':'auto';
  $('match-mode').value=mode;$('duration').value=mode==='auto'?'30':'120';
  $('duration').title=$('timer-enabled').checked?'Limite aplicado pelo simulador':'Cronômetro de partida desativado';
}
function setTeamLogo(url){$('team-logo').src=url;$('team-logo').hidden=false;}
function library(){try{const items=JSON.parse(localStorage.getItem(LIBRARY_KEY)||'[]');return Array.isArray(items)?items.filter(x=>x&&typeof x.name==='string'&&x.project?.version===2).slice(0,12):[];}catch{return [];}}
function projectData(){return {format:'meca-sim-project',version:2,source:$('source').value,files:{...javaFiles},config:config(),launcher:Object.fromEntries(launchIds.map(id=>[id,id==='shot-mode'?$(id).value:num(id)])),route:routePoints.slice(),hive:selectedHiveId};}
function refreshExamples(selected=''){
  const menu=$('example');menu.replaceChildren();
  const blank=document.createElement('option');blank.value='';blank.textContent='Selecione…';menu.append(blank);
  const base=document.createElement('optgroup');base.label='Exemplos incluídos';
  Object.keys(examples).forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;base.append(option);});
  menu.append(base);
  const saved=library();if(saved.length){const group=document.createElement('optgroup');group.label='Meus projetos salvos';
    saved.forEach(item=>{const option=document.createElement('option');option.value='saved:'+item.name;option.textContent=item.name;group.append(option);});menu.append(group);}
  menu.value=selected;
  $('delete-library').disabled=!selected.startsWith('saved:');
}
function saveInLibrary(name){
  if(!name||name.length>64)throw Error('Nome inválido (máximo 64 caracteres).');
  const data=projectData();const bytes=new TextEncoder().encode(JSON.stringify(data)).length;
  if(bytes>240000)throw Error('Projeto grande demais para a biblioteca local; exporte o JSON.');
  const items=library().filter(item=>item.name!==name);
  if(items.length>=12)throw Error('Limite de 12 projetos locais. Exclua um para salvar outro.');
  items.push({name,project:data});localStorage.setItem(LIBRARY_KEY,JSON.stringify(items));refreshExamples('saved:'+name);
}
async function loadProjectData(data){
  if(!data||data.format!=='meca-sim-project'||data.version!==2||typeof data.source!=='string')throw Error('Projeto salvo inválido.');
  if(['compilando','inicializando','executando'].includes(state.status))throw Error('Clique em STOP antes de trocar de projeto.');
  await api('reset',{config:data.config||{}});
  $('source').value=data.source;javaFiles={...(data.files||{})};restoreOpModeChoices();updateJavaFilesLabel();
  for(const id of configIds){const key=id==='initial-yaw'?'yaw':id;if(key in (data.config||{}))$(id).type==='checkbox'?$(id).checked=Boolean(data.config[key]):$(id).value=data.config[key];}
  for(const id of launchIds)if(id in (data.launcher||{}))$(id).value=data.launcher[id];
  if(!Object.prototype.hasOwnProperty.call(data.launcher||{},'shot-mode'))$('shot-mode').value='speed'; // projeto v2 antigo
  routePoints=Array.isArray(data.route)?data.route.slice(0,MAX_WAYPOINTS).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)):[];if(hiveCellById(data.hive))selectedHiveId=data.hive;$('walls').checked=true;refreshMatchLimit();selectHive(selectedHive(),false);updateRoute();
  resetReplay();shot=null;refreshShot();persist();scheduleHighlight();notice('Projeto restaurado. Compile/INIT para executar.');
}

function pathOfPrimary(code) {
  const pkg=code.match(/^\s*package\s+([\w.]+)\s*;/m);
  const cls=code.match(/\bpublic\s+(?:(?:final|strictfp)\s+)*class\s+([A-Za-z_$][\w$]*)\b/);
  return cls?(pkg?pkg[1].replaceAll('.','/')+'/':'')+cls[1]+'.java':null;
}
function chooseOpMode(path) {
  const candidate=javaFiles[path];
  if(typeof candidate!=='string')throw Error('OpMode não encontrado: '+path);
  const previous=pathOfPrimary($('source').value);
  if(previous && selectedJavaPath)javaFiles[previous]=$('source').value;
  delete javaFiles[path];$('source').value=candidate;
  selectedJavaPath=path;
  $('opmode-choice').value=path;
  updateJavaFilesLabel();persist();scheduleHighlight();
}
$('opmode-choice').addEventListener('change',e=>{try{chooseOpMode(e.target.value);}catch(error){notice(error.message);}});
function populateOpModes(opmodes) {
  zipOpModes=opmodes;
  const select=$('opmode-choice');select.replaceChildren();
  opmodes.forEach(({path,name})=>{const option=document.createElement('option');option.value=path;option.textContent=name+' — '+path;select.append(option);});
  $('opmode-choice-label').hidden=opmodes.length<2;
}
$('import-zip').addEventListener('change',async event=>{
  try{
    if(['compilando','inicializando','executando'].includes(state.status))throw Error('Pare a simulação antes de importar.');
    const file=event.target.files[0];if(!file)return;
    if(file.size>1000000)throw Error('ZIP deve ter no máximo 1 MB.');
    const encoded=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(Error('Não foi possível ler o ZIP'));
      reader.readAsDataURL(file);
    });
    const result=await api('import-zip',{zip_base64:encoded});
    const options=result.opmodes||[];
    if(!options.length)throw Error('ZIP sem OpMode compatível.');
    const path=options[0].path;
    javaFiles={...result.files};
    $('source').value='';selectedJavaPath='';
    populateOpModes(options);
    chooseOpMode(path);
    notice('Projeto FTC importado: '+Object.keys(result.files).length+' arquivos, '+options.length+' OpMode(s). APIs FTC não implementadas ainda podem falhar na compilação.');
  }catch(error){notice(error.message);}finally{event.target.value='';}
});
function restoreOpModeChoices() {
  const entries=[];
  const source=$('source').value,primary=pathOfPrimary(source);
  const pattern=/\bpublic\s+(?:(?:final|strictfp)\s+)*class\s+([A-Za-z_$][\w$]*)\s+extends\s+(?:com\.qualcomm\.robotcore\.eventloop\.opmode\.)?LinearOpMode\b/;
  const mainMatch=source.match(pattern);
  if(primary && mainMatch)entries.push({path:primary,name:mainMatch[1]});
  Object.entries(javaFiles).forEach(([path,code])=>{
    const match=code.match(pattern);
    if(match && !entries.some(entry=>entry.path===path))entries.push({path,name:match[1]});
  });
  populateOpModes(entries);
  selectedJavaPath=mainMatch?primary:'';
  if(selectedJavaPath)$('opmode-choice').value=selectedJavaPath;
}
function updateJavaFilesLabel() {
  const count=Object.keys(javaFiles).length;
  $('java-file-count').textContent=count ? count+' arquivo(s) auxiliar(es) importado(s).' : 'Nenhum arquivo auxiliar importado.';
}
$('import-java').addEventListener('change',async event=>{
  try {
    if(['compilando','inicializando','executando'].includes(state.status))throw Error('Pare a simulação antes de importar.');
    const selected=Array.from(event.target.files);
    if(!selected.length)return;
    if(selected.length>30)throw Error('Importe até 30 arquivos Java por vez.');
    const entries=[];
    for(const file of selected) {
      if(!/\.java$/i.test(file.name) || file.size>200000)throw Error('Selecione apenas arquivos .java menores que 200 kB.');
      const code=await file.text();
      const pkg=code.match(/^\s*package\s+([\w.]+)\s*;/m);
      const path=(pkg?pkg[1].replaceAll('.','/')+'/':'')+file.name;
      if(!/^(?:[A-Za-z_$][A-Za-z0-9_$]*\/)*[A-Za-z_$][A-Za-z0-9_$]*\.java$/.test(path))throw Error('Nome ou pacote Java inválido: '+path);
      if(entries.some(item=>item.path===path))throw Error('Arquivo Java repetido: '+path);
      entries.push({path,code});
    }
    const main=entries.find(item=>/\bpublic\s+(?:(?:final|strictfp)\s+)*class\s+[A-Za-z_$][\w$]*\s+extends\s+(?:com\.qualcomm\.robotcore\.eventloop\.opmode\.)?LinearOpMode\b/.test(item.code));
    if(!main && !$('source').value.trim())throw Error('Cole ou importe um LinearOpMode principal.');
    const helpers=main?{}:{...javaFiles};
    for(const item of entries)if(item!==main)helpers[item.path]=item.code;
    const primary=main?main.code:$('source').value;
    const size=new TextEncoder().encode(primary).length+
      Object.values(helpers).reduce((sum,code)=>sum+new TextEncoder().encode(code).length,0);
    if(Object.keys(helpers).length>30||size>220000)throw Error('Projeto excede 30 auxiliares ou 220 kB de Java.');
    if(main)$('source').value=main.code;
    selectedJavaPath='';javaFiles=helpers;restoreOpModeChoices();updateJavaFilesLabel();persist();scheduleHighlight();
    notice('Arquivos Java importados. Clique em Compilar / INIT.');
  }catch(error){notice(error.message);}finally{event.target.value='';}
});
async function api(path, data={}) {
  const response = await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Sim-Token':window.SIM_TOKEN},body:JSON.stringify(data)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error||'Falha no servidor');
  return result;
}
const action = (id, callback) => $(id).addEventListener('click',async()=>{try{notice('');await callback();}catch(e){notice(e.message);}});
action('compile',async()=>{resetReplay();persist();shot=null;javaShots=[];lastJavaLaunchId=0;matchStarted=false;await api('run',{source:$('source').value,files:javaFiles,config:config()});});
// O Autônomo 3.5 espera seleção (B/X/Y/↑) e confirmação A ANTES de START.
// Envia pulsos no mesmo canal gamepad do Java, sem alterar o código original.
$('auto35-confirm').addEventListener('click',async()=>{
  try{
    if(state.status!=='inicializando')throw Error('Execute INIT antes de confirmar o Autônomo 3.5.');
    const pulse=async index=>{
      virtualKeys.set(index,performance.now()+300);
      await new Promise(resolve=>setTimeout(resolve,360));
      virtualKeys.delete(index);
      await new Promise(resolve=>setTimeout(resolve,80));
    };
    const mode=Number($('auto35-mode').value);
    await pulse(mode);
    await pulse(6); // A
    await new Promise(resolve=>setTimeout(resolve,150));
    const response=await fetch('/api/state');
    if(!response.ok)throw Error('Falha ao ler confirmação da JVM');
    const latest=await response.json();
    if(!/Confirmado:\s*true/i.test(latest.telemetry||''))throw Error('O Java ainda não confirmou a escolha. Verifique a telemetria e tente novamente.');
    notice('Autônomo 3.5 confirmado pela JVM. START liberado.');
  }catch(error){notice(error.message);}
});
for(const [id,target] of [['ds-init','compile'],['ds-start','start'],['ds-stop','stop']])$(id).addEventListener('click',()=>$(target).click());
action('start',async()=>{
  if(finalReport)throw Error('Exporte ou descarte o relatório anterior antes de iniciar outra partida.');
  auto35StartPose=/class\s+Autonomo35\b/.test($('source').value)?{x:state.x,y:state.y,yaw:state.yaw}:null;
  auto35Moved=false;
  await api('heartbeat');await api('start');matchStarted=true;
});
action('stop',()=>api('stop'));
$('finish-match').addEventListener('click',async()=>{
  try{await api('stop');await poll();if(!finalReport)buildFinalReport('manual_finish');}
  catch(error){notice(error.message);}
});
function reportData(){
  const tips=(hiveFlips.red||0)+(hiveFlips.blue||0);
  const retained=scoredShots.filter(item=>item.kind==='POLLEN'||item.kind==='NECTAR').length;
  const result=state.status==='concluído'?'Java terminou normalmente (isso não comprova sucesso da missão).':
    state.status==='erro'?'Execução Java terminou com erro.':'Simulação encerrada antes do fim normal do Java.';
  return {format:'meca-sim-match-report',version:1,endedAt:new Date().toISOString(),
    javaResult:result,missionSuccess:'não avaliada',durationSeconds:Number(state.time||0),
    alliance:$('alliance').value,estimatedPoints:{hiveTipsDidactic:tips*20,
      elementsRetainedInHive:retained,retainedElementPoints:retained*2,
      partialTotal:tips*20+retained*2,scope:'estimativa parcial; não é placar oficial'},
    activity:{collected:(state.intake||{}).collected||0,launched:(state.launcher_status||{}).launch_count||0,
      successfulHiveElements:retained,emptyFeedAttempts:(state.launcher_status||{}).empty_feed_attempts||0,
      hiveTipsDidactic:tips,diagnostics:(state.diagnostics||[]).length},
    diagnostics:state.diagnostics||[],javaLogs:state.logs||'',telemetry:state.telemetry||'',
    limitations:['FLOWER/GARDEN scoring and ranking points are not calculated.',
      'Hive tipping still uses the didactic element-count approximation; it is not official rule adjudication.',
      'Physical robot validation is not included.']};
}
function renderFinalReport(){
  const root=$('final-report');if(!root)return;
  root.hidden=!finalReport;
  if(!finalReport)return;
  const r=finalReport,summary=$('report-summary');
  summary.replaceChildren();
  const fields=[
    ['Resultado Java',r.javaResult],['Missão','Não avaliada pelo simulador'],
    ['Duração',Number(r.durationSeconds).toFixed(2)+' s'],
    ['Estimativa parcial',r.estimatedPoints.partialTotal+' pts (não oficial)'],
    ['POLLEN/NECTAR coletados',r.activity.collected],
    ['Elementos lançados',r.activity.launched],
    ['Lançamentos vazios',r.activity.emptyFeedAttempts],
    ['Avisos de diagnóstico',r.activity.diagnostics]
  ];
  for(const [label,value] of fields){const p=document.createElement('p');p.textContent=label+': '+value;summary.append(p);}
}
function buildFinalReport(reason){
  finalReport=reportData();finalReport.endReason=reason;
  try{localStorage.setItem(REPORT_KEY,JSON.stringify(finalReport));}catch{}
  renderFinalReport();notice('Relatório final disponível. Término do Java não equivale à conclusão da missão.');
}
$('report-json').addEventListener('click',()=>{if(finalReport)download(JSON.stringify(finalReport,null,2),'meca-sim-relatorio.json');});
$('report-csv').addEventListener('click',()=>{
  if(!finalReport)return;
  const r=finalReport,rows=[['campo','valor'],['resultado_java',r.javaResult],['missao','nao avaliada'],
    ['duracao_s',r.durationSeconds],['estimativa_parcial_nao_oficial',r.estimatedPoints.partialTotal],
    ['coletados',r.activity.collected],['lancados',r.activity.launched],
    ['lancamentos_vazios',r.activity.emptyFeedAttempts],['diagnosticos',r.activity.diagnostics]];
  download(rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n'),
    'meca-sim-relatorio.csv','text/csv;charset=utf-8');
});
$('dismiss-report').addEventListener('click',()=>{
  finalReport=null;try{localStorage.removeItem(REPORT_KEY);}catch{}renderFinalReport();notice('Relatório descartado.');
});
action('reset',async()=>{resetReplay();shot=null;javaShots=[];lastJavaLaunchId=0;await api('reset',{config:config()});});
action('clear-shots',()=>{scoredShots=[];shot=null;javaShots=[];lastJavaLaunchId=Math.max(lastJavaLaunchId,...(state.launches||[]).map(e=>e.id));tippedHives.clear();hiveCounts={red:0,blue:0};hiveFlips={red:0,blue:0};hiveMotion={};setShotResult('POLLEN, contadores e gangorras reiniciados.','info');});
action('export',async()=>{
  const blob=new Blob([JSON.stringify({version:'0.2',config:config(),launcher:Object.fromEntries(launchIds.map(id=>[id,id==='shot-mode'?$(id).value:num(id)])),result:state},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download='meca-sim-resultado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function download(data, filename, type='application/json') {
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
action('save-project',()=>{
  const project=projectData();download(JSON.stringify(project,null,2),'meca-sim-projeto.json');
  const selected=$('example').value;
  const name=(selected.startsWith('saved:')?selected.slice(6):pathOfPrimary(project.source)?.split('/').pop().replace(/\.java$/,'')||'Meu projeto');
  try{saveInLibrary(name);notice('JSON exportado e projeto adicionado ao menu: '+name);}
  catch(error){notice('JSON exportado. Biblioteca local: '+error.message);}
});
action('save-library',()=>{const name=window.prompt('Nome do projeto na biblioteca:',pathOfPrimary($('source').value)?.split('/').pop().replace(/\.java$/,'')||'Meu projeto');if(name===null)return;saveInLibrary(name.trim());notice('Projeto guardado no menu deste navegador.');});
action('delete-library',()=>{const current=$('example').value;if(!current.startsWith('saved:'))return;const name=current.slice(6);if(!window.confirm('Excluir da biblioteca local: '+name+'?'))return;localStorage.setItem(LIBRARY_KEY,JSON.stringify(library().filter(item=>item.name!==name)));refreshExamples();notice('Removido do menu local. Arquivos JSON exportados não foram apagados.');});
$('load-project').addEventListener('change',async e=>{
  try {const file=e.target.files[0];if(!file)return;if(file.size>250000)throw Error('Projeto excede 250 kB');
    const data=JSON.parse(await file.text());if(data.format!=='meca-sim-project'||data.version!==2||typeof data.source!=='string')throw Error('Arquivo de projeto inválido');
    if(['compilando','inicializando','executando'].includes(state.status))throw Error('Pare a execução antes de carregar o projeto.');
    if(!data.config||typeof data.config!=='object'||!data.launcher||typeof data.launcher!=='object')throw Error('Configuração ausente');
    if(data.files!==undefined && (typeof data.files!=='object'||data.files===null||Array.isArray(data.files)||Object.keys(data.files).length>30||Object.values(data.files).some(value=>typeof value!=='string')))throw Error('Arquivos Java do projeto inválidos');
    await loadProjectData(data);
    const name=String(data.name||file.name.replace(/\.json$/i,'')).slice(0,64);
    try{saveInLibrary(name);}catch(error){notice('Projeto carregado, mas não salvo no menu: '+error.message);}
  }catch(error){notice(error.message);}finally{e.target.value='';}
});
action('csv',async()=>{const response=await fetch('/api/recording');if(!response.ok)throw Error('Falha ao exportar');const data=await response.json();download([data.columns.join(','),...data.rows.map(row=>row.join(','))].join('\n'),'meca-sim-trajetoria.csv','text/csv');});
action('calc-encoder',()=>{$('ticks_per_m').value=encoderScale(num('encoder-ticks'),num('gear-ratio'),num('wheel-diameter')/1000).toFixed(6);persist();notice('Conversão calculada; aplicada no próximo INIT ou Reiniciar posição.');});
action('solve-shot',()=>{
  const v=launchValues();if(!v.valid)throw Error('Confira os dados do shooter.');
  const result=targetSolution(state,v.lateral,v.forward,v.height,v.elevation,v.tx,v.ty,v.th);
  if(result.speed>30)throw Error('Velocidade necessária acima de 30 m/s; altere a elevação ou a posição.');
  if($('shot-mode').value==='force')$('force').value=forceFromSpeed(result.speed,v.mass,v.stroke,v.efficiency).toFixed(4);
  $('speed').value=result.speed.toFixed(6);$('azimuth').value=result.azimuth.toFixed(6);
  shot=null;refreshShot();persist();notice('Mira e energia ideais calculadas. Confira o resultado e valide no robô real.');
});
action('shoot',async()=>{
  const values=launchValues(),cell=$('arena').value==='biobuzz'?selectedHive():null;
  if(!values.valid)throw new Error('Confira altura, velocidade, elevação e coordenadas do lançador.');
  if($('arena').value==='biobuzz'&&!cell)throw new Error('Clique em uma CELL vermelha ou azul do HIVE para selecionar a mira.');
  const candidate={...values,cellId:cell?.id||'',origin:launcher(state,values.lateral,values.forward),yaw:state.yaw,start:performance.now(),hiveAngle:hiveOrientation(cell?.team||'red')*HIVE_SIDE.angleDeg};
  candidate.impact=cell?hiveShotImpact(candidate,cell):{hit:false,reason:'arena livre'};
  if(cell&&activeCellId(cell.team)!==cell.id)candidate.impact={hit:false,reason:'a CELL escolhida está virada para baixo'};
  candidate.restIndex=cell?scoredShots.filter(ball=>ball.cellId===cell.id).length:0;
  shot=candidate;
  setShotResult('LANÇAMENTO EM ANDAMENTO · '+(candidate.impact.hit?'trajetória converge para a abertura.':'trajetória sem captura: '+candidate.impact.reason)+'.','running');
});
function refreshLauncherReadouts(){
  ['offset-x','offset-y','height'].forEach(id=>{
    const out=$(id+'-readout');if(out)out.textContent=num(id).toFixed(2)+' m';
  });
  $('elevation-preview').value=$('elevation').value;
  $('elevation-preview-value').textContent=Number($('elevation').value).toFixed(0)+'°';
}
$('elevation-preview').addEventListener('input',()=>{
  $('elevation').value=$('elevation-preview').value;
  refreshLauncherReadouts();refreshShot();persist();
});
function refreshDriveMode(){const mecanum=$('drivetrain').value==='mecanum';$('mecanum-names').hidden=!mecanum;$('route-panel').hidden=mecanum;}
$('drivetrain').addEventListener('change',()=>{refreshDriveMode();persist();notice($('drivetrain').value==='mecanum'?'Mecanum configurado: use FL, FR, BL e BR no Java.':'Diferencial configurado: Mequinha usa ME e MD.');});
$('match-mode').addEventListener('change',()=>{refreshMatchLimit();persist();notice($('match-mode').value==='auto'?'Autônomo limitado a 30 s.':'TeleOp limitado a 2 min.');});
$('timer-enabled').addEventListener('change',()=>{refreshMatchLimit();persist();notice($('timer-enabled').checked?'Cronômetro de partida ativado.':'Cronômetro de partida desativado; STOP manual continua disponível.');});
function switchWorkspace(mode){
  const main=document.querySelector('main');
  const next=['overview','code','paths'].includes(mode)?mode:'overview';
  main.classList.remove('mode-code','mode-paths','mode-overview');
  main.classList.add('mode-'+next);
  document.querySelectorAll('[data-workspace]').forEach(button=>{
    const active=button.dataset.workspace===next;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('editor-full').setAttribute('aria-pressed',String(next==='code'));
  $('editor-full').textContent=next==='code'?'Voltar ao simulador':'Expandir editor';
  if(next==='code'){
    document.querySelector('[data-tab="code"]').click();
    $('source').focus({preventScroll:true});
    document.querySelector('.workspace-switch').scrollIntoView({block:'start',behavior:'instant'});
  }else if(next==='paths'){
    $('route-panel').open=true;
    $('timeline-panel').open=true;
    $('route-panel').scrollIntoView({block:'start',behavior:'instant'});
  }
}
document.querySelectorAll('[data-workspace]').forEach(button=>button.addEventListener('click',()=>switchWorkspace(button.dataset.workspace)));
$('editor-full').addEventListener('click',()=>switchWorkspace(document.querySelector('main').classList.contains('mode-code')?'overview':'code'));
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b===button));
  ['code','robot','launcher'].forEach(name=>$('tab-'+name).hidden=name!==button.dataset.tab);
}));
function refreshHighlight(){
  // Textarea nativo fica sempre visível: evita uma metade preta causada por
  // pre limitado a 220 px e elimina travadas ao colar OpModes extensos.
  const source=$('source').value;
  const stats=$('code-stats');
  if(stats)stats.textContent=source.split('\n').length+' linhas · '+new TextEncoder().encode(source).length.toLocaleString('pt-BR')+' bytes · '+(source.length>180000?'próximo do limite de 220 kB':'arquivo íntegro');
  $('auto35-panel').hidden=!/class\s+Autonomo35\b|Autonomo\s+3\.5/i.test(source);
}
function scheduleHighlight(){
  if(highlightJob)cancelAnimationFrame(highlightJob);
  highlightJob=requestAnimationFrame(()=>{highlightJob=0;refreshHighlight();});
}
$('source').addEventListener('input',()=>{persist();scheduleHighlight();showSuggestions();});
$('source').addEventListener('scroll',()=>{$('source-highlight').scrollTop=$('source').scrollTop;$('source-highlight').scrollLeft=$('source').scrollLeft;});
function placeCursor(line){
  const src=$('source'),lines=src.value.split('\n');
  const pos=lines.slice(0,Math.max(0,line-1)).reduce((sum,x)=>sum+x.length+1,0);
  src.focus();src.setSelectionRange(pos,pos);
  const lh=parseFloat(getComputedStyle(src).lineHeight)||20;
  src.scrollTop=Math.max(0,(line-5)*lh);$('source-highlight').scrollTop=src.scrollTop;
}
function showCodeErrors(logs){
  const errors=diagnostics(logs),list=$('code-errors');list.replaceChildren();
  if(!errors.length)return;
  const title=document.createElement('strong');title.textContent=errors.length+' diagnóstico(s) do compilador';list.append(title);
  const primary=pathOfPrimary($('source').value)?.split('/').pop();
  for(const issue of errors){
    const button=document.createElement('button');button.type='button';
    button.className=issue.severity==='error'?'code-error':'code-warning';
    button.textContent=issue.file+':'+issue.line+' · '+issue.message;
    button.addEventListener('click',()=>{if(issue.file===primary)placeCursor(issue.line);else notice('Diagnóstico de '+issue.file+'; abra o arquivo auxiliar correspondente para editar.');});
    list.append(button);
  }
}
function showSuggestions(forced=false){
  const src=$('source'),list=$('code-suggest');list.replaceChildren();
  const options=candidates(src.value,src.selectionStart,forced);
  for(const term of options){
    const button=document.createElement('button');button.type='button';button.textContent=term;
    button.addEventListener('click',()=>insertCompletion(term));list.append(button);
  }
  list.hidden=!options.length;
}
function insertCompletion(term){
  const src=$('source'),start=src.selectionStart,match=src.value.slice(0,start).match(/[A-Za-z_$][\w$]*$/);
  const begin=start-(match?.[0].length||0);src.focus();src.setRangeText(term,begin,start,'end');
  $('code-suggest').hidden=true;persist();scheduleHighlight();
}
$('source').addEventListener('click',()=>showSuggestions());
$('source').addEventListener('keyup',()=>showSuggestions());
[...configIds,...launchIds].forEach(id=>$(id).addEventListener('change',()=>{if(launchIds.includes(id))refreshShot();persist();}));
launchIds.forEach(id=>$(id).addEventListener('input',()=>{refreshLauncherReadouts();refreshShot();persist();}));
$('example').addEventListener('change',async()=>{
  try{const choice=$('example').value;
    if(choice.startsWith('saved:')){const item=library().find(x=>x.name===choice.slice(6));if(item)await loadProjectData(item.project);}
    else if(examples[choice]){$('source').value=examples[choice];javaFiles={};selectedJavaPath='';populateOpModes([]);updateJavaFilesLabel();persist();scheduleHighlight();}
    $('delete-library').disabled=!choice.startsWith('saved:');
  }catch(error){notice(error.message);}
});
$('source').addEventListener('keydown',event=>{
  const src=event.target;
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='s'){
    event.preventDefault();$('save-project').click();return;
  }
  if(event.ctrlKey&&event.code==='Space'){event.preventDefault();showSuggestions(true);return;}
  if(event.key==='Escape'){$('code-suggest').hidden=true;return;}
  if(event.key==='Tab'){
    event.preventDefault();
    const suggested=$('code-suggest').hidden?null:$('code-suggest button');
    if(suggested){insertCompletion(suggested.textContent);return;}
    src.setRangeText('    ',src.selectionStart,src.selectionEnd,'end');persist();scheduleHighlight();
  }
});

function launchValues() {
  const v={lateral:num('offset-x'),forward:num('offset-y'),height:num('height'),elevation:num('elevation'),
    azimuth:num('azimuth'),tx:num('target-x'),ty:num('target-y'),th:num('target-h'),
    mass:num('projectile-mass'),stroke:num('acceleration-stroke'),efficiency:num('shot-efficiency'),
    force:num('force'),radius:num('target-radius'),heightTolerance:num('target-tolerance'),
    speed:num('speed')};
  try{
    if($('shot-mode').value==='force')v.speed=speedFromForce(v.force,v.mass,v.stroke,v.efficiency);
    v.valid=Object.values(v).every(Number.isFinite)&&v.height>=0&&v.height<=5&&
      v.speed>0&&v.speed<=30&&v.elevation>=0&&v.elevation<90&&v.th>=0&&v.th<=5&&
      v.radius>0&&v.heightTolerance>0&&v.mass>0&&v.stroke>0&&v.efficiency>0&&v.efficiency<=1;
  }catch{v.valid=false;}
  return v;
}
function refreshShot(){
  const inForceMode=$('shot-mode').value==='force';$('speed').readOnly=inForceMode;
  $('force').disabled=!inForceMode;
  const v=launchValues();
  refreshLauncherReadouts();
  if(v.valid&&inForceMode)$('speed').value=v.speed.toFixed(3);
  const verdict=$('shot-verdict');
  if(!v.valid){verdict.dataset.possible='invalid';verdict.textContent='Parâmetros inválidos. Verifique força, massa, eficiência e limites.';return;}
  try{
    const pose=replayIndex>=0&&replayRows[replayIndex]?{...state,x:replayRows[replayIndex][1],y:replayRows[replayIndex][2],yaw:replayRows[replayIndex][3]}:state;
    const test=shotFeasibility(pose,v);
    const cell=$('arena').value==='biobuzz'?selectedHive():null;
    const simulated=cell?hiveShotImpact({...v,origin:launcher(pose,v.lateral,v.forward),
      yaw:pose.yaw,hiveAngle:hiveOrientation(cell.team)*HIVE_SIDE.angleDeg},cell):null;
    const valid=simulated?simulated.hit&&activeCellId(cell.team)===cell.id:test.possible;
    verdict.dataset.possible=valid?'yes':'no';
    verdict.textContent=(simulated
      ?(valid?'SIM — o POLLEN cruza a abertura do HIVE vermelho na descida.':
        'NÃO — '+(simulated.reason||'a CELL selecionada está voltada para baixo')+'.')
      :(test.possible?'SIM — lançamento geometricamente possível no modelo ideal.':'NÃO — '+test.issues.join('; ')+'.'))+
      (simulated?.impactPoint?' Ponto no plano: '+simulated.impactPoint.lateralError.toFixed(3)+' m de desvio lateral; '+simulated.impactPoint.depthError.toFixed(3)+' m de erro de profundidade.':'')+
      ' Alcance: '+test.range.toFixed(2)+' m; altura no alvo: '+(test.heightAtTarget===null?'—':test.heightAtTarget.toFixed(2)+' m')+
      '; desvio lateral: '+Math.abs(test.lateralError).toFixed(2)+' m; v₀: '+v.speed.toFixed(2)+' m/s.';
  }catch(e){verdict.dataset.possible='invalid';verdict.textContent=e.message;}
}
function canvasContext(canvas) {
  const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  const w=rect.width,h=rect.height;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);return {ctx,w,h};
}
function geometry() {const r=top.getBoundingClientRect(),scale=Math.min((r.width-70)/3.66,(r.height-40)/3.66);return {scale,ox:(r.width-3.66*scale)/2,oy:(r.height+3.66*scale)/2};}
function drawTop(now) {
  const {ctx:c,w,h}=canvasContext(top),g=geometry();
  const project=(x,y)=>[g.ox+x*g.scale,g.oy-y*g.scale];
  drawArenaTop(c,project,$('arena').value,selectedHiveId,scoredShots,[...tippedHives]);
  c.lineWidth=1;c.font='10px system-ui';
  for(let i=0;i<=6;i++){const p=i*3.66/6,[x,y]=project(p,p);c.strokeStyle='#242c37';c.beginPath();c.moveTo(x,g.oy);c.lineTo(x,g.oy-3.66*g.scale);c.moveTo(g.ox,y);c.lineTo(g.ox+3.66*g.scale,y);c.stroke();c.fillStyle='#627085';c.fillText(p.toFixed(2),x-9,g.oy+15);c.fillText(p.toFixed(2),g.ox-28,y+3);}
  c.strokeStyle='#536277';c.strokeRect(g.ox,g.oy-3.66*g.scale,3.66*g.scale,3.66*g.scale);
  (state.elements||[]).filter(item=>['field','flower','hive'].includes(item.status)).forEach(item=>{
    const q=project(item.x,item.y),radius=Math.max(3,item.radius*g.scale);
    const nectar=item.kind==='NECTAR',fill=nectar?(item.team==='red'?'#e34f5a':'#4c91e8'):'#f1ce54';
    c.fillStyle=fill;c.strokeStyle=nectar?'#f7f8ff':'#80621f';c.lineWidth=1.3;
    c.beginPath();c.arc(q[0],q[1],radius,0,Math.PI*2);c.fill();c.stroke();
    c.strokeStyle=nectar?'#ffffffaa':'#fff2ad';c.lineWidth=1;
    c.beginPath();c.moveTo(q[0]-radius*.55,q[1]);c.lineTo(q[0]+radius*.55,q[1]);c.stroke();
  });
  c.strokeStyle='#ff852e80';c.lineWidth=2;c.beginPath();state.trail.forEach((p,i)=>{const q=project(...p);i?c.lineTo(...q):c.moveTo(...q);});c.stroke();
  if(replayIndex>=0){const row=replayRows[replayIndex];if(row){c.strokeStyle='#56e4bd';c.beginPath();replayRows.slice(0,replayIndex+1).forEach((r,i)=>{const q=project(r[1],r[2]);i?c.lineTo(...q):c.moveTo(...q);});c.stroke();}}
  if(routePoints.length){c.setLineDash([5,4]);c.strokeStyle='#ffcc67';c.lineWidth=2;c.beginPath();
    const first=project(num('x'),num('y'));c.moveTo(...first);
    routePoints.forEach((p,i)=>{const q=project(p.x,p.y);c.lineTo(...q);});c.stroke();c.setLineDash([]);
    routePoints.forEach((p,i)=>{const q=project(p.x,p.y);c.fillStyle='#ffcc67';c.beginPath();c.arc(...q,10,0,Math.PI*2);c.fill();
      c.textAlign='center';c.fillStyle='#171717';c.font='bold 11px system-ui';c.fillText(String(i+1),q[0],q[1]+4);});}
  const shown=replayIndex>=0?{...state,x:replayRows[replayIndex][1],y:replayRows[replayIndex][2],yaw:replayRows[replayIndex][3]}:state;
  const corner=(x,y)=>{const r=rotate(x,y,shown.yaw);return project(shown.x+r[0],shown.y+r[1]);};
  c.beginPath();[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y],i)=>{const p=corner(x*state.width/2,y*state.length/2);i?c.lineTo(...p):c.moveTo(...p);});c.closePath();const robotColor=$('robot-color').value||'#ff7a1a';c.fillStyle=robotColor+'33';c.fill();c.strokeStyle=robotColor;c.stroke();
  const intakeReach=Number.isFinite(state.intake?.reach)?state.intake.reach:num('intake_reach');
  const intakeCorners=[[-shown.width/2,shown.length/2],[shown.width/2,shown.length/2],[shown.width/2,shown.length/2+intakeReach],[-shown.width/2,shown.length/2+intakeReach]].map(([x,y])=>{const r=rotate(x,y,shown.yaw);return project(shown.x+r[0],shown.y+r[1]);});
  c.beginPath();intakeCorners.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=state.intake?.active?'#51d1bb55':'#51d1bb12';c.fill();c.strokeStyle=state.intake?.active?'#51d1bb':'#51d1bb66';c.setLineDash([4,3]);c.stroke();c.setLineDash([]);
  const center=project(shown.x,shown.y),front=corner(0,shown.length*.6);c.beginPath();c.moveTo(...center);c.lineTo(...front);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(...center,3,0,Math.PI*2);c.fill();
  for(const sign of [-1,1]){const a=corner(sign*state.width/2,-state.length*.24),b=corner(sign*state.width/2,state.length*.24);c.strokeStyle='#d6dfeb';c.lineWidth=5;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}
  const v=launchValues();if(!v.valid)return;
  const check=shotFeasibility(shown,v);
  const gateCell=$('arena').value==='biobuzz'?selectedHive():null;
  const gateHit=gateCell?hiveShotImpact({...v,origin:launcher(shown,v.lateral,v.forward),
    yaw:shown.yaw,hiveAngle:hiveOrientation(gateCell.team)*HIVE_SIDE.angleDeg},gateCell):null;
  const origin=launcher(shown,v.lateral,v.forward),start=project(...origin),target=project(v.tx,v.ty),dir=rotate(0,1,shown.yaw+v.azimuth),f=flight(v.height,v.speed,v.elevation),impactPoint=gateHit?.impactPoint||gateHit,endDistance=Number.isFinite(impactPoint?.distance)?impactPoint.distance:(check.along>0?Math.min(f.range,check.along):f.range),end=project(origin[0]+dir[0]*endDistance,origin[1]+dir[1]*endDistance);
  c.lineWidth=1;c.setLineDash([5,5]);c.strokeStyle='#6b7584';c.beginPath();c.moveTo(...start);c.lineTo(...target);c.stroke();c.strokeStyle='#51d1bb';c.beginPath();c.moveTo(...start);c.lineTo(...end);c.stroke();c.setLineDash([]);
  c.fillStyle='#51d1bb';c.beginPath();c.arc(...start,4,0,Math.PI*2);c.fill();c.strokeStyle=(gateHit?gateHit.hit:check.possible)?'#55d9ab':'#ef727c';c.lineWidth=2;c.beginPath();c.arc(...target,9,0,Math.PI*2);c.moveTo(target[0]-14,target[1]);c.lineTo(target[0]+14,target[1]);c.moveTo(target[0],target[1]-14);c.lineTo(target[0],target[1]+14);c.stroke();
  if(impactPoint&&Number.isFinite(impactPoint.x)&&Number.isFinite(impactPoint.y)){const q=project(impactPoint.x,impactPoint.y);c.fillStyle='#ffe66d';c.strokeStyle=gateHit?.hit?'#fff7bd':'#ef727c';c.lineWidth=2;c.beginPath();c.arc(...q,6,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#1c2028';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(gateHit?.hit?'ENTROU':'IMPACTO',q[0],q[1]-10);}
  for(const ballShot of [...javaShots,...(shot?[shot]:[])]){
    const q=currentShotBall(now,ballShot);if(q&&q.fall<1){const pos=project(q.x,q.y);c.fillStyle=ballShot.kind==='NECTAR'?(ballShot.team==='blue'?'#4c91e8':'#e34f5a'):'#fff4a9';c.beginPath();c.arc(...pos,ballShot.kind==='NECTAR'?6:5,0,Math.PI*2);c.fill();c.strokeStyle='#bd924e';c.stroke();}
  }
  $('bounds').textContent=state.collision?'Contato com parede · rodas podem patinar':'Paredes externas físicas · frente +Y · yaw positivo ↶';
}
top.addEventListener('click',async event=>{
  const rect=top.getBoundingClientRect(),g=geometry();
  const x=(event.clientX-rect.left-g.ox)/g.scale,y=(g.oy-event.clientY+rect.top)/g.scale;
  if(routePicking&&!event.shiftKey&&!pickingStart){
    if(routePoints.length>=MAX_WAYPOINTS){notice('Limite de '+MAX_WAYPOINTS+' waypoints.');return;}
    if(!validStart(x,y,num('width'),num('length'),0)){notice('Waypoint fora do campo ou chassi não cabe.');return;}
    routePoints.push({x:+x.toFixed(3),y:+y.toFixed(3)});updateRoute();persist();return;
  }
  if(pickingStart||event.shiftKey){
    if(['compilando','inicializando','executando'].includes(state.status)){notice('Use STOP antes de alterar a partida.');return;}
    if(!validStart(x,y,num('width'),num('length'),num('initial-yaw'))){notice('A posição escolhida deixaria parte do robô fora do campo.');return;}
    $('x').value=x.toFixed(3);$('y').value=y.toFixed(3);persist();pickingStart=false;
    $('pick-start').setAttribute('aria-pressed','false');$('start-hint').textContent='Partida definida. Clique no campo para definir o alvo.';
    try{await api('reset',{config:config()});notice('Posição inicial aplicada.');}catch(error){notice(error.message);}
    return;
  }
  const cell=$('arena').value==='biobuzz'?hiveCellAt(x,y):null;
  if($('arena').value==='biobuzz'){
    if(!cell){setShotResult('MIRA NÃO SELECIONADA · clique em uma das quatro CELLs centrais vermelhas ou azuis.','error');return;}
    selectHive(cell);persist();return;
  }
  $('target-x').value=x.toFixed(3);$('target-y').value=y.toFixed(3);refreshShot();persist();
});
$('pick-start').addEventListener('click',()=>{
  pickingStart=!pickingStart;$('pick-start').setAttribute('aria-pressed',String(pickingStart));
  $('start-hint').textContent=pickingStart?'Clique no campo na nova posição inicial (ou Shift+clique).':'Clique no campo para definir o alvo.';
});
$('arena').addEventListener('change',()=>{$('field-description').textContent=$('arena').value==='biobuzz'?'BIOBUZZ · escala real 3,66 × 3,66 m · paredes físicas':'Campo livre · grade cartesiana';persist();});
function updateRoute(){
  const list=$('route-list');list.replaceChildren();
  let steps=[],warnings=[];
  try{
    const start={x:num('x'),y:num('y'),yaw:num('initial-yaw')};
    steps=routeSteps(start,routePoints,{width:num('width'),length:num('length')});
    warnings=routeWarnings(start,routePoints,$('arena').value);
  }catch(error){$('route-summary').textContent='Rota inválida: '+error.message;return;}
  steps.forEach((step,i)=>{
    const row=document.createElement('li');row.textContent=(i+1)+'. ('+step.x.toFixed(2)+', '+step.y.toFixed(2)+') m · virar '+step.turnDeg.toFixed(1)+'° → '+step.distanceM.toFixed(2)+' m';
    const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Excluir waypoint '+(i+1);
    remove.addEventListener('click',()=>{routePoints.splice(i,1);updateRoute();persist();});
    row.append(remove);list.append(row);
  });
  const distance=steps.reduce((s,r)=>s+r.distanceM,0);
  $('route-summary').textContent=steps.length+' ponto(s) · '+distance.toFixed(2)+' m · '+(warnings.length?warnings.join(' '):'Sem passagem pela área central ilustrativa.');
}
$('route-add').addEventListener('click',()=>{
  routePicking=!routePicking;$('route-add').setAttribute('aria-pressed',String(routePicking));
  notice(routePicking?'Clique na vista de cima para adicionar waypoints; Shift+clique define a partida.':'Edição de rota desativada.');
});
$('route-remove').addEventListener('click',()=>{routePoints.pop();updateRoute();persist();});
$('route-clear').addEventListener('click',()=>{routePoints=[];updateRoute();persist();});
$('route-code').addEventListener('click',()=>{
  try{
    const steps=routeSteps({x:num('x'),y:num('y'),yaw:num('initial-yaw')},routePoints,{width:num('width'),length:num('length')});
    const java=makeRouteJava(steps,{ticksPerM:num('ticks_per_m'),left:$('left').value,right:$('right').value});
    if(!window.confirm('Substituir o Java atual pelo roteiro? Salve seu projeto anterior antes de continuar.'))return;
    $('source').value=java;javaFiles={};restoreOpModeChoices();updateJavaFilesLabel();scheduleHighlight();persist();
    document.querySelector('[data-tab="code"]').click();
    switchWorkspace('code');
    notice('Java gerado. Revise sentidos dos motores e timeout antes de compilar.');
  }catch(e){notice(e.message);}
});
function showReplayInfo(){
  const row=replayRows[replayIndex];
  $('timeline-info').textContent=row?'t='+row[0].toFixed(2)+' s · X='+row[1].toFixed(2)+' m · Y='+row[2].toFixed(2)+' m · yaw='+row[3].toFixed(1)+'°':'Nenhum registro';
}
function resetReplay(){
  replayPlaying=false;replayRows=[];replayIndex=-1;
  $('timeline-range').value=0;$('timeline-range').max=0;$('timeline-range').disabled=true;
  $('timeline-play').disabled=true;$('timeline-play').textContent='Reproduzir';$('timeline-exit').disabled=true;showReplayInfo();
}
$('timeline-load').addEventListener('click',async()=>{
  try{const response=await fetch('/api/recording');if(!response.ok)throw Error('Sem gravação');
    const data=await response.json();
    if(!Array.isArray(data.rows)||!data.rows.length)throw Error('Execute um autônomo ou TeleOp primeiro.');
    replayRows=data.rows.filter(row=>Array.isArray(row)&&row.length>=4&&row.slice(0,4).every(Number.isFinite)).slice(0,4000);
    if(!replayRows.length)throw Error('Trajetória inválida.');
    replayPlaying=false;replayIndex=0;$('timeline-range').max=replayRows.length-1;
    $('timeline-range').disabled=false;$('timeline-play').disabled=false;$('timeline-exit').disabled=false;
    $('timeline-play').textContent='Reproduzir';showReplayInfo();readouts();
  }catch(e){notice(e.message);}
});
$('timeline-range').addEventListener('input',()=>{if(!replayRows.length)return;replayPlaying=false;replayIndex=Number($('timeline-range').value);
  $('timeline-play').textContent='Reproduzir';showReplayInfo();readouts();});
$('timeline-play').addEventListener('click',()=>{
  if(replayIndex===replayRows.length-1)replayIndex=0;
  replayPlaying=!replayPlaying;replayLast=0;
  $('timeline-play').textContent=replayPlaying?'Pausar':'Reproduzir';
});
$('timeline-exit').addEventListener('click',()=>{resetReplay();readouts();});

function drawSide(now) {
  const {ctx:c,w,h}=canvasContext(side),sideShot=shot||javaShots.at(-1)||null,v=sideShot||launchValues();if(!v.valid){$('shot-info').textContent='Confira os parâmetros do lançador.';return;}
  const viewed=replayIndex>=0&&replayRows[replayIndex]?{...state,x:replayRows[replayIndex][1],y:replayRows[replayIndex][2],yaw:replayRows[replayIndex][3]}:state;
  const origin=sideShot?.origin||launcher(viewed,v.lateral,v.forward),yaw=sideShot?.yaw??viewed.yaw,dir=rotate(0,1,yaw+v.azimuth),dx=v.tx-origin[0],dy=v.ty-origin[1],along=dx*dir[0]+dy*dir[1],cross=Math.abs(dx*dir[1]-dy*dir[0]),f=flight(v.height,v.speed,v.elevation);
  const a=v.azimuth*Math.PI/180,half=(Math.abs(Math.sin(a))*state.width+Math.abs(Math.cos(a))*state.length)/2,offset=v.lateral*(-Math.sin(a))+v.forward*Math.cos(a),left=-offset-half,right=-offset+half;
  const minX=Math.min(-.6,left-.1,along-.65),maxX=Math.max(2.2,along+.8,right+.1),peak=v.height+(v.speed*Math.sin(v.elevation*Math.PI/180))**2/(2*9.81),maxH=Math.max(1.5,peak+.3,v.th+.3),sx=(w-55)/(maxX-minX),sy=(h-35)/maxH;
  const point=(x,y)=>[40+(x-minX)*sx,h-25-y*sy];c.font='10px system-ui';c.lineWidth=1;
  const sideCell=hiveCellById(sideShot?.cellId||selectedHiveId);
  drawArenaSide(c,point,$('arena').value,along,v.th,sideCell,scoredShots,hiveStatus(sideCell?.team||'red',now));
  for(let i=0;i<=4;i++){const value=i*maxH/4,p=point(0,value);c.strokeStyle='#242c37';c.beginPath();c.moveTo(...p);c.lineTo(w-10,p[1]);c.stroke();c.fillStyle='#627085';c.fillText(value.toFixed(1)+'m',5,p[1]+3);}
  c.strokeStyle='#536277';c.beginPath();c.moveTo(...point(0,0));c.lineTo(...point(maxX,0));c.stroke();
  // Projeção do chassi no eixo do tiro; o lançador está em x=0.
  c.fillStyle='#ff852e20';c.strokeStyle='#ff852e';const p=point(left,.30);c.fillRect(p[0],p[1],(right-left)*sx,.30*sy);c.strokeRect(p[0],p[1],(right-left)*sx,.30*sy);
  c.strokeStyle='#f07a7b';c.lineWidth=2;c.setLineDash([7,4]);c.beginPath();
  const arcEnd=sideShot?.impact?.hit?shot.impact.distance:f.range;
  for(let i=0;i<=120;i++){const x=arcEnd*i/120,q=point(x,Math.max(0,heightAt(x,v.height,v.speed,v.elevation)));i?c.lineTo(...q):c.moveTo(...q);}
  c.stroke();c.setLineDash([]);
  const check=shotFeasibility(viewed,v);
  const viewedCell=$('arena').value==='biobuzz'?selectedHive():null;
  const checkHive=viewedCell?hiveShotImpact({...v,origin:launcher(viewed,v.lateral,v.forward),
    yaw:viewed.yaw,hiveAngle:hiveOrientation(viewedCell.team)*HIVE_SIDE.angleDeg},viewedCell):null;
  const target=point(along,v.th);c.fillStyle=(checkHive?checkHive.hit:check.possible)?'#5bd8a8':'#ef727c';c.fillRect(target[0]-6,target[1]-6,12,12);
  const sideImpact=checkHive?.impactPoint||checkHive;if(sideImpact&&Number.isFinite(sideImpact.distance)&&Number.isFinite(sideImpact.height)){const impact=point(sideImpact.distance,sideImpact.height);c.fillStyle='#ffe66d';c.strokeStyle=checkHive?.hit?'#fff7bd':'#ef727c';c.lineWidth=2;c.beginPath();c.arc(...impact,6,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#fff4cf';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(checkHive?.hit?'ENTRADA':'IMPACTO',impact[0],impact[1]-10);}
  c.strokeStyle=c.fillStyle;c.setLineDash([3,5]);c.beginPath();c.moveTo(...point(along,0));c.lineTo(...target);c.stroke();c.setLineDash([]);
  // O muzzle coincide exatamente com a origem da parábola: (distância=0, altura=height).
  const angle=v.elevation*Math.PI/180,reach=angle>0?Math.min(.35,v.height/Math.tan(angle)):.35;
  const ramp=point(-reach,Math.max(0,v.height-reach*Math.tan(angle))),muzzle=point(0,v.height);
  c.strokeStyle='#ffb564';c.lineWidth=5;c.beginPath();c.moveTo(...ramp);c.lineTo(...muzzle);c.stroke();
  c.fillStyle='#ffb564';c.beginPath();c.arc(...muzzle,4,0,Math.PI*2);c.fill();
  if(sideShot){const ball=currentShotBall(now,sideShot);if(ball){const q=point(ball.along,ball.z);c.fillStyle='#fff4a9';c.beginPath();c.arc(...q,5,0,Math.PI*2);c.fill();c.strokeStyle='#b98944';c.stroke();}}
  const at=along>=0&&along<=f.range?heightAt(along,v.height,v.speed,v.elevation):null;
  $('shot-info').textContent=((checkHive?checkHive.hit:check.possible)?'POSSÍVEL':'NÃO ATINGE O ALVO')+
    ' · v₀ '+v.speed.toFixed(2)+' m/s · alcance '+f.range.toFixed(2)+' m · distância horizontal '+along.toFixed(2)+
    ' m · desvio lateral '+cross.toFixed(2)+' m · altura na distância '+(at===null?'—':at.toFixed(2)+' m')+
    ' / alvo '+v.th.toFixed(2)+' m. Modelo ideal sem resistência do ar.';
}
function readouts() {
  $('status').textContent=state.status;$('clock').textContent=state.time.toFixed(2).padStart(5,'0')+' s';
  $('finish-match').disabled=state.status!=='executando';
  if(matchStarted&&!finalReport&&['parado','concluído','erro'].includes(state.status))buildFinalReport(state.status==='concluído'?'java_finished':state.status==='erro'?'java_error':'stopped');
  const visible=replayIndex>=0&&replayRows[replayIndex]?{x:replayRows[replayIndex][1],y:replayRows[replayIndex][2],yaw:replayRows[replayIndex][3]}:state;
  const shotPoseKey=visible.x+','+visible.y+','+visible.yaw;
  if(lastShotPoseKey!==shotPoseKey){lastShotPoseKey=shotPoseKey;refreshShot();}
  $('px').textContent=visible.x.toFixed(3)+' m';$('py').textContent=visible.y.toFixed(3)+' m';$('yaw').textContent=visible.yaw.toFixed(1)+'°';
  $('imu-yaw').textContent=Number.isFinite(state.imu_yaw)?state.imu_yaw.toFixed(1)+'°':'—';
  const hive=selectedHive();
  const progress=$('hive-progress');
  if(hive&&progress)progress.textContent='HIVE '+(hive.team==='red'?'vermelho':'azul')+
    ' · '+hiveCounts[hive.team]+'/'+SIM_TIP_POLLS+' peças (modelo didático) · '+hiveFlips[hive.team]+
    ' tombamento(s) · abertura ativa: '+hiveCellById(activeCellId(hive.team)).name;
  const stock=state.inventory||{POLLEN:0,NECTAR:0},intake=state.intake||{};
  $('inventory').textContent=`POLLEN ${stock.POLLEN||0} · NECTAR ${stock.NECTAR||0} · ${(intake.collected||0)} coletada(s)`;
  $('intake-status').textContent=intake.active
    ? `Intake MI ativo · captura frontal até ${intake.capacity||num('intake_capacity')} peça(s)`
    : `MI parado · ${stock.POLLEN||0}/${intake.capacity||num('intake_capacity')} no estoque`;
  $('sensor-status').textContent=state.imu_frozen?'Falha simulada ativa: IMU travado. Yaw real e yaw medido podem divergir.':'';
  const buttonNames=['LT','RT','A','B','X','Y','LB','RB','Back','Start','LS click','RS click','D-pad ↑','D-pad ↓','D-pad ←','D-pad →'];
  const gamepads=state.gamepads||[];
  $('input-status').textContent=gamepads.map((pad,index)=>{
    const active=buttonNames.filter((name,i)=>(pad[i+4]||0)>.5);
    const axes=(pad.slice(0,4).some(value=>Math.abs(value)>.05)
      ?' · eixos '+pad.slice(0,4).map(value=>Number(value).toFixed(1)).join('/'):'');
    return 'G'+(index+1)+': '+(active.join(', ')||'neutro')+axes;
  }).join(' · ');
  const warnings=Array.isArray(state.diagnostics)?state.diagnostics:[];
  $('diagnostic-count').textContent=warnings.length+' aviso(s)';
  const diagKey=JSON.stringify(warnings);
  if(lastDiagnosticSignature!==diagKey){lastDiagnosticSignature=diagKey;const list=$('diagnostic-list');list.replaceChildren();
    if(!warnings.length){const li=document.createElement('li');li.textContent='Nenhum alerta automático identificado.';list.append(li);}
    warnings.forEach(w=>{const li=document.createElement('li');li.textContent='['+w.severity+'] '+w.message+' · t='+w.time+' s';list.append(li);});}
  if(auto35StartPose&&state.status==='executando'&&
      (Math.hypot(state.x-auto35StartPose.x,state.y-auto35StartPose.y)>.035||
       Math.abs(state.yaw-auto35StartPose.yaw)>3))auto35Moved=true;
  const shouldMove=/Modo executado:\s*(COMPLETO|DESLOCAMENTO_CURTO|GIRO_CURTO)/i.test(state.telemetry||'');
  $('execution-hint').textContent=state.status==='concluído'
    ?(auto35StartPose&&shouldMove&&!auto35Moved
      ?'ALERTA: Autônomo 3.5 terminou, mas não houve deslocamento/rotação mensurável. Confira modo, telemetria, motores e limites.'
      :'Java encerrado. Verifique a trajetória e a telemetria: conclusão não comprova missão.'):'';

  $('start').disabled=state.status!=='inicializando';$('compile').disabled=['compilando','inicializando','executando'].includes(state.status);
  const auto35=!$('auto35-panel').hidden,confirmed=/Confirmado:\s*true/i.test(state.telemetry||'');
  if(auto35&&state.status==='inicializando'&&!confirmed)$('start').disabled=true;
  if(auto35){
    $('auto35-mode').disabled=state.status!=='inicializando'||confirmed;
    $('auto35-hint').textContent=confirmed
      ?'ETAPA 3/3 · modo CONFIRMADO pela JVM. Agora pressione START.'
      :state.status==='inicializando'
        ?'ETAPA 2/3 · escolha o teste e clique em Selecionar e confirmar (A). START permanece bloqueado até a telemetria confirmar.'
        :'ETAPA 1/3 · pressione INIT; depois escolha o modo e confirme com A.';
  }
  $('auto35-confirm').disabled=state.status!=='inicializando'||confirmed;
  $('ds-start').disabled=$('start').disabled;$('ds-init').disabled=$('compile').disabled;
  $('ds-state').textContent=state.status.toUpperCase();$('ds-time').textContent=state.time.toFixed(2)+' s';
  $('ds-mode').textContent=/@Autonomous\b/.test($('source').value)?'AUTÔNOMO · LinearOpMode':/@TeleOp\b/.test($('source').value)?'TELEOPERADO · LinearOpMode':'JAVA · LinearOpMode';
  $('telemetry').textContent=state.telemetry||'Aguardando telemetry.update()';
  if(lastLog!==state.logs){lastLog=state.logs;$('logs').textContent=state.logs||'Nenhum erro de compilação registrado.';showCodeErrors(state.logs);}
  const signature=JSON.stringify(state.motors);
  if(signature!==lastMotorSignature){lastMotorSignature=signature;
  $('motors').replaceChildren();Object.entries(state.motors).forEach(([name,m])=>{const node=document.createElement('div');node.className='motor';const label=document.createElement('strong');label.textContent=name;const value=document.createElement('span');value.textContent=`P ${m.power.toFixed(2)} · ${m.encoder} ticks`;const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('i');fill.style.width=Math.abs(m.power)*100+'%';bar.append(fill);node.append(label,value,bar);$('motors').append(node);});}
}
function receiveJavaLaunches(){
  for(const event of state.launches||[]){
    if(event.id<=lastJavaLaunchId)continue;
    lastJavaLaunchId=event.id;
    const cell=hiveCellById(event.hive)||selectedHive();
    if(!cell)continue;
    const hiveAngle=hiveOrientation(cell.team)*HIVE_SIDE.angleDeg;
    const target=hiveSideGeometry(cell,hiveAngle);
    const v={...launchValues(),lateral:event.lateral,forward:event.forward,height:event.height,
      speed:event.speed,elevation:event.elevation,azimuth:event.azimuth,
      tx:cell.x+cell.w/2,ty:cell.y+cell.h/2,th:target.openingHeight,valid:true};
    const origin=[event.x,event.y],yaw=event.yaw;
    const impact=hiveShotImpact({...v,origin,yaw,hiveAngle},cell);
    javaShots.push({...v,origin,yaw,start:performance.now()-Math.max(0,(state.time-event.time)*1000),
      impact,cellId:cell.id,hiveAngle,restIndex:scoredShots.filter(ball=>ball.cellId===cell.id).length,
      kind:event.kind,team:event.team||cell.team,pieceId:event.piece_id});
    setShotResult('JAVA LANÇOU '+event.kind+' · '+(impact.hit?'trajetória prevista para a CELL.':'não atinge: '+impact.reason+'.'),'info');
  }
}
async function poll() {
  if(polling)return;polling=true;
  try{const response=await fetch('/api/state');if(!response.ok)throw Error('Falha ao consultar simulação');state=await response.json();receiveJavaLaunches();readouts();}
  catch(e){$('status').textContent='Servidor desconectado';notice('Não foi possível acessar o servidor local. Confira o terminal do Python.');}
  finally{polling=false;}
}
const normalizedKey=key=>key.length===1?key.toLowerCase():key;
document.addEventListener('keydown',e=>{
  const key=normalizedKey(e.key);
  if(capturingKey){
    if(key==='Escape'){capturingKey=null;renderKeymap();notice('Remapeamento cancelado.');e.preventDefault();return;}
    if(['Control','Shift','Alt','Meta'].includes(key))return;
    if(Object.entries(keyMap).some(([action,value])=>action!==capturingKey&&value===key)){notice('Essa tecla já está atribuída. Escolha outra ou restaure o padrão.');e.preventDefault();return;}
    keyMap[capturingKey]=key;capturingKey=null;keys.clear();
    try{localStorage.setItem(KEYMAP_KEY,JSON.stringify(keyMap));}catch{}
    renderKeymap();notice('Tecla atualizada.');e.preventDefault();return;
  }
  if(e.target.closest?.('input,textarea,select,button,a,[contenteditable="true"]'))return;
  if(Object.values(keyMap).includes(key)){e.preventDefault();keys.add(key);}
});
document.addEventListener('keyup',e=>keys.delete(normalizedKey(e.key)));
window.addEventListener('blur',()=>{focused=false;capturingKey=null;keys.clear();renderKeymap();api('gamepad').catch(()=>{});});
window.addEventListener('focus',()=>{focused=true;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();api('stop').catch(()=>{});}});
async function sendPads(now) {
  if(now-lastPad<40||padBusy)return;lastPad=now;padBusy=true;
  try{const pads=connectedPlayers(navigator.getGamepads?Array.from(navigator.getGamepads()):[]),p1=gamepadValues(focused?pads[0]:null),p2=gamepadValues(focused?pads[1]:null);
    if(focused&&!pads[0])p1.splice(0,p1.length,...keyboardGamepadValues(keys,keyMap));
    for(const [index,expiry] of virtualKeys){
      if(now<expiry)p1[index]=1;else virtualKeys.delete(index);
    }
    $('controller').textContent=pads[0]?(pads[0].mapping==='standard'?`Controle 1 conectado${pads[1]?' · controle 2 conectado':''}`:'Controle sem mapeamento padrão: não suportado nesta versão'):'Controle: pressione um botão · teclado W/A/S/D disponível';
    await api('gamepad',{'1':p1,'2':p2});
  }catch{}finally{padBusy=false;}
}
function frame(now){
  javaShots=javaShots.filter(candidate=>{
    const elapsed=shotElapsed(now,candidate.start),impact=candidate.impact?.hit?candidate.impact:null;
    if(impact&&!candidate.registered&&elapsed>=impact.time)recordImpact(candidate,now);
    if(impact&&elapsed>=impact.time+.42){
      if(!candidate.tipped){const cell=hiveCellById(candidate.cellId);scoredShots.push({cellId:cell.id,x:impact.x,y:impact.y,height:impact.height,kind:candidate.kind});}
      if(candidate.tipped)selectHive(hiveCellById(activeCellId(impact.team)),false);
      return false;
    }
    if(!impact&&elapsed>=flight(candidate.height,candidate.speed,candidate.elevation).time){
      setShotResult('ERRO · '+(candidate.impact?.reason||'lançamento fora da abertura')+'.','error');return false;
    }
    return true;
  });
  if(shot){
    const elapsed=shotElapsed(now,shot.start),impact=shot.impact?.hit?shot.impact:null;
    if(impact&&!shot.registered&&elapsed>=impact.time)recordImpact(shot,now);
    if(impact&&elapsed>=impact.time+.42){
      if(!shot.tipped){const cell=hiveCellById(shot.cellId);
        scoredShots.push({cellId:cell.id,x:impact.x,y:impact.y,height:impact.height});}
      // A bolinha chega ao alvo, cai DENTRO e só então deixa a animação.
      if(shot.tipped)selectHive(hiveCellById(activeCellId(impact.team)),false);
      shot=null;
    }else if(!impact&&elapsed>=flight(shot.height,shot.speed,shot.elevation).time){
      setShotResult('ERRO · '+(shot.impact?.reason||'lançamento fora da abertura')+'.','error');
      shot=null;
    }
  }
  if(replayPlaying&&replayIndex>=0&&replayRows.length>1){
    if(now-replayLast>=50){replayLast=now;replayIndex=Math.min(replayRows.length-1,replayIndex+1);
      if(replayIndex===replayRows.length-1){replayPlaying=false;$('timeline-play').textContent='Reproduzir';}
      $('timeline-range').value=replayIndex;showReplayInfo();readouts();}
  }
  if(!document.hidden&&now-lastDraw>=33){lastDraw=now;drawTop(now);drawSide(now);sendPads(now);}
  requestAnimationFrame(frame);
}
async function init() {
  try{finalReport=JSON.parse(localStorage.getItem(REPORT_KEY)||'null');}catch{finalReport=null;}
  try{renderFinalReport();renderKeymap();const response=await fetch('/examples');examples=await response.json();Object.keys(examples).forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;$('example').append(option);});
    refreshExamples();
    const saved=JSON.parse(localStorage.getItem('meca-sim-v02')||'null');if(saved){$('source').value=saved.source||'';javaFiles=saved.files&&typeof saved.files==='object'&&!Array.isArray(saved.files)?saved.files:{};restoreOpModeChoices();updateJavaFilesLabel();Object.entries(saved.values||{}).forEach(([id,value])=>{if($(id))$(id).type==='checkbox'?$(id).checked=Boolean(value):$(id).value=value;});
    if(!Object.prototype.hasOwnProperty.call(saved.values||{},'shot-mode'))$('shot-mode').value='speed';
    if(hiveCellById(saved.hive))selectedHiveId=saved.hive;
    }else{$('source').value=Object.values(examples)[0];}
    $('walls').checked=true;refreshMatchLimit();selectHive(selectedHive(),false);
    $('field-description').textContent=$('arena').value==='biobuzz'?'BIOBUZZ · layout Desmos; paredes externas físicas, HIVE/FLOWERS livres':'Campo livre · grade cartesiana';
    try{const logo=localStorage.getItem(LOGO_KEY);if(logo?.startsWith('data:image/'))setTeamLogo(logo);}catch{}
    refreshHighlight();refreshLauncherReadouts();refreshDriveMode();refreshShot();$('shot-result').textContent='Clique em uma CELL central vermelha ou azul para trocar a mira.';
    if(saved&&Array.isArray(saved.route))routePoints=saved.route.slice(0,MAX_WAYPOINTS).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    updateRoute();
  }catch(e){notice('Não foi possível carregar exemplos ou configurações: '+e.message);}
  await poll();setInterval(poll,100);setInterval(()=>{if(!document.hidden)api('heartbeat').catch(()=>{});},500);requestAnimationFrame(frame);
}
init();
