$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$Version='10.0.77';$Source='https://raw.githubusercontent.com/guardamunicipalbs-alt/gcmbs-online/main';$Stamp=Get-Date -Format 'yyyyMMdd_HHmmss'
function Say([string]$t,[ConsoleColor]$c='Gray'){Write-Host $t -ForegroundColor $c}
function Sha([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToUpperInvariant()}
function Need([string]$p,[string]$n){if(!(Test-Path -LiteralPath $p)){throw "$n nao encontrado: $p"}}
function Dl([string]$r,[string]$d){Invoke-WebRequest -UseBasicParsing -Uri "$Source/$($r.Replace('\','/'))?v=100084" -OutFile $d;Need $d $r;if((Get-Item $d).Length-lt 50){throw "Download incompleto: $r"}}
function FirstExisting($items){foreach($x in $items){if($x -and (Test-Path -LiteralPath $x)){return $x}};return $null}
try{
 Say ('='*76) Cyan;Say ' GCMBS ANDROID 10.0.77 - HF84 UTF-8 + BRASAO' Cyan;Say ('='*76) Cyan
 $Root=FirstExisting @('D:\GCMBS','D:\GCMBS\GCMBS','G:\GCMBS','G:\GCMBS\GCMBS');if(!$Root){throw 'Projeto GCMBS nao encontrado em D: ou G:'};Need (Join-Path $Root 'package.json') 'package.json';Say "[OK] Projeto: $Root" Green
 $Mobile=Join-Path $Root 'mobile';$Www=Join-Path $Mobile 'www';$Android=Join-Path $Mobile 'android';$Assets=Join-Path $Android 'app\src\main\assets\public';Need $Www 'mobile\www';Need (Join-Path $Android 'gradlew.bat') 'Gradle wrapper'
 $Sdk=FirstExisting @($env:ANDROID_HOME,$env:ANDROID_SDK_ROOT,"$env:LOCALAPPDATA\Android\Sdk",'D:\Sdk','G:\Sdk');if(!$Sdk){throw 'Android SDK nao encontrado'};$env:ANDROID_HOME=$Sdk;$env:ANDROID_SDK_ROOT=$Sdk;$env:GRADLE_USER_HOME=Join-Path $Root '.gradle-gcmbs';New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME -Force|Out-Null;Say "[OK] Android SDK: $Sdk" Green
 $Java=$null;if($env:JAVA_HOME -and (Test-Path $env:JAVA_HOME)){$Java=$env:JAVA_HOME}else{$Candidates=@('C:\Program Files\Eclipse Adoptium\jdk-21.0.12.1-hotspot','C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot','C:\Program Files\Java\jdk-21');$Java=FirstExisting $Candidates;if(!$Java){$J=(Get-Command javac -ErrorAction SilentlyContinue);if($J){$Java=Split-Path (Split-Path $J.Source -Parent) -Parent}}};if(!$Java){throw 'JDK nao encontrado'};$env:JAVA_HOME=$Java;$env:Path="$Java\bin;$Sdk\platform-tools;$env:Path";Say "[OK] JAVA_HOME: $Java" Green
 $Node=(Get-Command node -ErrorAction Stop).Source;$Npx=(Get-Command npx.cmd -ErrorAction SilentlyContinue);if(!$Npx){$Npx=(Get-Command npx -ErrorAction Stop)};Say "[OK] Node: $Node" Green
 $Protected=@((Join-Path $Root 'src\services\GeradorEscalaService.js'),(Join-Path $Root 'src\database\sige_gcm.db'),(Join-Path $Root 'database\sige_gcm.db'))|Where-Object{Test-Path $_};$Before=@{};foreach($p in $Protected){$Before[$p]=Sha $p}
 $Backup=Join-Path $Root "backup_ANDROID_HF84_$Stamp";New-Item -ItemType Directory -Path $Backup -Force|Out-Null;Copy-Item $Www (Join-Path $Backup 'www') -Recurse -Force;Say "[OK] Backup: $Backup" Green
 $Tmp=Join-Path $env:TEMP "GCMBS_HF84_$Stamp";New-Item -ItemType Directory -Path $Tmp -Force|Out-Null;Dl 'js/hf84-utf8-branding-fix.js' (Join-Path $Tmp 'hf84-utf8-branding-fix.js');Dl 'js/gcmbs-design-system-v76.js' (Join-Path $Tmp 'gcmbs-design-system-v76.js')
 & $Node --check (Join-Path $Tmp 'hf84-utf8-branding-fix.js');if($LASTEXITCODE-ne 0){throw 'HF84 JavaScript invalido'};& $Node --check (Join-Path $Tmp 'gcmbs-design-system-v76.js');if($LASTEXITCODE-ne 0){throw 'Bootstrap JavaScript invalido'}
 New-Item -ItemType Directory -Path (Join-Path $Www 'js') -Force|Out-Null;Copy-Item (Join-Path $Tmp 'hf84-utf8-branding-fix.js') (Join-Path $Www 'js\hf84-utf8-branding-fix.js') -Force;Copy-Item (Join-Path $Tmp 'gcmbs-design-system-v76.js') (Join-Path $Www 'js\gcmbs-design-system-v76.js') -Force;Dl 'brasao-gcmbs.png' (Join-Path $Www 'brasao-gcmbs.png')
 Push-Location $Mobile;try{& $Npx.Source cap sync android;if($LASTEXITCODE-ne 0){throw 'Falha no npx cap sync android'}}finally{Pop-Location}
 Need (Join-Path $Assets 'js\hf84-utf8-branding-fix.js') 'HF84 nos assets Android';if((Sha (Join-Path $Www 'js\hf84-utf8-branding-fix.js'))-ne(Sha (Join-Path $Assets 'js\hf84-utf8-branding-fix.js'))){throw 'HF84 divergente entre WWW e assets Android'}
 $Gradle=Join-Path $Android 'app\build.gradle';Need $Gradle 'app/build.gradle';$g=Get-Content $Gradle -Raw;$g=[regex]::Replace($g,'versionCode\s+\d+','versionCode 77');$g=[regex]::Replace($g,'versionName\s+"[^"]+"','versionName "10.0.77"');Set-Content $Gradle $g -Encoding UTF8
 Push-Location $Android;try{& .\gradlew.bat clean assembleDebug;if($LASTEXITCODE-ne 0){throw 'Falha no Gradle assembleDebug'}}finally{Pop-Location}
 $Built=Join-Path $Android 'app\build\outputs\apk\debug\app-debug.apk';Need $Built 'APK compilado';$Out=Join-Path $Root 'GCMBS-Android-10.0.77-HF84.apk';Copy-Item $Built $Out -Force
 foreach($p in $Protected){if((Sha $p)-ne $Before[$p]){throw "Arquivo protegido alterado: $p"}}
 $Report=Join-Path $Root "RELATORIO_ANDROID_HF84_$Stamp.txt";@("GCMBS Android $Version - HF84","Projeto: $Root","SDK: $Sdk","JAVA_HOME: $Java","APK: $Out","SHA-256: $(Sha $Out)",'HF84 UTF-8: OK','Brasao: OK','Capacitor sync: OK','Gerador/SQLite: PRESERVADOS')|Set-Content $Report -Encoding UTF8
 Say ('='*76) Cyan;Say '[OK] APK 10.0.77 HF84 COMPILADO' Green;Say "APK: $Out" Green;Say "SHA-256: $(Sha $Out)" Green;Say "Relatorio: $Report" Green;Say 'NAO desinstale o aplicativo atual.' Yellow
}catch{Say 'HF84 ANDROID INTERROMPIDO' Red;Say $_.Exception.Message Red;exit 1}
