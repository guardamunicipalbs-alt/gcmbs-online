$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$SourceCommit = 'aad41c727d2dad24b2e73a8561b7e5681d63943e'
$SourceUrl = "https://github.com/guardamunicipalbs-alt/gcmbs-online/archive/$SourceCommit.zip"
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupRoot = $null
$Targets = @()

function Say([string]$Text,[ConsoleColor]$Color='Gray') {
    Write-Host $Text -ForegroundColor $Color
}
function Sha([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { throw "Arquivo obrigatorio ausente: $Path" }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Restore-WebTrees {
    if (!$BackupRoot -or !(Test-Path -LiteralPath $BackupRoot)) { return }
    Say ''
    Say 'Restaurando as tres arvores web a partir do backup...' Yellow
    $names = @('cloud-public','mobile-www','android-public')
    for ($i=0; $i -lt $Targets.Count; $i++) {
        $src = Join-Path $BackupRoot $names[$i]
        $dst = $Targets[$i]
        if (Test-Path -LiteralPath $src) {
            if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
            New-Item -ItemType Directory -Path $dst -Force | Out-Null
            Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force
        }
    }
    Say '[OK] Rollback das arvores web concluido.' Yellow
}

try {
    Say '====================================================================' Cyan
    Say ' GCMBS - RETORNO AO DESKTOP / HF10 R15' Cyan
    Say ' Atualiza fontes Online + Mobile + Android, com backup e validacao' Cyan
    Say '====================================================================' Cyan
    Say ''

    $candidatos = @('G:\GCMBS','G:\GCMBS\GCMBS')
    $Root = $null
    foreach ($c in $candidatos) {
        if (Test-Path -LiteralPath (Join-Path $c 'package.json')) { $Root = $c; break }
    }
    if (!$Root) { throw 'Projeto GCMBS nao encontrado em G:\GCMBS nem G:\GCMBS\GCMBS.' }
    Say "[OK] Projeto: $Root" Green

    $Targets = @(
        (Join-Path $Root 'cloud\public'),
        (Join-Path $Root 'mobile\www'),
        (Join-Path $Root 'mobile\android\app\src\main\assets\public')
    )
    foreach ($t in $Targets) { if (!(Test-Path -LiteralPath $t)) { throw "Arvore web ausente: $t" } }

    # Fecha apenas processos Electron/Node ligados ao projeto GCMBS.
    try {
        Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
            $_.Name -match '^(electron|node|gcmbs).*\.exe$' -and
            (($_.CommandLine -like "*$Root*") -or ($_.ExecutablePath -like "*$Root*"))
        } | ForEach-Object {
            Say "[INFO] Encerrando processo GCMBS PID $($_.ProcessId)..." Yellow
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } catch { Say '[INFO] Nao foi necessario encerrar processo do GCMBS.' DarkGray }

    $Protected = @(
        (Join-Path $Root 'src\services\GeradorEscalaService.js'),
        (Join-Path $Root 'src\database\sige_gcm.db'),
        (Join-Path $Root 'database\sige_gcm.db')
    )
    $ProtectedBefore = @{}
    foreach ($p in $Protected) {
        $ProtectedBefore[$p] = Sha $p
        Say "[PROTEGIDO] $p = $($ProtectedBefore[$p])" DarkGray
    }

    # Confirma que a etapa funcional de Permutas/Extra por Evento ja esta presente.
    $Permutas = Join-Path $Root 'src\ipc\permutas.ipc.js'
    if (!(Test-Path -LiteralPath $Permutas)) { throw "Arquivo de Permutas ausente: $Permutas" }
    $PermutasText = Get-Content -LiteralPath $Permutas -Raw
    $R12Ok = ($PermutasText -match 'TROCA_EXTRA') -and ($PermutasText -match 'CESSAO_EXTRA') -and ($PermutasText -match 'financeiro_neutro')
    if (!$R12Ok) {
        throw 'A etapa HF10 R12 de Permutas/Extra por Evento ainda nao foi detectada. Aplique primeiro o ZIP GCMBS_10.0.68_HF10_R12_PERMUTAS_EXTRA_EVENTO_FINAL.zip e execute este instalador novamente.'
    }
    Say '[OK] HF10 R12 Permutas/Extra por Evento detectado; nao sera reaplicado.' Green

    $BackupRoot = Join-Path $Root "backup_RETORNO_DESKTOP_HF10_R15_$Stamp"
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    $names = @('cloud-public','mobile-www','android-public')
    for ($i=0; $i -lt $Targets.Count; $i++) {
        $b = Join-Path $BackupRoot $names[$i]
        New-Item -ItemType Directory -Path $b -Force | Out-Null
        Copy-Item -Path (Join-Path $Targets[$i] '*') -Destination $b -Recurse -Force
    }
    Say "[OK] Backup completo das tres arvores: $BackupRoot" Green

    $Temp = Join-Path $env:TEMP "GCMBS_HF10_R15_$Stamp"
    $Zip = "$Temp.zip"
    if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }

    Say '[INFO] Baixando exatamente o HF10 R15 publicado e validado...' Cyan
    Invoke-WebRequest -Uri $SourceUrl -OutFile $Zip -UseBasicParsing
    Expand-Archive -LiteralPath $Zip -DestinationPath $Temp -Force
    $Source = Get-ChildItem -LiteralPath $Temp -Directory | Select-Object -First 1
    if (!$Source) { throw 'Nao foi possivel localizar os arquivos extraidos do HF10 R15.' }
    $Source = $Source.FullName

    $Required = @(
        'index.html','sw.js','js\app.js','js\app-core.js','js\data-provider.js',
        'js\access-catalog.js','js\v62-auditoria-app-fix.js','js\p0-online-workflows.js',
        'js\hf10-r14-guardas-search-stability.js','js\hf10-r15-online-stability.js',
        'corrigir-online.html','corrigir-guardas.html'
    )
    foreach ($rel in $Required) {
        if (!(Test-Path -LiteralPath (Join-Path $Source $rel))) { throw "Fonte R15 incompleta: $rel" }
    }
    Say '[OK] Fonte HF10 R15 conferida.' Green

    # Copia a mesma fonte para as tres arvores, sem apagar arquivos locais extras.
    foreach ($target in $Targets) {
        Copy-Item -LiteralPath (Join-Path $Source 'index.html') -Destination $target -Force
        Copy-Item -LiteralPath (Join-Path $Source 'sw.js') -Destination $target -Force
        foreach ($name in @('corrigir-online.html','corrigir-guardas.html','instalar.html')) {
            $s = Join-Path $Source $name
            if (Test-Path -LiteralPath $s) { Copy-Item -LiteralPath $s -Destination $target -Force }
        }
        foreach ($dir in @('js','css')) {
            $sdir = Join-Path $Source $dir
            $ddir = Join-Path $target $dir
            if (Test-Path -LiteralPath $sdir) {
                New-Item -ItemType Directory -Path $ddir -Force | Out-Null
                Copy-Item -Path (Join-Path $sdir '*') -Destination $ddir -Recurse -Force
            }
        }
        $srcVersion = Join-Path $Source 'downloads\version.json'
        if (Test-Path -LiteralPath $srcVersion) {
            $downloads = Join-Path $target 'downloads'
            New-Item -ItemType Directory -Path $downloads -Force | Out-Null
            Copy-Item -LiteralPath $srcVersion -Destination (Join-Path $downloads 'version.json') -Force
        }
    }
    Say '[OK] Online / Mobile / Android local receberam a mesma fonte R15.' Green

    $Node = (Get-Command node -ErrorAction Stop).Source
    $JsFiles = Get-ChildItem -LiteralPath (Join-Path $Targets[0] 'js') -Filter '*.js' -File -Recurse
    foreach ($f in $JsFiles) {
        & $Node --check $f.FullName | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "JavaScript invalido: $($f.FullName)" }
    }
    & $Node --check (Join-Path $Targets[0] 'sw.js') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Service Worker com sintaxe invalida.' }
    Say "[OK] Sintaxe JavaScript validada ($($JsFiles.Count) arquivos + sw.js)." Green

    $Parity = @(
        'index.html','sw.js','js\app.js','js\app-core.js','js\data-provider.js',
        'js\access-catalog.js','js\v62-auditoria-app-fix.js','js\p0-online-workflows.js',
        'js\hf10-r14-guardas-search-stability.js','js\hf10-r15-online-stability.js'
    )
    foreach ($rel in $Parity) {
        $hs = @($Targets | ForEach-Object { Sha (Join-Path $_ $rel) } | Select-Object -Unique)
        if ($hs.Count -ne 1) { throw "Paridade divergente entre Online/Mobile/Android: $rel" }
        Say "[OK] Paridade: $rel" Green
    }

    foreach ($p in $Protected) {
        $after = Sha $p
        if ($after -ne $ProtectedBefore[$p]) { throw "Arquivo protegido foi alterado: $p" }
    }
    Say '[OK] Gerador de Escala e os dois bancos SQLite permanecem byte a byte inalterados.' Green

    $PkgVersion = 'nao identificada'
    try { $PkgVersion = (Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version } catch {}
    $Report = Join-Path $Root "RELATORIO_RETORNO_DESKTOP_HF10_R15_$Stamp.txt"
    @(
        'GCMBS - Relatorio de atualizacao HF10 R15',
        "Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')",
        "Projeto: $Root",
        "Desktop package.json: $PkgVersion",
        "Fonte Online: commit $SourceCommit",
        'HF10 R12 Permutas/Extra por Evento: detectado',
        'Paridade Online/Mobile/Android: OK',
        'JavaScript: OK',
        'Gerador de Escala: PRESERVADO',
        'Bancos SQLite: PRESERVADOS',
        "Backup: $BackupRoot",
        '',
        'PROXIMO PASSO: abra o GCMBS Desktop e execute SINCRONIZAR AGORA.'
    ) | Set-Content -LiteralPath $Report -Encoding UTF8

    Say ''
    Say '====================================================================' Green
    Say ' HF10 R15 APLICADO E VALIDADO COM SUCESSO' Green
    Say '====================================================================' Green
    Say "Backup   : $BackupRoot" Green
    Say "Relatorio: $Report" Green
    Say ''
    Say 'Agora abra o GCMBS Desktop e execute SINCRONIZAR AGORA.' Yellow
    Say 'O APK nao e recompilado por este instalador.' Yellow
    exit 0
}
catch {
    Say ''
    Say '====================================================================' Red
    Say ' ATUALIZACAO INTERROMPIDA' Red
    Say '====================================================================' Red
    Say $_.Exception.Message Red
    try { Restore-WebTrees } catch { Say "Falha ao restaurar backup: $($_.Exception.Message)" Red }
    exit 1
}
