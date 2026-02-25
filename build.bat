@echo off
setlocal
cd /d "%~dp0"

echo Building HoloVox.exe with Nuitka...
echo.
echo Note: Nuitka with Python 3.13 requires either:
echo   - Visual Studio Build Tools (MSVC), or
echo   - Python 3.12 (MinGW works with 3.12)
echo.

python -m nuitka --standalone --assume-yes-for-downloads ^
  --output-dir=dist ^
  --output-filename=HoloVox.exe ^
  --include-data-dir=ui=ui ^
  --include-data-dir=Assets=Assets ^
  --windows-console-mode=disable ^
  --enable-plugin=pywebview ^
  app.py

if %ERRORLEVEL% EQU 0 (
  echo.
  echo Build succeeded. Exe: dist\app.dist\HoloVox.exe
  if exist "dist\app.dist\HoloVox.exe" start "" "dist\app.dist"
) else (
  echo.
  echo Build failed. If you see "MinGW64 is not currently supported with Python 3.13",
  echo use Python 3.12 for this project or install Visual Studio Build Tools.
)

endlocal
