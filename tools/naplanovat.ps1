# Zaregistruje denní kontrolu se zálohou jako naplánovanou úlohu Windows.
#
# Úloha spustí tools\audit_zaloha.py — ten nejdřív zazálohuje data i hotovou
# appku, pak pustí audit integrity dat a obě testovací sady, a výsledek zapíše
# do zalohy\<datum>\report.txt. Souhrn všech běhů je v zalohy\posledni.txt.
#
# Registrace:   powershell -ExecutionPolicy Bypass -File tools\naplanovat.ps1
# Jiný čas:     powershell -ExecutionPolicy Bypass -File tools\naplanovat.ps1 -Cas "21:30"
# Zrušení:      powershell -ExecutionPolicy Bypass -File tools\naplanovat.ps1 -Odebrat
# Zkusit hned:  powershell -ExecutionPolicy Bypass -File tools\naplanovat.ps1 -Ted
#
# S -Obnovit úloha navíc stáhne akce a ligové žebříčky a zapeče je do appky.
# Pořadí je záloha → obnova → audit → testy, takže když obnova neprojde
# kontrolou, data i appka se vrátí ze zálohy. Bez -Obnovit se nic nestahuje.
#
# S -Nasadit se po úspěšné obnově spustí i deploy.ps1 (GitHub Pages a OneDrive).
# Nasazuje se jen tehdy, když se data opravdu změnila a všechno prošlo.
#
# Denní obnova:  ... \naplanovat.ps1 -Obnovit
# I s nasazením: ... \naplanovat.ps1 -Obnovit -Nasadit
# Celá data:    ... \naplanovat.ps1 -Obnovit -Vsechno   (i pokédex a útoky)

param(
    [string]$Cas = "20:00",
    [switch]$Odebrat,
    [switch]$Ted,
    [switch]$Obnovit,
    [switch]$Vsechno,
    [switch]$Nasadit
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$nazev = "PokemonTracker - kontrola a zaloha"
$skript = Join-Path $root "tools\audit_zaloha.py"

if (-not (Test-Path $skript)) {
    Write-Host "Nenasel jsem $skript" -ForegroundColor Red
    exit 1
}

if ($Odebrat) {
    try {
        Unregister-ScheduledTask -TaskName $nazev -Confirm:$false -ErrorAction Stop
        Write-Host "Uloha '$nazev' odebrana." -ForegroundColor Yellow
    } catch {
        Write-Host "Uloha '$nazev' zaregistrovana nebyla, neni co odebirat."
    }
    exit 0
}

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) {
    Write-Host "Nenasel jsem python v PATH." -ForegroundColor Red
    exit 1
}

# Argumenty pro audit_zaloha.py se skládají stejně pro -Ted i pro úlohu,
# ať ruční zkouška dělá přesně to, co pak poběží samo.
$argy = @()
if ($Obnovit) { if ($Vsechno) { $argy += "--obnovit-vse" } else { $argy += "--obnovit" } }
if ($Nasadit) { $argy += "--nasadit" }

if ($Ted) {
    Write-Host "Zkousim spustit rovnou (bez registrace)..." -ForegroundColor Cyan
    & $python $skript @argy
    exit $LASTEXITCODE
}

$argument = (@("`"$skript`"") + $argy) -join " "
$akce = New-ScheduledTaskAction -Execute $python -Argument $argument -WorkingDirectory $root
$spousteni = New-ScheduledTaskTrigger -Daily -At $Cas
# Nespoustet, kdyz je notebook na baterii, a nechat dobehnout, i kdyby PC spal
$nastaveni = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 45)

Register-ScheduledTask -TaskName $nazev -Action $akce -Trigger $spousteni `
    -Settings $nastaveni -Description "Zaloha dat a appky + audit integrity + testy" -Force | Out-Null

Write-Host ""
Write-Host "Hotovo. Uloha '$nazev' pobezi kazdy den v $Cas." -ForegroundColor Green
if ($Obnovit) {
    $co = if ($Vsechno) { "pokedex, utoky, ligy a akce" } else { "ligy a akce" }
    Write-Host "  + kazdy den obnovi $co a zapece je do appky" -ForegroundColor Green
    Write-Host "    (kdyz kontrola neprojde, data se vrati ze zalohy)"
}
if ($Nasadit) {
    Write-Host "  + po uspesne obnove nasadi na GitHub Pages a do OneDrivu" -ForegroundColor Green
}
Write-Host ""
Write-Host "  zalohy jdou do:   $root\zalohy\<datum_cas>\"
Write-Host "  souhrn behu:      $root\zalohy\posledni.txt"
Write-Host "  detail posledniho: $root\zalohy\<datum_cas>\report.txt"
Write-Host ""
Write-Host "Drzi se poslednich 20 generaci, starsi se mazou samy."
Write-Host "Zrusit: powershell -ExecutionPolicy Bypass -File tools\naplanovat.ps1 -Odebrat"
