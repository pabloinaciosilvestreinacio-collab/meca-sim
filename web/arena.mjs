// BIOBUZZ: planta e corte inspirados nas imagens Desmos fornecidas pela equipe.
// Não é CAD oficial. Unidades: metros; origem do campo no canto inferior esquerdo.
export const FIELD_METERS=3.66;
export const ARENAS=Object.freeze({biobuzz:'BIOBUZZ 2026–2027',livre:'Arena livre'});
export const DIMS=Object.freeze({frameWidth:1.2565,frameDepth:.9895,pivotHeight:1.1165,cellSpacing:.478,cellOpeningWidth:.508,cellOpeningHeight:.356,cellDepth:.305,flowerHeight:.546,flowerDiameter:.1015,gardenWidth:.584,gardenStrip:.051,loadingWidth:.584,loadingDepth:.2795});
export const FLOWERS=Object.freeze([[.09,1.82],[1.22,3.57],[3.56,2.43],[2.44,.09]]);
const HIVE_X=(FIELD_METERS-DIMS.frameWidth)/2,HIVE_Y=(FIELD_METERS-DIMS.frameDepth)/2;
const HIVE_CELLS=Object.freeze([
  Object.freeze({id:'red-lower',name:'HIVE vermelho inferior',team:'red',x:HIVE_X+.065,y:HIVE_Y+.105,w:.52,h:.32,openingHeight:.90}),
  Object.freeze({id:'red-upper',name:'HIVE vermelho superior',team:'red',x:HIVE_X+.065,y:HIVE_Y+.575,w:.52,h:.32,openingHeight:.90}),
  Object.freeze({id:'blue-lower',name:'HIVE azul inferior',team:'blue',x:HIVE_X+.68,y:HIVE_Y+.105,w:.52,h:.32,openingHeight:.90}),
  Object.freeze({id:'blue-upper',name:'HIVE azul superior',team:'blue',x:HIVE_X+.68,y:HIVE_Y+.575,w:.52,h:.32,openingHeight:.90})
]);
export const HIVE=Object.freeze({x:HIVE_X,y:HIVE_Y,w:DIMS.frameWidth,h:DIMS.frameDepth,cells:HIVE_CELLS});
export const ZONES=Object.freeze({redVertical:{x:0,y:2.43,w:.29,h:.62},redBottom:{x:0,y:0,w:0,h:0},redLine:{x:0,y:0,w:DIMS.gardenWidth,h:DIMS.gardenStrip},blueVertical:{x:FIELD_METERS-.28,y:.6,w:.28,h:.62},blueTop:{x:FIELD_METERS-DIMS.gardenWidth,y:FIELD_METERS-DIMS.gardenStrip,w:DIMS.gardenWidth,h:DIMS.gardenStrip}});
export function validStart(x,y,width,length,yaw=0){
  if(![x,y,width,length,yaw].every(Number.isFinite)||width<=0||length<=0)return false;
  const a=yaw*Math.PI/180,hx=(Math.abs(Math.cos(a))*width+Math.abs(Math.sin(a))*length)/2,hy=(Math.abs(Math.sin(a))*width+Math.abs(Math.cos(a))*length)/2;
  return x>=hx&&x<=FIELD_METERS-hx&&y>=hy&&y<=FIELD_METERS-hy;
}
const cellColor=cell=>cell.team==='red'?'#c9424e74':'#346fac74';
const cellStroke=cell=>cell.team==='red'?'#ef6770':'#79b5ff';
export function drawArenaTop(ctx,project,mode,selectedCellId='',scoredBalls=[],tippedCellIds=[]){
  if(mode!=='biobuzz')return;
  const p=(x,y)=>project(x,y),rect=(r,fill,stroke)=>{const a=p(r.x,r.y+r.h),b=p(r.x+r.w,r.y);ctx.fillStyle=fill;ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.8;ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}};
  const tipped=new Set(Array.isArray(tippedCellIds)?tippedCellIds:[]),balls=Array.isArray(scoredBalls)?scoredBalls:[];
  ctx.save();rect({x:0,y:0,w:FIELD_METERS,h:FIELD_METERS},'#34373b','#b0b5bb');
  for(let i=1;i<18;i++){const v=i*FIELD_METERS/18,a=p(v,0),b=p(v,FIELD_METERS),c=p(0,v),d=p(FIELD_METERS,v);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.moveTo(...c);ctx.lineTo(...d);ctx.lineWidth=i%5===0?1:.45;ctx.strokeStyle=i%5===0?'#777e864d':'#656b7240';ctx.stroke();}
  rect(ZONES.redVertical,'#bb3c4659','#ec6869');rect(ZONES.redBottom,'#bb3c466b','#ec6869');rect(ZONES.redLine,'#b73f46','#eb646a');rect(ZONES.blueVertical,'#2466b15e','#6cadf8');rect(ZONES.blueTop,'#356fb6','#7cb1fe');rect(HIVE,'#202328','#d5d9df');
  HIVE.cells.forEach(cell=>{rect(cell,cellColor(cell),cellStroke(cell));const a=p(cell.x,cell.y+cell.h),b=p(cell.x+cell.w,cell.y);
    if(cell.id===selectedCellId){ctx.strokeStyle='#fff3a8';ctx.lineWidth=3;ctx.strokeRect(a[0]-3,a[1]-3,b[0]-a[0]+6,b[1]-a[1]+6);ctx.fillStyle='#fff3a8';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillText('MIRA',(a[0]+b[0])/2,a[1]-7);}
    balls.filter(ball=>ball?.cellId===cell.id).forEach((ball,index)=>{const q=p(cell.x+cell.w*(.26+(index%3)*.24),cell.y+cell.h*(.25+Math.floor(index/3)*.28));ctx.fillStyle='#fff4a9';ctx.strokeStyle='#7a5523';ctx.lineWidth=1;ctx.beginPath();ctx.arc(q[0],q[1],3.7,0,Math.PI*2);ctx.fill();ctx.stroke();});
    if(tipped.has(cell.id)){ctx.fillStyle='#ffb654';ctx.font='bold 15px system-ui';ctx.textAlign='right';ctx.fillText('↷',b[0]-4,b[1]-5);}
  });
  for(const [x,y] of FLOWERS){const center=p(x,y),edge=p(x+DIMS.flowerDiameter/2,y);ctx.fillStyle='#ff952f';ctx.strokeStyle='#ffb670';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(center[0],center[1],Math.max(3.2,Math.abs(edge[0]-center[0])),0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.restore();
}
export function drawArenaSide(ctx,point,mode,targetDistance,targetHeight,cell=null,scoredBalls=[],tipped=false){
  if(mode!=='biobuzz'||!Number.isFinite(targetDistance)||targetDistance<=.25)return;
  const h=Math.max(.35,Number.isFinite(cell?.openingHeight)?cell.openingHeight:Number.isFinite(targetHeight)?targetHeight:DIMS.pivotHeight),at=targetDistance,fill=cell?.team==='blue'?'#346fac':'#c9424e',stroke=cell?.team==='blue'?'#79b5ff':'#ef6770';
  const p=(x,y)=>point(x,y),poly=points=>{ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();};
  ctx.save();poly([p(at-.39,0),p(at,h-.08),p(at+.39,0)]);ctx.fillStyle='#15191e';ctx.fill();ctx.strokeStyle='#9098a2';ctx.lineWidth=1.5;ctx.stroke();
  ctx.strokeStyle='#59616c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...p(at-.31,0));ctx.lineTo(...p(at,h-.22));ctx.lineTo(...p(at+.31,0));ctx.stroke();
  const lean=tipped?.14:0,frame=[p(at-.20+lean,h-.04),p(at+.17+lean,h-.04),p(at+.26+lean,h+.22),p(at-.11+lean,h+.22)];poly(frame);ctx.fillStyle='#262c33';ctx.fill();ctx.strokeStyle='#d5d9df';ctx.lineWidth=1.5;ctx.stroke();
  poly([p(at-.13+lean,h+.015),p(at+.10+lean,h+.015),p(at+.16+lean,h+.16),p(at-.07+lean,h+.16)]);ctx.fillStyle=fill+'cc';ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();
  (Array.isArray(scoredBalls)?scoredBalls.filter(ball=>!cell||ball?.cellId===cell.id):[]).forEach((ball,index)=>{const q=p(at+lean-.05+(index%3)*.05,h+.07+Math.floor(index/3)*.035);ctx.fillStyle='#fff4a9';ctx.strokeStyle='#7a5523';ctx.lineWidth=1;ctx.beginPath();ctx.arc(q[0],q[1],4,0,Math.PI*2);ctx.fill();ctx.stroke();});
  const label=p(at+lean,h+.31);ctx.fillStyle='#dce3ec';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText((cell?.name||'HIVE selecionado')+(tipped?' · TOMBOU':''),label[0],label[1]);ctx.restore();
}
export function hiveCellAt(x,y){return HIVE.cells.find(cell=>x>=cell.x&&x<=cell.x+cell.w&&y>=cell.y&&y<=cell.y+cell.h)||null;}
export function hiveCellById(id){return HIVE.cells.find(cell=>cell.id===id)||null;}
