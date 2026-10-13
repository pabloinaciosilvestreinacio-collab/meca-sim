import {hiveSideGeometry,HIVE_SIDE} from './arena.mjs';
export function rotate(x, y, degrees) {
  const a = degrees * Math.PI / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}
export function launcher(pose, lateral, forward) {
  const [x, y] = rotate(lateral, forward, pose.yaw);
  return [pose.x + x, pose.y + y];
}
export function heightAt(distance, height, speed, elevation) {
  const a = elevation * Math.PI / 180;
  if (![distance,height,speed,elevation].every(Number.isFinite) || distance<0 || height<0 || !(speed > 0) || elevation < 0 || elevation >= 90) throw new Error('Lançamento inválido');
  return height + distance * Math.tan(a) - 9.81 * distance ** 2 / (2 * speed ** 2 * Math.cos(a) ** 2);
}
// requestAnimationFrame fornece o instante do início do frame, que pode ser
// anterior ao performance.now() usado no clique que criou o lançamento.
export function shotElapsed(frameTime,startTime){
  if(!Number.isFinite(frameTime)||!Number.isFinite(startTime))throw Error('Tempo de lançamento inválido');
  return Math.max(0,(frameTime-startTime)/1000);
}
export function flight(height, speed, elevation) {
  heightAt(0,height,speed,elevation);
  const a = elevation * Math.PI / 180;
  const vy = speed * Math.sin(a);
  const time = (vy + Math.sqrt(vy ** 2 + 2 * 9.81 * height)) / 9.81;
  return {time, range: speed * Math.cos(a) * time};
}
export function targetSolution(pose, lateral, forward, height, elevation, tx, ty, th) {
  if (![pose.x,pose.y,pose.yaw,lateral,forward,height,elevation,tx,ty,th].every(Number.isFinite) || th<0) throw Error('Alvo inválido');
  heightAt(0,height,1,elevation);
  const [x,y]=launcher(pose,lateral,forward),dx=tx-x,dy=ty-y,distance=Math.hypot(dx,dy),a=elevation*Math.PI/180;
  const drop=height+distance*Math.tan(a)-th;
  if(distance<1e-8 || drop<=0) throw Error('Alvo inalcançável nesta elevação. Aumente o ângulo ou ajuste a altura.');
  const speed=Math.sqrt(9.81*distance**2/(2*Math.cos(a)**2*drop));
  const azimuth=((Math.atan2(-dx,dy)*180/Math.PI-pose.yaw+180)%360+360)%360-180;
  return {speed,azimuth,distance};
}
// Trabalho ideal transferido ao projétil: 0,5 m v² = eficiência × F × curso.
// F é força média equivalente, NÃO torque/potência de motor.
export function speedFromForce(force,mass,stroke,efficiency){
  if(![force,mass,stroke,efficiency].every(Number.isFinite)||force<=0||mass<=0||stroke<=0||efficiency<=0||efficiency>1)
    throw Error('Força, massa, curso e eficiência inválidos.');
  return Math.sqrt(2*efficiency*force*stroke/mass);
}
export function forceFromSpeed(speed,mass,stroke,efficiency){
  if(![speed,mass,stroke,efficiency].every(Number.isFinite)||speed<=0||mass<=0||stroke<=0||efficiency<=0||efficiency>1)
    throw Error('Dados do shooter inválidos.');
  return mass*speed*speed/(2*efficiency*stroke);
}
export function shotFeasibility(pose,v){
  const {lateral,forward,height,speed,elevation,azimuth,tx,ty,th,radius=.12,heightTolerance=.12}=v;
  if(![pose.x,pose.y,pose.yaw,lateral,forward,height,speed,elevation,azimuth,tx,ty,th,radius,heightTolerance].every(Number.isFinite)||
    radius<=0||heightTolerance<=0||th<0||th>5)throw Error('Alvo ou tolerâncias inválidos.');
  const origin=launcher(pose,lateral,forward),dir=rotate(0,1,pose.yaw+azimuth),
    dx=tx-origin[0],dy=ty-origin[1],along=dx*dir[0]+dy*dir[1],
    lateralError=dx*dir[1]-dy*dir[0],distance=Math.hypot(dx,dy);
  const f=flight(height,speed,elevation);
  const heightAtTarget=along>=0?heightAt(along,height,speed,elevation):null;
  const verticalError=heightAtTarget===null?null:heightAtTarget-th;
  const issues=[];
  if(along<=0)issues.push('alvo atrás da direção de lançamento');
  else {
    if(along>f.range)issues.push('projétil atinge o solo antes da distância do alvo');
    if(Math.abs(lateralError)>radius)issues.push('desvio lateral '+Math.abs(lateralError).toFixed(2)+' m maior que tolerância '+radius.toFixed(2)+' m');
    if(along<=f.range&&Math.abs(verticalError)>heightTolerance)issues.push('erro de altura '+Math.abs(verticalError).toFixed(2)+' m maior que tolerância '+heightTolerance.toFixed(2)+' m');
  }
  return {possible:issues.length===0,issues,origin,along,lateralError,verticalError,heightAtTarget,
    range:f.range,flightTime:f.time,distance};
}
export function encoderScale(ticks, reduction, diameter) {
  if(![ticks,reduction,diameter].every(v=>Number.isFinite(v)&&v>0))throw Error('Ticks, redução e diâmetro devem ser positivos.');
  return ticks*reduction/(Math.PI*diameter);
}
export function connectedPlayers(pads) {
  // Preserve browser index: unplugging player 1 must not promote player 2.
  return [pads[0]?.connected===false?null:pads[0], pads[1]?.connected===false?null:pads[1]];
}
export function gamepadValues(pad) {
  const zero = Array(20).fill(0);
  if (!pad || pad.connected===false || pad.mapping !== 'standard') return zero;
  const button = n => Number(Boolean(pad.buttons[n]?.pressed));
  return [0, 1, 2, 3].map(i => pad.axes[i] || 0).concat(
    [pad.buttons[6]?.value || 0, pad.buttons[7]?.value || 0],
    [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15].map(button));
}

/** Modelo ilustrativo da entrada na abertura da CELL. Um acerto é
 * decidido ao cruzar o plano do alvo, não quando a bola toca o chão.
 * Largura/altura da abertura são medidas do manual; alinhamento e
 * transferência para dentro não substituem colisão tridimensional. */
/** Interseção do POLLEN com a boca superior (plano inclinado) do HIVE.
 * Exige cruzamento na DESCIDA, não altura parecida na subida.
 * Entrada é centrada na profundidade 30,5 cm com raio real de 3,55 cm.
 * Aproximação 2D balística sem rebote/atrito; não é colisão 3D do CAD. */
export function hiveShotImpact(shot,cell){
  if(!cell)return {hit:false,reason:'CELL inválida'};
  const all=[...(shot.origin||[]),shot.yaw,shot.azimuth,shot.speed,shot.elevation,
    shot.height,shot.hiveAngle,cell.x,cell.y,cell.w,cell.h];
  if(all.length!==12||!all.every(Number.isFinite))return {hit:false,reason:'dados balísticos inválidos'};
  if(!(shot.speed>0)||shot.elevation<0||shot.elevation>=90)return {hit:false,reason:'rampa inválida'};
  const gate=hiveSideGeometry(cell,shot.hiveAngle);
  const center=[cell.x+cell.w/2,cell.y+cell.h/2],dir=rotate(0,1,shot.yaw+shot.azimuth);
  const dx=center[0]-shot.origin[0],dy=center[1]-shot.origin[1];
  const distance=dx*dir[0]+dy*dir[1],cross=Math.abs(dx*dir[1]-dy*dir[0]);
  const r=HIVE_SIDE.ballRadius;
  if(distance<=0)return {hit:false,reason:'alvo atrás do lançador'};
  const vy=shot.speed*Math.sin(shot.elevation*Math.PI/180);
  const vx=shot.speed*Math.cos(shot.elevation*Math.PI/180);
  const slope=Math.tan(gate.angle);
  const relativeVy=vy-vx*slope,delta=gate.openingHeight-slope*distance-shot.height;
  const discriminant=relativeVy*relativeVy-2*9.81*delta;
  if(discriminant<0)return {hit:false,reason:'trajetória não alcança o plano da abertura'};
  const t=(relativeVy+Math.sqrt(discriminant))/9.81;
  if(!(t>0)||t>flight(shot.height,shot.speed,shot.elevation).time)
    return {hit:false,reason:'bola cai antes do plano da abertura'};
  const forward=vx*t,depthError=forward-distance;
  const x=shot.origin[0]+dir[0]*forward,y=shot.origin[1]+dir[1]*forward;
  const height=shot.height+vy*t-4.905*t*t;
  // O marcador é devolvido mesmo no erro: ele mostra a interseção real
  // com o plano da boca, não um ponto mágico no centro da CELL.
  const impactPoint={x,y,height,time:t,distance:forward,lateralError:cross,depthError,
    insideWidth:cross<=cell.w/2-r,insideDepth:Math.abs(depthError)<=gate.halfDepth-r,
    descending:vy-9.81*t<0,abovePlane:relativeVy-9.81*t<0};
  if(!impactPoint.insideWidth)return {hit:false,reason:'impactou fora da largura útil da abertura',impactPoint};
  if(!impactPoint.insideDepth)return {hit:false,reason:'impactou fora da profundidade útil da abertura',impactPoint};
  if(!impactPoint.descending)return {hit:false,reason:'atingiu a altura da abertura na subida; aumente o ângulo da rampa',impactPoint};
  if(!impactPoint.abovePlane)return {hit:false,reason:'cruzou o plano pelo lado inferior',impactPoint};
  return {hit:true,...impactPoint,cellId:cell.id,team:cell.team,openingHeight:gate.openingHeight};
}
/** TIPS idealizados: 8 POLLEN por ciclo, regra configurada da simulação.
 * No campo real o tombamento depende do peso, da posição e do pivô. */
export const SIM_TIP_POLLS=8;
export function registerPollen(count,threshold=SIM_TIP_POLLS){
  if(!Number.isInteger(count)||count<0||!Number.isInteger(threshold)||threshold<1)
    throw Error('Contagem do HIVE inválida');
  const total=count+1;
  return {count:total>=threshold?0:total,tipped:total>=threshold};
}
