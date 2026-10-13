@echo off
setlocal
cd /d "%~dp0"
title MecaSim 0.3 RC - Diagnostico e Teste
echo.
echo === MecaSim - Teste local ===
if not exist "MecaSim.exe" (
  echo ERRO: MecaSim.exe nao encontrado nesta pasta.
  echo Extraia todos os arquivos do pacote ZIP antes de iniciar.
  pause
  exit /b 1
)
echo Verificando Java e salvando mecasim-diagnostico.txt ...
"MecaSim.exe" --diagnostico > "mecasim-diagnostico.txt" 2>&1
if errorlevel 1 (
  echo ERRO na verificacao do JDK:
  type "mecasim-diagnostico.txt"
  echo Leia TESTE_AMANHA.md para resolver a dependencia.
  pause
  exit /b 1
)
type "mecasim-diagnostico.txt"
echo.
echo Iniciando MecaSim em http://127.0.0.1:8765
echo Mantenha esta janela aberta durante o teste.
"MecaSim.exe"
echo.
echo MecaSim encerrado. O diagnostico permanece salvo em mecasim-diagnostico.txt.
pause
