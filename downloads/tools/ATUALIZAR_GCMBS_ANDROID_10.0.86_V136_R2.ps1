$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Base='https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main/downloads/tools/ATUALIZAR_GCMBS_ANDROID_10.0.86_V136.ps1'
$Tmp=Join-Path $env:TEMP 'ATUALIZAR_GCMBS_ANDROID_10.0.86_V136_R2_CORE.ps1'

Write-Host '============================================================================== ' -ForegroundColor Cyan
Write-Host ' GCMBS ANDROID 10.0.86 - V136 R2' -ForegroundColor Cyan
Write-Host ' Correcao da auditoria do carregador V136' -ForegroundColor Cyan
Write-Host '============================================================================== ' -ForegroundColor Cyan

Invoke-WebRequest -UseBasicParsing -Uri $Base -OutFile $Tmp
$Raw=Get-Content -LiteralPath $Tmp -Raw

$Old="AssertContains (Join-Path `$Www 'js\app-core.js') 'gcmbs-v136-loader\.js' 'Carregamento V136'"
$New="AssertContains (Join-Path `$Www 'js\communication-workflows-v74.js') 'gcmbs-v136-loader\.js' 'Carregamento V136'"

if(-not $Raw.Contains($Old)){
  throw 'Nao foi possivel localizar a verificacao antiga no atualizador base.'
}

$Raw=$Raw.Replace($Old,$New)
Set-Content -LiteralPath $Tmp -Value $Raw -Encoding UTF8

Write-Host '[OK] Auditoria corrigida: loader V136 sera verificado em communication-workflows-v74.js.' -ForegroundColor Green
Write-Host '[OK] Reiniciando o processo completo com backup e validacoes.' -ForegroundColor Green

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Tmp
exit $LASTEXITCODE
