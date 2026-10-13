// BIOBUZZ 2026-27: medidas reais citadas no manual, posição ilustrativa dos elementos.
// Fonte: FIRST, Competition Manual §9.1/9.6/9.7 (TU03, outubro 2026).
// As coordenadas de CELL/FLOWER abaixo não foram extraídas do STEP.
// Nunca tratar esta vista como CAD exato, colisão ou pontuação oficial.
export const FIELD_METERS=3.66; // oficial: aproximadamente 144 in = 3,6576 m
export const ARENAS=Object.freeze({biobuzz:'BIOBUZZ 2026–2027',livre:'Arena livre'});
export const DIMS=Object.freeze({
  frameWidth:1.2565, frameDepth:.9895, pivotHeight:1.1165,
  cellSpacing:.478, cellOpeningWidth:.508, cellOpeningHeight:.356, cellDepth:.305,
  flowerHeight:.546,flowerDiameter:.1015,gardenWidth:.584,gardenStrip:.051,
  loadingWidth:.584,loadingDepth:.2795
});
// Localização junto ao perímetro ilustrativa até extração/validação do CAD.
export const FLOWERS=Object.freeze([[.10,.92],[.10,2.74],[3.56,.92],[3.56,2.74]]);
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
  function line(x1,y1,x2,y2,color='#9aabbf',width=2){const a=p(x1,y1),b=p(x2,y2);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function rect(x,y,w,h,color){const a=p(x,y+h),b=p(x+w,y);ctx.fillStyle=color;ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
  function border(x,y,w,h,color){const a=p(x,y+h),b=p(x+w,y);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
  ctx.save();
  rect(0,0,FIELD_METERS,FIELD_METERS,'#22272c');
  const tile=FIELD_METERS/6;
  for(let k=1;k<6;k++){const v=k*tile;line(v,0,v,FIELD_METERS,'#41454a',.7);line(0,v,FIELD_METERS,v,'#41454a',.7);}
  // Jardins: fitas de 23 × 2 in, junto a cantos opostos.
  rect(0,0,DIMS.gardenWidth,DIMS.gardenStrip,'#d65261');
  rect(FIELD_METERS-DIMS.gardenWidth,FIELD_METERS-DIMS.gardenStrip,DIMS.gardenWidth,DIMS.gardenStrip,'#558ff2');
  // Loading zones: 23 × 11 in, orientação diagramática, sem reivindicar CAD.
  rect(0,0,DIMS.loadingWidth,DIMS.loadingDepth,'#cc4c5f33');
  rect(FIELD_METERS-DIMS.loadingWidth,FIELD_METERS-DIMS.loadingDepth,DIMS.loadingWidth,DIMS.loadingDepth,'#5d92ee33');
  border(0,0,DIMS.loadingWidth,DIMS.loadingDepth,'#e46a74');
  border(FIELD_METERS-DIMS.loadingWidth,FIELD_METERS-DIMS.loadingDepth,DIMS.loadingWidth,DIMS.loadingDepth,'#6fafff');
  // Base central: medidas documentadas 49.46 in × 38.95 in (1.2565 × .9895 m).
  const bx=(FIELD_METERS-DIMS.frameWidth)/2,by=(FIELD_METERS-DIMS.frameDepth)/2;
  rect(bx,by,DIMS.frameWidth,DIMS.frameDepth,'#10151abf');
  border(bx,by,DIMS.frameWidth,DIMS.frameDepth,'#b5bdc7');
  // Duas HIVEs, cada uma com 2 CELLS. Posições relativas ilustrativas.
  for(const [x,color] of [[FIELD_METERS/2-.29,'#477fc1'],[FIELD_METERS/2+.29,'#c9515e']]){
    for(const sy of [-1,1]){
      const y=FIELD_METERS/2+sy*DIMS.cellSpacing/2;
      rect(x-.13,y-.1525,.26,DIMS.cellDepth,color+'77');
      border(x-.13,y-.1525,.26,DIMS.cellDepth,color);
    }
    line(x,FIELD_METERS/2-DIMS.cellSpacing/2,x,FIELD_METERS/2+DIMS.cellSpacing/2,color,2);
  }
  const label=p(FIELD_METERS/2,by-.14);
  ctx.textAlign='center';ctx.font='bold 10px system-ui';ctx.fillStyle='#e7eaed';
  ctx.fillText('HIVE · 1,256 × 0,990 m',label[0],label[1]);
  for(const [x,y] of FLOWERS){
    const q=p(x,y),q2=p(x+DIMS.flowerDiameter,y);
    ctx.fillStyle='#88b96d';ctx.strokeStyle='#c8efa7';ctx.beginPath();
    ctx.arc(q[0],q[1],Math.max(4,Math.abs(q2[0]-q[0])/2),0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
export function drawArenaSide(ctx,point,mode){
  if(mode!=='biobuzz')return;
  ctx.save();
  // Corte didático ao longo do lançador, NÃO é projeção CAD absoluta.
  const center=1.83,half=DIMS.frameWidth/2;
  const lowerLeft=point(center-half,0),lowerRight=point(center+half,0),apex=point(center,DIMS.pivotHeight);
  ctx.strokeStyle='#9eacb9';ctx.lineWidth=3;ctx.beginPath();
  ctx.moveTo(...lowerLeft);ctx.lineTo(...apex);ctx.lineTo(...lowerRight);ctx.stroke();
  const ca=point(center-DIMS.cellSpacing/2,DIMS.pivotHeight),cb=point(center+DIMS.cellSpacing/2,DIMS.pivotHeight);
  ctx.strokeStyle='#f08d70';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(...ca);ctx.lineTo(...cb);ctx.stroke();
  const flowerX=[.12,3.54];
  flowerX.forEach(x=>{const a=point(x,0),b=point(x,DIMS.flowerHeight);
    ctx.strokeStyle='#8fc57d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();});
  ctx.fillStyle='#e0e4ea';ctx.textAlign='center';ctx.font='10px system-ui';
  ctx.fillText('Pivô HIVE 1,1165 m',apex[0],apex[1]-13);
  ctx.fillText('FLOWER 0,546 m',point(.6,.58)[0],point(.6,.58)[1]);
  ctx.restore();
}
