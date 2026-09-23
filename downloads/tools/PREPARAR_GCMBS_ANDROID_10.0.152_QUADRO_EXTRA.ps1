$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Version='10.0.152'
$VersionCode=152
$RuntimeCommit='d01b99dc9a732fa4b7c31f908909d45c02182414'
$Repo='https://github.com/guardamunicipalbs-alt/gcmbs-online.git'
$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'

function Say([string]$Text,[ConsoleColor]$Color='Gray'){ Write-Host $Text -ForegroundColor $Color }
function Need([string]$Path,[string]$Label){ if(!(Test-Path -LiteralPath $Path)){ throw ($Label+' nao encontrado: '+$Path) } }
function Sha([string]$Path){ (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant() }
function FirstExisting($Items){ foreach($Item in $Items){ if($Item -and (Test-Path -LiteralPath $Item)){ return $Item } }; return $null }
function CopyTree([string]$Source,[string]$Target){ if(Test-Path -LiteralPath $Target){ Remove-Item -LiteralPath $Target -Recurse -Force }; Copy-Item -LiteralPath $Source -Destination $Target -Recurse -Force }
function AssertText([string]$Path,[string]$Pattern,[string]$Label){
  Need $Path $Label
  $Raw=Get-Content -LiteralPath $Path -Raw
  if($Raw -notmatch $Pattern){ throw ('Auditoria falhou: '+$Label) }
  Say ('[OK] '+$Label) Green
}

try{
  Say ('='*78) Cyan
  Say ' GCMBS ANDROID 10.0.152 - QUADRO EXTRA x ORDINARIO' Cyan
  Say ' Atualiza apenas a camada mobile e gera candidato release.' Cyan
  Say ('='*78) Cyan

  $Root=FirstExisting @('D:\GCMBS','D:\gcmbs','G:\GCMBS','G:\gcmbs','F:\GCMBS','F:\gcmbs')
  if(!$Root){ throw 'Projeto GCMBS nao encontrado em D:, G: ou F:.' }

  $Mobile=Join-Path $Root 'mobile'
  $Www=Join-Path $Mobile 'www'
  $Android=Join-Path $Mobile 'android'
  $Assets=Join-Path $Android 'app\src\main\assets\public'
  $Gradle=Join-Path $Android 'app\build.gradle'
  $GradleKts=Join-Path $Android 'app\build.gradle.kts'

  Need $Www 'mobile\www'
  Need (Join-Path $Android 'gradlew.bat') 'Gradle wrapper'

  $Git=(Get-Command git.exe -ErrorAction SilentlyContinue)
  if(!$Git){$Git=(Get-Command git -ErrorAction Stop)}
  $Node=(Get-Command node.exe -ErrorAction SilentlyContinue)
  if(!$Node){$Node=(Get-Command node -ErrorAction Stop)}
  $Npx=(Get-Command npx.cmd -ErrorAction SilentlyContinue)
  if(!$Npx){$Npx=(Get-Command npx -ErrorAction Stop)}

  $Protected=@(
    (Join-Path $Root 'src\database\sige_gcm.db'),
    (Join-Path $Root 'database\sige_gcm.db'),
    (Join-Path $Root 'src\services\GeradorEscalaService.js')
  ) | Where-Object { Test-Path -LiteralPath $_ }
  $Before=@{}
  foreach($P in $Protected){$Before[$P]=Sha $P}

  $Backup=Join-Path $Root ('backup_android_10_0_152_extra_'+$Stamp)
  New-Item -ItemType Directory -Path $Backup -Force | Out-Null
  Copy-Item -LiteralPath $Www -Destination (Join-Path $Backup 'www') -Recurse -Force
  if(Test-Path $Assets){Copy-Item -LiteralPath $Assets -Destination (Join-Path $Backup 'assets_public') -Recurse -Force}
  if(Test-Path $Gradle){Copy-Item $Gradle (Join-Path $Backup 'build.gradle') -Force}
  if(Test-Path $GradleKts){Copy-Item $GradleKts (Join-Path $Backup 'build.gradle.kts') -Force}
  Say ('[OK] Backup: '+$Backup) Green

  $Tmp=Join-Path $env:TEMP ('GCMBS_ANDROID_152_'+$Stamp)
  if(Test-Path $Tmp){Remove-Item $Tmp -Recurse -Force}
  & $Git.Source clone --quiet --no-checkout $Repo $Tmp
  if($LASTEXITCODE-ne 0){throw 'Falha ao clonar o runtime online.'}
  & $Git.Source -C $Tmp checkout --quiet $RuntimeCommit
  if($LASTEXITCODE-ne 0){throw 'Falha ao fixar o runtime aprovado.'}
  $Head=(& $Git.Source -C $Tmp rev-parse HEAD).Trim()
  if($Head-ne $RuntimeCommit){throw ('Runtime divergente: '+$Head)}

  $LocalConfig=$null
  if(Test-Path (Join-Path $Www 'config.js')){
    $LocalConfig=Join-Path $env:TEMP ('gcmbs_config_152_'+$Stamp+'.js')
    Copy-Item (Join-Path $Www 'config.js') $LocalConfig -Force
  }

  foreach($Dir in @('css','js','assets','data')){
    $Src=Join-Path $Tmp $Dir
    if(Test-Path $Src){CopyTree $Src (Join-Path $Www $Dir)}
  }
  foreach($File in @('index.html','manifest.webmanifest','sw.js','favicon.png','icon.png','icon.svg','icon-192.png','icon-512.png','brasao-gcmbs.png')){
    $Src=Join-Path $Tmp $File
    if(Test-Path $Src){Copy-Item $Src (Join-Path $Www $File) -Force}
  }
  if($LocalConfig){Copy-Item $LocalConfig (Join-Path $Www 'config.js') -Force}

  AssertText (Join-Path $Www 'js\gcmbs-quadro-tipo-servico-v151.js') ':scope > span' 'Classificador usa o detalhe real do servico'
  AssertText (Join-Path $Www 'js\app-core.js') 'function tipoServicoQuadro' 'App-core classifica Extra/Ordinario no render'
  AssertText (Join-Path $Www 'index.html') '100177-extra-classify2' 'Cache do hotfix atualizado'

  & $Node.Source --check (Join-Path $Www 'js\gcmbs-quadro-tipo-servico-v151.js')
  if($LASTEXITCODE-ne 0){throw 'JavaScript V151 invalido.'}

  Push-Location $Mobile
  try{
    & $Npx.Source cap sync android
    if($LASTEXITCODE-ne 0){throw 'Falha no npx cap sync android.'}
  }finally{Pop-Location}

  Need (Join-Path $Assets 'js\gcmbs-quadro-tipo-servico-v151.js') 'Hotfix nos assets Android'
  if((Sha (Join-Path $Www 'js\gcmbs-quadro-tipo-servico-v151.js')) -ne (Sha (Join-Path $Assets 'js\gcmbs-quadro-tipo-servico-v151.js'))){
    throw 'Hotfix divergente entre mobile\www e Android assets.'
  }
  Say '[OK] Online runtime copiado e sincronizado com Android assets.' Green

  if(Test-Path $Gradle){
    $G=Get-Content -LiteralPath $Gradle -Raw
    $G=[regex]::Replace($G,'versionCode\s+\d+','versionCode '+$VersionCode)
    $G=[regex]::Replace($G,'versionName\s+["''][^"'']+["'']','versionName "'+$Version+'"')
    [System.IO.File]::WriteAllText($Gradle,$G,(New-Object System.Text.UTF8Encoding($false)))
  }elseif(Test-Path $GradleKts){
    $G=Get-Content -LiteralPath $GradleKts -Raw
    $G=[regex]::Replace($G,'versionCode\s*=\s*\d+','versionCode = '+$VersionCode)
    $G=[regex]::Replace($G,'versionName\s*=\s*["''][^"'']+["'']','versionName = "'+$Version+'"')
    [System.IO.File]::WriteAllText($GradleKts,$G,(New-Object System.Text.UTF8Encoding($false)))
  }else{throw 'app/build.gradle(.kts) nao encontrado.'}

  Push-Location $Android
  try{
    & .\gradlew.bat clean assembleRelease
    if($LASTEXITCODE-ne 0){throw 'Falha no assembleRelease.'}
  }finally{Pop-Location}

  $ReleaseDir=Join-Path $Android 'app\build\outputs\apk\release'
  $Built=FirstExisting @(
    (Join-Path $ReleaseDir 'app-release.apk'),
    (Join-Path $ReleaseDir 'app-release-unsigned.apk')
  )
  Need $Built 'APK release'

  $Out=Join-Path $Root ('GCMBS-Android-'+$Version+'-QUADRO-EXTRA.apk')
  Copy-Item $Built $Out -Force

  foreach($P in $Protected){
    if((Sha $P)-ne $Before[$P]){throw ('Arquivo protegido alterado: '+$P)}
  }

  Say ('='*78) Cyan
  Say '[OK] CANDIDATO ANDROID 10.0.152 GERADO' Green
  Say ('APK: '+$Out) Green
  Say ('SHA-256: '+(Sha $Out)) Green
  Say 'IMPORTANTE: confirme a assinatura do APK antes de instalar/publicar.' Yellow
  Say 'Teste obrigatorio: itens com "Extra automatica", "Extra por Evento" ou "Servico extra" devem exibir badge Extra.' Yellow
  Say ('='*78) Cyan
}catch{
  Say ('='*78) Red
  Say 'PREPARACAO ANDROID 10.0.152 INTERROMPIDA' Red
  Say $_.Exception.Message Red
  Say 'Nao publique APK parcial.' Yellow
  Say ('='*78) Red
  exit 1
}
