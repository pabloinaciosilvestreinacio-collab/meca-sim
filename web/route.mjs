// Planejador diferencial (tank, sem mecanum): rota de girar + avançar.
// A geometria usa yaw 0=+Y e aumento anti-horário.
import {validStart,FIELD_METERS} from './arena.mjs';
export const MAX_WAYPOINTS=16;
export function normalizeYaw(deg){return (deg+180)%360<0?(deg+180)%360+180:(deg+180)%360-180;}
export function routeSteps(start,points,dimensions={width:.45,length:.45}){
  if(!Array.isArray(points)||points.length>MAX_WAYPOINTS)throw Error('Rota excede 16 pontos');
  let {x,y,yaw}=start;
  if(!validStart(x,y,dimensions.width,dimensions.length,yaw))throw Error('Partida fora dos limites');
  const result=[];
  for(const point of points){
    if(!point||!validStart(Number(point.x),Number(point.y),dimensions.width,dimensions.length,0))
      throw Error('Waypoint inválido ou fora do campo');
    const dx=point.x-x,dy=point.y-y,dist=Math.hypot(dx,dy);
    if(dist<.01)throw Error('Pontos consecutivos próximos demais (mínimo 1 cm)');
    const desired=Math.atan2(-dx,dy)*180/Math.PI;
    const turn=normalizeYaw(desired-yaw);
    result.push({x:point.x,y:point.y,turnDeg:turn,headingDeg:desired,distanceM:dist});
    x=point.x;y=point.y;yaw=desired;
  }
  return result;
}
function crossHive(a,b){
  // Faixa da base do suporte HIVE; apenas aviso, sem colisão física.
  const rect={xmin:FIELD_METERS/2-1.2565/2,xmax:FIELD_METERS/2+1.2565/2,ymin:FIELD_METERS/2-.9895/2,ymax:FIELD_METERS/2+.9895/2};
  // Liang–Barsky sobre segmento.
  const dx=b.x-a.x,dy=b.y-a.y;
  let t0=0,t1=1;
  for(const [p,q] of [[-dx,a.x-rect.xmin],[dx,rect.xmax-a.x],[-dy,a.y-rect.y],[dy,rect.ymax-a.y]]){
    if(p===0){if(q<0)return false;continue;}
    const t=q/p;if(p<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
    if(t0>t1)return false;
  }
  return true;
}
export function routeWarnings(start,points,mode='biobuzz'){
  if(mode!=='biobuzz')return [];
  let a=start;const warnings=[];
  for(let i=0;i<points.length;i++){if(crossHive(a,points[i]))warnings.push('Trecho '+(i+1)+' atravessa a base ilustrativa do HIVE; sem desvio automático.');a=points[i];}
  return warnings;
}
export function makeRouteJava(steps,settings){
  if(!steps.length)throw Error('Adicione ao menos um waypoint');
  if(!Number.isFinite(settings.ticksPerM)||settings.ticksPerM<=0)throw Error('Ticks/m inválido');
  const left=settings.left,right=settings.right;
  if(!/^[A-Za-z0-9_]{1,32}$/.test(left)||!/^[A-Za-z0-9_]{1,32}$/.test(right)||left===right)throw Error('Hardware do chassi inválido');
  const commands=steps.map((s,i)=>'        if (!virar('+s.turnDeg.toFixed(6)+') || !andar('+s.distanceM.toFixed(6)+')) return; // waypoint '+(i+1)).join('\n');
  return \`package org.firstinspires.ftc.teamcode;

import com.qualcomm.hardware.rev.RevHubOrientationOnRobot;
import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.IMU;
import com.qualcomm.robotcore.util.ElapsedTime;
import com.qualcomm.robotcore.util.Range;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;

@Autonomous(name="MecaSim: roteiro diferencial")
public class RotaMecaSim extends LinearOpMode {
    private DcMotor ME, MD;
    private IMU imu;
    private static final double TICKS_M = \${settings.ticksPerM.toFixed(6)};
    @Override public void runOpMode() {
        ME = hardwareMap.get(DcMotor.class,"\${left}");
        MD = hardwareMap.get(DcMotor.class,"\${right}");
        ME.setDirection(DcMotor.Direction.FORWARD);
        MD.setDirection(DcMotor.Direction.REVERSE);
        ME.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        MD.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        imu = hardwareMap.get(IMU.class,"imu");
        imu.initialize(new IMU.Parameters(new RevHubOrientationOnRobot(
            RevHubOrientationOnRobot.LogoFacingDirection.LEFT,
            RevHubOrientationOnRobot.UsbFacingDirection.UP)));
        telemetry.addLine("Roteiro gerado no MecaSim. Validar sinais e PID no robo real.");
        telemetry.update();
        waitForStart();
        if (isStopRequested()) return;
        imu.resetYaw();
        try {
\${commands}
            telemetry.addLine("Roteiro executado (confirmar pose final)");
            telemetry.update();
        } finally { parar(); }
    }
    private void parar() { ME.setPower(0); MD.setPower(0); }
    private double yaw() { return imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES); }
    private double normalizar(double a) { while(a>180)a-=360;while(a< -180)a+=360;return a; }
    private boolean virar(double graus) {
        double alvo=normalizar(yaw()+graus);
        ElapsedTime timer=new ElapsedTime();
        while (opModeIsActive() && timer.seconds()<6.0) {
            double erro=normalizar(alvo-yaw());
            if (Math.abs(erro)<2.0) { parar();return true; }
            double comando=Range.clip(erro*.012,-.40,.40);
            if (Math.abs(comando)<.10) comando=Math.copySign(.10,erro);
            ME.setPower(-comando);MD.setPower(comando);idle();
        }
        parar();telemetry.addLine("Falha: timeout de giro");telemetry.update();return false;
    }
    private boolean andar(double metros) {
        ME.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
        MD.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
        ME.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER);
        MD.setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER);
        final double rumo=yaw();
        ElapsedTime timer=new ElapsedTime();
        final double limite=Math.max(3.0,Math.min(16.0,metros/0.25+2.0));
        while(opModeIsActive() && timer.seconds()<limite) {
            double media=(ME.getCurrentPosition()+MD.getCurrentPosition())/(2.0*TICKS_M);
            if(media>=metros-.015) { parar();return true; }
            double correcao=Range.clip(normalizar(rumo-yaw())*.014,-.16,.16);
            ME.setPower(Range.clip(.35-correcao,.08,.55));
            MD.setPower(Range.clip(.35+correcao,.08,.55));
            idle();
        }
        parar();telemetry.addLine("Falha: timeout de percurso");telemetry.update();return false;
    }
}
\`;
}
