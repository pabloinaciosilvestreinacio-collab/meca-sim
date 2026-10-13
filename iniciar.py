"""Verifica dependências antes de abrir o servidor local."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import webbrowser

def locate_jdk():
    home=os.environ.get('JAVA_HOME')
    candidates=[Path(home)] if home else []
    if os.name=='nt':
        program=Path(os.environ.get('ProgramFiles',r'C:\Program Files'))
        candidates += [program/'Android/Android Studio/jbr']
        for vendor in ('Eclipse Adoptium','Java','Microsoft'):
            candidates+=sorted((program/vendor).glob('*'),reverse=True)
    candidates += [Path('/usr/lib/jvm/java-17-openjdk-amd64')]
    suffix='.exe' if os.name=='nt' else ''
    for candidate in candidates:
        if all((candidate/'bin'/(name+suffix)).is_file() for name in ('java','javac')):
            os.environ['JAVA_HOME']=str(candidate);return

def main():
    if sys.version_info<(3,10):raise RuntimeError('Instale Python 3.10 ou superior.')
    locate_jdk()
    from server import executable, main as serve
    for name in ('java','javac'):
        command=executable(name)
        if not command:raise RuntimeError('JDK não encontrado. Instale JDK 17+ ou configure JAVA_HOME para a pasta jbr do Android Studio.')
        result=subprocess.run([command,'-version'],capture_output=True,text=True,timeout=45)
        text=result.stdout+result.stderr
        version=re.search(r'(?:version\s+")?(\d+)\.',text)
        if result.returncode or not version or int(version.group(1))<17:raise RuntimeError(f'{name}: JDK 17+ funcional é necessário.\n{text}')
        print(text.splitlines()[0])
    if '--diagnostico' in sys.argv:
        print('Python e JDK disponíveis. Diagnóstico concluído.');return
    port=int(os.environ.get('SIM_PORT','8765'))
    timer=threading.Timer(1,lambda:webbrowser.open(f'http://127.0.0.1:{port}'));timer.daemon=True;timer.start()
    serve()

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('\nNão foi possível iniciar:',error,file=sys.stderr);sys.exit(1)
