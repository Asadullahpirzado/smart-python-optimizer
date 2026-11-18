@echo off
cd /d %~dp0
set "PYCMD=python"
python --version >nul 2>&1
if errorlevel 1 (
    py --version >nul 2>&1
    if not errorlevel 1 (
        set "PYCMD=py"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" (
        set "PYCMD="%LOCALAPPDATA%\Programs\Python\Python314\python.exe""
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
        set "PYCMD="%LOCALAPPDATA%\Programs\Python\Python313\python.exe""
    )
)
echo Starting Smart Python Optimizer...
%PYCMD% -m pip install -r requirements.txt -q 2>nul
%PYCMD% app.py
if errorlevel 1 pause
