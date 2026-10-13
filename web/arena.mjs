// BIOBUZZ: planta e corte inspirados nas imagens Desmos fornecidas pela equipe.
// Não é CAD oficial. Unidades: metros; origem do campo no canto inferior esquerdo.
export const FIELD_METERS=3.66;
export const ARENAS=Object.freeze({biobuzz:'BIOBUZZ 2026–2027',livre:'Arena livre'});
export const DIMS=Object.freeze({frameWidth:1.2565,frameDepth:.9895,pivotHeight:1.1165,cellSpacing:.478,cellOpeningWidth:.508,cellOpeningHeight:.356,cellDepth:.305,flowerHeight:.546,flowerDiameter:.1015,gardenWidth:.584,gardenStrip:.051,loadingWidth:.584,loadingDepth:.2795});
// Corte ilustrativo calibrado pela figura 9-10: pivô em 1,1165 m;
// abertura alta 1,665 m, borda inferior alta 1,359 m e baixa 0,777 m.
// A distância dos braços no corte é aproximação VISUAL, não a medida do CAD.
export const HIVE_SIDE=Object.freeze({angleDeg:34,arm:.52,openingTop:.312,openingBottom:-.050,
  sideDepth:.305,ballRadius:.0355});
export function hiveSideGeometry(cell,angleDeg){
  if(!cell)throw Error('CELL inválida');
  const sign=cell.id.endsWith('lower')?-1:1;
  const rad=angleDeg*Math.PI/180;
  const cy=DIMS.pivotHeight+sign*HIVE_SIDE.arm*Math.sin(rad);
  return {sign,angle:rad,cy,
    openingHeight:cy+HIVE_SIDE.openingTop*Math.cos(rad),
    bottomOpeningHeight:cy+HIVE_SIDE.openingBottom*Math.cos(rad),
    floorHeight:cy-.20*Math.cos(rad),
    halfDepth:HIVE_SIDE.sideDepth/2};
}
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
// Vista lateral em corte orientado ao tiro (não é modelo CAD 3D).
// A-frame no pivô oficial de 1,1165 m; duas CELLS em corpo pentagonal,
// unidas por uma gangorra com rotação biestável perceptível.
export function drawArenaSide(ctx,point,mode,targetDistance,targetHeight,cell=null,scoredBalls=[],hiveStatus={}){
  if(mode!=='biobuzz'||!Number.isFinite(targetDistance)||targetDistance<=.25||!cell)return;
  // O corte é do HIVE VERMELHO exclusivamente; vista superior permanece intacta.
  const angleDeg=Number.isFinite(hiveStatus.angle)?hiveStatus.angle:-HIVE_SIDE.angleDeg;
  const angle=angleDeg*Math.PI/180,arm=HIVE_SIDE.arm;
  const sin=Math.sin(angle),cos=Math.cos(angle),pivotY=DIMS.pivotHeight;
  const selectedSign=cell.id.endsWith('lower')?-1:1;
  const pivotX=targetDistance-selectedSign*arm*cos;
  const p=(x,z)=>point(x,z);
  const poly=(pts,fill,stroke,width=1.5)=>{
    ctx.beginPath();pts.forEach((pt,i)=>i?ctx.lineTo(...pt):ctx.moveTo(...pt));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  };
  ctx.save();
  // Apoio triangular estacionário conforme as figuras 9-7/9-8 do manual.
  poly([p(pivotX-.49,0),p(pivotX,pivotY),p(pivotX+.49,0)],'#171b22','#b6bec9',2.5);
  ctx.strokeStyle='#7f8997';ctx.lineWidth=2.8;ctx.beginPath();
  ctx.moveTo(...p(pivotX-.40,.035));ctx.lineTo(...p(pivotX,pivotY));
  ctx.lineTo(...p(pivotX+.40,.035));ctx.moveTo(...p(pivotX-.47,.03));ctx.lineTo(...p(pivotX+.47,.03));ctx.stroke();
  // Travessa metálica biestável: ambas as CELLs são rigidamente ligadas.
  ctx.strokeStyle='#d2dae5';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();
  ctx.moveTo(...p(pivotX-arm*cos,pivotY-arm*sin));
  ctx.lineTo(...p(pivotX+arm*cos,pivotY+arm*sin));ctx.stroke();
  for(const sign of [-1,1]){
    const id='red-'+(sign===-1?'lower':'upper');
    const cx=pivotX+sign*arm*cos,cy=pivotY+sign*arm*sin;
    const local=(u,v)=>p(cx+u*cos-v*sin,cy+u*sin+v*cos);
    const outline=[[-.175,-.20],[.175,-.20],[.175,.09],[.12,.312],[-.12,.312],[-.175,.09]];
    // Casinha vermelha: face frontal em formato de frontão, volume interno
    // rebaixado e abertura SUPERIOR sem uma linha de teto atravessando a boca.
    poly(outline.map(([u,v])=>local(u,v)),'#43202b',null);
    ctx.strokeStyle='#ef6770';ctx.lineWidth=2.6;
    const strokePoints=points=>{ctx.beginPath();points.forEach(([u,v],i)=>i?ctx.lineTo(...local(u,v)):ctx.moveTo(...local(u,v)));ctx.stroke();};
    strokePoints([[-.12,.312],[-.175,.09],[-.175,-.20],[.175,-.20],[.175,.09],[.12,.312]]);
    // Revestimento e cantos visíveis atrás da abertura.
    poly([[-.14,-.17],[.14,-.17],[.14,.055],[-.14,.055]].map(([u,v])=>local(u,v)),
      '#762d3b77','#ffa1a0',1);
    ctx.strokeStyle='#ffd293';ctx.lineWidth=3;
    strokePoints([[-.12,.312],[-.12,.222]]);strokePoints([[.12,.312],[.12,.222]]);
    ctx.strokeStyle='#ae5660';ctx.lineWidth=1.2;
    strokePoints([[-.12,.312],[-.12,-.05]]);strokePoints([[.12,.312],[.12,-.05]]);
    if(id===hiveStatus.activeCellId){ctx.fillStyle='#ffdaa8';ctx.font='bold 10px system-ui';ctx.textAlign='center';
      const q=local(0,.420);ctx.fillText('ABERTA',q[0],q[1]);}
    (Array.isArray(scoredBalls)?scoredBalls:[]).filter(b=>b?.cellId===id).forEach((ball,i)=>{
      const q=local(-.085+(i%4)*.055,-.12+Math.floor(i/4)*.070);
      ctx.fillStyle='#ffea95';ctx.strokeStyle='#a27930';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...q,4.4,0,2*Math.PI);ctx.fill();ctx.stroke();
    });
  }
  const hinge=p(pivotX,pivotY);ctx.fillStyle='#ffae58';ctx.beginPath();ctx.arc(...hinge,5,0,2*Math.PI);ctx.fill();
  const label=p(pivotX,pivotY+.63);ctx.fillStyle='#ff777d';ctx.font='bold 11px system-ui';ctx.textAlign='center';
  ctx.fillText('HIVE VERMELHO · '+(hiveStatus.count||0)+'/8 POLLEN',label[0],label[1]);
  if(hiveStatus.tips>0){const q=p(pivotX,pivotY+.51);ctx.fillStyle='#ffd092';ctx.fillText('TOMBAMENTOS: '+hiveStatus.tips,q[0],q[1]);}
  ctx.restore();
}
export function hiveCellAt(x,y){return HIVE.cells.find(cell=>x>=cell.x&&x<=cell.x+cell.w&&y>=cell.y&&y<=cell.y+cell.h)||null;}
export function hiveCellById(id){return HIVE.cells.find(cell=>cell.id===id)||null;}
