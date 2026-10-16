"""Smoke test do EXE PyInstaller, executado no Windows Actions."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

if len(sys.argv) != 2:
    raise SystemExit("Uso: python tests/packaged_smoke.py dist/MecaSim.exe")
exe = Path(sys.argv[1]).resolve()
if not exe.is_file():
    raise SystemExit(f"Executável não encontrado: {exe}")
env = {**os.environ, "SIM_PORT": "8893"}
process = subprocess.Popen([str(exe)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
try:
    for attempt in range(120):
        if process.poll() is not None:
            raise AssertionError(f"MecaSim.exe encerrou com código {process.returncode}")
        try:
            with urlopen("http://127.0.0.1:8893/api/state", timeout=.7) as response:
                state = json.load(response)
            with urlopen("http://127.0.0.1:8893/", timeout=.7) as response:
                html = response.read().decode("utf-8")
            with urlopen("http://127.0.0.1:8893/examples", timeout=.7) as response:
                examples = json.load(response)
            for resource in ('/arena.mjs','/editor.mjs','/route.mjs'):
                with urlopen("http://127.0.0.1:8893"+resource,timeout=.7) as response:
                    assert response.status==200
            assert state['status'] == 'pronto'
            assert 'Meca Sim' in html and len(examples) >= 2
            assert state['build'] == 'partida-integrada-20261016'
            assert state['inventory'] == {'POLLEN': 4, 'NECTAR': 0}
            assert len(state['inventory_ids']) == 4 and len(state['elements']) == 56
            assert state['hives']['red']['NECTAR'] == 3
            assert state['hives']['red']['load'] == 4
            assert 'id="controls-panel"' in html and 'id="load-teleop"' in html
            teleop = examples['TeleOp · gamepad / teclado']
            assert 'MI.setPower' in teleop and 'MS.setPower' in teleop
            assert 'gamepad1.left_bumper' in teleop and 'gamepad1.right_bumper' in teleop
            print('PASS: EXE contém build integrado, inventário, HIVE ponderado, painel Controles e TeleOp MI/MS')
            break
        except OSError:
            time.sleep(.25)
    else:
        raise AssertionError("Executável não respondeu no localhost")
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
