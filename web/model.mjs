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
