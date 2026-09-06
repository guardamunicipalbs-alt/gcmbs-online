$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$VisualVersion='100080'
$SourceBase='https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main'
$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'
function Say([string]$Text,[ConsoleColor]$Color='Gray'){Write-Host $Text -ForegroundColor $Color}
function EnsureDir([string]$Path){New-Item -ItemType Directory -Path $Path -Force|Out-Null}
function Sha([string]$Path){if(!(Test-Path -LiteralPath $Path)){return $null};(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()}
function GetFile([string]$Relative,[string]$Destination){$Uri="$SourceBase/$($Relative.Replace('\','/'))?v=$VisualVersion";Invoke-WebRequest -Uri $Uri -OutFile $Destination -UseBasicParsing;if(!(Test-Path -LiteralPath $Destination) -or (Get-Item -LiteralPath $Destination).Length -lt 80){throw "Download incompleto: $Relative"}}
function Rel([string]$FromDirectory,[string]$ToFile){$A=New-Object System.Uri(((Resolve-Path -LiteralPath $FromDirectory).Path.TrimEnd('\')+'\'));$B=New-Object System.Uri((Resolve-Path -LiteralPath $ToFile).Path);[Uri]::UnescapeDataString($A.MakeRelativeUri($B).ToString())}
function PatchWebIndex([string]$Index){
  if(!(Test-Path -LiteralPath $Index)){throw "index.html ausente: $Index"}
  $T=Get-Content -LiteralPath $Index -Raw
  $T=$T -replace 'gcmbs-design-system-v76\.js\?v=[^"'']+','gcmbs-design-system-v76.js?v=100080'
  $T=$T -replace 'gcmbs-design-system-v76\.css\?v=[^"'']+','gcmbs-design-system-v76.css?v=100080'
  Set-Content -LiteralPath $Index -Value $T -Encoding UTF8
}
function PatchDesktopHtml([string]$Html,[string]$Ui){
  $T=Get-Content -LiteralPath $Html -Raw
  if($T -notmatch '</head>' -or $T -notmatch '</body>'){return $false}
  $Original=$T
  $Names=@('gcmbs-premium-3d-v78','gcmbs-premium-3d-v79-fix','gcmbs-premium-3d-v79-r2','gcmbs-platform-parity-v80')
  foreach($N in $Names){$T=$T -replace "<link[^>]+$N\.css[^>]*>\s*",'';$T=$T -replace "<script[^>]+$N\.js[^>]*></script>\s*",''}
  $Head=@();$Body=@()
  foreach($N in $Names){$Css=Join-Path $Ui "$N.css";$Head+=('<link rel="stylesheet" href="{0}?v=100080" data-gcmbs-platform="1">' -f (Rel (Split-Path -Parent $Html) $Css))}
  foreach($N in $Names){$Js=Join-Path $Ui "$N.js";if(Test-Path -LiteralPath $Js){$Body+=('<script defer src="{0}?v=100080" data-gcmbs-platform="1"></script>' -f (Rel (Split-Path -Parent $Html) $Js))}}
  $T=$T -replace '</head>',(($Head -join "`r`n")+"`r`n</head>")
  $T=$T -replace '</body>',(($Body -join "`r`n")+"`r`n</body>")
  if($T -ne $Original){Set-Content -LiteralPath $Html -Value $T -Encoding UTF8;return $true};return $false
}
try{
  Say ('='*78) Cyan;Say ' GCMBS - PARIDADE VISUAL PREMIUM 3D V80 - APP + DESKTOP' Cyan;Say ('='*78) Cyan
  Say 'Aplica ao App e Desktop o mesmo Design System Premium 3D aprovado no Online.' Cyan
  $Root=$null;foreach($C in @('D:\GCMBS','D:\GCMBS\GCMBS','G:\GCMBS','G:\GCMBS\GCMBS')){if(Test-Path -LiteralPath (Join-Path $C 'package.json')){$Root=$C;break}}
  if(!$Root){throw 'Projeto GCMBS nao encontrado em D:\GCMBS ou G:\GCMBS.'};Say "[OK] Projeto: $Root" Green
  $WebTargets=@((Join-Path $Root 'cloud\public'),(Join-Path $Root 'mobile\www'),(Join-Path $Root 'mobile\android\app\src\main\assets\public'))
  foreach($T in $WebTargets){if(!(Test-Path -LiteralPath $T)){throw "Arvore ausente: $T"}}
  $Ui=Join-Path $Root 'src\ui';if(!(Test-Path -LiteralPath $Ui)){throw "Interface Desktop ausente: $Ui"}

  try{Get-CimInstance Win32_Process -ErrorAction Stop|Where-Object{$_.Name -match '^(electron|node|gcmbs).*\.exe$' -and (($_.CommandLine -like "*$Root*") -or ($_.ExecutablePath -like "*$Root*"))}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}}catch{}

  $Protected=@((Join-Path $Root 'src\services\GeradorEscalaService.js'),(Join-Path $Root 'src\database\sige_gcm.db'),(Join-Path $Root 'database\sige_gcm.db'))|Where-Object{Test-Path -LiteralPath $_}
  $Before=@{};foreach($P in $Protected){$Before[$P]=Sha $P;Say "[PROTEGIDO] $P" DarkGray}

  $Backup=Join-Path $Root "backup_PARIDADE_VISUAL_V80_$Stamp";EnsureDir $Backup
  $Names=@('cloud-public','mobile-www','android-public')
  for($I=0;$I -lt $WebTargets.Count;$I++){$Dst=Join-Path $Backup $Names[$I];EnsureDir $Dst;Copy-Item -Path (Join-Path $WebTargets[$I] '*') -Destination $Dst -Recurse -Force}
  $UiBackup=Join-Path $Backup 'desktop-ui';EnsureDir $UiBackup;Copy-Item -Path (Join-Path $Ui '*') -Destination $UiBackup -Recurse -Force
  Say "[OK] Backup: $Backup" Green

  $Tmp=Join-Path $env:TEMP "GCMBS_PLATFORM_V80_$Stamp";EnsureDir $Tmp
  $Remote=@(
    'css/gcmbs-premium-3d-v78.css','css/gcmbs-premium-3d-v79-fix.css','css/gcmbs-premium-3d-v79-r2.css','css/gcmbs-platform-parity-v80.css',
    'js/gcmbs-premium-3d-v78.js','js/gcmbs-premium-3d-v79-fix.js','js/gcmbs-premium-3d-v79-r2.js','js/gcmbs-platform-parity-v80.js','js/gcmbs-design-system-v76.js','js/hf83-justificativas-protected-route.js','sw.js')
  foreach($R in $Remote){GetFile $R (Join-Path $Tmp ([IO.Path]::GetFileName($R)))}
  $Node=(Get-Command node -ErrorAction Stop).Source
  foreach($J in @('gcmbs-premium-3d-v78.js','gcmbs-premium-3d-v79-fix.js','gcmbs-premium-3d-v79-r2.js','gcmbs-platform-parity-v80.js','gcmbs-design-system-v76.js','hf83-justificativas-protected-route.js')){& $Node --check (Join-Path $Tmp $J)|Out-Null;if($LASTEXITCODE -ne 0){throw "JavaScript invalido: $J"}}
  Say '[OK] Camadas visuais e HF83 baixadas/validadas.' Green

  foreach($Target in $WebTargets){EnsureDir (Join-Path $Target 'css');EnsureDir (Join-Path $Target 'js');foreach($F in @('gcmbs-premium-3d-v78.css','gcmbs-premium-3d-v79-fix.css','gcmbs-premium-3d-v79-r2.css','gcmbs-platform-parity-v80.css')){Copy-Item -LiteralPath (Join-Path $Tmp $F) -Destination (Join-Path $Target "css\$F") -Force};foreach($F in @('gcmbs-premium-3d-v78.js','gcmbs-premium-3d-v79-fix.js','gcmbs-premium-3d-v79-r2.js','gcmbs-platform-parity-v80.js','gcmbs-design-system-v76.js','hf83-justificativas-protected-route.js')){Copy-Item -LiteralPath (Join-Path $Tmp $F) -Destination (Join-Path $Target "js\$F") -Force};Copy-Item -LiteralPath (Join-Path $Tmp 'sw.js') -Destination (Join-Path $Target 'sw.js') -Force;PatchWebIndex (Join-Path $Target 'index.html')}
  Say '[OK] Online local, Mobile WWW e assets Android padronizados.' Green

  foreach($F in @('gcmbs-premium-3d-v78.css','gcmbs-premium-3d-v79-fix.css','gcmbs-premium-3d-v79-r2.css','gcmbs-platform-parity-v80.css','gcmbs-premium-3d-v78.js','gcmbs-premium-3d-v79-fix.js','gcmbs-premium-3d-v79-r2.js','gcmbs-platform-parity-v80.js')){Copy-Item -LiteralPath (Join-Path $Tmp $F) -Destination (Join-Path $Ui $F) -Force}
  $Count=0;Get-ChildItem -LiteralPath $Ui -Filter '*.html' -File -Recurse|ForEach-Object{if(PatchDesktopHtml $_.FullName $Ui){$Count++}}
  Say "[OK] Desktop Electron: $Count pagina(s) normalizada(s) no Premium 3D v80." Green

  foreach($RelPath in @('css\gcmbs-platform-parity-v80.css','js\gcmbs-platform-parity-v80.js')){$Hashes=@($WebTargets|ForEach-Object{Sha (Join-Path $_ $RelPath)}|Select-Object -Unique);if($Hashes.Count -ne 1){throw "Paridade divergente: $RelPath"}}
  foreach($P in $Protected){if((Sha $P) -ne $Before[$P]){throw "Arquivo protegido alterado: $P"}}
  Say '[OK] Paridade App/Online/Android confirmada byte a byte.' Green
  Say '[OK] Gerador de Escala e bancos SQLite preservados.' Green

  $Report=Join-Path $Root "RELATORIO_PARIDADE_VISUAL_V80_$Stamp.txt"
  @('GCMBS Premium 3D v80 - Paridade App/Desktop',"Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')",'App mobile: Premium 3D responsivo','Desktop Electron: Premium 3D institucional',"Desktop paginas alteradas: $Count",'Mobile WWW: OK','Android assets: OK','HF83 Justificativas: copiada','Gerador/SQLite: PRESERVADOS',"Backup: $Backup",'','Para o aplicativo ja instalado no celular, gere/instale um novo APK apos esta atualizacao.')|Set-Content -LiteralPath $Report -Encoding UTF8
  Say ('='*78) Cyan;Say ' PARIDADE VISUAL V80 APLICADA COM SUCESSO' Green;Say ('='*78) Cyan
  Say "Relatorio: $Report" Green;Say 'O App instalado no telefone precisa ser recompilado para receber os novos assets.' Yellow
}catch{Say 'APLICACAO INTERROMPIDA' Red;Say $_.Exception.Message Red;exit 1}
