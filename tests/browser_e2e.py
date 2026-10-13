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
        assert page.locator('#diagnostic-panel').count()==1
        page.locator('[data-tab="robot"]').click()
        assert page.locator('#walls').is_checked() and page.locator('#walls').is_disabled()
        page.locator('#match-mode').select_option('teleop')
        assert page.locator('#duration').input_value()=='120'
        page.locator('#timer-enabled').uncheck()
        assert page.locator('#clear-shots').count()==1
        page.locator('[data-tab="code"]').click()
        passed('Interface inicial, exemplos e canvas carregados')
        assert page.locator('#arena').input_value() in ('biobuzz','livre')
        page.locator('#arena').select_option('livre')
        page.locator('#pick-start').click()
        box=page.locator('#top').bounding_box()
        page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
        page.wait_for_function("document.querySelector('#pick-start').getAttribute('aria-pressed')==='false'")
        x=float(page.locator('#x').input_value());y=float(page.locator('#y').input_value())
        assert abs(x-1.83)<.08 and abs(y-1.83)<.08,(x,y)
        page.once('dialog',lambda d:d.accept('Teste biblioteca FTC'))
        page.locator('#save-library').click()
        page.wait_for_function("Array.from(document.querySelector('#example').options).some(o=>o.textContent==='Teste biblioteca FTC')")
        page.locator('#arena').select_option('biobuzz')
        page.locator('#example').select_option(label='Teste biblioteca FTC')
        page.wait_for_function("document.querySelector('#arena').value==='livre'")
        assert abs(float(page.locator('#x').input_value())-x)<.001
        page.locator('#arena').select_option('biobuzz')
        passed('Biblioteca: projeto salvo no menu e arena/partida restauradas')
        page.locator('[data-tab="launcher"]').click()
        page.locator('#solve-shot').click()
        page.wait_for_function("document.querySelector('#message').textContent.includes('calculada')")
        assert float(page.locator('#speed').input_value())>0
        assert float(page.locator('#force').input_value())>0
        assert 'SIM' in page.locator('#shot-verdict').text_content(),page.locator('#shot-verdict').text_content()
        page.locator('#force').fill('0.2')
        page.wait_for_function("document.querySelector('#shot-verdict').dataset.possible==='no'")
        page.locator('#force').fill('6.4')
        page.locator('#shot-mode').select_option('speed')
        assert page.locator('#speed').get_attribute('readonly') is None
        page.locator('#speed').fill('5')
        page.locator('#shot-mode').select_option('force')
        assert page.locator('#speed').get_attribute('readonly') is not None
        page.locator('#solve-shot').click()
        page.wait_for_function("document.querySelector('#shot-verdict').dataset.possible==='yes'")
        page.locator('#shoot').click()
        passed('Força, velocidade, ângulo, mira e parabola com veredito atualizam')
        page.locator('[data-tab="robot"]').click()
        page.locator('summary').filter(has_text='Calcular ticks').click()
        page.locator('#calc-encoder').click()
        assert abs(float(page.locator('#ticks_per_m').input_value())-1980.594847)<1e-6
        passed('Calculadora de encoders aplicada')
        page.locator('[data-tab="code"]').click()
        page.locator('#ds-init').click()
        page.wait_for_function("document.querySelector('#status').textContent==='inicializando'",timeout=30000)
        assert page.locator('#ds-start').is_enabled()
        page.locator('#ds-start').click()
        page.wait_for_function("document.querySelector('#status').textContent==='concluído'",timeout=30000)
        result=page.request.get(f'http://127.0.0.1:{port}/api/state').json()
        # E2E cruza ticks da JVM, servidor e navegador. O erro angular final
        # pode diferir ligeiramente após zerar potência; não é ensaio de PID físico.
        assert abs(result['yaw']-50)<2.5,{'yaw':result['yaw'],'time':result['time'],'telemetry':result['telemetry']}
        assert all(m['power']==0 for m in result['motors'].values())
        assert 'CONCLUÍDO' in page.locator('#ds-state').text_content().upper()
        passed('Autônomo real via INIT/START/Driver Station concluiu e zerou motores')
        page.locator('#timeline-panel summary').click()
        page.locator('#timeline-load').click()
        page.wait_for_function("!document.querySelector('#timeline-range').disabled")
        assert int(page.locator('#timeline-range').get_attribute('max'))>8
        page.locator('#timeline-range').evaluate("(el)=>{el.value='5';el.dispatchEvent(new Event('input',{bubbles:true}));}")
        assert 't=' in page.locator('#timeline-info').text_content()
        page.locator('#timeline-play').click()
        page.wait_for_timeout(200)
        page.locator('#timeline-play').click()
        page.locator('#timeline-exit').click()
        assert page.locator('#timeline-range').is_disabled()
        passed('Replay: scrub, reprodução, pausa e retorno à pose real')
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
        page.locator('#route-panel summary').click()
        page.locator('#route-add').click()
        rect=page.locator('#top').bounding_box()
        page.mouse.click(rect['x']+rect['width']/2+60,rect['y']+rect['height']/2-60)
        assert page.locator('#route-list li').count()==1
        page.once('dialog',lambda d:d.accept())
        page.locator('#route-code').click()
        page.wait_for_function("document.querySelector('#source').value.includes('RotaMecaSim')")
        page.locator('#compile').click()
        page.wait_for_function("['inicializando','erro'].includes(document.querySelector('#status').textContent)",timeout=30000)
        assert page.locator('#status').text_content()=='inicializando', {
            'logs':page.locator('#logs').text_content()[-2500:],
            'message':page.locator('#message').text_content(),
            'source':page.locator('#source').input_value()[-900:]}
        page.locator('#stop').click()
        page.wait_for_function("document.querySelector('#status').textContent==='parado'")
        passed('Editor de waypoints gera Java e compila contra SDK parcial')
        page.locator('#source').fill('public class Bad extends LinearOpMode { broken }')
        page.locator('#compile').click()
        page.wait_for_function("document.querySelector('#status').textContent==='erro'",timeout=30000)
        assert 'error:' in page.locator('#logs').text_content()
        page.wait_for_function("document.querySelectorAll('#code-errors button').length>0",timeout=10000)
        assert 'error:' in page.locator('#logs').text_content()
        passed('Erro do javac exibido e navegável no editor')
        page.locator('#reset').click()
        page.wait_for_function("document.querySelector('#status').textContent==='pronto'")
        page.locator('#source').fill('setPow')
        assert page.locator('#code-suggest button').filter(has_text='setPower').count()>0
        page.locator('#code-suggest button').filter(has_text='setPower').first.click()
        assert page.locator('#source').input_value()=='setPower'
        passed('Autocomplete offline concluiu símbolo Java')
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
