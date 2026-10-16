Warning: truncated output (original token count: 17768)
Total output lines: 919

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

const configIds = ['arena','drivetrain','robot-color','left','right','front_left','front_right','back_left','back_right','width','length','track','max_speed','ticks_per_m','duration','match-mode','timer-enabled','x','y','initial-yaw','invert_left','invert_right','acceleration','left_gain','right_gain','left_slip','right_slip','imu_delay','imu_drift','walls','alliance','intake_reach','intake_capacity','imu_frozen','left_encoder_frozen','right_encoder_frozen','flower-servo-name','flower-deploy-position','flower-range'];
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
  if(!cell||!shot.impact?.hit||shot.registered)return;
  const result=registerPollen(hiveCounts[cell.team],SIM_TIP_POLLS);
  hiveCounts[cell.team]=result.count;
  shot.registered=true;shot.tipped=result.tipped;
  if(result.tipped){
    if(matchStarted&&state.status==='executando')
      api('rules',{action:'hive_tip',team:cell.team}).catch(error=>notice(error.message));
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
action('introduce-nectar',async()=>{
  const result=await api('rules',{action:'nectar_entry'});
  notice('Human Player introduziu '+result.event.element_id+' pela Loading Zone. Confira a entrada no campo.');
});
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
  await api('heartbeat');await a…7768 tokens truncated…yInfo();
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
  const rules=state.rules||{};
  const entryButton=$('introduce-nectar');
  entryButton.disabled=state.status!=='executando'||(rules.nectar_available||0)<1;
  $('rules-status').textContent='Human Player · NECTAR '+(rules.nectar_available||0)+' disponível(is) / '+(rules.nectar_total||5)+
    ' · TIPs simulados: '+((rules.hive_tips_didactic||{})[rules.alliance]||0)+
    ' · G410: '+(rules.penalties||[]).length+' registro(s)';
  const flowerEvents=state.flower_events||[];
  $('flower-status').textContent=flowerEvents.length
    ? 'FLOWER · '+flowerEvents.slice(-8).map(event=>`#${event.sequence} ${event.kind} → F${event.flower}`).join(' · ')
    : `FLOWER · aguardando servo “${$('flower-servo-name').value}” e proximidade`;
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
