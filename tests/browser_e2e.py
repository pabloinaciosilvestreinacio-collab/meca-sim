"""Integração em Chromium real: servidor, JVM e interface. Executada pela CI."""
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
port=8879
process=subprocess.Popen([sys.executable,str(ROOT/'server.py')],env={**os.environ,'SIM_PORT':str(port)},stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
checks=[]
def passed(text):
    checks.append(text);print('PASS:',text,flush=True)
try:
    deadline=time.monotonic()+15
    while time.monotonic()<deadline:
        try:
            with urlopen(f'http://127.0.0.1:{port}/api/state',timeout=1):break
        except OSError:time.sleep(.1)
    else:raise AssertionError('Servidor não iniciou')
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_page(viewport={'width':1440,'height':1100})
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}')
        page.locator('#source').wait_for()
        page.wait_for_function("document.querySelector('#source').value.includes('LinearOpMode')")
        assert page.locator('#top').evaluate('(e)=>e.width>0 && e.height>0')
        passed('Interface inicial, exemplos e canvas carregados')
        page.locator('[data-tab="launcher"]').click()
        page.locator('#solve-shot').click()
        page.wait_for_function("document.querySelector('#message').textContent.includes('calculada')")
        assert float(page.locator('#speed').input_value())>0
        page.locator('#shoot').click()
        passed('Solução balística e animação sem exceção')
        page.locator('[data-tab="robot"]').click()
        page.locator('summary').filter(has_text='Calcular ticks').click()
        page.locator('#calc-encoder').click()
        assert abs(float(page.locator('#ticks_per_m').input_value())-1980.594847)<1e-6
        passed('Calculadora de encoders aplicada')
        page.locator('[data-tab="code"]').click()
        page.locator('#compile').click()
        page.wait_for_function("document.querySelector('#status').textContent==='inicializando'",timeout=30000)
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#status').textContent==='concluído'",timeout=30000)
        result=page.request.get(f'http://127.0.0.1:{port}/api/state').json()
        assert abs(result['yaw']-50)<1.5,result
        assert all(m['power']==0 for m in result['motors'].values())
        passed('Autônomo real via INIT/START concluiu em duas vistas e zerou motores')
        with page.expect_download() as out:page.locator('#csv').click()
        csv=out.value.path().read_text() if isinstance(out.value.path(),Path) else Path(out.value.path()).read_text()
        assert 'time_s,x_m,y_m,yaw_deg' in csv and len(csv.splitlines())>10
        passed('Exportação CSV contém trajetória temporal')
        with page.expect_download() as out:page.locator('#save-project').click()
        project=Path(out.value.path());data=json.loads(project.read_text());assert data['version']==2
        page.locator('#source').fill('alterado')
        page.locator('#load-project').set_input_files(str(project))
        page.wait_for_function("document.querySelector('#source').value.includes('LinearOpMode')")
        passed('Salvar e reabrir projeto restaura o código')
        with tempfile.TemporaryDirectory() as folder:
            main=Path(folder)/'MultiBrowser.java'
            helper=Path(folder)/'AuxiliarBrowser.java'
            main.write_text("""package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import org.firstinspires.ftc.teamcode.util.AuxiliarBrowser;
public class MultiBrowser extends LinearOpMode {
    public void runOpMode() { waitForStart(); telemetry.addLine(AuxiliarBrowser.mensagem()); telemetry.update(); }
}""",encoding='utf-8')
            helper.write_text("""package org.firstinspires.ftc.teamcode.util;
public class AuxiliarBrowser {
    public static String mensagem() { return "Importacao multipla OK"; }
}""",encoding='utf-8')
            page.locator('#import-java').set_input_files([str(main),str(helper)])
            page.wait_for_function("document.querySelector('#source').value.includes('MultiBrowser')")
            assert '1 arquivo(s)' in page.locator('#java-file-count').text_content()
            page.locator('#compile').click()
            page.wait_for_function("document.querySelector('#status').textContent==='inicializando'",timeout=30000)
            page.locator('#start').click()
            page.wait_for_function("document.querySelector('#status').textContent==='concluído'",timeout=30000)
            assert 'Importacao multipla OK' in page.locator('#telemetry').text_content()
            with page.expect_download() as out:page.locator('#save-project').click()
            saved=json.loads(Path(out.value.path()).read_text(encoding='utf-8'))
            assert len(saved['files'])==1
            passed('OpMode e auxiliar importados, compilados e salvos em JSON')
        import io,zipfile,base64
        with tempfile.TemporaryDirectory() as folder:
            archive=Path(folder)/'TeamCode.zip'
            with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as stream:
                stream.writestr('FTC/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/ZipDemo.java',
                  """package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
public class ZipDemo extends LinearOpMode {
  public void runOpMode() { waitForStart(); telemetry.addLine("ZIP FTC OK"); telemetry.update(); }
}""")
                stream.writestr('FTC/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/ZipOutro.java',
                  """package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
public class ZipOutro extends LinearOpMode {
  public void runOpMode() { waitForStart(); telemetry.addLine("OUTRO OK"); telemetry.update(); }
}""")
            page.locator('#import-zip').set_input_files(str(archive))
            page.wait_for_function("document.querySelector('#source').value.includes('ZipDemo')")
            assert page.locator('#opmode-choice option').count()==2
            page.locator('#opmode-choice').select_option(label='ZipOutro — org/firstinspires/ftc/teamcode/ZipOutro.java')
            assert 'ZipOutro' in page.locator('#source').input_value()
            page.locator('#compile').click()
            page.wait_for_function("document.querySelector('#status').textContent==='inicializando'",timeout=30000)
            page.locator('#start').click()
            page.wait_for_function("document.querySelector('#status').textContent==='concluído'",timeout=30000)
            assert 'OUTRO OK' in page.locator('#telemetry').text_content()
            with page.expect_download() as out:page.locator('#save-project').click()
            saved_zip=Path(out.value.path())
            assert len(json.loads(saved_zip.read_text(encoding='utf-8'))['files'])==1
            page.locator('#load-project').set_input_files(str(saved_zip))
            page.wait_for_function("document.querySelector('#opmode-choice').options.length===2")
            page.locator('#opmode-choice').select_option(label='ZipDemo — org/firstinspires/ftc/teamcode/ZipDemo.java')
            assert 'ZipDemo' in page.locator('#source').input_value()
            passed('ZIP TeamCode seleciona OpMode, compila, executa e restaura opções ao reabrir JSON')
        options=page.locator('#example option').all_text_contents()
        tele=next(x for x in options if 'TeleOp' in x)
        page.locator('#example').select_option(label=tele)
        page.locator('#compile').click()
        page.wait_for_function("document.querySelector('#status').textContent==='inicializando'",timeout=30000)
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#status').textContent==='executando'")
        page.keyboard.down('w')
        page.wait_for_function("parseFloat(document.querySelector('#py').textContent)>.72",timeout=10000)
        page.keyboard.up('w')
        page.locator('#stop').click()
        page.wait_for_function("document.querySelector('#status').textContent==='parado'")
        result=page.request.get(f'http://127.0.0.1:{port}/api/state').json()
        assert all(m['power']==0 for m in result['motors'].values())
        passed('TeleOp: teclado movimenta e STOP encerra JVM')
        page.locator('#source').fill('public class Bad extends LinearOpMode { broken }')
        page.locator('#compile').click()
        page.wait_for_function("document.querySelector('#status').textContent==='erro'",timeout=30000)
        assert 'error:' in page.locator('#logs').text_content()
        passed('Erro de compilação visível')
        page.locator('#reset').click()
        page.wait_for_function("document.querySelector('#status').textContent==='pronto'")
        page.locator('#example').select_option(label=options[1])
        (ROOT/'reports').mkdir(exist_ok=True)
        page.screenshot(path=str(ROOT/'reports/interface-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Overflow horizontal em celular'
        page.screenshot(path=str(ROOT/'reports/interface-mobile.png'),full_page=True)
        assert not errors,errors
        passed('Desktop/celular sem overflow horizontal ou erros JavaScript')
        browser.close()
finally:
    process.terminate()
    try:process.wait(5)
    except subprocess.TimeoutExpired:process.kill();process.wait()
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/browser-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
