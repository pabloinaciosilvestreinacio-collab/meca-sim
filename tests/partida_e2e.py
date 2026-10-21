"""Partida real em Chromium/JVM: teclas -> OpMode -> física -> inventário -> tela."""
from pathlib import Path
import json
import os
import subprocess
import sys
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PORT=8881
URL=f'http://127.0.0.1:{PORT}'
REPORTS=ROOT/'reports'
REPORTS.mkdir(exist_ok=True)
checks=[]
process=subprocess.Popen([sys.executable,str(ROOT/'server.py')],env={**os.environ,'SIM_PORT':str(PORT)},stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)

def passed(message):
    checks.append(message);print('PASS:',message,flush=True)

def state(page): return page.request.get(URL+'/api/state').json()

def wait_state(page, expression, timeout=15000):
    deadline=time.monotonic()+timeout/1000
    while time.monotonic()<deadline:
        # evaluate aguarda a Promise e devolve exatamente o snapshot aprovado.
        # wait_for_function com predicado async podia resolver antes da condição.
        found=page.evaluate('async()=>{const s=await (await fetch("/api/state")).json();return ('+expression+') ? s : null;}')
        if found is not None:
            return found
        page.wait_for_timeout(50)
    raise AssertionError({'condition':expression,'state':state(page),'message':page.locator('#message').text_content()})

def conservation(s):
    assert len(s['elements'])==len({p['id'] for p in s['elements']})==56
    assert sum(p['kind']=='POLLEN' for p in s['elements'])==40
    assert sum(p['kind']=='NECTAR' for p in s['elements'])==16
    assert set(s['inventory_ids'])=={p['id'] for p in s['elements'] if p['status']=='robot'}

def start(page):
    page.locator('#ds-init').click()
    wait_state(page,"s.status==='inicializando'",45000)
    page.wait_for_function("!document.querySelector('#ds-start').disabled")
    page.locator('#ds-start').click()
    wait_state(page,"s.status==='executando'")
    page.locator('#top').focus()

def stop(page, report_check=False, rules_check=False, dismiss=True, previous_report=None):
    page.locator('#ds-stop').click()
    wait_state(page,"s.status==='parado'")
    page.wait_for_function("!document.querySelector('#final-report').hidden")
    if previous_report is not None:
        page.wait_for_function("previous=>JSON.parse(localStorage.getItem('meca-sim-final-report-v1'))?.endedAt!==previous",arg=previous_report)
    if rules_check:
        report=page.evaluate("JSON.parse(localStorage.getItem('meca-sim-final-report-v1'))")
        assert report['ruleStatus']['profile']['mode']=='custom'
        assert report['ruleStatus']['phase']=='teleop'
        assert report['ruleStatus']['remaining_seconds'] is None
        assert len([e for e in report['ruleStatus']['events'] if e['type']=='phase_changed'])==2
        assert 'Personalizado' in page.locator('#report-summary').text_content()
    if report_check:
        report=page.evaluate("JSON.parse(localStorage.getItem('meca-sim-final-report-v1'))")
        assert report['activity']['hits']==4 and report['activity']['misses']==0
        assert report['activity']['pending']==0 and report['activity']['emptyFeedAttempts']>0
        assert 'undefined' not in page.locator('#report-summary').text_content()
        with page.expect_download() as download: page.locator('#report-csv').click()
        csv=Path(download.value.path()).read_text(encoding='utf-8')
        assert 'activity.emptyFeedAttempts' in csv and 'estimatedPoints.hive_elements' in csv
        assert 'undefined' not in csv
        page.reload()
        page.wait_for_function("!document.querySelector('#final-report').hidden")
        assert 'Acertos no HIVE: 4' in page.locator('#report-summary').text_content()
        passed('Relatório: contadores reais, categorias no CSV e persistência após recarregar')
    result=page.evaluate("JSON.parse(localStorage.getItem('meca-sim-final-report-v1'))")
    if dismiss: page.locator('#dismiss-report').click()
    return result

try:
    deadline=time.monotonic()+20
    while time.monotonic()<deadline:
        try:
            with urlopen(URL+'/api/state',timeout=1): break
        except OSError:time.sleep(.1)
    else:raise AssertionError('Servidor não iniciou')
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        page=browser.new_page(viewport={'width':1440,'height':1100})
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(URL)
        page.wait_for_function("document.querySelector('#source').value.includes('MI.setPower')")
        page.wait_for_function("document.querySelector('#control-actions').textContent.includes('coleta com MI')")
        assert 'z (LB)' in page.locator('#control-actions').text_content()
        assert 'c (RB)' in page.locator('#control-actions').text_content()
        assert 'partida-integrada-20261016' in page.locator('#build-id').text_content()
        # Configuração Mecanum persistida não pode quebrar o TeleOp inicial ME/MD.
        page.locator('[data-tab="robot"]').click()
        page.locator('#drivetrain').select_option('mecanum')
        page.reload()
        page.wait_for_function("document.querySelector('#source').value.includes('MI.setPower')")
        page.locator('#ds-init').click()
        configured=wait_state(page,"s.status==='inicializando'",45000)
        assert {'ME','MD','MI','MS'}<=set(configured['motors'])
        assert 'Diferencial, ME/MD' in page.locator('#message').text_content()
        page.locator('#ds-stop').click()
        wait_state(page,"s.status==='parado'")
        passed('TeleOp inicial recupera chassi ME/MD mesmo com Mecanum salvo no navegador')
        page.locator('[data-tab="launcher"]').click()
        # Cenário do usuário: nenhum ajuste de mira; o pacote abre e o Java dispara.
        page.wait_for_function("document.querySelector('#shot-verdict').dataset.possible==='yes'")
        start(page)
        page.keyboard.down('c')
        default_tip=wait_state(page,"s.hives.red.tips===1 && s.elements.filter(p=>(p.status==='falling'||p.status==='field') && (p.id.startsWith('nectar-hive-red')||p.id.startsWith('pollen-preload-red-0'))).length===7")
        conservation(default_tip)
        assert default_tip['launcher_status']['hits']==4
        assert default_tip['inventory']=={'POLLEN':0,'NECTAR':0}
        assert default_tip['launcher_config']['azimuth']==29.82
        assert all(entry['azimuth']==29.82 for entry in default_tip['launches'])
        page.screenshot(path=str(REPORTS/'partida-00-padrao-hive-tombado.png'),full_page=True)
        page.keyboard.up('c')
        passed('Sem ajustar a mira: TeleOp inicial lança os 4 preloads, HIVE tomba e os mesmos 7 IDs caem')
        stop(page,dismiss=False)
        previous=page.evaluate("JSON.parse(localStorage.getItem('meca-sim-final-report-v1')).endedAt")
        page.reload()
        page.wait_for_function("!document.querySelector('#final-report').hidden")
        start(page)
        page.wait_for_timeout(300)
        next_report=stop(page,previous_report=previous)
        assert next_report['endedAt']!=previous
        assert page.evaluate("localStorage.getItem('meca-sim-final-report-v1')") is None
        passed('Relatório salvo não bloqueia INIT/START; nova execução substitui o relatório ao terminar')
        page.locator('[data-tab="launcher"]').click()
        page.locator('#solve-shot').click()
        page.wait_for_function("document.querySelector('#shot-verdict').dataset.possible==='yes'")
        start(page)
        initial=state(page);conservation(initial)
        preloads=set(initial['inventory_ids'])
        nectar={p['id'] for p in initial['elements'] if p['location']=='red-lower'}
        assert len(preloads)==4 and len(nectar)==3
        page.screenshot(path=str(REPORTS/'partida-01-preloads.png'),full_page=True)
        # Não há chamadas para alterar motores/estoque: só teclado real do navegador.
        page.keyboard.down('c')
        first=wait_state(page,"s.inventory.POLLEN===3 && s.launcher_status.launch_count===1")
        conservation(first)
        page.wait_for_function("document.querySelector('#inventory').textContent.includes('POLLEN 3')")
        assert first['motors']['MI']['power']==first['motors']['MS']['power']==1, {'state':first,'errors':errors}
        assert first['launches'][0]['piece_id'] in preloads
        fell=wait_state(page,"s.hives.red.tips===1 && s.elements.filter(p=>(p.status==='falling'||p.status==='field') && (p.id.startsWith('nectar-hive-red')||p.id.startsWith('pollen-preload-red-0'))).length===7")
        assert {p['id'] for p in fell['elements'] if p['status'] in ('falling','field') and p['id'] in preloads|nectar}==preloads|nectar
        conservation(fell)
        page.screenshot(path=str(REPORTS/'partida-02-queda.png'),full_page=True)
        floor=wait_state(page,"s.hives.red.tips===1 && s.elements.filter(p=>p.status==='field' && (p.id.startsWith('nectar-hive-red')||p.id.startsWith('pollen-preload-red-0'))).length===7")
        page.wait_for_timeout(900)
        page.keyboard.up('c')
        empty=wait_state(page,"s.motors.MI.power===0 && s.motors.MS.power===0")
        assert empty['launcher_status']['launch_count']==4
        assert empty['inventory']=={'POLLEN':0,'NECTAR':0}
        assert empty['launcher_status']['empty_feed_attempts']>0
        page.wait_for_function("document.querySelector('#inventory').textContent.includes('POLLEN 0')")
        assert page.locator('#inventory-pieces').text_content()=='Armazenamento: vazio'
        assert not errors,errors
        passed('Java/teclado: 4 preloads diminuem 4→3→0; 3 NECTAR + 4 POLLEN tombam e os mesmos 7 IDs caem; estoque vazio não lança')
        stop(page, report_check=True)
        # Coletar as quatro peças de FLOWER usando deslocamento Java e MI.
        page.locator('[data-tab="robot"]').click()
        for key,value in {'x':'0.8','y':'1.82','initial-yaw':'90','max_speed':'0.4'}.items():page.locator('#'+key).fill(value)
        page.locator('[data-tab="launcher"]').click()
        page.locator('#shot-mode').select_option('speed')
        for key,value in {'azimuth':'180','speed':'5','elevation':'30'}.items():page.locator('#'+key).fill(value)
        start(page)
        page.keyboard.down('c')
        wait_state(page,"s.inventory.POLLEN===0")
        page.keyboard.up('c')
        wait_state(page,"s.motors.MI.power===0 && s.motors.MS.power===0")
        page.keyboard.down('z');page.keyboard.down('w')
        collected=wait_state(page,"s.intake.collected>=4")
        page.keyboard.up('w');page.keyboard.up('z')
        settled=wait_state(page,"s.motors.MI.power===0 && s.motors.ME.power===0")
        conservation(settled)
        flower={f'pollen-flower-0-{n}' for n in range(4)}
        assert set(settled['inventory_ids'])==flower,settled['inventory_ids']
        assert all(p['status']=='robot' for p in settled['elements'] if p['id'] in flower)
        page.wait_for_function("document.querySelector('#inventory-pieces').textContent.includes('pollen-flower-0-3')")
        page.screenshot(path=str(REPORTS/'partida-03-coleta.png'),full_page=True)
        page.keyboard.down('c')
        fired=wait_state(page,"s.launcher_status.launch_count===5 && s.inventory.POLLEN===3")
        page.keyboard.up('c')
        assert fired['launches'][-1]['piece_id'] in flower
        conservation(fired)
        assert not errors,errors
        passed('W+Z move e coleta 4 POLLEN da FLOWER via Java; deixam a arena e entram no robô; C lança o mesmo ID e reduz estoque')
        stop(page)
        # Com oito vagas, os quatro preloads não bloqueiam a coleta inicial.
        start(page)
        initial_loaded=state(page)
        assert len(initial_loaded['inventory_ids'])==4 and initial_loaded['intake']['capacity']==8
        page.keyboard.down('z');page.keyboard.down('w')
        with_preloads=wait_state(page,"s.intake.collected>=4 && s.inventory.POLLEN===8")
        page.keyboard.up('w');page.keyboard.up('z')
        conservation(with_preloads)
        assert all(p['status']=='robot' for p in with_preloads['elements'] if p['id'].startswith('pollen-flower-0-'))
        page.locator('[data-tab="launcher"]').click()
        page.locator('#azimuth').fill('0')
        updated=wait_state(page,"s.launcher_config.azimuth===0")
        assert updated['inventory']['POLLEN']==8
        page.locator('#top').focus();page.keyboard.down('c')
        fired=wait_state(page,"s.launcher_status.launch_count===1 && s.inventory.POLLEN===7")
        page.keyboard.up('c')
        assert fired['launches'][0]['azimuth']==0
        page.locator('#azimuth').fill('30')
        changed=wait_state(page,"s.launcher_config.azimuth===30")
        assert changed['inventory']['POLLEN']==7
        conservation(changed)
        passed('MI coleta com 4 preloads: 4→8; ajuste da mira durante Java altera os próximos tiros e não repõe estoque')
        stop(page)
        # Perfil personalizado: todos os pontos desligados, G426 ainda ativo.
        page.locator('[data-tab="robot"]').click()
        page.locator('#timer-enabled').uncheck()
        page.locator('[data-tab="rules"]').click()
        page.locator('#rules-mode').select_option('custom')
        for key in ('penalties', 'score-hive', 'score-flower', 'score-garden'):
            page.locator('#rule-'+key).uncheck()
        page.locator('#manual-phase').select_option('teleop')
        start(page)
        trained=wait_state(page,"s.rules.phase==='teleop' && s.rules.phase_source==='manual'")
        conservation(trained)
        assert trained['rules']['remaining_seconds'] is None
        assert trained['rules']['nectar_available']==0
        assert all(v['total']==0 for v in trained['scoring']['by_alliance'].values())
        page.locator('[data-tab="rules"]').click()
        page.wait_for_function("document.querySelector('#rules-mode').disabled")
        assert page.locator('#timer-enabled').is_disabled()
        assert page.locator('#restore-rules').is_disabled()
        page.locator('#manual-phase').select_option('endgame')
        page.locator('#apply-phase').click()
        late=wait_state(page,"s.rules.phase==='endgame' && s.rules.nectar_available===5")
        assert late['inventory_ids']==trained['inventory_ids']
        assert trained['time']<=late['time']<trained['time']+15  # Sem salto de 60/120 s.
        assert late['status']=='executando'
        page.wait_for_function("!document.querySelector('#introduce-nectar').disabled")
        page.locator('#introduce-nectar').click()
        wait_state(page,"s.rules.nectar_entered===1")
        page.locator('#manual-phase').select_option('teleop')
        page.locator('#apply-phase').click()
        early=wait_state(page,"s.rules.phase==='teleop' && s.rules.nectar_available===0 && s.elements.some(p=>p.id==='nectar-alliance-red-0' && p.status==='field')")
        conservation(early)
        assert early['inventory_ids']==trained['inventory_ids']
        assert early['rules']['nectar_entered']==1
        assert len([e for e in early['rules']['events'] if e['type']=='phase_changed'])==2
        page.screenshot(path=str(REPORTS/'partida-04-regras-fases.png'),full_page=True)
        stop(page, rules_check=True)
        assert early['rules']['profile']['mode']=='custom'
        passed('Regras: perfil fixo após INIT, fase manual sem reiniciar Java/estoque, G426 e peça liberada preservados')

        # Configuração acompanha JSON de projeto e recarga; restaurar não altera física.
        page.locator('#files-menu summary').click()
        with page.expect_download() as out: page.locator('#save-project').click()
        project_path=Path(out.value.path())
        project=json.loads(project_path.read_text(encoding='utf-8'))
        assert project['config']['rules-mode']=='custom'
        assert project['config']['manual-phase']=='teleop'
        assert project['config']['rule-penalties'] is False
        page.locator('#files-menu summary').click()
        page.locator('[data-tab="rules"]').click()
        page.wait_for_function("!document.querySelector('#restore-rules').disabled")
        page.locator('#restore-rules').click()
        assert page.locator('#rules-mode').input_value()=='official'
        for key in ('penalties','g410','nectar-release','score-hive','score-flower','score-garden'):
            assert page.locator('#rule-'+key).is_checked() and page.locator('#rule-'+key).is_disabled()
        page.locator('#load-project').set_input_files(str(project_path))
        page.wait_for_function("document.querySelector('#rules-mode').value==='custom'")
        assert not page.locator('#rule-penalties').is_checked()
        page.reload()
        page.wait_for_function("document.querySelector('#rules-mode').value==='custom'")
        page.locator('[data-tab="rules"]').click()
        assert not page.locator('#rule-penalties').is_checked()
        assert page.locator('#manual-phase').input_value()=='teleop'
        assert not page.locator('#timer-enabled').is_checked()
        # Restrição G426 desligada torna disponíveis exatamente cinco reservas.
        page.locator('#rule-nectar-release').uncheck()
        start(page)
        unrestricted=wait_state(page,"s.rules.profile['nectar-release']===false && s.rules.nectar_available===5")
        conservation(unrestricted)
        stop(page)
        # Projeto antigo não herda flags desligadas do projeto anterior.
        legacy={**project, 'config': {k:v for k,v in project['config'].items() if not k.startswith('rule') and k!='manual-phase'}}
        page.locator('#load-project').set_input_files({'name':'legacy.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
        page.wait_for_function("document.querySelector('#rules-mode').value==='official'")
        assert page.locator('#rule-penalties').is_checked()
        assert page.locator('#manual-phase').input_value()=='teleop'
        page.set_viewport_size({'width':390,'height':844})
        page.locator('[data-tab="rules"]').click()
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2')
        page.screenshot(path=str(REPORTS/'partida-05-regras-mobile.png'),full_page=True)
        assert not errors,errors
        passed('Regras: JSON e recarga preservam escolhas; restauração oficial e projetos antigos; G426 opcional; painel mobile')
        browser.close()
finally:
    process.terminate()
    try:process.wait(5)
    except subprocess.TimeoutExpired:process.kill();process.wait()
    (REPORTS/'partida-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
