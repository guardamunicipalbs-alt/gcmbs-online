$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Version='10.0.86'
$VersionCode=86
$RuntimeCommit='04a013295899497e21402478c25d0b78b271b22e'
$Repo='https://github.com/guardamunicipalbs-alt/gcmbs-online.git'
$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'

function Say([string]$Text,[ConsoleColor]$Color='Gray'){ Write-Host $Text -ForegroundColor $Color }
function Need([string]$Path,[string]$Name){ if(!(Test-Path -LiteralPath $Path)){ throw "$Name nao encontrado: $Path" } }
function Sha([string]$Path){ (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant() }
function FirstExisting($Items){ foreach($Item in $Items){ if($Item -and (Test-Path -LiteralPath $Item)){ return $Item } }; return $null }
function CopyTree([string]$Source,[string]$Target){ if(Test-Path -LiteralPath $Target){ Remove-Item -LiteralPath $Target -Recurse -Force }; Copy-Item -LiteralPath $Source -Destination $Target -Recurse -Force }
function AssertContains([string]$Path,[string]$Pattern,[string]$Label){ Need $Path $Label; $Raw=Get-Content -LiteralPath $Path -Raw; if($Raw -notmatch $Pattern){ throw "Auditoria falhou: $Label nao contem padrao esperado [$Pattern]" }; Say "[OK] $Label" Green }

try {
  Say ('='*78) Cyan
  Say ' GCMBS ANDROID 10.0.86 - ATUALIZACAO V136 AGENDADA' Cyan
  Say ' Banco de Horas + Permutas + Quadro + paridade acumulada' Cyan
  Say ('='*78) Cyan

  $Root=FirstExisting @('D:\GCMBS','D:\gcmbs','G:\GCMBS','G:\gcmbs')
  if(!$Root){ throw 'Projeto GCMBS nao encontrado em D:\GCMBS ou G:\GCMBS.' }
  Need (Join-Path $Root 'package.json') 'package.json'
  $Mobile=Join-Path $Root 'mobile'
  $Www=Join-Path $Mobile 'www'
  $Android=Join-Path $Mobile 'android'
  $Assets=Join-Path $Android 'app\src\main\assets\public'
  Need $Www 'mobile\www'
  Need (Join-Path $Android 'gradlew.bat') 'Gradle wrapper'
  Say "[OK] Projeto: $Root" Green

  $Git=(Get-Command git.exe -ErrorAction SilentlyContinue)
  if(!$Git){ $Git=(Get-Command git -ErrorAction Stop) }
  $Node=(Get-Command node.exe -ErrorAction SilentlyContinue)
  if(!$Node){ $Node=(Get-Command node -ErrorAction Stop) }
  $Npx=(Get-Command npx.cmd -ErrorAction SilentlyContinue)
  if(!$Npx){ $Npx=(Get-Command npx -ErrorAction Stop) }

  $Sdk=FirstExisting @($env:ANDROID_HOME,$env:ANDROID_SDK_ROOT,"$env:LOCALAPPDATA\Android\Sdk",'D:\Sdk','G:\Sdk')
  if(!$Sdk){ throw 'Android SDK nao encontrado.' }
  $env:ANDROID_HOME=$Sdk
  $env:ANDROID_SDK_ROOT=$Sdk
  $env:GRADLE_USER_HOME=Join-Path $Root '.gradle-gcmbs'
  New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME -Force | Out-Null

  $Java=$null
  if($env:JAVA_HOME -and (Test-Path -LiteralPath $env:JAVA_HOME)){ $Java=$env:JAVA_HOME }
  if(!$Java){
    $Java=FirstExisting @(
      'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.1-hotspot',
      'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot',
      'C:\Program Files\Java\jdk-21'
    )
  }
  if(!$Java){
    $Javac=Get-Command javac.exe -ErrorAction SilentlyContinue
    if(!$Javac){ $Javac=Get-Command javac -ErrorAction SilentlyContinue }
    if($Javac){ $Java=Split-Path (Split-Path $Javac.Source -Parent) -Parent }
  }
  if(!$Java){ throw 'JDK nao encontrado.' }
  $env:JAVA_HOME=$Java
  $env:Path="$Java\bin;$Sdk\platform-tools;$env:Path"
  Say "[OK] Android SDK: $Sdk" Green
  Say "[OK] JAVA_HOME: $Java" Green

  # Arquivos que esta atualizacao nao pode alterar.
  $Protected=@(
    (Join-Path $Root 'src\database\sige_gcm.db'),
    (Join-Path $Root 'database\sige_gcm.db'),
    (Join-Path $Root 'src\services\GeradorEscalaService.js')
  ) | Where-Object { Test-Path -LiteralPath $_ }
  $Before=@{}
  foreach($P in $Protected){ $Before[$P]=Sha $P }

  # Backup completo da camada mobile antes da troca do runtime.
  $Backup=Join-Path $Root "backup_android_10_0_86_v136_$Stamp"
  New-Item -ItemType Directory -Path $Backup -Force | Out-Null
  Copy-Item -LiteralPath $Www -Destination (Join-Path $Backup 'www') -Recurse -Force
  $Gradle=Join-Path $Android 'app\build.gradle'
  $GradleKts=Join-Path $Android 'app\build.gradle.kts'
  if(Test-Path -LiteralPath $Gradle){ Copy-Item $Gradle (Join-Path $Backup 'build.gradle') -Force }
  if(Test-Path -LiteralPath $GradleKts){ Copy-Item $GradleKts (Join-Path $Backup 'build.gradle.kts') -Force }
  Say "[OK] Backup: $Backup" Green

  # Baixa exatamente o runtime que recebeu as correcoes V136 aprovadas em 10/09/2026.
  $Tmp=Join-Path $env:TEMP "GCMBS_ANDROID_10_0_86_$Stamp"
  if(Test-Path -LiteralPath $Tmp){ Remove-Item $Tmp -Recurse -Force }
  & $Git.Source clone --quiet --no-checkout $Repo $Tmp
  if($LASTEXITCODE-ne 0){ throw 'Falha ao clonar gcmbs-online.' }
  Push-Location $Tmp
  try {
    & $Git.Source checkout --quiet $RuntimeCommit
    if($LASTEXITCODE-ne 0){ throw "Falha ao fixar runtime no commit $RuntimeCommit" }
    $Head=(& $Git.Source rev-parse HEAD).Trim()
    if($Head -ne $RuntimeCommit){ throw "Runtime inesperado: $Head" }
  } finally { Pop-Location }
  Say "[OK] Runtime fixado: $RuntimeCommit" Green

  # Preserva configuracao local do app, se existir.
  $LocalConfig=$null
  if(Test-Path -LiteralPath (Join-Path $Www 'config.js')){
    $LocalConfig=Join-Path $env:TEMP "gcmbs_config_local_$Stamp.js"
    Copy-Item (Join-Path $Www 'config.js') $LocalConfig -Force
  }

  # Copia somente a camada executavel web; nao traz docs, downloads ou Supabase para o APK.
  foreach($Dir in @('css','js','assets','data')){
    $Src=Join-Path $Tmp $Dir
    if(Test-Path -LiteralPath $Src){ CopyTree $Src (Join-Path $Www $Dir) }
  }
  foreach($File in @('index.html','manifest.webmanifest','sw.js','favicon.png','icon.png','icon.svg','icon-192.png','icon-512.png','brasao-gcmbs.png')){
    $Src=Join-Path $Tmp $File
    if(Test-Path -LiteralPath $Src){ Copy-Item -LiteralPath $Src -Destination (Join-Path $Www $File) -Force }
  }
  if($LocalConfig){ Copy-Item $LocalConfig (Join-Path $Www 'config.js') -Force }
  Say '[OK] Runtime Online canonico copiado para mobile\www.' Green

  # Auditoria estatica obrigatoria antes do Capacitor.
  AssertContains (Join-Path $Www 'js\app-core.js') 'gcmbs-v136-loader\.js' 'Carregamento V136'
  AssertContains (Join-Path $Www 'js\gcmbs-bank-filter-v136.js') 'Todos os GCMs' 'Filtro individual do Banco de Horas'
  AssertContains (Join-Path $Www 'js\gcmbs-bank-filter-v136.js') 'bank_hours_for_guard' 'Recarga individual do Banco de Horas'
  AssertContains (Join-Path $Www 'js\gcmbs-permuta-confirm-v136.js') 'Processando\.\.\.' 'Persistencia visual de decisao de permuta'
  AssertContains (Join-Path $Www 'js\gcmbs-dashboard-dedupe-v136.js') 'gc102-analytics' 'Deduplicacao do Quadro'
  AssertContains (Join-Path $Www 'index.html') 'loginLembrar' 'Login lembrado'
  AssertContains (Join-Path $Www 'index.html') 'minhaSenha' 'Alteracao de senha'
  AssertContains (Join-Path $Www 'index.html') 'escalaComandoAviso' 'Gerenciador de Escala do Comando'
  AssertContains (Join-Path $Www 'index.html') 'quadroAvisosHome' 'Quadro de Avisos'
  AssertContains (Join-Path $Www 'index.html') 'occForm' 'Ocorrencias completas'
  AssertContains (Join-Path $Www 'js\gcmbs-v137-checklist-detalhado.js') 'GCMBS_CHECKLIST_V137' 'Check-list detalhado de viaturas'

  # Valida os JS novos principais.
  foreach($Js in @(
    'js\gcmbs-v136-loader.js',
    'js\gcmbs-bank-filter-v136.js',
    'js\gcmbs-permuta-confirm-v136.js',
    'js\gcmbs-dashboard-dedupe-v136.js'
  )){
    & $Node.Source --check (Join-Path $Www $Js)
    if($LASTEXITCODE-ne 0){ throw "JavaScript invalido: $Js" }
  }

  # Sincroniza WWW -> Android assets.
  Push-Location $Mobile
  try {
    & $Npx.Source cap sync android
    if($LASTEXITCODE-ne 0){ throw 'Falha no npx cap sync android.' }
  } finally { Pop-Location }
  Need (Join-Path $Assets 'js\gcmbs-bank-filter-v136.js') 'V136 Banco nos assets Android'
  Need (Join-Path $Assets 'js\gcmbs-permuta-confirm-v136.js') 'V136 Permuta nos assets Android'
  Need (Join-Path $Assets 'js\gcmbs-dashboard-dedupe-v136.js') 'V136 Quadro nos assets Android'
  if((Sha (Join-Path $Www 'js\gcmbs-bank-filter-v136.js')) -ne (Sha (Join-Path $Assets 'js\gcmbs-bank-filter-v136.js'))){ throw 'Banco V136 divergente entre WWW e Android assets.' }
  Say '[OK] Capacitor sincronizado e V136 presente nos assets Android.' Green

  # Define a proxima versao Android acima da 10.0.85 publicada.
  if(Test-Path -LiteralPath $Gradle){
    $G=Get-Content -LiteralPath $Gradle -Raw
    $G=[regex]::Replace($G,'versionCode\s+\d+',"versionCode $VersionCode")
    $G=[regex]::Replace($G,'versionName\s+["''][^"'']+["'']',"versionName `"$Version`"")
    Set-Content -LiteralPath $Gradle -Value $G -Encoding UTF8
  } elseif(Test-Path -LiteralPath $GradleKts){
    $G=Get-Content -LiteralPath $GradleKts -Raw
    $G=[regex]::Replace($G,'versionCode\s*=\s*\d+',"versionCode = $VersionCode")
    $G=[regex]::Replace($G,'versionName\s*=\s*["''][^"'']+["'']',"versionName = `"$Version`"")
    Set-Content -LiteralPath $GradleKts -Value $G -Encoding UTF8
  } else { throw 'app/build.gradle(.kts) nao encontrado.' }
  Say "[OK] Android versionCode=$VersionCode / versionName=$Version" Green

  # Compila candidato RELEASE. Se a assinatura estiver configurada no Gradle, sai pronto para instalar.
  Push-Location $Android
  try {
    & .\gradlew.bat clean assembleRelease
    if($LASTEXITCODE-ne 0){ throw 'Falha no Gradle assembleRelease.' }
  } finally { Pop-Location }

  $ReleaseCandidates=@(
    (Join-Path $Android 'app\build\outputs\apk\release\app-release.apk'),
    (Join-Path $Android 'app\build\outputs\apk\release\app-release-unsigned.apk')
  ) | Where-Object { Test-Path -LiteralPath $_ }
  if(!$ReleaseCandidates){ throw 'APK release nao localizado apos compilacao.' }
  $Built=$ReleaseCandidates[0]

  $ApkSigner=$null
  $BuildTools=Join-Path $Sdk 'build-tools'
  if(Test-Path -LiteralPath $BuildTools){
    $ApkSigner=Get-ChildItem $BuildTools -Filter 'apksigner.bat' -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
  }
  $Signed=$false
  if($ApkSigner){
    & $ApkSigner verify --verbose $Built 2>$null | Out-Null
    $Signed=($LASTEXITCODE-eq 0)
  }

  $Out=Join-Path $Root "GCMBS-Android-$Version-V136.apk"
  Copy-Item -LiteralPath $Built -Destination $Out -Force

  # Integridade dos arquivos protegidos.
  foreach($P in $Protected){
    if((Sha $P) -ne $Before[$P]){ throw "Arquivo protegido alterado: $P" }
  }

  $Report=Join-Path $Root "RELATORIO_ANDROID_10_0_86_V136_$Stamp.txt"
  $StatusAssinatura=if($Signed){'ASSINADO / VERIFICADO'}else{'NAO VERIFICADO OU UNSIGNED - NAO PUBLICAR'}
  @(
    "GCMBS Android $Version - candidato V136",
    "Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')",
    "Projeto: $Root",
    "Runtime GitHub: $RuntimeCommit",
    "Android SDK: $Sdk",
    "JAVA_HOME: $Java",
    "APK: $Out",
    "Tamanho: $((Get-Item $Out).Length) bytes",
    "SHA-256: $(Sha $Out)",
    "Assinatura: $StatusAssinatura",
    '',
    'Incluido nesta atualizacao:',
    '- Banco de Horas do Comando com filtro Todos os GCMs / GCM individual e recarga das movimentacoes.',
    '- Aprovacoes posteriores refletidas por nova consulta, sem total congelado.',
    '- Aprovacao/recusa de permuta com estado Processando ate persistencia/recarga.',
    '- Deduplicacao visual do Quadro e remocao da injecao legada gc102-analytics.',
    '- Paridade acumulada: Gerenciador de Escala, FJ/UTF-8/datas BR, manutencao, login/senha, ocorrencias, avisos e checklist.',
    '- Gerador de Escala e bancos SQLite preservados.',
    '',
    'Antes de publicar: testar App x Online x Desktop, Banco em Todos/GONDIM, permuta aprovar/recusar e Quadro sem repeticoes.'
  ) | Set-Content -LiteralPath $Report -Encoding UTF8

  Say ('='*78) Cyan
  Say '[OK] CANDIDATO ANDROID 10.0.86 V136 COMPILADO' Green
  Say "APK: $Out" Green
  Say "SHA-256: $(Sha $Out)" Green
  Say "Assinatura: $StatusAssinatura" $(if($Signed){'Green'}else{'Yellow'})
  Say "Relatorio: $Report" Green
  if(!$Signed){ Say 'ATENCAO: nao instalar/publicar como atualizacao ate confirmar assinatura institucional.' Yellow }
  Say 'NAO desinstale o aplicativo atual.' Yellow
  Say ('='*78) Cyan

} catch {
  Say ('='*78) Red
  Say 'ATUALIZACAO ANDROID 10.0.86 V136 INTERROMPIDA' Red
  Say $_.Exception.Message Red
  Say 'O backup anterior foi preservado. Nao publique APK parcial.' Yellow
  Say ('='*78) Red
  exit 1
}
