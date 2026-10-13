// BIOBUZZ: planta inspirada no Desmos fornecido pela equipe.
// As posições são extraídas da imagem e aproximadas, NÃO do CAD oficial.
// Unidades: metros. Origem do campo no canto inferior esquerdo.
export const FIELD_METERS=3.66;
export const ARENAS=Object.freeze({biobuzz:'BIOBUZZ 2026–2027',livre:'Arena livre'});
export const DIMS=Object.freeze({
  frameWidth:1.2565,frameDepth:.9895,pivotHeight:1.1165,
  cellSpacing:.478,cellOpeningWidth:.508,cellOpeningHeight:.356,cellDepth:.305,
  flowerHeight:.546,flowerDiameter:.1015,gardenWidth:.584,gardenStrip:.051,
  loadingWidth:.584,loadingDepth:.2795
});
export const FLOWERS=Object.freeze([[.09,1.82],[1.22,3.57],[3.56,2.43],[2.44,.09]]);
export const HIVE=Object.freeze({x:(FIELD_METERS-DIMS.frameWidth)/2,y:(FIELD_METERS-DIMS.frameDepth)/2,w:DIMS.frameWidth,h:DIMS.frameDepth,cells:Object.freeze([Object.freeze({x:1.39,y:1.84,w:.43,h:.31,openingHeight:.90}),Object.freeze({x:1.84,y:1.84,w:.43,h:.31,openingHeight:.90}),Object.freeze({x:1.39,y:1.49,w:.43,h:.31,openingHeight:.90}),Object.freeze({x:1.84,y:1.49,w:.43,h:.31,openingHeight:.90})])});
export const ZONES=Object.freeze({
  redVertical:{x:0,y:2.43,w:.29,h:.62},
  redBottom:{x:0,y:0,w:0,h:0},
  redLine:{x:0,y:0,w:DIMS.gardenWidth,h:DIMS.gardenStrip},
  blueVertical:{x:FIELD_METERS-.28,y:.6,w:.28,h:.62},
  blueTop:{x:FIELD_METERS-DIMS.gardenWidth,y:FIELD_METERS-DIMS.gardenStrip,w:DIMS.gardenWidth,h:DIMS.gardenStrip}
});
export function validStart(x,y,width,length,yaw=0){
  if(![x,y,width,length,yaw].every(Number.isFinite)||width<=0||length<=0)return false;
  const a=yaw*Math.PI/180;
  const hx=(Math.abs(Math.cos(a))*width+Math.abs(Math.sin(a))*length)/2;
  const hy=(Math.abs(Math.sin(a))*width+Math.abs(Math.cos(a))*length)/2;
  return x>=hx&&x<=FIELD_METERS-hx&&y>=hy&&y<=FIELD_METERS-hy;
}

export function drawArenaTop(ctx,project,mode){
  if(mode!=='biobuzz')return;
  const p=(x,y)=>project(x,y);
  const rect=(r,fill,stroke)=>{
    const a=p(r.x,r.y+r.h),b=p(r.x+r.w,r.y);
    ctx.fillStyle=fill;ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.8;ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
  };
  ctx.save();
  rect({x:0,y:0,w:FIELD_METERS,h:FIELD_METERS},'#34373b','#b0b5bb');
  for(let i=1;i<18;i++){
    const v=i*FIELD_METERS/18,a=p(v,0),b=p(v,FIELD_METERS),c=p(0,v),d=p(FIELD_METERS,v);
    ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.moveTo(...c);ctx.lineTo(...d);
    ctx.lineWidth=i%5===0?1:.45;ctx.strokeStyle=i%5===0?'#777e864d':'#656b7240';ctx.stroke();
  }
  rect(ZONES.redVertical,'#bb3c4659','#ec6869');rect(ZONES.redBottom,'#bb3c466b','#ec6869');rect(ZONES.redLine,'#b73f46','#eb646a');
  rect(ZONES.blueVertical,'#2466b15e','#6cadf8');rect(ZONES.blueTop,'#356fb6','#7cb1fe');
  rect(HIVE,'#292b2e','#d5d9df');
  // No Desmos: CELLS vermelhas à esquerda, azuis à direita.
  for(const [x,fill,stroke] of [[HIVE.x+.065,'#c9424e74','#ef6770'],[HIVE.x+.68,'#346fac74','#79b5ff']]){
    for(const y of [HIVE.y+.105,HIVE.y+.575])rect({x,y,w:.52,h:.32},fill,stroke);
  }
  for(const [x,y] of FLOWERS){
    const center=p(x,y),edge=p(x+DIMS.flowerDiameter/2,y);
    ctx.fillStyle='#ff952f';ctx.strokeStyle='#ffb670';ctx.lineWidth=1.2;ctx.beginPath();
    ctx.arc(center[0],center[1],Math.max(3.2,Math.abs(edge[0]-center[0])),0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
export function drawArenaSide(ctx,point,mode,targetDistance,targetHeight){
  // Perfil RELATIVO à mira. Não é vista global do campo ou CAD do HIVE.
  if(mode!=='biobuzz'||!Number.isFinite(targetDistance)||targetDistance<=.25)return;
  const h=Math.max(.35,Number.isFinite(targetHeight)?targetHeight:DIMS.pivotHeight),at=targetDistance;
  ctx.save();
  const a=point(at-.18,0),b=point(at,h),c=point(at+.18,0);
  ctx.strokeStyle='#a6adb6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.stroke();
  const goal1=point(at-.16,h),goal2=point(at+.16,h);
  ctx.strokeStyle='#79b5ff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(...goal1);ctx.lineTo(...goal2);ctx.stroke();
  ctx.fillStyle='#c2ccda';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText('Alvo · corte didático',b[0],b[1]-12);
  ctx.restore();
}

export function hiveCellAt(x,y){return HIVE.cells.find(cell=>x>=cell.x&&x<=cell.x+cell.w&&y>=cell.y&&y<=cell.y+cell.h)||null;}
