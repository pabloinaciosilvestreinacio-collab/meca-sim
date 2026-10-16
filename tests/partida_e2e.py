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

def stop(page, report_check=False):
    page.locator('#ds-stop').click()
    wait_state(page,"s.status==='parado'")
    page.wait_for_function("!document.querySelector('#final-report').hidden")
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
    page.locator('#dismiss-report').click()

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
        fell=wait_state(page,"s.hives.red.tips===1 && s.elements.filter(p=>p.status==='falling').length===7")
        assert {p['id'] for p in fell['elements'] if p['status']=='falling'}==preloads|nectar
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
        browser.close()
finally:
    process.terminate()
    try:process.wait(5)
    except subprocess.TimeoutExpired:process.kill();process.wait()
    (REPORTS/'partida-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
