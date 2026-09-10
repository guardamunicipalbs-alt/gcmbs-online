$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Root='D:\GCMBS'
$Android=Join-Path $Root 'mobile\android'
$ReleaseDir=Join-Path $Android 'app\build\outputs\apk\release'
$Sdk=if($env:ANDROID_HOME){$env:ANDROID_HOME}else{"$env:LOCALAPPDATA\Android\Sdk"}
$Out=Join-Path $Root 'GCMBS-Android-10.0.86-V136.apk'
$Package='br.gov.brejosanto.gcmbs'
$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'

function Say([string]$t,[ConsoleColor]$c='Gray'){Write-Host $t -ForegroundColor $c}
function Need([string]$p,[string]$n){if(!(Test-Path -LiteralPath $p)){throw "$n nao encontrado: $p"}}
function Sha([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToUpperInvariant()}
function RunCapture([string]$Exe,[string[]]$Args,[string]$Name){
  $o=Join-Path $env:TEMP "GCMBS_${Name}_${Stamp}_out.txt"
  $e=Join-Path $env:TEMP "GCMBS_${Name}_${Stamp}_err.txt"
  Remove-Item $o,$e -Force -ErrorAction SilentlyContinue
  $p=Start-Process -FilePath $Exe -ArgumentList $Args -Wait -PassThru -NoNewWindow -RedirectStandardOutput $o -RedirectStandardError $e
  $txt=@()
  if(Test-Path $o){$txt+=Get-Content $o -ErrorAction SilentlyContinue}
  if(Test-Path $e){$txt+=Get-Content $e -ErrorAction SilentlyContinue}
  [pscustomobject]@{ExitCode=$p.ExitCode;Text=($txt -join "`n")}
}
function CertDigest([string]$Text){
  $m=[regex]::Match($Text,'(?im)Signer #1 certificate SHA-256 digest:\s*([0-9A-F:]+)')
  if(!$m.Success){return ''}
  return ($m.Groups[1].Value -replace ':','').ToUpperInvariant()
}

try{
  Say ('='*80) Cyan
  Say ' GCMBS ANDROID 10.0.86 - V136 R5 / ASSINATURA SEGURA' Cyan
  Say ' Trata corretamente APK unsigned e compara certificado com o app instalado' Cyan
  Say ('='*80) Cyan

  Need $ReleaseDir 'Pasta release'
  $Candidates=@(Get-ChildItem -LiteralPath $ReleaseDir -Filter '*.apk' -File -ErrorAction Stop |
    Where-Object {$_.Name -match '^app-release.*\.apk$'} |
    Sort-Object @{Expression={if($_.Name -eq 'app-release.apk'){0}elseif($_.Name -match 'unsigned'){1}else{2}}},LastWriteTime -Descending)
  if($Candidates.Count -lt 1){throw 'Nenhum APK release encontrado.'}
  $Built=$Candidates[0].FullName
  Say "[OK] APK compilado: $Built" Green
  Say "[OK] Tamanho: $([math]::Round((Get-Item $Built).Length/1MB,2)) MB" Green

  $BuildTools=Join-Path $Sdk 'build-tools'
  Need $BuildTools 'Android build-tools'
  $ToolDirs=@(Get-ChildItem -LiteralPath $BuildTools -Directory | Sort-Object {[version]$_.Name} -Descending)
  $Tools=$null
  foreach($d in $ToolDirs){
    $a=Join-Path $d.FullName 'apksigner.bat';$z=Join-Path $d.FullName 'zipalign.exe';$aa=Join-Path $d.FullName 'aapt.exe'
    if((Test-Path $a)-and(Test-Path $z)){$Tools=[pscustomobject]@{ApkSigner=$a;ZipAlign=$z;Aapt=$aa};break}
  }
  if(!$Tools){throw 'apksigner/zipalign nao encontrados.'}
  Say "[OK] apksigner: $($Tools.ApkSigner)" Green

  # Um APK unsigned faz apksigner retornar codigo != 0. Isso e informacao, nao excecao.
  $Check=RunCapture $Tools.ApkSigner @('verify','--verbose','--print-certs',$Built) 'verify_build'
  $AlreadySigned=($Check.ExitCode -eq 0)

  if($AlreadySigned){
    Say '[OK] APK compilado ja esta assinado.' Green
    Copy-Item -LiteralPath $Built -Destination $Out -Force
  }else{
    Say '[INFO] APK compilado esta unsigned, como esperado para assembleRelease sem signingConfig.' Yellow

    $KeyCandidates=@()
    foreach($Dir in @('D:\GCMBS_KEYS','C:\GCMBS_KEYS','C:\GCMBS_KEYS_BACKUP')){
      if(Test-Path -LiteralPath $Dir){
        $KeyCandidates+=@(Get-ChildItem -LiteralPath $Dir -File -Recurse -ErrorAction SilentlyContinue |
          Where-Object {$_.Extension -in @('.jks','.keystore')})
      }
    }
    $KeyCandidates=@($KeyCandidates | Sort-Object FullName -Unique)
    if($KeyCandidates.Count -lt 1){throw 'Nenhum .jks/.keystore institucional localizado em D:\GCMBS_KEYS, C:\GCMBS_KEYS ou C:\GCMBS_KEYS_BACKUP.'}

    if($KeyCandidates.Count -eq 1){
      $KeyStore=$KeyCandidates[0].FullName
    }else{
      Say 'Foram encontradas varias chaves. Selecione a chave institucional usada nas versoes atuais:' Yellow
      for($i=0;$i-lt $KeyCandidates.Count;$i++){Write-Host "[$($i+1)] $($KeyCandidates[$i].FullName)"}
      $Sel=[int](Read-Host 'Numero da chave')
      if($Sel -lt 1 -or $Sel -gt $KeyCandidates.Count){throw 'Selecao de chave invalida.'}
      $KeyStore=$KeyCandidates[$Sel-1].FullName
    }
    Say "[OK] Keystore selecionado: $KeyStore" Green

    $Aligned=Join-Path $ReleaseDir 'app-release-v136-r5-aligned.apk'
    Remove-Item $Aligned,$Out -Force -ErrorAction SilentlyContinue
    & $Tools.ZipAlign -f -p 4 $Built $Aligned
    if($LASTEXITCODE-ne 0){throw 'Falha no zipalign.'}
    & $Tools.ZipAlign -c -v 4 $Aligned | Out-Null
    if($LASTEXITCODE-ne 0){throw 'Verificacao zipalign falhou.'}
    Say '[OK] zipalign concluido.' Green

    $KsSecure=Read-Host 'Senha do keystore institucional' -AsSecureString
    $KeySecure=Read-Host 'Senha da chave (Enter se for a mesma do keystore)' -AsSecureString
    $b1=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($KsSecure)
    try{$KsPlain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b1)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b1)}
    $b2=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($KeySecure)
    try{$KeyPlain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b2)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b2)}
    if([string]::IsNullOrEmpty($KeyPlain)){$KeyPlain=$KsPlain}
    $env:GCMBS_KS_PASS=$KsPlain;$env:GCMBS_KEY_PASS=$KeyPlain
    try{
      # O alias e omitido de proposito: se o keystore possuir uma unica chave, apksigner seleciona-a.
      # Caso possua mais de uma, ele informara a necessidade do alias sem publicar nada.
      $Sign=RunCapture $Tools.ApkSigner @('sign','--ks',$KeyStore,'--ks-pass','env:GCMBS_KS_PASS','--key-pass','env:GCMBS_KEY_PASS','--out',$Out,$Aligned) 'sign'
      if($Sign.ExitCode-ne 0){
        if($Sign.Text){Write-Host $Sign.Text}
        throw 'Falha ao assinar APK com a chave selecionada.'
      }
    }finally{
      Remove-Item Env:GCMBS_KS_PASS -ErrorAction SilentlyContinue
      Remove-Item Env:GCMBS_KEY_PASS -ErrorAction SilentlyContinue
      $KsPlain=$null;$KeyPlain=$null
    }
    Say '[OK] APK assinado.' Green
  }

  Need $Out 'APK final'
  $Final=RunCapture $Tools.ApkSigner @('verify','--verbose','--print-certs',$Out) 'verify_final'
  if($Final.ExitCode-ne 0){if($Final.Text){Write-Host $Final.Text};throw 'APK final nao passou na verificacao de assinatura.'}
  $NewDigest=CertDigest $Final.Text
  if(!$NewDigest){throw 'Nao foi possivel obter SHA-256 do certificado do APK novo.'}
  Say "[OK] Certificado novo SHA-256: $NewDigest" Green

  $PackageInfo=''
  if(Test-Path -LiteralPath $Tools.Aapt){
    $Aapt=RunCapture $Tools.Aapt @('dump','badging',$Out) 'aapt'
    if($Aapt.ExitCode-eq 0){$PackageInfo=($Aapt.Text -split "`n" | Where-Object {$_ -match '^package: name='} | Select-Object -First 1)}
  }

  # Compara com o app efetivamente instalado, quando ADB estiver disponivel.
  $CertMatch='NAO COMPARADO'
  $Adb=Join-Path $Sdk 'platform-tools\adb.exe'
  if(Test-Path -LiteralPath $Adb){
    $Dev=& $Adb devices
    $Connected=@($Dev | Select-String "\tdevice$")
    if($Connected.Count -gt 0){
      $Pm=& $Adb shell pm path $Package 2>$null
      $Remote=($Pm | Select-String '^package:' | Select-Object -First 1).Line
      if($Remote){
        $Remote=$Remote.Substring(8).Trim()
        $Installed=Join-Path $env:TEMP "GCMBS_INSTALLED_$Stamp.apk"
        Remove-Item $Installed -Force -ErrorAction SilentlyContinue
        & $Adb pull $Remote $Installed | Out-Null
        if($LASTEXITCODE-eq 0 -and (Test-Path $Installed)){
          $Old=RunCapture $Tools.ApkSigner @('verify','--verbose','--print-certs',$Installed) 'verify_installed'
          if($Old.ExitCode-eq 0){
            $OldDigest=CertDigest $Old.Text
            Say "[OK] Certificado instalado SHA-256: $OldDigest" Green
            if($OldDigest -eq $NewDigest){$CertMatch='IGUAL'}else{$CertMatch='DIFERENTE'}
          }
        }
      }
    }
  }

  Say ('='*80) Cyan
  Say '[OK] APK 10.0.86 V136 R5 FINALIZADO' Green
  Say "APK: $Out" Green
  Say "SHA-256: $(Sha $Out)" Green
  if($PackageInfo){Say "PACOTE: $PackageInfo" Green}
  Say "CERTIFICADO NOVO: $NewDigest" Green
  if($CertMatch -eq 'IGUAL'){
    Say 'CERTIFICADO APP INSTALADO: IGUAL - atualizacao compativel por assinatura.' Green
    Say 'Ainda nao publique: execute o teste funcional no aparelho primeiro.' Yellow
  }elseif($CertMatch -eq 'DIFERENTE'){
    Say 'CERTIFICADO APP INSTALADO: DIFERENTE - NAO INSTALE.' Red
    throw 'A assinatura do APK novo difere do aplicativo instalado.'
  }else{
    Say 'CERTIFICADO APP INSTALADO: NAO COMPARADO - NAO INSTALE AINDA.' Yellow
    Say 'Conecte o celular por USB/ADB para comparar antes da instalacao.' Yellow
  }
  Say ('='*80) Cyan
}catch{
  Say ('='*80) Red
  Say 'FINALIZACAO V136 R5 INTERROMPIDA' Red
  Say $_.Exception.Message Red
  Say 'Nao publique nem instale APK parcial.' Yellow
  Say ('='*80) Red
  exit 1
}
