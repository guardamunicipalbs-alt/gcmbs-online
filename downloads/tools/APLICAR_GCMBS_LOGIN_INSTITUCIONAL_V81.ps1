$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$VisualVersion='1000812'
$SourceBase='https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main'
$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'

function Say([string]$Text,[ConsoleColor]$Color='Gray'){ Write-Host $Text -ForegroundColor $Color }
function EnsureDir([string]$Path){ New-Item -ItemType Directory -Path $Path -Force | Out-Null }
function Sha([string]$Path){ if(!(Test-Path -LiteralPath $Path)){ return $null }; (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant() }
function GetFile([string]$Relative,[string]$Destination){
  $Uri="$SourceBase/$($Relative.Replace('\','/'))?v=$VisualVersion"
  Invoke-WebRequest -Uri $Uri -OutFile $Destination -UseBasicParsing
  if(!(Test-Path -LiteralPath $Destination) -or (Get-Item -LiteralPath $Destination).Length -lt 100){ throw "Download incompleto: $Relative" }
}
function Rel([string]$FromDirectory,[string]$ToFile){
  $A=New-Object System.Uri(((Resolve-Path -LiteralPath $FromDirectory).Path.TrimEnd('\')+'\'))
  $B=New-Object System.Uri((Resolve-Path -LiteralPath $ToFile).Path)
  [Uri]::UnescapeDataString($A.MakeRelativeUri($B).ToString())
}
function PatchHtml([string]$Html,[string]$CssFile,[string]$JsFile){
  if(!(Test-Path -LiteralPath $Html)){ return $false }
  $T=Get-Content -LiteralPath $Html -Raw
  if($T -notmatch '</head>' -or $T -notmatch '</body>'){ return $false }
  $Original=$T
  $T=$T -replace '<link[^>]+gcmbs-login-institucional-v81\.css[^>]*>\s*',''
  $T=$T -replace '<script[^>]+gcmbs-login-institucional-v81\.js[^>]*></script>\s*',''
  $CssHref=Rel (Split-Path -Parent $Html) $CssFile
  $JsSrc=Rel (Split-Path -Parent $Html) $JsFile
  $T=$T -replace '</head>',("<link rel=`"stylesheet`" href=`"${CssHref}?v=${VisualVersion}`" data-gcmbs-login-v81=`"1`">`r`n</head>")
  $T=$T -replace '</body>',("<script defer src=`"${JsSrc}?v=${VisualVersion}`" data-gcmbs-login-v81=`"1`"></script>`r`n</body>")
  if($T -ne $Original){ Set-Content -LiteralPath $Html -Value $T -Encoding UTF8; return $true }
  return $false
}

try{
  Say ('='*82) Cyan
  Say ' GCMBS - LOGIN INSTITUCIONAL V81 R2 - DESKTOP + ONLINE + APP ANDROID' Cyan
  Say ('='*82) Cyan
  Say 'Atualiza somente a apresentacao da tela de login. Autenticacao, regras e banco ficam preservados.' Cyan

  $Root=$null
  foreach($C in @('D:\GCMBS','D:\GCMBS\GCMBS','G:\GCMBS','G:\GCMBS\GCMBS')){
    if(Test-Path -LiteralPath (Join-Path $C 'package.json')){ $Root=$C; break }
  }
  if(!$Root){ throw 'Projeto GCMBS nao encontrado em D:\GCMBS ou G:\GCMBS.' }
  Say "[OK] Projeto: $Root" Green

  try{
    Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object { $_.Name -match '^(electron|node|gcmbs).*\.exe$' -and (($_.CommandLine -like "*$Root*") -or ($_.ExecutablePath -like "*$Root*")) } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }catch{}

  $WebTargets=@(
    (Join-Path $Root 'cloud\public'),
    (Join-Path $Root 'mobile\www'),
    (Join-Path $Root 'mobile\android\app\src\main\assets\public')
  )
  foreach($T in $WebTargets){ if(!(Test-Path -LiteralPath $T)){ throw "Arvore ausente: $T" } }
  $Ui=Join-Path $Root 'src\ui'
  if(!(Test-Path -LiteralPath $Ui)){ throw "Interface Desktop ausente: $Ui" }

  $Protected=@(
    (Join-Path $Root 'src\services\GeradorEscalaService.js'),
    (Join-Path $Root 'src\database\sige_gcm.db'),
    (Join-Path $Root 'database\sige_gcm.db')
  ) | Where-Object { Test-Path -LiteralPath $_ }
  $Before=@{}
  foreach($P in $Protected){ $Before[$P]=Sha $P; Say "[PROTEGIDO] $P" DarkGray }

  $Backup=Join-Path $Root "backup_LOGIN_INSTITUCIONAL_V81_R2_$Stamp"
  EnsureDir $Backup
  $Names=@('cloud-public','mobile-www','android-public')
  for($I=0;$I -lt $WebTargets.Count;$I++){
    $Dst=Join-Path $Backup $Names[$I]; EnsureDir $Dst
    Copy-Item -Path (Join-Path $WebTargets[$I] '*') -Destination $Dst -Recurse -Force
  }
  $UiBackup=Join-Path $Backup 'desktop-ui'; EnsureDir $UiBackup
  Copy-Item -Path (Join-Path $Ui '*') -Destination $UiBackup -Recurse -Force
  Say "[OK] Backup completo: $Backup" Green

  $Tmp=Join-Path $env:TEMP "GCMBS_LOGIN_V81_$Stamp"
  EnsureDir $Tmp
  $CssTmp=Join-Path $Tmp 'gcmbs-login-institucional-v81.css'
  $JsTmp=Join-Path $Tmp 'gcmbs-login-institucional-v81.js'
  GetFile 'css/gcmbs-login-institucional-v81.css' $CssTmp
  GetFile 'js/gcmbs-login-institucional-v81.js' $JsTmp

  $Node=Get-Command node -ErrorAction SilentlyContinue
  if($Node){
    & $Node.Source --check $JsTmp | Out-Null
    if($LASTEXITCODE -ne 0){ throw 'JavaScript do Login v81 invalido.' }
    Say '[OK] JavaScript validado pelo Node.' Green
  }else{ Say '[AVISO] Node nao localizado; validacao sintatica local foi ignorada.' Yellow }

  foreach($Target in $WebTargets){
    $CssDir=Join-Path $Target 'css'; $JsDir=Join-Path $Target 'js'
    EnsureDir $CssDir; EnsureDir $JsDir
    $CssDst=Join-Path $CssDir 'gcmbs-login-institucional-v81.css'
    $JsDst=Join-Path $JsDir 'gcmbs-login-institucional-v81.js'
    Copy-Item -LiteralPath $CssTmp -Destination $CssDst -Force
    Copy-Item -LiteralPath $JsTmp -Destination $JsDst -Force
    $Index=Join-Path $Target 'index.html'
    if(!(PatchHtml $Index $CssDst $JsDst)){ Say "[AVISO] index sem alteracao: $Index" Yellow }
  }
  Say '[OK] Online local + mobile/www + assets Android atualizados.' Green

  $DesktopCss=Join-Path $Ui 'gcmbs-login-institucional-v81.css'
  $DesktopJs=Join-Path $Ui 'gcmbs-login-institucional-v81.js'
  Copy-Item -LiteralPath $CssTmp -Destination $DesktopCss -Force
  Copy-Item -LiteralPath $JsTmp -Destination $DesktopJs -Force
  $Count=0
  Get-ChildItem -LiteralPath $Ui -Filter '*.html' -File -Recurse | ForEach-Object {
    if(PatchHtml $_.FullName $DesktopCss $DesktopJs){ $Count++ }
  }
  Say "[OK] Desktop Electron: camada de login instalada em $Count pagina(s) HTML." Green

  foreach($P in $Protected){
    if((Sha $P) -ne $Before[$P]){ throw "Arquivo protegido alterado indevidamente: $P" }
  }
  Say '[OK] Gerador de Escala e bancos SQLite preservados.' Green

  $Report=Join-Path $Root "RELATORIO_LOGIN_INSTITUCIONAL_V81_R2_$Stamp.txt"
  @(
    'GCMBS - Login Institucional v81 R2',
    "Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')",
    "Projeto: $Root",
    'Desktop Electron: camada v81 instalada',
    'Online local: camada v81 instalada',
    'Mobile WWW: camada v81 instalada',
    'Android assets/public: camada v81 instalada',
    "Desktop HTML alterados: $Count",
    'Autenticacao/regras/calculos: NAO ALTERADOS',
    'Gerador/SQLite: PRESERVADOS',
    "Backup: $Backup",
    '',
    'IMPORTANTE: o aplicativo ja instalado no celular precisa de novo build/instalacao do APK para receber os assets atualizados.'
  ) | Set-Content -LiteralPath $Report -Encoding UTF8

  Say ('='*82) Cyan
  Say ' LOGIN INSTITUCIONAL V81 R2 APLICADO AO PROJETO' Green
  Say ('='*82) Cyan
  Say "Relatorio: $Report" Green
  Say 'Online/Projeto: pronto. App instalado: recompilar APK e instalar a nova versao.' Yellow
}catch{
  Say 'APLICACAO INTERROMPIDA' Red
  Say $_.Exception.Message Red
  exit 1
}
