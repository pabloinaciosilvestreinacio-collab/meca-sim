import math
import random
import time
import threading
import unittest
import test_simulator as base_tests
from physics import World, encoder_scale, trajectory
from server import Session, build_world, executable, validate_java_files
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import json

class MultipleFileTests(unittest.TestCase):
    def test_invalid_paths_are_rejected(self):
        for name in ('../Ataque.java','/tmp/X.java','pasta\\X.java','pasta/../X.java','Arquivo.txt'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate_java_files({name:'class X {}'})
    def test_invalid_collection_is_rejected(self):
        for value in ([],{'A.java':None},{f'A{i}.java':'class A {}' for i in range(31)}):
            with self.assertRaises(ValueError):validate_java_files(value)
    @unittest.skipUnless(executable('javac') and executable('java'),'JDK requerido')
    def test_helper_in_other_package_compiles_and_runs(self):
        main='''package org.firstinspires.ftc.teamcode.teleOp;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import org.firstinspires.ftc.teamcode.util.Auxiliar;
public class MultiArquivo extends LinearOpMode {
  public void runOpMode() { telemetry.addLine(Auxiliar.mensagem()); telemetry.update(); }
}'''
        helper='''package org.firstinspires.ftc.teamcode.util;
public class Auxiliar { public static String mensagem() { return "Arquivos juntos OK"; } }'''
        session=Session()
        session.run(main,{'org/firstinspires/ftc/teamcode/util/Auxiliar.java':helper})
        session.worker.join(20)
        self.assertFalse(session.worker.is_alive())
        self.assertEqual(session.status,'concluído',session.logs)
        self.assertIn('Arquivos juntos OK',session.telemetry)
        self.assertTrue(all(m.power==0 for m in session.world.motors.values()))


class DiagnosticTests(unittest.TestCase):
    def test_frozen_imu_and_encoder_are_reported_without_stopping_java(self):
        session=Session({'imu_frozen':True,'left_encoder_frozen':True})
        session.inspector.inspect(session.world,False)
        codes={d['code'] for d in session.snapshot()['diagnostics']}
        self.assertIn('IMU_CONGELADO',codes)
        self.assertIn('ENCODER_ME',codes)
        self.assertFalse(session.stop_event.is_set())
    def test_timeout_diagnostic_does_not_mean_java_crash(self):
        session=Session()
        session.rpc('telemetry','Autonomo interrompido: Tempo limite da virada')
        self.assertIn('TIMEOUT_JAVA',{x['code'] for x in session.snapshot()['diagnostics']})
        self.assertEqual(session.status,'pronto')
    def test_motor_stalled_detection(self):
        session=Session({'left_gain':0})
        session.world.motors['ME'].power=.4
        session.world.motors['MD'].direction=-1
        session.world.motors['MD'].power=.4
        for i in range(90):
            session.world.step(.01)
            session.inspector.inspect(session.world,True)
        codes={x['code'] for x in session.snapshot()['diagnostics']}
        self.assertIn('MOTOR_SEM_PROGRESSO_ME',codes)
        self.assertNotIn('MOTOR_SEM_PROGRESSO_MD',codes)

class StopRaceTests(unittest.TestCase):
    def test_delayed_java_finish_does_not_override_stop(self):
        session=Session()
        session.stop()
        session.rpc('finish')
        self.assertEqual(session.status,'parado')
        self.assertTrue(all(m.power==0 for m in session.world.motors.values()))


class NumericalTests(unittest.TestCase):
    def test_thousand_random_arcs_against_analytical_solution(self):
        rng=random.Random(32578)
        for _ in range(1000):
            vl,vr=rng.uniform(-1,1),rng.uniform(-1,1)
            t,track=rng.uniform(.001,1),rng.uniform(.1,1)
            yaw=rng.uniform(-math.pi,math.pi)
            w=World(x=0,y=0,yaw=yaw,track=track)
            w.motors['MD'].direction=-1
            w.motors['ME'].power=vl;w.motors['MD'].power=vr
            v=(vl+vr)/2;omega=(vr-vl)/track;theta=yaw+math.pi/2
            if abs(omega)<1e-8:
                expected=(v*t*math.cos(theta),v*t*math.sin(theta))
            else:
                expected=(v/omega*(math.sin(theta+omega*t)-math.sin(theta)),v/omega*(math.cos(theta)-math.cos(theta+omega*t)))
            w.step(t)
            self.assertAlmostEqual(w.x,expected[0],delta=1e-10)
            self.assertAlmostEqual(w.y,expected[1],delta=1e-10)
    def test_nearly_equal_wheels_are_stable(self):
        w=World(x=0,y=0);w.motors['MD'].direction=-1
        w.motors['ME'].power=.5;w.motors['MD'].power=.5+1e-12
        w.step(1)
        self.assertAlmostEqual(w.y,.5,delta=1e-10)
        self.assertAlmostEqual(w.x,0,delta=1e-10)
    def test_gear_conversion(self):
        self.assertAlmostEqual(encoder_scale(28,20,.09),1980.5948473658087)
        for args in [(0,20,.09),(28,-1,.09),(28,20,float('nan'))]:
            with self.assertRaises(ValueError):encoder_scale(*args)
    def test_invalid_step_and_projectile(self):
        for dt in [0,-.1,float('inf'),float('nan')]:
            with self.assertRaises(ValueError):World().step(dt)
        for h,v,a,d in [(-1,5,45,1),(0,0,45,1),(0,5,-2,1),(0,5,90,1),(0,5,45,float('nan'))]:
            with self.assertRaises(ValueError):trajectory(h,v,a,d)
    def test_slip_separates_ground_distance_from_encoder(self):
        w=build_world({'left_slip':.5,'right_slip':.5});w.motors['MD'].direction=-1
        w.motors['ME'].power=w.motors['MD'].power=.5
        w.step(1)
        self.assertAlmostEqual(w.y,.9)
        self.assertAlmostEqual(w.motors['ME'].position(),.5*w.ticks_per_m,delta=1)
    def test_frozen_encoder_moves_without_feedback(self):
        w=build_world({'left_encoder_frozen':True});w.motors['MD'].direction=-1
        w.motors['ME'].power=w.motors['MD'].power=.5;w.step(.5)
        self.assertGreater(w.y,.65);self.assertEqual(w.motors['ME'].position(),0)
        self.assertGreater(w.motors['MD'].position(),100)
    def test_brake_stops_faster_than_float(self):
        def distance(brake):
            w=build_world({'acceleration':1});w.motors['MD'].direction=-1
            for m in w.motors.values():m.power=.5;m.brake=brake
            w.step(1);initial=w.y
            for m in w.motors.values():m.power=0
            w.step(1);return w.y-initial
        self.assertLess(distance('BRAKE'),distance('FLOAT')/2)
    def test_wall_blocks_body_not_encoder(self):
        w=build_world({'walls':True,'y':3.4});w.motors['MD'].direction=-1
        w.motors['ME'].power=w.motors['MD'].power=1;w.step(.5)
        self.assertTrue(w.inside());self.assertTrue(w.collision)
        self.assertLess(w.y,3.44);self.assertGreater(w.motors['ME'].position(),900)
    def test_bad_wall_start_rejected(self):
        with self.assertRaises(ValueError):build_world({'walls':True,'x':0})
    def test_delayed_and_frozen_imu(self):
        for frozen in (False,True):
            s=Session({'imu_delay':.2,'imu_frozen':frozen});w=s.world
            w.motors['MD'].direction=-1;w.motors['ME'].power=-.2;w.motors['MD'].power=.2
            w.step(.5)
            expected=0 if frozen else math.degrees((.4/.45)*.3)
            self.assertAlmostEqual(float(s.rpc('yaw')),expected,delta=1e-7)
            s.rpc('resetYaw');self.assertAlmostEqual(float(s.rpc('yaw')),0)
    def test_snapshot_distinguishes_true_yaw_from_frozen_imu(self):
        s=Session({'imu_frozen':True})
        s.rpc('motor','MD','direction','REVERSE')
        s.rpc('motor','ME','power','-.3')
        s.rpc('motor','MD','power','.3')
        s.world.step(.5)
        state=s.snapshot()
        self.assertTrue(state['imu_frozen'])
        self.assertAlmostEqual(state['imu_yaw'],0)
        self.assertGreater(abs(state['yaw']),5)
        self.assertAlmostEqual(float(s.rpc('yaw')),state['imu_yaw'])

    def test_snapshot_imu_yaw_respects_reset(self):
        s=Session()
        s.world.yaw=math.radians(30)
        s.rpc('resetYaw')
        s.world.yaw=math.radians(50)
        state=s.snapshot()
        self.assertFalse(state['imu_frozen'])
        self.assertAlmostEqual(state['imu_yaw'],20)
        self.assertAlmostEqual(state['yaw'],50)

    def test_stop_blocks_future_power(self):
        s=Session();s.stop();s.rpc('motor','ME','power','1')
        self.assertEqual(s.world.motors['ME'].power,0)
    def test_stale_gamepad_neutralized(self):
        s=Session();s.client_required=True;s.gamepads[0][1]=1;s.input_seen=time.monotonic()-1
        thread=threading.Thread(target=s.tick);thread.start()
        try:
            time.sleep(.04);self.assertEqual(s.gamepads[0],[0]*20)
        finally:s.stop();thread.join(1)
    def test_lost_browser_stops_session(self):
        s=Session();s.client_required=True;s.client_seen=time.monotonic()-3
        thread=threading.Thread(target=s.tick);thread.start();thread.join(1)
        self.assertTrue(s.stop_event.is_set());self.assertIn('desconectado',s.logs)

class RequestValidationTests(unittest.TestCase):
    setUp = base_tests.HTTPTests.setUp
    tearDown = base_tests.HTTPTests.tearDown
    def post(self, data, path='/api/gamepad', origin=None):
        headers={'Content-Type':'application/json','X-Sim-Token':self.app.token}
        if origin:headers['Origin']=origin
        return urlopen(Request(self.url+path,data=json.dumps(data).encode(),headers=headers))
    def test_non_object_json_returns_400(self):
        for data in [[],None,'abc',3]:
            with self.assertRaises(HTTPError) as error:self.post(data)
            self.assertEqual(error.exception.code,400)
    def test_invalid_gamepad_is_atomic(self):
        with self.assertRaises(HTTPError):self.post({'1':[1]*20,'2':None})
        self.assertEqual(self.app.session.gamepads,[[0]*20,[0]*20])
    def test_wrong_origin_rejected(self):
        with self.assertRaises(HTTPError) as error:self.post({},'/api/stop','https://example.org')
        self.assertEqual(error.exception.code,403)
    def test_recording_columns(self):
        with urlopen(self.url+'/api/recording') as r:data=json.load(r)
        self.assertEqual(data['columns'][:4],['time_s','x_m','y_m','yaw_deg'])

@unittest.skipUnless(executable('javac') and executable('java'),'JDK requerido')
class ExtendedJavaTests(unittest.TestCase):
    def test_autonomo31_frozen_imu_times_out_without_false_success(self):
        from pathlib import Path
        source=(Path(__file__).resolve().parent/'fixtures/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Autonomo/autonomo.java').read_text(encoding='utf-8')
        s=Session({'imu_frozen':True,'duration':15})
        try:
            s.run(source)
            init_deadline=time.monotonic()+25
            while s.status not in ('inicializando','erro') and time.monotonic()<init_deadline:
                time.sleep(.01)
            self.assertEqual(s.status,'inicializando',s.logs)
            s.started=True
            s.status='executando'
            s.worker.join(35)
            self.assertFalse(s.worker.is_alive(),f'Autonomo 3.1 não encerrou: {s.status}, sim={s.world.elapsed:.1f}s, logs={s.logs[-1200:]}')
            self.assertEqual(s.status,'concluído',s.logs)
            self.assertIn('Tempo limite da virada',s.telemetry)
            self.assertIn('interrompido',s.telemetry.lower())
            self.assertGreaterEqual(s.world.elapsed,6.5)
            self.assertAlmostEqual(s.snapshot()['imu_yaw'],0)
            self.assertTrue(all(m.power==0 for m in s.world.motors.values()))
        finally:
            s.stop()
            if s.worker:
                s.worker.join(2)

    def test_final_class_fully_qualified_base_and_url_in_string(self):
        s=Session();s.run('public final class Qualified extends com.qualcomm.robotcore.eventloop.opmode.LinearOpMode {public void runOpMode(){String s="http://localhost/*a*/"; telemetry.addLine(s); telemetry.update();}}')
        s.worker.join(15);self.assertFalse(s.worker.is_alive());self.assertEqual(s.status,'concluído',s.logs)
        self.assertIn('http://localhost/*a*/',s.telemetry)
    def test_java_exception_remains_error(self):
        s=Session();s.run('public class Failure extends com.qualcomm.robotcore.eventloop.opmode.LinearOpMode {public void runOpMode(){throw new RuntimeException("falha simulada");}}')
        s.worker.join(15);self.assertEqual(s.status,'erro',s.logs);self.assertIn('falha simulada',s.logs)
        self.assertTrue(all(m.power==0 for m in s.world.motors.values()))

    def test_utf8_stdout_preserves_portuguese(self):
        s=Session();s.run('public class Acentos extends com.qualcomm.robotcore.eventloop.opmode.LinearOpMode {public void runOpMode(){System.out.println("Atenção: execução, posição e direção");}}')
        s.worker.join(15);self.assertEqual(s.status,'concluído',s.logs)
        self.assertIn('Atenção: execução, posição e direção',s.logs)
