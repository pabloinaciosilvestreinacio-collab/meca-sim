@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 iniciar.py
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo Instale Python 3.10 ou superior e marque Add Python to PATH.
        pause
        exit /b 1
    )
    python iniciar.py
)
pause
