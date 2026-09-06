$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$VisualVersion='100080'
$SourceBase='https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main'
$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'
function Say([string]$Text,[ConsoleColor]$Color='Gray'){Write-Host $Text -ForegroundColor $Color}
function EnsureDir([string]$Path){New-Item -ItemType Directory -Path $Path -Force|Out-Null}
function Sha([string]$Path){if(!(Test-Path -LiteralPath $Path)){return $null};(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()}
function GetVisual([string]$Relative,[string]$Destination){$Uri="$SourceBase/$($Relative.Replace('\','/'))?v=$VisualVersion";Invoke-WebRequest -Uri $Uri -OutFile $Destination -UseBasicParsing;if(!(Test-Path -LiteralPath $Destination) -or (Get-Item -LiteralPath $Destination).Length -lt 80){throw "Download incompleto: $Relative"}}
function RelativeUri([string]$FromDirectory,[string]$ToFile){$A=New-Object System.Uri(((Resolve-Path -LiteralPath $FromDirectory).Path.TrimEnd('\')+'\'));$B=New-Object System.Uri((Resolve-Path -LiteralPath $ToFile).Path);[Uri]::UnescapeDataString($A.MakeRelativeUri($B).ToString())}
function PatchHtml([string]$Html,[string]$Css,[string]$Js){
  if(!(Test-Path -LiteralPath $Html)){return}
  $Text=Get-Content -LiteralPath $Html -Raw
  if($Text -notmatch '</head>' -or $Text -notmatch '</body>'){return}
  $CssRel=RelativeUri (Split-Path -Parent $Html) $Css
  $JsRel=RelativeUri (Split-Path -Parent $Html) $Js
  $Text=$Text -replace 'gcmbs-design-system-v76\.js\?v=100079','gcmbs-design-system-v76.js?v=100080'
  $Text=$Text -replace 'gcmbs-design-system-v76\.css\?v=100079','gcmbs-design-system-v76.css?v=100080'
  if($Text -notmatch 'gcmbs-premium-3d-v79-r2\.css'){$Tag='<link rel="stylesheet" href="{0}?v=100080" data-gc79-r2="1">' -f $CssRel;$Text=$Text -replace '</head>',($Tag+"`r`n</head>")}
  if($Text -notmatch 'gcmbs-premium-3d-v79-r2\.js'){$Tag='<script defer src="{0}?v=100080" data-gc79-r2="1"></script>' -f $JsRel;$Text=$Text -replace '</body>',($Tag+"`r`n</body>")}
  Set-Content -LiteralPath $Html -Value $Text -Encoding UTF8
}
try{
  Say '==============================================================================' Cyan
  Say ' GCMBS - PREMIUM 3D V79 R2 - MODAL E NAVEGACAO' Cyan
  Say '==============================================================================' Cyan
  Say 'Corrige o modal que apareceu preso ao rodape e remove definitivamente icones duplicados.' Cyan

  $Root=$null
  foreach($Candidate in @('D:\GCMBS','D:\GCMBS\GCMBS','G:\GCMBS','G:\GCMBS\GCMBS')){if(Test-Path -LiteralPath (Join-Path $Candidate 'package.json')){$Root=$Candidate;break}}
  if(!$Root){throw 'Projeto GCMBS nao encontrado em D:\GCMBS ou G:\GCMBS.'}
  Say "[OK] Projeto: $Root" Green

  $Targets=@((Join-Path $Root 'cloud\public'),(Join-Path $Root 'mobile\www'),(Join-Path $Root 'mobile\android\app\src\main\assets\public'))
  foreach($Target in $Targets){if(!(Test-Path -LiteralPath $Target)){throw "Arvore ausente: $Target"}}
  $Ui=Join-Path $Root 'src\ui';if(!(Test-Path -LiteralPath $Ui)){throw "Interface Desktop ausente: $Ui"}

  $Protected=@((Join-Path $Root 'src\services\GeradorEscalaService.js'),(Join-Path $Root 'src\database\sige_gcm.db'),(Join-Path $Root 'database\sige_gcm.db'))|Where-Object{Test-Path -LiteralPath $_}
  $Before=@{};foreach($P in $Protected){$Before[$P]=Sha $P}

  $Backup=Join-Path $Root "backup_PREMIUM_3D_V79_R2_$Stamp";EnsureDir $Backup
  foreach($Rel in @('cloud\public\index.html','cloud\public\js\gcmbs-design-system-v76.js','cloud\public\sw.js','mobile\www\index.html','mobile\www\js\gcmbs-design-system-v76.js','mobile\www\sw.js','mobile\android\app\src\main\assets\public\index.html','mobile\android\app\src\main\assets\public\js\gcmbs-design-system-v76.js','mobile\android\app\src\main\assets\public\sw.js')){
    $Src=Join-Path $Root $Rel;if(Test-Path -LiteralPath $Src){$Dst=Join-Path $Backup ($Rel -replace '[\\:]','_');Copy-Item -LiteralPath $Src -Destination $Dst -Force}
  }
  $UiBackup=Join-Path $Backup 'desktop-ui';EnsureDir $UiBackup;Copy-Item -Path (Join-Path $Ui '*') -Destination $UiBackup -Recurse -Force
  Say "[OK] Backup visual: $Backup" Green

  $Tmp=Join-Path $env:TEMP "GCMBS_V79_R2_$Stamp";EnsureDir $Tmp
  $Css=Join-Path $Tmp 'gcmbs-premium-3d-v79-r2.css';$Js=Join-Path $Tmp 'gcmbs-premium-3d-v79-r2.js';$Bootstrap=Join-Path $Tmp 'gcmbs-design-system-v76.js';$Sw=Join-Path $Tmp 'sw.js'
  GetVisual 'css/gcmbs-premium-3d-v79-r2.css' $Css
  GetVisual 'js/gcmbs-premium-3d-v79-r2.js' $Js
  GetVisual 'js/gcmbs-design-system-v76.js' $Bootstrap
  GetVisual 'sw.js' $Sw
  $Node=(Get-Command node -ErrorAction Stop).Source;& $Node --check $Js|Out-Null;if($LASTEXITCODE -ne 0){throw 'JavaScript R2 invalido'};& $Node --check $Bootstrap|Out-Null;if($LASTEXITCODE -ne 0){throw 'Bootstrap visual invalido'}
  Say '[OK] Arquivos R2 baixados e validados.' Green

  foreach($Target in $Targets){
    EnsureDir (Join-Path $Target 'css');EnsureDir (Join-Path $Target 'js')
    Copy-Item -LiteralPath $Css -Destination (Join-Path $Target 'css\gcmbs-premium-3d-v79-r2.css') -Force
    Copy-Item -LiteralPath $Js -Destination (Join-Path $Target 'js\gcmbs-premium-3d-v79-r2.js') -Force
    Copy-Item -LiteralPath $Bootstrap -Destination (Join-Path $Target 'js\gcmbs-design-system-v76.js') -Force
    Copy-Item -LiteralPath $Sw -Destination (Join-Path $Target 'sw.js') -Force
    PatchHtml (Join-Path $Target 'index.html') (Join-Path $Target 'css\gcmbs-premium-3d-v79-r2.css') (Join-Path $Target 'js\gcmbs-premium-3d-v79-r2.js')
  }

  $DesktopCss=Join-Path $Ui 'gcmbs-premium-3d-v79-r2.css';$DesktopJs=Join-Path $Ui 'gcmbs-premium-3d-v79-r2.js'
  Copy-Item -LiteralPath $Css -Destination $DesktopCss -Force;Copy-Item -LiteralPath $Js -Destination $DesktopJs -Force
  $Count=0;Get-ChildItem -LiteralPath $Ui -Filter '*.html' -File -Recurse|ForEach-Object{PatchHtml $_.FullName $DesktopCss $DesktopJs;$Count++}

  foreach($Rel in @('css\gcmbs-premium-3d-v79-r2.css','js\gcmbs-premium-3d-v79-r2.js')){$Hashes=@($Targets|ForEach-Object{Sha (Join-Path $_ $Rel)}|Select-Object -Unique);if($Hashes.Count -ne 1){throw "Paridade divergente: $Rel"}}
  foreach($P in $Protected){if((Sha $P) -ne $Before[$P]){throw "Arquivo protegido alterado: $P"}}

  $Report=Join-Path $Root "RELATORIO_PREMIUM_3D_V79_R2_$Stamp.txt"
  @('GCMBS Premium 3D v79 R2',"Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')",'Modal do Quadro: CENTRALIZADO','Icones duplicados: REMOVIDOS','Navegacao tardia: NORMALIZADA','Paridade Online/App/Android: OK',"Desktop HTML conferidos: $Count",'Gerador e SQLite: PRESERVADOS',"Backup: $Backup")|Set-Content -LiteralPath $Report -Encoding UTF8

  Say '[OK] Modal do Quadro corrigido e centralizado.' Green
  Say '[OK] Icones duplicados removidos inclusive apos carregamento tardio do menu.' Green
  Say '[OK] Desktop, Online local, Mobile WWW e Android assets atualizados.' Green
  Say '[OK] Gerador de Escala e bancos SQLite permanecem inalterados.' Green
  Say "[OK] Relatorio: $Report" Green
  Say 'PREMIUM 3D V79 R2 CONCLUIDO.' Cyan
}catch{Say 'CORRECAO INTERROMPIDA' Red;Say $_.Exception.Message Red;exit 1}
