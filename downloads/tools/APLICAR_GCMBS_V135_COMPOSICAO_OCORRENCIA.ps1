$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$SourceCommit = '03c630efbc4fffeded49652646273a565e9ba175'
$RepoRaw = "https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/$SourceCommit"
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

function Say([string]$Text,[ConsoleColor]$Color='Gray') { Write-Host $Text -ForegroundColor $Color }

function Find-GcmbsRoot {
    $candidatos = @(
        'D:\gcmbs',
        'D:\GCMBS',
        'G:\GCMBS',
        'G:\GCMBS\GCMBS',
        'C:\GCMBS'
    )
    foreach ($c in $candidatos) {
        if (Test-Path -LiteralPath (Join-Path $c 'package.json')) { return $c }
    }
    throw 'Projeto GCMBS não encontrado. Foram verificados D:\gcmbs, D:\GCMBS, G:\GCMBS, G:\GCMBS\GCMBS e C:\GCMBS.'
}

function Backup-File([string]$Path,[string]$BackupRoot,[string]$Root) {
    if (!(Test-Path -LiteralPath $Path)) { return }
    $rel = $Path.Substring($Root.Length).TrimStart('\')
    $dest = Join-Path $BackupRoot $rel
    $dir = Split-Path -Parent $dest
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item -LiteralPath $Path -Destination $dest -Force
}

function Patch-AppCore([string]$Path,[string]$BackupRoot,[string]$Root) {
    if (!(Test-Path -LiteralPath $Path)) { return $false }
    $txt = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ($txt -match 'suggested_team' -and $txt -match 'preencherEquipeOcorrencia') {
        Say "[OK] Já corrigido: $Path" DarkGray
        return $true
    }

    $old = @'
async function preencherEquipeOcorrencia(){const data=$('occData').value,hora=$('occHora').value||nowTime();let ctx={team:[]};try{ctx=await provider.occurrenceContext(data,hora)}catch{}const teamIds=new Set((ctx.team||[]).map(x=>Number(x.guarda_id)));teamIds.add(Number(provider.session?.guarda_id));const refs=provider.references().guardas||[];$('occEquipe').innerHTML=refs.map(g=>`<label class="${teamIds.has(Number(g.id))?'suggested':''}"><input type="checkbox" class="occ-team" value="${g.id}" ${teamIds.has(Number(g.id))?'checked':''}> ${esc(g.nome_guerra||g.nome_completo)}</label>`).join('');document.querySelectorAll('.occ-team').forEach(x=>x.addEventListener('change',atualizarOccCondutor));atualizarOccCondutor()}
'@

    $new = @'
async function preencherEquipeOcorrencia(){const data=$('occData').value,hora=$('occHora').value||nowTime();let ctx={team:[],suggested_team:[]};try{ctx=await provider.occurrenceContext(data,hora)}catch{}const sugestoes=Array.isArray(ctx.suggested_team)?ctx.suggested_team:(ctx.team||[]);const teamIds=new Set(sugestoes.map(x=>Number(x.guarda_id)));const refs=provider.references().guardas||[];$('occEquipe').innerHTML=refs.map(g=>`<label class="${teamIds.has(Number(g.id))?'suggested':''}"><input type="checkbox" class="occ-team" value="${g.id}"> ${esc(g.nome_guerra||g.nome_completo)}</label>`).join('');document.querySelectorAll('.occ-team').forEach(x=>x.addEventListener('change',atualizarOccCondutor));atualizarOccCondutor()}
'@

    if (!$txt.Contains($old.TrimEnd("`r","`n"))) {
        return $false
    }

    Backup-File $Path $BackupRoot $Root
    $txt = $txt.Replace($old.TrimEnd("`r","`n"),$new.TrimEnd("`r","`n"))
    Set-Content -LiteralPath $Path -Value $txt -Encoding UTF8
    Say "[OK] Seleção automática removida: $Path" Green
    return $true
}

function Patch-Index([string]$Path,[string]$BackupRoot,[string]$Root) {
    if (!(Test-Path -LiteralPath $Path)) { return }
    $txt = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $old = 'Os GCMs escalados no período aparecem pré-selecionados quando possível.'
    $new = 'Os GCMs escalados no período aparecem destacados como sugestão. Marque somente quem realmente integrou a ocorrência.'
    if ($txt.Contains($old)) {
        Backup-File $Path $BackupRoot $Root
        Set-Content -LiteralPath $Path -Value ($txt.Replace($old,$new)) -Encoding UTF8
        Say "[OK] Texto do formulário atualizado: $Path" Green
    }
}

try {
    Say '====================================================================' Cyan
    Say ' GCMBS V135 - COMPOSIÇÃO DE EQUIPE EM OCORRÊNCIAS' Cyan
    Say ' Seleção explícita no Online, App e cópias locais do Desktop' Cyan
    Say '====================================================================' Cyan

    $Root = Find-GcmbsRoot
    Say "[OK] Projeto localizado: $Root" Green

    $BackupRoot = Join-Path $Root "backup_V135_OCORRENCIAS_$Stamp"
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    Say "[OK] Backup: $BackupRoot" Green

    $temp = Join-Path $env:TEMP "gcmbs_v135_$Stamp"
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    $remoteHotfix = Join-Path $temp 'gcmbs-online-app-v122-controls.js'
    $remoteSw = Join-Path $temp 'sw.js'

    Say '[INFO] Baixando o hotfix V135 publicado...' Cyan
    Invoke-WebRequest -Uri "$RepoRaw/js/gcmbs-online-app-v122-controls.js" -OutFile $remoteHotfix -UseBasicParsing
    Invoke-WebRequest -Uri "$RepoRaw/sw.js" -OutFile $remoteSw -UseBasicParsing

    $webTrees = @(
        (Join-Path $Root 'cloud\public'),
        (Join-Path $Root 'mobile\www'),
        (Join-Path $Root 'mobile\android\app\src\main\assets\public')
    ) | Where-Object { Test-Path -LiteralPath $_ }

    if (!$webTrees.Count) { Say '[AVISO] Nenhuma árvore web padrão foi encontrada.' Yellow }

    foreach ($tree in $webTrees) {
        $jsDir = Join-Path $tree 'js'
        New-Item -ItemType Directory -Path $jsDir -Force | Out-Null
        $hotfixDest = Join-Path $jsDir 'gcmbs-online-app-v122-controls.js'
        $swDest = Join-Path $tree 'sw.js'
        Backup-File $hotfixDest $BackupRoot $Root
        Backup-File $swDest $BackupRoot $Root
        Copy-Item -LiteralPath $remoteHotfix -Destination $hotfixDest -Force
        Copy-Item -LiteralPath $remoteSw -Destination $swDest -Force
        Patch-AppCore (Join-Path $jsDir 'app-core.js') $BackupRoot $Root | Out-Null
        Patch-Index (Join-Path $tree 'index.html') $BackupRoot $Root
        Say "[OK] Árvore atualizada: $tree" Green
    }

    # Procura também cópias do manipulador de ocorrência fora das árvores web,
    # inclusive eventual renderer do Desktop Electron, sem tocar node_modules/backups.
    $searchRoots = @('src','cloud','mobile') | ForEach-Object { Join-Path $Root $_ } | Where-Object { Test-Path -LiteralPath $_ }
    $patchedExtra = 0
    foreach ($sr in $searchRoots) {
        Get-ChildItem -LiteralPath $sr -Recurse -File -Filter '*.js' -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\node_modules\\|\\backup_|\\dist\\|\\build\\' } |
            ForEach-Object {
                try {
                    $probe = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
                    if ($probe -match 'preencherEquipeOcorrencia') {
                        if (Patch-AppCore $_.FullName $BackupRoot $Root) { $patchedExtra++ }
                    }
                } catch {}
            }
    }

    # Validação sintática dos arquivos alterados quando Node estiver disponível.
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        foreach ($tree in $webTrees) {
            foreach ($rel in @('js\app-core.js','js\gcmbs-online-app-v122-controls.js','sw.js')) {
                $f = Join-Path $tree $rel
                if (Test-Path -LiteralPath $f) {
                    & $node.Source --check $f | Out-Null
                    if ($LASTEXITCODE -ne 0) { throw "JavaScript inválido após correção: $f" }
                }
            }
        }
        Say '[OK] JavaScript validado pelo Node.' Green
    }

    Say ''
    Say '====================================================================' Green
    Say ' V135 APLICADO NAS FONTES LOCAIS DISPONÍVEIS' Green
    Say '====================================================================' Green
    Say 'Regra final:' Yellow
    Say '  - escala do período = somente sugestão visual;' Yellow
    Say '  - nenhum GCM entra automaticamente na composição;' Yellow
    Say '  - somente caixas marcadas manualmente são salvas;' Yellow
    Say '  - o condutor deve estar entre os integrantes escolhidos.' Yellow
    Say ''
    Say "Backup: $BackupRoot" DarkGray
    Say ''
    Say 'Abra o Desktop e use SINCRONIZAR AGORA para receber a correção da Ocorrência 2.' Cyan
    Say 'Para um APK novo, use o fluxo normal de build/assinatura do projeto após este patch.' Cyan
}
catch {
    Say ''
    Say 'ERRO AO APLICAR V135:' Red
    Say $_.Exception.Message Red
    exit 1
}
