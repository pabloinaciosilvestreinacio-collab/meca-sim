"""Compila fontes existentes contra SDK simulado e executa dois cenários sintéticos."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from sdk import write_sdk
from server import Session,executable

def wait_init(session, start=True):
    deadline=time.monotonic()+12
    while session.status not in ('inicializando','erro') and time.monotonic()<deadline:time.sleep(.01)
    if session.status!='inicializando':raise AssertionError(session.logs)
    if start:session.started=True;session.status='executando'

def main():
    repo=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'tests/fixtures'
    base=repo/'TeamCode/src/main/java/org/firstinspires/ftc/teamcode'
    files=[base/'Autonomo'/x for x in ['autonomo.java','Autonomo32.java','Autonomo33.java','Autonomo34.java','Autonomo35.java']]+sorted((base/'teleOp').glob('*.java'))
    if not executable('javac'):raise SystemExit('JDK ausente: compatibilidade não testada')
    with tempfile.TemporaryDirectory(prefix='meca-compat-') as d:
        compile_result=subprocess.run([executable('javac'),'-encoding','UTF-8','-d',d,*write_sdk(d),*[str(p) for p in files]],capture_output=True,text=True)
        if compile_result.returncode:raise AssertionError(compile_result.stderr)
    print(json.dumps({'compiled_against_simulated_sdk':[p.name for p in files]},ensure_ascii=False),flush=True)
    auto=Session({'duration':30})
    auto.run((base/'Autonomo/Autonomo35.java').read_text(encoding='utf-8'))
    wait_init(auto,start=False)
    deadline=time.monotonic()+3
    while 'Confirmado:' not in auto.telemetry and time.monotonic()<deadline:time.sleep(.01)
    auto.gamepads[0][9]=1  # Y: modo completo
    time.sleep(.25)
    auto.gamepads[0]=[0]*20
    auto.gamepads[0][6]=1  # A: confirma após selecionar
    time.sleep(.25)
    assert 'Confirmado: true' in auto.telemetry,auto.telemetry
    auto.gamepads[0]=[0]*20
    auto.started=True;auto.status='executando';auto.worker.join(35)
    if auto.worker.is_alive():auto.stop();auto.worker.join(2);raise AssertionError('Autonomo35 não encerrou')
    assert auto.status=='concluído',auto.logs
    assert 'concluido' in auto.telemetry.lower(),auto.telemetry
    assert all(m.power==0 for m in auto.world.motors.values())
    result=auto.snapshot();result.pop('trail');print(json.dumps({'Autonomo35':result},ensure_ascii=False),flush=True)
    # Mistura histórica é testada como está, com hipótese de montagem explícita.
    # Aguarde um resultado observável, não uma quantidade fixa de tempo de parede.
    # No Windows, a compilação/inicialização da JVM e a rampa do TeleOp podem
    # consumir parte dos 350 ms sem avançar o relógio físico da simulação.
    tele=Session({'duration':10,'invert_left':True,'invert_right':True})
    try:
        tele.run((base/'teleOp/TeleOp13.java').read_text(encoding='utf-8'))
        wait_init(tele)
        start_y=tele.world.y
        tele.gamepads[0][1]=-.6
        deadline=time.monotonic()+5
        while tele.world.y<=start_y+.01 and time.monotonic()<deadline:
            if tele.status in ('erro','parado','concluído'):
                raise AssertionError({'reason':'TeleOp terminou antes de avançar',
                                      'state':tele.snapshot()})
            time.sleep(.02)
        forward=tele.snapshot()
        assert forward['y']>start_y+.01,{'reason':'Sem deslocamento após 5 s',
                                        'state':forward}
        assert abs(forward['yaw'])<5,{'reason':'Desvio indevido de rumo',
                                      'state':forward}
        assert any(abs(m['encoder'])>=5 for m in forward['motors'].values()),forward

        tele.gamepads[0]=[0]*20
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            if all(abs(tele.world.motors[k].power)<.01 for k in ('ME','MD')):
                break
            time.sleep(.02)
        neutral=tele.snapshot()
        assert all(abs(neutral['motors'][k]['power'])<.01 for k in ('ME','MD')),{
            'reason':'Comando neutro não zerou motores','state':neutral}
        print(json.dumps({'TeleOp13':'avanço físico, encoders, rumo e rampa de neutralização passaram',
                          'start_y':start_y,'end_y':forward['y'],
                          'sim_time':forward['time'],
                          'mount_hypothesis':'ambos lados invertidos; não aferido no robô'},
                         ensure_ascii=False),flush=True)
    finally:
        tele.stop()
        if tele.worker:tele.worker.join(5)
    assert not tele.worker.is_alive(), 'JVM não encerrou após STOP'
    assert all(m.power==0 for m in tele.world.motors.values()),tele.snapshot()

if __name__=='__main__':main()
