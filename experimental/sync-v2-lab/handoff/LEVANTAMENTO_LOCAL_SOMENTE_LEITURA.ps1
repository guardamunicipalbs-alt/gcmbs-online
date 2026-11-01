#requires -version 5.1
<#
GCMBS Sync V2 - levantamento local SOMENTE LEITURA.
Rodar futuramente em Windows PowerShell. Nao apaga, copia, reinicia ou
modifica arquivos do GCMBS. Nao le conteudo do banco SQLite e nao envia dados
automaticamente para nenhum servidor.
Resultado: um JSON de metadados e hashes, salvo fora da pasta do GCMBS.
#>
[CmdletBinding()]
param(
  [string] $OutputPath = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'GCMBS_SyncV2_Levantamento.json')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Safe-FileInfo([string]$FilePath) {
  if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) { return $null }
  $file = Get-Item -LiteralPath $FilePath -ErrorAction Stop
  $sha = Get-FileHash -LiteralPath $FilePath -Algorithm SHA256 -ErrorAction Stop
  [PSCustomObject]@{
    RelativeOrName = $file.Name
    LengthBytes = $file.Length
    ModifiedUtc = $file.LastWriteTimeUtc.ToString('o')
    SHA256 = $sha.Hash
  }
}
$roots = @('F:\GCMBS','G:\GCMBS','D:\GCMBS')
$candidates = @()
foreach ($root in $roots) {
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
  $main = Join-Path $root 'main.js'
  $pkgPath = Join-Path $root 'package.json'
  $services = @('src\services\MobileFullMirrorService.js',
                'src\services\MobileCloudSyncService.js',
                'src\services\MobileOutboxService.js')
  $serviceInfo = @()
  foreach ($relative in $services) {
    $full = Join-Path $root $relative
    $meta = Safe-FileInfo $full
    if ($null -ne $meta) {
      $serviceInfo += [PSCustomObject]@{ RelativePath = $relative; Meta = $meta }
    }
  }
  $packageInfo = Safe-FileInfo $pkgPath
  $version = $null
  if ($null -ne $packageInfo) {
    try {
      $raw = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8
      $obj = ConvertFrom-Json -InputObject $raw
      $version = [string]$obj.version
    } catch { $version = 'VERSAO_NAO_IDENTIFICADA' }
  }
  $capacitorFiles = @()
  foreach ($relative in @('capacitor.config.ts','capacitor.config.json',
                          'src\mobile\capacitor.config.ts',
                          'android\app\build.gradle')) {
    $meta = Safe-FileInfo (Join-Path $root $relative)
    if ($null -ne $meta) {
      $capacitorFiles += [PSCustomObject]@{ RelativePath = $relative; Meta = $meta }
    }
  }
  $candidates += [PSCustomObject]@{
    Root = $root
    Main = Safe-FileInfo $main
    Version = $version
    PackageJson = $packageInfo
    Services = @($serviceInfo)
    MobileFiles = @($capacitorFiles)
    AndroidDirectoryPresent = (Test-Path -LiteralPath (Join-Path $root 'android') -PathType Container)
    DatabaseMetadataCollected = $false
  }
}
if (-not $candidates.Count) {
  Write-Warning 'Nao encontrei nenhuma raiz do GCMBS nos caminhos padrao.'
}
$result = [PSCustomObject]@{
  Product = 'GCMBS Sync V2 - levantamento local sem alteracoes'
  GeneratedAtUtc = [DateTime]::UtcNow.ToString('o')
  MachineName = $env:COMPUTERNAME
  ReadOnly = $true
  NoDatabaseContents = $true
  NoTokensOrCredentials = $true
  Candidates = @($candidates)
}
$parent = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
  throw "Pasta de saida nao existe: $parent"
}
if (Test-Path -LiteralPath $OutputPath) {
  throw "O relatorio ja existe; para evitar sobrescrever, escolha outro OutputPath."
}
$json = $result | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($OutputPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Relatorio SOMENTE LEITURA salvo em: $OutputPath"
Write-Host "Revise o JSON antes de compartilhar: contem caminhos, versoes, hashes e nome do computador."
