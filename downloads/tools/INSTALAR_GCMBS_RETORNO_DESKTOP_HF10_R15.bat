@echo off
setlocal
title GCMBS - Atualizacao segura HF10 R15
cd /d "%~dp0"

set "PS1=%~dp0ATUALIZAR_GCMBS_RETORNO_DESKTOP_HF10_R15.ps1"
set "PS1URL=https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/7fbbaba1b63759bcda58280e80e604f3b5618ef0/downloads/tools/ATUALIZAR_GCMBS_RETORNO_DESKTOP_HF10_R15.ps1"

echo ====================================================================
echo  GCMBS - RETORNO AO DESKTOP / HF10 R15
echo ====================================================================
echo.

if not exist "%PS1%" (
  echo [INFO] Baixando o script PowerShell validado do pacote...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%PS1URL%' -OutFile '%PS1%'"
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel baixar o script PowerShell.
    echo Verifique a conexao com a Internet e tente novamente.
    echo.
    pause
    exit /b 2
  )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
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
