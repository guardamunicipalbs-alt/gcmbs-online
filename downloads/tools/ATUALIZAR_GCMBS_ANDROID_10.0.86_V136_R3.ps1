$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Base='https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main/downloads/tools/ATUALIZAR_GCMBS_ANDROID_10.0.86_V136.ps1'
$Tmp=Join-Path $env:TEMP 'ATUALIZAR_GCMBS_ANDROID_10.0.86_V136_R3_CORE.ps1'

Write-Host '==============================================================================' -ForegroundColor Cyan
Write-Host ' GCMBS ANDROID 10.0.86 - V136 R3' -ForegroundColor Cyan
Write-Host ' Correcao: auditoria V136 + build.gradle UTF-8 sem BOM' -ForegroundColor Cyan
Write-Host '==============================================================================' -ForegroundColor Cyan

Invoke-WebRequest -UseBasicParsing -Uri $Base -OutFile $Tmp
$Raw=Get-Content -LiteralPath $Tmp -Raw

# 1) Corrige a verificacao do loader V136.
$OldAudit="AssertContains (Join-Path `$Www 'js\app-core.js') 'gcmbs-v136-loader\.js' 'Carregamento V136'"
$NewAudit="AssertContains (Join-Path `$Www 'js\communication-workflows-v74.js') 'gcmbs-v136-loader\.js' 'Carregamento V136'"
if(-not $Raw.Contains($OldAudit)){ throw 'Nao foi possivel localizar a verificacao antiga do loader V136.' }
$Raw=$Raw.Replace($OldAudit,$NewAudit)

# 2) Windows PowerShell 5.1 grava -Encoding UTF8 com BOM. O Groovy/Gradle rejeitou
#    os bytes EF BB BF no inicio de app/build.gradle. Grava os scripts Gradle em UTF-8 sem BOM.
$OldGradle='Set-Content -LiteralPath $Gradle -Value $G -Encoding UTF8'
$NewGradle='[System.IO.File]::WriteAllText($Gradle,$G,(New-Object System.Text.UTF8Encoding($false)))'
if(-not $Raw.Contains($OldGradle)){ throw 'Nao foi possivel localizar a gravacao antiga de build.gradle.' }
$Raw=$Raw.Replace($OldGradle,$NewGradle)

$OldGradleKts='Set-Content -LiteralPath $GradleKts -Value $G -Encoding UTF8'
$NewGradleKts='[System.IO.File]::WriteAllText($GradleKts,$G,(New-Object System.Text.UTF8Encoding($false)))'
if($Raw.Contains($OldGradleKts)){ $Raw=$Raw.Replace($OldGradleKts,$NewGradleKts) }

# O proprio arquivo temporario pode ter BOM sem afetar o PowerShell, mas gravamos sem BOM por consistencia.
[System.IO.File]::WriteAllText($Tmp,$Raw,(New-Object System.Text.UTF8Encoding($false)))

Write-Host '[OK] Auditoria do loader V136 corrigida.' -ForegroundColor Green
Write-Host '[OK] Gravacao do build.gradle alterada para UTF-8 sem BOM.' -ForegroundColor Green
Write-Host '[OK] Reiniciando processo completo com novo backup e validacoes.' -ForegroundColor Green

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Tmp
exit $LASTEXITCODE
