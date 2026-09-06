$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$VisualVersion = '100078'
$SourceBase = 'https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main'
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupRoot = $null

function Say([string]$Text,[ConsoleColor]$Color='Gray') { Write-Host $Text -ForegroundColor $Color }
function Sha([string]$Path) { if (!(Test-Path -LiteralPath $Path)) { return $null }; return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant() }
function Ensure-Dir([string]$Path) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
function Download-Visual([string]$Relative,[string]$Destination) {
    $uri = "$SourceBase/$($Relative.Replace('\','/'))?v=$VisualVersion"
    Invoke-WebRequest -Uri $uri -OutFile $Destination -UseBasicParsing
    if (!(Test-Path -LiteralPath $Destination) -or (Get-Item -LiteralPath $Destination).Length -lt 100) { throw "Download visual incompleto: $Relative" }
}
function Patch-WebIndex([string]$IndexPath) {
    if (!(Test-Path -LiteralPath $IndexPath)) { throw "index.html ausente: $IndexPath" }
    $text = Get-Content -LiteralPath $IndexPath -Raw
    $original = $text
    $text = $text -replace '<link[^>]+gcmbs-online-premium-v77\.css[^>]*>\s*',''
    $text = $text -replace '<script[^>]+gcmbs-online-premium-v77\.js[^>]*></script>\s*',''
    if ($text -notmatch 'gcmbs-premium-3d-v78\.css') {
        $tag = '<link rel="stylesheet" href="css/gcmbs-premium-3d-v78.css?v=100078" data-gc78-premium="1">'
        $text = $text -replace '</head>', "$tag`r`n</head>"
    }
    if ($text -notmatch 'gcmbs-premium-3d-v78\.js') {
        $tag = '<script defer src="js/gcmbs-premium-3d-v78.js?v=100078" data-gc78-premium="1"></script>'
        $text = $text -replace '</body>', "$tag`r`n</body>"
    }
    $text = $text -replace 'gcmbs-design-system-v76\.css\?v=[^"'']+','gcmbs-design-system-v76.css?v=100078'
    $text = $text -replace 'gcmbs-design-system-v76\.js\?v=[^"'']+','gcmbs-design-system-v76.js?v=100078'
    $text = $text -replace '📱\s*Baixar aplicativo Android','Baixar aplicativo Android'
    if ($text -ne $original) { Set-Content -LiteralPath $IndexPath -Value $text -Encoding UTF8 }
}
function Relative-Uri([string]$FromDirectory,[string]$ToFile) {
    $from = (Resolve-Path -LiteralPath $FromDirectory).Path.TrimEnd('\') + '\'
    $to = (Resolve-Path -LiteralPath $ToFile).Path
    $fromUri = New-Object System.Uri($from); $toUri = New-Object System.Uri($to)
    return [Uri]::UnescapeDataString($fromUri.MakeRelativeUri($toUri).ToString())
}
function Patch-DesktopHtml([string]$HtmlPath,[string]$CssFile,[string]$JsFile) {
    $text = Get-Content -LiteralPath $HtmlPath -Raw
    if ($text -notmatch '<html' -or $text -notmatch '</head>' -or $text -notmatch '</body>') { return $false }
    $original = $text
    $cssRel = Relative-Uri (Split-Path -Parent $HtmlPath) $CssFile
    $jsRel = Relative-Uri (Split-Path -Parent $HtmlPath) $JsFile
    if ($text -notmatch 'gcmbs-premium-3d-v78\.css') { $tag = '<link rel="stylesheet" href="{0}?v=100078" data-gc78-premium="1">' -f $cssRel; $text = $text -replace '</head>', "$tag`r`n</head>" }
    if ($text -notmatch 'gcmbs-premium-3d-v78\.js') { $tag = '<script defer src="{0}?v=100078" data-gc78-premium="1"></script>' -f $jsRel; $text = $text -replace '</body>', "$tag`r`n</body>" }
    if ($text -ne $original) { Set-Content -LiteralPath $HtmlPath -Value $text -Encoding UTF8; return $true }
    return $false
}
function Restore-Backup([string[]]$WebTargets,[string]$DesktopUi) {
    if (!$BackupRoot -or !(Test-Path -LiteralPath $BackupRoot)) { return }
    $names = @('cloud-public','mobile-www','android-public')
    for ($i=0; $i -lt $WebTargets.Count; $i++) {
        $src = Join-Path $BackupRoot $names[$i]; $dst = $WebTargets[$i]
        if (Test-Path -LiteralPath $src) { if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }; Ensure-Dir $dst; Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force }
    }
    $srcUi = Join-Path $BackupRoot 'desktop-ui'
    if ($DesktopUi -and (Test-Path -LiteralPath $srcUi)) { if (Test-Path -LiteralPath $DesktopUi) { Remove-Item -LiteralPath $DesktopUi -Recurse -Force }; Ensure-Dir $DesktopUi; Copy-Item -Path (Join-Path $srcUi '*') -Destination $DesktopUi -Recurse -Force }
}

$Root = $null; $WebTargets = @(); $DesktopUi = $null
try {
    Say '==============================================================================' Cyan
    Say ' GCMBS - PREMIUM 3D V78 - DESKTOP / ONLINE / APP' Cyan
    Say '==============================================================================' Cyan
    Say 'Escopo exclusivamente visual: layout moderno e botoes 3D institucionais.' Cyan
    Say ''

    foreach ($c in @('D:\GCMBS','D:\GCMBS\GCMBS','G:\GCMBS','G:\GCMBS\GCMBS')) { if (Test-Path -LiteralPath (Join-Path $c 'package.json')) { $Root = $c; break } }
    if (!$Root) { throw 'Projeto GCMBS nao encontrado em D:\GCMBS ou G:\GCMBS.' }
    Say "[OK] Projeto: $Root" Green

    $WebTargets = @((Join-Path $Root 'cloud\public'),(Join-Path $Root 'mobile\www'),(Join-Path $Root 'mobile\android\app\src\main\assets\public'))
    foreach ($t in $WebTargets) { if (!(Test-Path -LiteralPath $t)) { throw "Arvore visual ausente: $t" } }
    $DesktopUi = Join-Path $Root 'src\ui'; if (!(Test-Path -LiteralPath $DesktopUi)) { throw "Interface Desktop ausente: $DesktopUi" }

    try { Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -match '^(electron|node|gcmbs).*\.exe$' -and (($_.CommandLine -like "*$Root*") -or ($_.ExecutablePath -like "*$Root*")) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } } catch {}

    $Protected = @((Join-Path $Root 'src\services\GeradorEscalaService.js'),(Join-Path $Root 'src\database\sige_gcm.db'),(Join-Path $Root 'database\sige_gcm.db')) | Where-Object { Test-Path -LiteralPath $_ }
    $ProtectedBefore = @{}; foreach ($p in $Protected) { $ProtectedBefore[$p] = Sha $p; Say "[PROTEGIDO] $p" DarkGray }

    $BackupRoot = Join-Path $Root "backup_PREMIUM_3D_V78_$Stamp"; Ensure-Dir $BackupRoot
    $names = @('cloud-public','mobile-www','android-public')
    for ($i=0; $i -lt $WebTargets.Count; $i++) { $dst = Join-Path $BackupRoot $names[$i]; Ensure-Dir $dst; Copy-Item -Path (Join-Path $WebTargets[$i] '*') -Destination $dst -Recurse -Force }
    $uiBackup = Join-Path $BackupRoot 'desktop-ui'; Ensure-Dir $uiBackup; Copy-Item -Path (Join-Path $DesktopUi '*') -Destination $uiBackup -Recurse -Force
    Say "[OK] Backup: $BackupRoot" Green

    $Temp = Join-Path $env:TEMP "GCMBS_PREMIUM_3D_V78_$Stamp"; Ensure-Dir $Temp
    $Css = Join-Path $Temp 'gcmbs-premium-3d-v78.css'; $Js = Join-Path $Temp 'gcmbs-premium-3d-v78.js'
    Download-Visual 'css/gcmbs-premium-3d-v78.css' $Css; Download-Visual 'js/gcmbs-premium-3d-v78.js' $Js
    $node = Get-Command node -ErrorAction Stop; & $node.Source --check $Js | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'JavaScript Premium 3D v78 invalido.' }

    foreach ($target in $WebTargets) { Ensure-Dir (Join-Path $target 'css'); Ensure-Dir (Join-Path $target 'js'); Copy-Item -LiteralPath $Css -Destination (Join-Path $target 'css\gcmbs-premium-3d-v78.css') -Force; Copy-Item -LiteralPath $Js -Destination (Join-Path $target 'js\gcmbs-premium-3d-v78.js') -Force; Patch-WebIndex (Join-Path $target 'index.html') }
    Say '[OK] Online / Mobile WWW / Android assets atualizados.' Green

    $DesktopCss = Join-Path $DesktopUi 'gcmbs-premium-3d-v78.css'; $DesktopJs = Join-Path $DesktopUi 'gcmbs-premium-3d-v78.js'
    Copy-Item -LiteralPath $Css -Destination $DesktopCss -Force; Copy-Item -LiteralPath $Js -Destination $DesktopJs -Force
    $patched = 0; Get-ChildItem -LiteralPath $DesktopUi -Filter '*.html' -File -Recurse | ForEach-Object { if (Patch-DesktopHtml $_.FullName $DesktopCss $DesktopJs) { $patched++ } }
    Say "[OK] Desktop Electron: $patched pagina(s) atualizada(s)." Green

    foreach ($rel in @('css\gcmbs-premium-3d-v78.css','js\gcmbs-premium-3d-v78.js')) { $hashes = @($WebTargets | ForEach-Object { Sha (Join-Path $_ $rel) } | Select-Object -Unique); if ($hashes.Count -ne 1) { throw "Paridade visual divergente: $rel" } }
    foreach ($p in $Protected) { if ((Sha $p) -ne $ProtectedBefore[$p]) { throw "Arquivo protegido alterado: $p" } }
    Say '[OK] Paridade visual confirmada; Gerador e SQLite preservados.' Green

    $Report = Join-Path $Root "RELATORIO_PREMIUM_3D_V78_$Stamp.txt"
    @('GCMBS - Premium 3D v78',"Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')","Projeto: $Root",'Escopo: somente visual/UX','Desktop Electron: aplicado','Online: aplicado','Mobile WWW: aplicado','Android assets: aplicado','Paridade visual: OK','Gerador de Escala: PRESERVADO','SQLite: PRESERVADO',"Backup: $BackupRoot",'','OBS.: o APK instalado so muda depois de recompilar/assinar uma nova versao.','Nenhuma Edge Function, API ou regra de negocio foi modificada.') | Set-Content -LiteralPath $Report -Encoding UTF8

    Say ''; Say 'PREMIUM 3D V78 APLICADO COM SUCESSO' Green; Say "Relatorio: $Report" Green; Say 'Para o app instalado, ainda e necessario recompilar e assinar o APK.' Yellow
    exit 0
} catch {
    Say ''; Say 'APLICACAO VISUAL INTERROMPIDA' Red; Say $_.Exception.Message Red
    try { Restore-Backup $WebTargets $DesktopUi } catch { Say "Falha no rollback: $($_.Exception.Message)" Red }
    exit 1
}
