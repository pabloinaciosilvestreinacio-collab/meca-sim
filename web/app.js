import {rotate, launcher, heightAt, flight, gamepadValues, targetSolution, encoderScale, connectedPlayers} from './model.mjs';
import {FIELD_METERS, ARENAS, validStart, drawArenaTop, drawArenaSide} from './arena.mjs';
import {candidates, diagnostics, highlightJava} from './editor.mjs';
const $ = id => document.getElementById(id);
const num = id => Number($(id).value);
let state = {x:1.83,y:.65,yaw:0,width:.45,length:.45,trail:[],motors:{},time:0,status:'pronto'};
let focused = document.hasFocus();
let shot = null, examples = {}, javaFiles = {}, zipOpModes = [], selectedJavaPath = '', lastPad = 0, polling = false, padBusy = false, pickingStart = false;
let lastDraw=0,lastLog='',lastMotorSignature='',highlightJob=0;
const LIBRARY_KEY='meca-sim-library-v1',LOGO_KEY='meca-sim-logo-v1';
const keys = new Set(), top = $('top'), side = $('side');
const configIds = ['arena','left','right','width','length','track','max_speed','ticks_per_m','duration','x','y','initial-yaw','invert_left','invert_right','acceleration','left_gain','right_gain','left_slip','right_slip','imu_delay','imu_drift','walls','imu_frozen','left_encoder_frozen','right_encoder_frozen'];
const launchIds = ['offset-x','offset-y','height','speed','elevation','azimuth','target-x','target-y','target-h'];
function config() {
  const data = {};
  configIds.forEach(id => { const input=$(id); data[id==='initial-yaw'?'yaw':id]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value; });
  return data;
}
function persist() {
  try { const values={}; [...configIds,...launchIds].forEach(id=>values[id]=$(id).type==='checkbox'?$(id).checked:$(id).value);
    localStorage.setItem('meca-sim-v02',JSON.stringify({source:$('source').value,files:javaFiles,values})); } catch {}
}
function notice(text) {$('message').textContent=text;}
function setTeamLogo(url){$('team-logo').src=url;$('team-logo').hidden=false;$('logo-fallback').hidden=true;}
$('logo-file').addEventListener('change',async event=>{
  try{
    const file=event.target.files?.[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Use PNG, JPG ou WebP da logo oficial.');
    if(file.size>2_000_000)throw Error('Imagem maior que 2 MB; reduza o tamanho.');
    const image=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
    const ctx=canvas.getContext('2d'),scale=Math.min(160/image.width,160/image.height),w=image.width*scale,h=image.height*scale;
    ctx.drawImage(image,(160-w)/2,(160-h)/2,w,h);image.close();
    const url=canvas.toDataURL('image/png');
    localStorage.setItem(LOGO_KEY,url);setTeamLogo(url);notice('Logo salva neste navegador.');
  }catch(error){notice('Logo: '+error.message);}finally{event.target.value='';}
});
function library(){try{const items=JSON.parse(localStorage.getItem(LIBRARY_KEY)||'[]');return Array.isArray(items)?items.filter(x=>x&&typeof x.name==='string'&&x.project?.version===2).slice(0,12):[];}catch{return [];}}
function projectData(){return {format:'meca-sim-project',version:2,source:$('source').value,files:{...javaFiles},config:config(),launcher:Object.fromEntries(launchIds.map(id=>[id,num(id)]))};}
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
  shot=null;persist();notice('Projeto restaurado. Compile/INIT para executar.');
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
  updateJavaFilesLabel();persist();
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
    selectedJavaPath='';javaFiles=helpers;restoreOpModeChoices();updateJavaFilesLabel();persist();
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
action('compile',async()=>{persist();shot=null;await api('run',{source:$('source').value,files:javaFiles,config:config()});});
for(const [id,target] of [['ds-init','compile'],['ds-start','start'],['ds-stop','stop']])$(id).addEventListener('click',()=>$(target).click());
action('start',async()=>{await api('heartbeat');await api('start');});
action('stop',()=>api('stop'));
action('reset',async()=>{shot=null;await api('reset',{config:config()});});
action('export',async()=>{
  const blob=new Blob([JSON.stringify({version:'0.2',config:config(),launcher:Object.fromEntries(launchIds.map(id=>[id,num(id)])),result:state},null,2)],{type:'application/json'});
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
action('save-library',()=>{const name=window.prompt('Nome do projeto na biblioteca:',pathOfPrimary($('source').value)?.split('/').pop().replace(/\\.java$/,'')||'Meu projeto');if(name===null)return;saveInLibrary(name.trim());notice('Projeto guardado no menu deste navegador.');});
action('delete-library',()=>{const current=$('example').value;if(!current.startsWith('saved:'))return;const name=current.slice(6);if(!window.confirm('Excluir da biblioteca local: '+name+'?'))return;localStorage.setItem(LIBRARY_KEY,JSON.stringify(library().filter(item=>item.name!==name)));refreshExamples();notice('Removido do menu local. Arquivos JSON exportados não foram apagados.');});
$('load-project').addEventListener('change',async e=>{
  try {const file=e.target.files[0];if(!file)return;if(file.size>250000)throw Error('Projeto excede 250 kB');
    const data=JSON.parse(await file.text());if(data.format!=='meca-sim-project'||data.version!==2||typeof data.source!=='string')throw Error('Arquivo de projeto inválido');
    if(['compilando','inicializando','executando'].includes(state.status))throw Error('Pare a execução antes de carregar o projeto.');
    if(!data.config||typeof data.config!=='object'||!data.launcher||typeof data.launcher!=='object')throw Error('Configuração ausente');
    if(data.files!==undefined && (typeof data.files!=='object'||data.files===null||Array.isArray(data.files)||Object.keys(data.files).length>30||Object.values(data.files).some(value=>typeof value!=='string')))throw Error('Arquivos Java do projeto inválidos');
    await loadProjectData(data);
    const name=String(data.name||file.name.replace(/\\.json$/i,'')).slice(0,64);
    try{saveInLibrary(name);}catch(error){notice('Projeto carregado, mas não salvo no menu: '+error.message);}
  }catch(error){notice(error.message);}finally{e.target.value='';}
});
action('csv',async()=>{const response=await fetch('/api/recording');if(!response.ok)throw Error('Falha ao exportar');const data=await response.json();download([data.columns.join(','),...data.rows.map(row=>row.join(','))].join('\n'),'meca-sim-trajetoria.csv','text/csv');});
action('calc-encoder',()=>{$('ticks_per_m').value=encoderScale(num('encoder-ticks'),num('gear-ratio'),num('wheel-diameter')/1000).toFixed(6);persist();notice('Conversão calculada; aplicada no próximo INIT ou Reiniciar posição.');});
action('solve-shot',()=>{const v=launchValues();if(!v.valid)throw Error('Confira os valores do lançador.');const result=targetSolution(state,v.lateral,v.forward,v.height,v.elevation,v.tx,v.ty,v.th);if(result.speed>30)throw Error('Solução acima de 30 m/s; altere a elevação ou a posição.');$('speed').value=result.speed.toFixed(6);$('azimuth').value=result.azimuth.toFixed(6);shot=null;persist();notice('Solução ideal calculada. Não estima a potência do motor MS.');});
action('shoot',async()=>{
  const values=launchValues();if(!values.valid)throw new Error('Confira altura, velocidade, elevação e coordenadas do lançador.');
  shot={...values,origin:launcher(state,values.lateral,values.forward),yaw:state.yaw,start:performance.now()};
});
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b===button));
  ['code','robot','launcher'].forEach(name=>$('tab-'+name).hidden=name!==button.dataset.tab);
}));
function refreshHighlight(){$('source-highlight').innerHTML=highlightJava($('source').value);}
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
[...configIds,...launchIds].forEach(id=>$(id).addEventListener('change',persist));
$('example').addEventListener('change',async()=>{
  try{const choice=$('example').value;
    if(choice.startsWith('saved:')){const item=library().find(x=>x.name===choice.slice(6));if(item)await loadProjectData(item.project);}
    else if(examples[choice]){$('source').value=examples[choice];javaFiles={};selectedJavaPath='';populateOpModes([]);updateJavaFilesLabel();persist();}
    $('delete-library').disabled=!choice.startsWith('saved:');
  }catch(error){notice(error.message);}
});
$('source').addEventListener('keydown',event=>{
  const src=event.target;
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
  const v={lateral:num('offset-x'),forward:num('offset-y'),height:num('height'),speed:num('speed'),elevation:num('elevation'),azimuth:num('azimuth'),tx:num('target-x'),ty:num('target-y'),th:num('target-h')};
  v.valid=Object.values(v).every(Number.isFinite)&&v.height>=0&&v.height<=5&&v.speed>0&&v.speed<=30&&v.elevation>=0&&v.elevation<90&&v.th>=0&&v.th<=5;
  return v;
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
  drawArenaTop(c,project,$('arena').value);
  c.lineWidth=1;c.font='10px system-ui';
  for(let i=0;i<=6;i++){const p=i*3.66/6,[x,y]=project(p,p);c.strokeStyle='#242c37';c.beginPath();c.moveTo(x,g.oy);c.lineTo(x,g.oy-3.66*g.scale);c.moveTo(g.ox,y);c.lineTo(g.ox+3.66*g.scale,y);c.stroke();c.fillStyle='#627085';c.fillText(p.toFixed(2),x-9,g.oy+15);c.fillText(p.toFixed(2),g.ox-28,y+3);}
  c.strokeStyle='#536277';c.strokeRect(g.ox,g.oy-3.66*g.scale,3.66*g.scale,3.66*g.scale);
  c.strokeStyle='#ff852e80';c.lineWidth=2;c.beginPath();state.trail.forEach((p,i)=>{const q=project(...p);i?c.lineTo(...q):c.moveTo(...q);});c.stroke();
  const corner=(x,y)=>{const r=rotate(x,y,state.yaw);return project(state.x+r[0],state.y+r[1]);};
  c.beginPath();[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y],i)=>{const p=corner(x*state.width/2,y*state.length/2);i?c.lineTo(...p):c.moveTo(...p);});c.closePath();c.fillStyle='#ff852e20';c.fill();c.strokeStyle='#ff852e';c.stroke();
  const center=project(state.x,state.y),front=corner(0,state.length*.6);c.beginPath();c.moveTo(...center);c.lineTo(...front);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(...center,3,0,Math.PI*2);c.fill();
  for(const sign of [-1,1]){const a=corner(sign*state.width/2,-state.length*.24),b=corner(sign*state.width/2,state.length*.24);c.strokeStyle='#d6dfeb';c.lineWidth=5;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}
  const v=launchValues();if(!v.valid)return;
  const origin=launcher(state,v.lateral,v.forward),start=project(...origin),target=project(v.tx,v.ty),dir=rotate(0,1,state.yaw+v.azimuth),f=flight(v.height,v.speed,v.elevation),end=project(origin[0]+dir[0]*f.range,origin[1]+dir[1]*f.range);
  c.lineWidth=1;c.setLineDash([5,5]);c.strokeStyle='#6b7584';c.beginPath();c.moveTo(...start);c.lineTo(...target);c.stroke();c.strokeStyle='#51d1bb';c.beginPath();c.moveTo(...start);c.lineTo(...end);c.stroke();c.setLineDash([]);
  c.fillStyle='#51d1bb';c.beginPath();c.arc(...start,4,0,Math.PI*2);c.fill();c.strokeStyle='#91a8ff';c.lineWidth=2;c.beginPath();c.arc(...target,9,0,Math.PI*2);c.moveTo(target[0]-14,target[1]);c.lineTo(target[0]+14,target[1]);c.moveTo(target[0],target[1]-14);c.lineTo(target[0],target[1]+14);c.stroke();
  if(shot){const elapsed=(now-shot.start)/1000,d=rotate(0,1,shot.yaw+shot.azimuth),ff=flight(shot.height,shot.speed,shot.elevation);if(elapsed<=ff.time){const distance=shot.speed*Math.cos(shot.elevation*Math.PI/180)*elapsed,q=project(shot.origin[0]+d[0]*distance,shot.origin[1]+d[1]*distance);c.fillStyle='#fff4a9';c.beginPath();c.arc(...q,5,0,Math.PI*2);c.fill();}}
  $('bounds').textContent=state.collision?'Contato com parede · rodas podem patinar':state.x<0||state.x>3.66||state.y<0||state.y>3.66?'Centro fora do campo · paredes desativadas':'Frente +Y · yaw positivo ↶';
}
top.addEventListener('click',async event=>{
  const rect=top.getBoundingClientRect(),g=geometry();
  const x=(event.clientX-rect.left-g.ox)/g.scale,y=(g.oy-event.clientY+rect.top)/g.scale;
  if(pickingStart||event.shiftKey){
    if(['compilando','inicializando','executando'].includes(state.status)){notice('Use STOP antes de alterar a partida.');return;}
    if(!validStart(x,y,num('width'),num('length'),num('initial-yaw'))){notice('A posição escolhida deixaria parte do robô fora do campo.');return;}
    $('x').value=x.toFixed(3);$('y').value=y.toFixed(3);persist();pickingStart=false;
    $('pick-start').setAttribute('aria-pressed','false');$('start-hint').textContent='Partida definida. Clique no campo para definir o alvo.';
    try{await api('reset',{config:config()});notice('Posição inicial aplicada.');}catch(error){notice(error.message);}
    return;
  }
  $('target-x').value=x.toFixed(3);$('target-y').value=y.toFixed(3);persist();
});
$('pick-start').addEventListener('click',()=>{
  pickingStart=!pickingStart;$('pick-start').setAttribute('aria-pressed',String(pickingStart));
  $('start-hint').textContent=pickingStart?'Clique no campo na nova posição inicial (ou Shift+clique).':'Clique no campo para definir o alvo.';
});
$('arena').addEventListener('change',()=>{$('field-description').textContent=$('arena').value==='biobuzz'?'BIOBUZZ · esquema ilustrativo, sem colisões nos elementos':'Campo livre · grade cartesiana';persist();});
function drawSide(now) {
  const {ctx:c,w,h}=canvasContext(side),v=shot||launchValues();if(!v.valid){$('shot-info').textContent='Confira os parâmetros do lançador.';return;}
  const origin=shot?.origin||launcher(state,v.lateral,v.forward),yaw=shot?.yaw??state.yaw,dir=rotate(0,1,yaw+v.azimuth),dx=v.tx-origin[0],dy=v.ty-origin[1],along=dx*dir[0]+dy*dir[1],cross=Math.abs(dx*dir[1]-dy*dir[0]),f=flight(v.height,v.speed,v.elevation);
  const a=v.azimuth*Math.PI/180,half=(Math.abs(Math.sin(a))*state.width+Math.abs(Math.cos(a))*state.length)/2,offset=v.lateral*(-Math.sin(a))+v.forward*Math.cos(a),left=-offset-half,right=-offset+half;
  const minX=Math.min(-.6,left-.1,along-.1),maxX=Math.max(3.66,f.range+.3,along+.3,right+.1),peak=v.height+(v.speed*Math.sin(v.elevation*Math.PI/180))**2/(2*9.81),maxH=Math.max(1.5,peak+.3,v.th+.3),sx=(w-55)/(maxX-minX),sy=(h-35)/maxH;
  const point=(x,y)=>[40+(x-minX)*sx,h-25-y*sy];c.font='10px system-ui';c.lineWidth=1;
  drawArenaSide(c,point,$('arena').value);
  for(let i=0;i<=4;i++){const value=i*maxH/4,p=point(0,value);c.strokeStyle='#242c37';c.beginPath();c.moveTo(...p);c.lineTo(w-10,p[1]);c.stroke();c.fillStyle='#627085';c.fillText(value.toFixed(1)+'m',5,p[1]+3);}
  c.strokeStyle='#536277';c.beginPath();c.moveTo(...point(0,0));c.lineTo(...point(maxX,0));c.stroke();
  // Projeção do chassi no eixo do tiro; o lançador está em x=0.
  c.fillStyle='#ff852e20';c.strokeStyle='#ff852e';const p=point(left,.30);c.fillRect(p[0],p[1],(right-left)*sx,.30*sy);c.strokeRect(p[0],p[1],(right-left)*sx,.30*sy);
  c.strokeStyle='#51d1bb';c.lineWidth=2;c.beginPath();for(let i=0;i<=120;i++){const x=f.range*i/120,q=point(x,Math.max(0,heightAt(x,v.height,v.speed,v.elevation)));i?c.lineTo(...q):c.moveTo(...q);}c.stroke();
  const target=point(along,v.th);c.fillStyle='#91a8ff';c.fillRect(target[0]-5,target[1]-5,10,10);
  if(shot){const elapsed=(now-shot.start)/1000;if(elapsed<=f.time){const x=v.speed*Math.cos(v.elevation*Math.PI/180)*elapsed,q=point(x,heightAt(x,v.height,v.speed,v.elevation));c.fillStyle='#fff4a9';c.beginPath();c.arc(...q,5,0,Math.PI*2);c.fill();}}
  const at=along>=0&&along<=f.range?heightAt(along,v.height,v.speed,v.elevation):null;
  $('shot-info').textContent=`Prévia manual · alcance ${f.range.toFixed(2)} m · desvio lateral do alvo ${cross.toFixed(2)} m · ${at===null?'alvo fora do alcance frontal':`altura na distância do alvo ${at.toFixed(2)} m (alvo ${v.th.toFixed(2)} m)`}.`;
}
function readouts() {
  $('status').textContent=state.status;$('clock').textContent=state.time.toFixed(2).padStart(5,'0')+' s';
  $('px').textContent=state.x.toFixed(3)+' m';$('py').textContent=state.y.toFixed(3)+' m';$('yaw').textContent=state.yaw.toFixed(1)+'°';
  $('imu-yaw').textContent=Number.isFinite(state.imu_yaw)?state.imu_yaw.toFixed(1)+'°':'—';
  $('sensor-status').textContent=state.imu_frozen?'Falha simulada ativa: IMU travado. Yaw real e yaw medido podem divergir.':'';
  $('execution-hint').textContent=state.status==='concluído'?'Java encerrado. Confira a telemetria: isso não comprova o sucesso da missão.':'';
  $('start').disabled=state.status!=='inicializando';$('compile').disabled=['compilando','inicializando','executando'].includes(state.status);
  $('ds-start').disabled=$('start').disabled;$('ds-init').disabled=$('compile').disabled;
  $('ds-state').textContent=state.status.toUpperCase();$('ds-time').textContent=state.time.toFixed(2)+' s';
  $('ds-mode').textContent=/@Autonomous\b/.test($('source').value)?'AUTÔNOMO · LinearOpMode':/@TeleOp\b/.test($('source').value)?'TELEOPERADO · LinearOpMode':'JAVA · LinearOpMode';
  $('telemetry').textContent=state.telemetry||'Aguardando telemetry.update()';
  if(lastLog!==state.logs){lastLog=state.logs;$('logs').textContent=state.logs||'Nenhum erro de compilação registrado.';showCodeErrors(state.logs);}
  const signature=JSON.stringify(state.motors);
  if(signature!==lastMotorSignature){lastMotorSignature=signature;
  $('motors').replaceChildren();Object.entries(state.motors).forEach(([name,m])=>{const node=document.createElement('div');node.className='motor';const label=document.createElement('strong');label.textContent=name;const value=document.createElement('span');value.textContent=`P ${m.power.toFixed(2)} · ${m.encoder} ticks`;const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('i');fill.style.width=Math.abs(m.power)*100+'%';bar.append(fill);node.append(label,value,bar);$('motors').append(node);});}
}
async function poll() {
  if(polling)return;polling=true;
  try{const response=await fetch('/api/state');if(!response.ok)throw Error('Falha ao consultar simulação');state=await response.json();readouts();}
  catch(e){$('status').textContent='Servidor desconectado';notice('Não foi possível acessar o servidor local. Confira o terminal do Python.');}
  finally{polling=false;}
}
const controls=['w','s','a','d','b','x','y',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const key=e.key.length===1?e.key.toLowerCase():e.key;if(controls.includes(key)){e.preventDefault();keys.add(key);}});
document.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',()=>{focused=false;keys.clear();api('gamepad').catch(()=>{});});
window.addEventListener('focus',()=>{focused=true;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();api('stop').catch(()=>{});}});
async function sendPads(now) {
  if(now-lastPad<40||padBusy)return;lastPad=now;padBusy=true;
  try{const pads=connectedPlayers(navigator.getGamepads?Array.from(navigator.getGamepads()):[]),p1=gamepadValues(focused?pads[0]:null),p2=gamepadValues(focused?pads[1]:null);
    if(focused&&!pads[0]){p1[1]=Number(keys.has('s'))-Number(keys.has('w'));p1[2]=Number(keys.has('d'))-Number(keys.has('a'));p1[6]=Number(keys.has(' '));['b','x','y'].forEach((k,i)=>p1[7+i]=Number(keys.has(k)));['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].forEach((k,i)=>p1[16+i]=Number(keys.has(k)));}
    $('controller').textContent=pads[0]?(pads[0].mapping==='standard'?`Controle 1 conectado${pads[1]?' · controle 2 conectado':''}`:'Controle sem mapeamento padrão: não suportado nesta versão'):'Controle: pressione um botão · teclado W/A/S/D disponível';
    await api('gamepad',{'1':p1,'2':p2});
  }catch{}finally{padBusy=false;}
}
function frame(now){
  if(shot&&(now-shot.start)/1000>flight(shot.height,shot.speed,shot.elevation).time+.8)shot=null;
  if(!document.hidden&&now-lastDraw>=33){lastDraw=now;drawTop(now);drawSide(now);sendPads(now);}
  requestAnimationFrame(frame);
}
async function init() {
  try{const response=await fetch('/examples');examples=await response.json();Object.keys(examples).forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;$('example').append(option);});
    refreshExamples();
    const saved=JSON.parse(localStorage.getItem('meca-sim-v02')||'null');if(saved){$('source').value=saved.source||'';javaFiles=saved.files&&typeof saved.files==='object'&&!Array.isArray(saved.files)?saved.files:{};restoreOpModeChoices();updateJavaFilesLabel();Object.entries(saved.values||{}).forEach(([id,value])=>{if($(id))$(id).type==='checkbox'?$(id).checked=Boolean(value):$(id).value=value;});}else{$('source').value=Object.values(examples)[0];}
    $('field-description').textContent=$('arena').value==='biobuzz'?'BIOBUZZ · esquema ilustrativo, sem colisões nos elementos':'Campo livre · grade cartesiana';
    try{const logo=localStorage.getItem(LOGO_KEY);if(logo?.startsWith('data:image/'))setTeamLogo(logo);}catch{}
    refreshHighlight();
  }catch(e){notice('Não foi possível carregar exemplos ou configurações: '+e.message);}
  await poll();setInterval(poll,100);setInterval(()=>{if(!document.hidden)api('heartbeat').catch(()=>{});},500);requestAnimationFrame(frame);
}
init();
