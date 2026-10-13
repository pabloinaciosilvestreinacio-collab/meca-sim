// BIOBUZZ 2026–2027: esquema instrutivo, NÃO um modelo CAD/calibrado.
// Convenção local: 3,66 m de lado, frente +Y, yaw positivo anti-horário.
export const FIELD_METERS=3.66;
export const ARENAS=Object.freeze({biobuzz:'BIOBUZZ 2026–2027',livre:'Arena livre'});
export const FLOWERS=Object.freeze([[.12,.92],[.12,2.74],[3.54,.92],[3.54,2.74]]);
export function validStart(x,y,width,length,yaw=0){
  if(![x,y,width,length,yaw].every(Number.isFinite) || width<=0||length<=0)return false;
  const a=yaw*Math.PI/180;
  const hx=(Math.abs(Math.cos(a))*width+Math.abs(Math.sin(a))*length)/2;
  const hy=(Math.abs(Math.sin(a))*width+Math.abs(Math.cos(a))*length)/2;
  return x>=hx&&x<=FIELD_METERS-hx&&y>=hy&&y<=FIELD_METERS-hy;
}
export function drawArenaTop(ctx,project,mode){
  if(mode!=='biobuzz')return;
  const p=(x,y)=>project(x,y);
  function line(x1,y1,x2,y2,color,width=2){const a=p(x1,y1),b=p(x2,y2);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function rect(x,y,w,h,color){const a=p(x,y+h),b=p(x+w,y);ctx.fillStyle=color;ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}
  ctx.save();
  rect(0,0,FIELD_METERS,FIELD_METERS,'#22272c');
  for(let k=1;k<6;k++){const v=k*FIELD_METERS/6;line(v,0,v,FIELD_METERS,'#41454a',.7);line(0,v,FIELD_METERS,v,'#41454a',.7);}
  // Zonas ilustrativas: sem colisor/pontuação.
  rect(.02,.02,.60,.30,'#942c3044');rect(3.04,3.34,.60,.30,'#29589d44');
  rect(.01,1.45,.28,.70,'#bc434638');rect(3.37,1.45,.28,.70,'#4876bc38');
  line(.03,.24,.60,.24,'#fc666e',3);line(3.06,3.42,3.62,3.42,'#70aaff',3);
  // HIVE central e duas CELLS (representação em planta).
  rect(1.34,1.50,.98,.67,'#12171cbf');
  ctx.strokeStyle='#a2a9b7';ctx.lineWidth=2;ctx.strokeRect(...p(1.34,2.17),...(()=>{const a=p(1.34,2.17),b=p(2.32,1.50);return [b[0]-a[0],b[1]-a[1]];})());
  rect(1.46,1.68,.28,.27,'#a73b46');rect(1.93,1.68,.28,.27,'#366cae');
  const tag=p(1.83,1.45);ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#e8e9df';ctx.fillText('HIVE',tag[0],tag[1]);
  for(const [x,y] of FLOWERS){const q=p(x,y);ctx.fillStyle='#8acf67';ctx.beginPath();ctx.arc(q[0],q[1],6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c6f3a9';ctx.stroke();}
  ctx.restore();
}
export function drawArenaSide(ctx,point,mode){
  if(mode!=='biobuzz')return;
  ctx.save();const a=point(1.75,0),b=point(1.75,1.12),t=point(1.45,0),u=point(2.05,0);
  ctx.strokeStyle='#8893a0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...t);ctx.lineTo(...b);ctx.lineTo(...u);ctx.stroke();
  const r=point(1.65,1.12),s=point(1.85,1.12);ctx.strokeStyle='#fd6d79';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(...r);ctx.lineTo(...s);ctx.stroke();
  ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle='#bcc6cf';ctx.fillText('HIVE · esquema',b[0],b[1]-10);
  for(const x of [.12,3.54]){const l=point(x,0),h=point(x,.85);ctx.strokeStyle='#87b872';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(...l);ctx.lineTo(...h);ctx.stroke();}
  ctx.restore();
}
