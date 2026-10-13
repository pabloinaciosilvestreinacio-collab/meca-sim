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
            for resource in ('/arena.mjs','/editor.mjs'):
                with urlopen("http://127.0.0.1:8893"+resource,timeout=.7) as response:
                    assert response.status==200
            assert state['status'] == 'pronto'
            assert 'Meca Sim' in html and len(examples) >= 2
            print('PASS: MecaSim.exe iniciou servidor, interface e exemplos')
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
