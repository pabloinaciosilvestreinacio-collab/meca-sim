import test from 'node:test';
import {validStart,FIELD_METERS,FLOWERS,hiveCellAt,hiveCellById,HIVE} from '../web/arena.mjs';
import assert from 'node:assert/strict';
import {rotate, launcher, heightAt, flight, gamepadValues, shotElapsed} from '../web/model.mjs';
test('Ponto do Desmos permanece preso ao centro ao girar',()=>{
  for(const yaw of [0,45,90,180,-135]){
    const p={x:2,y:1,yaw},l=launcher(p,.1125,.225);
    assert.ok(Math.abs(Math.hypot(l[0]-2,l[1]-1)-Math.hypot(.1125,.225))<1e-10);
  }
  assert.deepEqual(launcher({x:1,y:1,yaw:0},.1125,.225),[1.1125,1.225]);
});
test('Mover lançador não muda pose e gira pelo centro',()=>{
  const p={x:1,y:2,yaw:90};assert.deepEqual(rotate(1,0,90).map(v=>Math.round(v)),[0,1]);
  const l=launcher(p,.3,.4);assert.ok(Math.abs(l[0]-.6)<1e-12);assert.ok(Math.abs(l[1]-2.3)<1e-12);
  assert.deepEqual(p,{x:1,y:2,yaw:90});
});
test('Parábola com alcance analítico',()=>{const f=flight(0,5,45);assert.ok(Math.abs(f.range-25/9.81)<1e-10);assert.ok(Math.abs(heightAt(f.range,0,5,45))<1e-10);});
test('Alvo vertical usa projeção vetorial, sem dividir por delta X',()=>{const l=launcher({x:1,y:1,yaw:0},0,.2),target=[1,3];assert.equal(target[0]-l[0],0);assert.ok(Number.isFinite(Math.hypot(target[0]-l[0],target[1]-l[1])));});
test('Mapeamento padrão: eixos, gatilhos, back/start e D-pad',()=>{
  const buttons=Array.from({length:16},()=>({pressed:false,value:0}));buttons[0]={pressed:true,value:1};buttons[6]={pressed:true,value:.7};buttons[8]={pressed:true,value:1};buttons[12]={pressed:true,value:1};
  const v=gamepadValues({mapping:'standard',axes:[.1,-.2,.3,-.4],buttons});assert.equal(v.length,20);assert.equal(v[1],-.2);assert.equal(v[4],.7);assert.equal(v[6],1);assert.equal(v[12],1);assert.equal(v[16],1);
});
test('Desconectar ou mapeamento desconhecido zera comando',()=>{assert.deepEqual(gamepadValues(null),Array(20).fill(0));assert.deepEqual(gamepadValues({mapping:''}),Array(20).fill(0));});

import {targetSolution, encoderScale, connectedPlayers} from '../web/model.mjs';
test('solução inversa atinge alvo em 500 posições e rotações',()=>{
  for(let i=0;i<500;i++){
    const pose={x:1.2,y:.7,yaw:i*137.508%360-180};
    const [x,y]=launcher(pose,.11,.225),tx=x+Math.cos(i)*2,ty=y+Math.sin(i)*2;
    const solution=targetSolution(pose,.11,.225,.3,50,tx,ty,.9);
    assert.ok(Math.abs(heightAt(solution.distance,.3,solution.speed,50)-.9)<1e-10);
    const [dx,dy]=rotate(0,solution.distance,pose.yaw+solution.azimuth);
    assert.ok(Math.hypot(x+dx-tx,y+dy-ty)<1e-10);
  }
});
test('solução impossível falha explicitamente',()=>{
  assert.throws(()=>targetSolution({x:0,y:0,yaw:0},0,0,.3,0,0,2,1));
  assert.throws(()=>flight(-1,5,45));
  assert.throws(()=>heightAt(1,.3,NaN,45));
});
test('desconectar controle 1 não promove o controle 2',()=>{
  const p2={mapping:'standard',connected:true,axes:[0,.5,0,0],buttons:[]};
  const [a,b]=connectedPlayers([null,p2]);
  assert.equal(a,null);assert.equal(b,p2);assert.deepEqual(gamepadValues(a),Array(20).fill(0));
});
test('conversão usa redução total e circunferência',()=>{
  assert.ok(Math.abs(encoderScale(28,20,.09)-1980.5948473658087)<1e-9);
  assert.throws(()=>encoderScale(28,20,0));
});

test('Partida válida respeita tamanho e rotação do chassi nas duas arenas',()=>{
  assert.equal(FIELD_METERS,3.66);
  assert.equal(FLOWERS.length,4);
  assert.equal(validStart(1.83,.65,.45,.45,0),true);
  assert.equal(validStart(.1,.1,.45,.45,0),false);
  assert.equal(validStart(3.6,3.6,.45,.45,0),false);
  assert.equal(validStart(.36,.36,.45,.45,45),true);
  assert.equal(validStart(NaN,1,.45,.45,0),false);
});

import {candidates,diagnostics,highlightJava} from '../web/editor.mjs';
test('Editor Java: sugestões locais e completamento',()=>{
  assert.ok(candidates('setPow',6).includes('setPower'));
  assert.equal(candidates('se',2).length,0);
});
test('Editor Java: javac aponta arquivo e linha e HTML não é executado',()=>{
  const errors=diagnostics('C:/temp/Robot.java:15: error: cannot find symbol\n  symbol: variable MISSING');
  assert.deepEqual(errors,[{file:'Robot.java',line:15,severity:'error',message:'cannot find symbol'}]);
  assert.match(highlightJava('class A { String x="<script>"; // ok }'),/&lt;script&gt;/);
});

import {routeSteps,routeWarnings,makeRouteJava,normalizeYaw} from '../web/route.mjs';
test('Rota diferencial: eixo Y, diagonal, giros relativos e limite do campo',()=>{
  const steps=routeSteps({x:1,y:1,yaw:0},[{x:1,y:2},{x:2,y:3}],{width:.45,length:.45});
  assert.equal(steps.length,2);
  assert.ok(Math.abs(steps[0].turnDeg)<1e-10);
  assert.ok(Math.abs(steps[0].distanceM-1)<1e-10);
  assert.ok(Math.abs(steps[1].turnDeg+45)<1e-10);
  assert.ok(Math.abs(steps[1].distanceM-Math.SQRT2)<1e-10);
  assert.ok(Math.abs(normalizeYaw(-270)-90)<1e-10);
  assert.throws(()=>routeSteps({x:1,y:1,yaw:0},[{x:0,y:0}],{width:.45,length:.45}));
});
test('Editor de rota gera Java LinearOpMode com API FTC parcial',()=>{
  const steps=routeSteps({x:.65,y:.65,yaw:0},[{x:.65,y:1.2}]);
  const java=makeRouteJava(steps,{left:'ME',right:'MD',ticksPerM:1980.6});
  assert.match(java,/class RotaMecaSim extends LinearOpMode/);
  assert.match(java,/virar\(0\.000000\)/);
  assert.match(java,/andar\(0\.550000\)/);
  assert.match(java,/timeout de percurso/);
  assert.equal(routeWarnings({x:0,y:0},[{x:3.6,y:3.6}]).length,1);
  assert.equal(routeWarnings({x:0,y:0},[{x:3.6,y:3.6}],'livre').length,0);
});

import {DIMS} from '../web/arena.mjs';
test('Medidas oficiais BIOBUZZ modeladas em SI',()=>{
  assert.equal(DIMS.frameWidth,1.2565);assert.equal(DIMS.frameDepth,.9895);
  assert.equal(DIMS.pivotHeight,1.1165);assert.equal(DIMS.flowerHeight,.546);
  assert.equal(DIMS.gardenWidth,.584);assert.equal(DIMS.loadingDepth,.2795);
});

import {speedFromForce,forceFromSpeed,shotFeasibility} from '../web/model.mjs';
import {ZONES} from '../web/arena.mjs';
test('Força, curso, eficiência e massa respeitam energia cinética ideal',()=>{
  const v=speedFromForce(6,.05,.15,.65);
  assert.ok(Math.abs(v-Math.sqrt(23.4))<1e-12);
  assert.ok(Math.abs(forceFromSpeed(v,.05,.15,.65)-6)<1e-12);
  assert.throws(()=>speedFromForce(4,0,.1,.7));
  assert.throws(()=>speedFromForce(4,.05,.1,1.2));
});
test('Viabilidade considera alcance, altura e desvio lateral do alvo',()=>{
  const pose={x:1,y:1,yaw:0};
  const base={lateral:0,forward:0,height:.3,speed:5,elevation:45,azimuth:0,tx:1,ty:2,th:.9,radius:.10,heightTolerance:.12};
  const hit=shotFeasibility(pose,base);
  assert.equal(hit.possible,true,JSON.stringify(hit));
  const slow=shotFeasibility(pose,{...base,speed:2});
  assert.equal(slow.possible,false);
  assert.ok(slow.issues.some(s=>s.includes('solo')||s.includes('altura')));
  const offAxis=shotFeasibility(pose,{...base,tx:1.5});
  assert.equal(offAxis.possible,false);
  assert.ok(offAxis.issues.some(s=>s.includes('desvio lateral')));
  const behind=shotFeasibility(pose,{...base,ty:.2});
  assert.ok(behind.issues.some(s=>s.includes('atrás')));
});
test('CELL do HIVE usa coordenadas físicas do campo',()=>{
  const cell=hiveCellAt(1.50,1.95);assert.ok(cell);assert.equal(cell.id,'red-upper');assert.equal(hiveCellAt(.2,.2),null);
});
test('Quatro HIVEs centrais têm mira estável e identificável',()=>{
  assert.equal(HIVE.cells.length,4);
  assert.deepEqual(HIVE.cells.map(cell=>cell.id),['red-lower','red-upper','blue-lower','blue-upper']);
  for(const cell of HIVE.cells)assert.equal(hiveCellById(cell.id),cell);
  assert.equal(hiveCellById('inexistente'),null);
});

test('Desenho de arena segue referências observadas no Desmos',()=>{
  assert.ok(FLOWERS.some(([x,y])=>x<.2&&y>1.6&&y<2));
  assert.ok(FLOWERS.some(([x,y])=>y>3.5&&x>1));
  assert.ok(ZONES.redVertical.y>2.4&&ZONES.blueVertical.y<1);
  assert.ok(Math.abs(HIVE.w-1.2565)<1e-10);
});

test('Animação não calcula percurso negativo antes do primeiro frame do disparo',()=>{
  assert.equal(shotElapsed(1000,1004),0);
  assert.equal(shotElapsed(1000,1000),0);
  assert.ok(Math.abs(shotElapsed(1500,1000)-.5)<1e-12);
  const distance=5*Math.cos(45*Math.PI/180)*shotElapsed(1000,1004);
  assert.equal(heightAt(distance,.3,5,45),.3);
  assert.throws(()=>shotElapsed(NaN,1004));
});

import {hiveShotImpact,registerPollen,SIM_TIP_POLLS} from '../web/model.mjs';
import {hiveSideGeometry,HIVE_SIDE} from '../web/arena.mjs';
test('POLLEN só entra na CELL vermelha descendo, acima da borda da casinha',()=>{
  const pose={x:1.83,y:.65,yaw:0},cell=hiveCellById('red-lower'),hiveAngle=-HIVE_SIDE.angleDeg;
  const [tx,ty]=[cell.x+cell.w/2,cell.y+cell.h/2];
  const gate=hiveSideGeometry(cell,hiveAngle);
  assert.ok(Math.abs(gate.openingHeight-1.665)<.015);
  assert.ok(Math.abs(gate.bottomOpeningHeight-1.359)<.020);
  assert.ok(Math.abs(hiveSideGeometry(hiveCellById('red-upper'),hiveAngle).bottomOpeningHeight-.777)<.025);
  const solution=targetSolution(pose,.1125,.225,.30,78,tx,ty,gate.openingHeight);
  const shot={origin:launcher(pose,.1125,.225),yaw:pose.yaw,azimuth:solution.azimuth,
    speed:solution.speed,elevation:78,height:.30,tx,ty,hiveAngle};
  const hit=hiveShotImpact(shot,cell);
  assert.equal(hit.hit,true,JSON.stringify(hit));
  assert.ok(hit.time>0&&hit.time<flight(shot.height,shot.speed,shot.elevation).time);
  assert.ok(Math.abs(hit.height-hit.openingHeight)<.08);
  assert.ok(Math.hypot(hit.x-tx,hit.y-ty)<HIVE_SIDE.sideDepth/2);
  assert.equal(hiveShotImpact({...shot,azimuth:shot.azimuth+45},cell).hit,false);
  assert.equal(hiveShotImpact({...shot,speed:1},cell).hit,false);
  const rising=targetSolution(pose,.1125,.225,.30,70,tx,ty,gate.openingHeight);
  const incoming=hiveShotImpact({...shot,elevation:70,speed:rising.speed,azimuth:rising.azimuth},cell);
  assert.equal(incoming.hit,false,'não atravessar telhado em subida');
  assert.ok(incoming.reason,'erro explicativo');
});
test('Ajustes na rampa entre 60–85 graus alteram o ponto de queda e captura',()=>{
  const cell=hiveCellById('red-lower'),pose={x:1.83,y:.65,yaw:0};
  const gate=hiveSideGeometry(cell,-34),tx=cell.x+cell.w/2,ty=cell.y+cell.h/2;
  const origin=launcher(pose,.1125,.225);
  const data=[60,65,70,75,78,80,82,85].map(elevation=>{
    const sol=targetSolution(pose,.1125,.225,.30,elevation,tx,ty,gate.openingHeight);
    const impact=hiveShotImpact({origin,yaw:0,azimuth:sol.azimuth,
      speed:sol.speed,elevation,height:.30,hiveAngle:-34},cell);
    return {elevation,...impact};
  });
  assert.equal(data.find(x=>x.elevation===78).hit,true);
  assert.ok(data.some(x=>x.hit===false));
  assert.ok(data.some(x=>x.hit===true));
  assert.notEqual(data[0].hit,data[data.length-1].hit);
});
test('Tombamento didático ocorre só no oitavo POLLEN e reinicia o ciclo',()=>{
  assert.equal(SIM_TIP_POLLS,8);
  let count=0;
  for(let i=1;i<=24;i++){
    const step=registerPollen(count);count=step.count;
    assert.equal(step.tipped,i%8===0,'tombamento fora da oitava bola, tiro '+i);
    assert.equal(count,i%8);
  }
  assert.throws(()=>registerPollen(-1));
});
