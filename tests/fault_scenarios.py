"""Cenários sintéticos sobre o Autonomo35 original, sem alterar suas constantes."""
import json
from pathlib import Path
import time
from repository_compatibility import wait_init
from server import Session

ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'tests/fixtures/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Autonomo/Autonomo35.java').read_text(encoding='utf-8')
results=[]
for name,config in [('encoder esquerdo travado',{'left_encoder_frozen':True}),('IMU travada',{'imu_frozen':True}),('motor direito sem resposta',{'right_gain':0})]:
    s=Session({'duration':30,**config})
    try:
        s.run(source);wait_init(s,start=False)
        end=time.monotonic()+4
        while 'Confirmado:' not in s.telemetry and time.monotonic()<end:time.sleep(.01)
        s.gamepads[0][9]=1;time.sleep(.25)
        s.gamepads[0]=[0]*20;s.gamepads[0][6]=1;time.sleep(.25)
        assert 'Confirmado: true' in s.telemetry,s.telemetry
        s.gamepads[0]=[0]*20;s.started=True;s.status='executando';s.worker.join(32)
        assert not s.worker.is_alive(),name
        assert all(m.power==0 for m in s.world.motors.values()),name
        assert 'interrompido' in s.telemetry.lower(),s.telemetry
        result={'scenario':name,'status':s.status,'seconds':round(s.world.elapsed,3),'telemetry':s.telemetry,'motors_zero':True}
        results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
    finally:
        s.stop()
        if s.worker:s.worker.join(3)
(ROOT/'reports').mkdir(exist_ok=True)
(ROOT/'reports/fault-scenarios.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
