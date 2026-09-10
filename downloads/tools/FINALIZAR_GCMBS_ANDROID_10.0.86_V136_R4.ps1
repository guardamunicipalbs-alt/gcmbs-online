$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Root='D:\GCMBS'
$Android=Join-Path $Root 'mobile\android'
$ReleaseDir=Join-Path $Android 'app\build\outputs\apk\release'
$Sdk=if($env:ANDROID_HOME){$env:ANDROID_HOME}else{"$env:LOCALAPPDATA\Android\Sdk"}
$Version='10.0.86'
$Out=Join-Path $Root 'GCMBS-Android-10.0.86-V136.apk'
$Alias='gcmbs_release'

function Say([string]$t,[ConsoleColor]$c='Gray'){Write-Host $t -ForegroundColor $c}
function Need([string]$p,[string]$n){if(!(Test-Path -LiteralPath $p)){throw "$n nao encontrado: $p"}}
function Sha([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToUpperInvariant()}

try{
  Say ('='*78) Cyan
  Say ' GCMBS ANDROID 10.0.86 - V136 R4 / FINALIZACAO' Cyan
  Say ' Retoma apos BUILD SUCCESSFUL sem recompilar' Cyan
  Say ('='*78) Cyan

  Need $ReleaseDir 'Pasta de release'
  $ReleaseCandidates=@(
    @(Get-ChildItem -LiteralPath $ReleaseDir -Filter '*.apk' -File -ErrorAction Stop |
      Where-Object { $_.Name -match '^app-release.*\.apk$' } |
      Sort-Object @{Expression={if($_.Name -eq 'app-release.apk'){0}elseif($_.Name -match 'unsigned'){1}else{2}}},LastWriteTime -Descending)
  )
  if($ReleaseCandidates.Count -lt 1){throw 'Nenhum APK release encontrado.'}
  $Built=$ReleaseCandidates[0].FullName
  Say "[OK] APK localizado: $Built" Green
  Say "[OK] Tamanho: $([math]::Round((Get-Item $Built).Length/1MB,2)) MB" Green

  $BuildTools=Join-Path $Sdk 'build-tools'
  Need $BuildTools 'Android build-tools'
  $ToolDirs=Get-ChildItem -LiteralPath $BuildTools -Directory | Sort-Object {[version]$_.Name} -Descending
  $Tools=$null
  foreach($d in $ToolDirs){
    $a=Join-Path $d.FullName 'apksigner.bat';$z=Join-Path $d.FullName 'zipalign.exe';$aa=Join-Path $d.FullName 'aapt.exe'
    if((Test-Path $a) -and (Test-Path $z)){ $Tools=[pscustomobject]@{ApkSigner=$a;ZipAlign=$z;Aapt=$aa}; break }
  }
  if(!$Tools){throw 'apksigner/zipalign nao encontrados.'}
  Say "[OK] apksigner: $($Tools.ApkSigner)" Green

  # Verifica se o APK ja veio assinado. O bug anterior era $ReleaseCandidates[0]
  # aplicado sobre string escalar, que virava apenas a letra D.
  $VerifyOutput=& $Tools.ApkSigner verify --verbose --print-certs $Built 2>&1
  $AlreadySigned=($LASTEXITCODE -eq 0)

  if($AlreadySigned){
    Say '[OK] APK de build ja esta assinado.' Green
    Copy-Item -LiteralPath $Built -Destination $Out -Force
  } else {
    Say '[INFO] APK de build esta unsigned; sera assinado com a chave institucional.' Yellow

    $KeyStore=$null
    foreach($k in @(
      'C:\GCMBS_KEYS\GCMBS_RELEASE.jks',
      'D:\GCMBS_KEYS\GCMBS_RELEASE.jks',
      'C:\GCMBS_KEYS_BACKUP\GCMBS_RELEASE.jks'
    )){if(Test-Path -LiteralPath $k){$KeyStore=$k;break}}
    if(!$KeyStore){throw 'GCMBS_RELEASE.jks nao encontrado nos caminhos institucionais.'}
    Say "[OK] Keystore: $KeyStore" Green

    $Aligned=Join-Path $ReleaseDir 'app-release-v136-aligned.apk'
    Remove-Item $Aligned -Force -ErrorAction SilentlyContinue
    & $Tools.ZipAlign -f -p 4 $Built $Aligned
    if($LASTEXITCODE-ne 0){throw 'Falha no zipalign.'}
    & $Tools.ZipAlign -c -v 4 $Aligned | Out-Null
    if($LASTEXITCODE-ne 0){throw 'APK alinhado falhou na verificacao.'}
    Say '[OK] zipalign concluido.' Green

    $KsSecure=Read-Host 'Senha do keystore GCMBS_RELEASE.jks' -AsSecureString
    $KeySecure=Read-Host 'Senha da chave gcmbs_release (Enter se for a mesma)' -AsSecureString
    $b1=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($KsSecure)
    try{$KsPlain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b1)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b1)}
    $b2=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($KeySecure)
    try{$KeyPlain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b2)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b2)}
    if([string]::IsNullOrEmpty($KeyPlain)){$KeyPlain=$KsPlain}
    $env:GCMBS_KS_PASS=$KsPlain
    $env:GCMBS_KEY_PASS=$KeyPlain

    Remove-Item $Out -Force -ErrorAction SilentlyContinue
    try{
      & $Tools.ApkSigner sign --ks $KeyStore --ks-key-alias $Alias --ks-pass env:GCMBS_KS_PASS --key-pass env:GCMBS_KEY_PASS --out $Out $Aligned
      if($LASTEXITCODE-ne 0){throw 'Falha ao assinar APK.'}
    } finally {
      Remove-Item Env:GCMBS_KS_PASS -ErrorAction SilentlyContinue
      Remove-Item Env:GCMBS_KEY_PASS -ErrorAction SilentlyContinue
      $KsPlain=$null;$KeyPlain=$null
    }
  }

  Need $Out 'APK final'
  $FinalVerify=& $Tools.ApkSigner verify --verbose --print-certs $Out 2>&1
  if($LASTEXITCODE-ne 0){$FinalVerify|ForEach-Object{Write-Host $_};throw 'Assinatura final invalida.'}

  $PackageInfo=''
  if(Test-Path -LiteralPath $Tools.Aapt){
    $PackageInfo=(& $Tools.Aapt dump badging $Out 2>&1 | Select-String "^package: name=").Line
  }

  Say ('='*78) Cyan
  Say '[OK] APK 10.0.86 V136 FINALIZADO' Green
  Say "APK: $Out" Green
  Say "SHA-256: $(Sha $Out)" Green
  if($PackageInfo){Say "PACOTE: $PackageInfo" Green}
  Say 'ASSINATURA:' Cyan
  $FinalVerify | Where-Object {$_ -match 'Verified using|Signer #1 certificate (DN|SHA-256 digest)'} | ForEach-Object {Write-Host $_}
  Say 'NAO DESINSTALE O APP ATUAL. Antes da instalacao, comparar certificado com o app instalado.' Yellow
  Say ('='*78) Cyan
}catch{
  Say ('='*78) Red
  Say 'FINALIZACAO V136 R4 INTERROMPIDA' Red
  Say $_.Exception.Message Red
  Say 'Nao publique nem instale APK parcial.' Yellow
  Say ('='*78) Red
  exit 1
}
