@echo off
setlocal
title GCMBS - Atualizacao segura HF10 R15
cd /d "%~dp0"

echo ====================================================================
echo  GCMBS - RETORNO AO DESKTOP / HF10 R15
echo ====================================================================
echo.

if not exist "%~dp0ATUALIZAR_GCMBS_RETORNO_DESKTOP_HF10_R15.ps1" (
  echo [ERRO] O arquivo ATUALIZAR_GCMBS_RETORNO_DESKTOP_HF10_R15.ps1
  echo        precisa estar na mesma pasta deste BAT.
  echo.
  pause
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ATUALIZAR_GCMBS_RETORNO_DESKTOP_HF10_R15.ps1"
set RC=%ERRORLEVEL%

echo.
if "%RC%"=="0" (
  echo [OK] Atualizacao concluida.
) else (
  echo [ERRO] Atualizacao terminou com codigo %RC%.
  echo Consulte a mensagem acima. Se houve alteracao parcial, o instalador
  echo tentou restaurar automaticamente o backup.
)
echo.
pause
exit /b %RC%
