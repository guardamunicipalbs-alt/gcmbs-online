$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$VisualVersion='100079'
$SourceBase='https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main'
$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'
function Say([string]$t,[ConsoleColor]$c='Gray'){Write-Host $t -ForegroundColor $c}
function Sha([string]$p){if(!(Test-Path -LiteralPath $p)){return $null};(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToUpperInvariant()}
function Dir([string]$p){New-Item -ItemType Directory -Path $p -Force|Out-Null}
function GetVisual([string]$rel,[string]$dst){$u="$SourceBase/$($rel.Replace('\','/'))?v=$VisualVersion";Invoke-WebRequest -Uri $u -OutFile $dst -UseBasicParsing;if(!(Test-Path -LiteralPath $dst) -or (Get-Item $dst).Length -lt 80){throw "Download incompleto: $rel"}}
function Rel([string]$from,[string]$to){$a=New-Object System.Uri(((Resolve-Path $from).Path.TrimEnd('\')+'\'));$b=New-Object System.Uri((Resolve-Path $to).Path);[Uri]::UnescapeDataString($a.MakeRelativeUri($b).ToString())}
function PatchHtml([string]$html,[string]$css,[string]$js){$t=Get-Content $html -Raw;if($t -notmatch '</head>' -or $t -notmatch '</body>'){return};$cr=Rel (Split-Path $html -Parent) $css;$jr=Rel (Split-Path $html -Parent) $js;if($t -notmatch 'gcmbs-premium-3d-v79-fix\.css'){$t=$t -replace '</head>',("<link rel=\"stylesheet\" href=\"$cr?v=100079\" data-gc79-refined=\"1\">`r`n</head>")};if($t -notmatch 'gcmbs-premium-3d-v79-fix\.js'){$t=$t -replace '</body>',("<script defer src=\"$jr?v=100079\" data-gc79-refined=\"1\"></script>`r`n</body>")};$t=$t -replace 'gcmbs-design-system-v76\.js\?v=100078','gcmbs-design-system-v76.js?v=100079';$t=$t -replace 'gcmbs-design-system-v76\.css\?v=100078','gcmbs-design-system-v76.css?v=100079';Set-Content $html $t -Encoding UTF8}

try{
 Say '==============================================================================' Cyan
 Say ' GCMBS - CORRECAO VISUAL PREMIUM 3D V79' Cyan
 Say '==============================================================================' Cyan
 Say 'Remove herancas da previa v77, elimina icones duplicados e aproxima o Quadro do modelo aprovado.' Cyan
 $Root=$null;foreach($c in @('D:\GCMBS','D:\GCMBS\GCMBS','G:\GCMBS','G:\GCMBS\GCMBS')){if(Test-Path (Join-Path $c 'package.json')){$Root=$c;break}}
 if(!$Root){throw 'Projeto GCMBS nao encontrado em D:\GCMBS ou G:\GCMBS.'};Say "[OK] Projeto: $Root" Green
 $Targets=@((Join-Path $Root 'cloud\public'),(Join-Path $Root 'mobile\www'),(Join-Path $Root 'mobile\android\app\src\main\assets\public'));foreach($t in $Targets){if(!(Test-Path $t)){throw "Arvore ausente: $t"}}
 $Ui=Join-Path $Root 'src\ui';if(!(Test-Path $Ui)){throw "Interface Desktop ausente: $Ui"}
 $Protected=@((Join-Path $Root 'src\services\GeradorEscalaService.js'),(Join-Path $Root 'src\database\sige_gcm.db'),(Join-Path $Root 'database\sige_gcm.db'))|Where-Object{Test-Path $_};$Before=@{};foreach($p in $Protected){$Before[$p]=Sha $p}
 $Backup=Join-Path $Root "backup_PREMIUM_3D_V79_$Stamp";Dir $Backup
 foreach($p in @('cloud\public\css','cloud\public\js','mobile\www\css','mobile\www\js','mobile\android\app\src\main\assets\public\css','mobile\android\app\src\main\assets\public\js','src\ui')){$src=Join-Path $Root $p;if(Test-Path $src){$name=($p -replace '[\\:]','_');$dst=Join-Path $Backup $name;Dir $dst;Copy-Item (Join-Path $src '*') $dst -Recurse -Force}}
 Say "[OK] Backup visual: $Backup" Green
 $Tmp=Join-Path $env:TEMP "GCMBS_V79_$Stamp";Dir $Tmp
 $Files=@('css/gcmbs-premium-3d-v79-fix.css','js/gcmbs-premium-3d-v79-fix.js','js/gcmbs-design-system-v76.js','sw.js');foreach($f in $Files){$dst=Join-Path $Tmp ([IO.Path]::GetFileName($f));GetVisual $f $dst}
 $node=(Get-Command node -ErrorAction Stop).Source;& $node --check (Join-Path $Tmp 'gcmbs-premium-3d-v79-fix.js')|Out-Null;if($LASTEXITCODE -ne 0){throw 'JavaScript v79 invalido'};& $node --check (Join-Path $Tmp 'gcmbs-design-system-v76.js')|Out-Null;if($LASTEXITCODE -ne 0){throw 'Bootstrap visual invalido'}
 foreach($t in $Targets){Dir (Join-Path $t 'css');Dir (Join-Path $t 'js');Copy-Item (Join-Path $Tmp 'gcmbs-premium-3d-v79-fix.css') (Join-Path $t 'css\gcmbs-premium-3d-v79-fix.css') -Force;Copy-Item (Join-Path $Tmp 'gcmbs-premium-3d-v79-fix.js') (Join-Path $t 'js\gcmbs-premium-3d-v79-fix.js') -Force;Copy-Item (Join-Path $Tmp 'gcmbs-design-system-v76.js') (Join-Path $t 'js\gcmbs-design-system-v76.js') -Force;Copy-Item (Join-Path $Tmp 'sw.js') (Join-Path $t 'sw.js') -Force;PatchHtml (Join-Path $t 'index.html') (Join-Path $t 'css\gcmbs-premium-3d-v79-fix.css') (Join-Path $t 'js\gcmbs-premium-3d-v79-fix.js')}
 $Dc=Join-Path $Ui 'gcmbs-premium-3d-v79-fix.css';$Dj=Join-Path $Ui 'gcmbs-premium-3d-v79-fix.js';Copy-Item (Join-Path $Tmp 'gcmbs-premium-3d-v79-fix.css') $Dc -Force;Copy-Item (Join-Path $Tmp 'gcmbs-premium-3d-v79-fix.js') $Dj -Force;$count=0;Get-ChildItem $Ui -Filter '*.html' -File -Recurse|ForEach-Object{PatchHtml $_.FullName $Dc $Dj;$count++}
 foreach($rel in @('css\gcmbs-premium-3d-v79-fix.css','js\gcmbs-premium-3d-v79-fix.js')){$h=@($Targets|ForEach-Object{Sha (Join-Path $_ $rel)}|Select-Object -Unique);if($h.Count -ne 1){throw "Paridade divergente: $rel"}}
 foreach($p in $Protected){if((Sha $p) -ne $Before[$p]){throw "Arquivo protegido alterado: $p"}}
 $Report=Join-Path $Root "RELATORIO_PREMIUM_3D_V79_$Stamp.txt";@('GCMBS Premium 3D v79',"Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')",'Heranca v77: bloqueada','Icones duplicados: corrigidos','Dashboard: reorganizado','Paridade Online/App/Android: OK',"Desktop HTML conferidos: $count",'Gerador e SQLite: PRESERVADOS',"Backup: $Backup")|Set-Content $Report -Encoding UTF8
 Say '[OK] Herancas v77 bloqueadas e icones duplicados removidos.' Green
 Say '[OK] Dashboard reorganizado conforme o modelo aprovado.' Green
 Say '[OK] Desktop, Online local, Mobile WWW e Android assets atualizados.' Green
 Say '[OK] Gerador de Escala e bancos SQLite permanecem inalterados.' Green
 Say "[OK] Relatorio: $Report" Green
 Say 'CORRECAO PREMIUM 3D V79 CONCLUIDA.' Cyan
}catch{Say 'CORRECAO INTERROMPIDA' Red;Say $_.Exception.Message Red;exit 1}
