# Denní propis akcí z LeekDucku do obou prostředí.
#
# Úloha spustí tools\akce_denne.py: stáhne rozpis akcí, zkontroluje ho
# a položí `events.json` vedle TEST sestavení i vedle produkční appky na
# GitHub Pages. Appka samotná se neposílá — do publish/ se sahá jen na
# ten jeden soubor, takže rozpracovaná verze nemůže omylem odejít.
#
# Registrace:   powershell -ExecutionPolicy Bypass -File tools\naplanovat_akce.ps1
# Jiný čas:     ... \naplanovat_akce.ps1 -Cas "06:30"
# Zrušení:      ... \naplanovat_akce.ps1 -Odebrat
# Zkusit hned:  ... \naplanovat_akce.ps1 -Ted
# Nanečisto:    ... \naplanovat_akce.ps1 -Ted -Nahlas   (vyrobí, neodešle)

param(
    [string]$Cas = "07:00",
    [switch]$Odebrat,
    [switch]$Ted,
    [switch]$Nahlas
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$nazev = "PokemonTracker - akce z LeekDucku"
$skript = Join-Path $root "tools\akce_denne.py"

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

$argy = @()
if ($Nahlas) { $argy += "--nahlas" }

if ($Ted) {
    Write-Host "Zkousim spustit rovnou (bez registrace)..." -ForegroundColor Cyan
    & $python $skript @argy
    exit $LASTEXITCODE
}

$argument = (@("`"$skript`"") + $argy) -join " "
$akce = New-ScheduledTaskAction -Execute $python -Argument $argument -WorkingDirectory $root
$spousteni = New-ScheduledTaskTrigger -Daily -At $Cas
# Akce se obnovuji i na baterii: je to jedno stazeni a jeden maly soubor.
$nastaveni = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $nazev -Action $akce -Trigger $spousteni `
    -Settings $nastaveni -Description "Stahne akce z LeekDucku a polozi events.json k TEST i produkcni appce" -Force | Out-Null

Write-Host ""
Write-Host "Hotovo. Uloha '$nazev' pobezi kazdy den v $Cas." -ForegroundColor Green
Write-Host "  Stahne akce, zkontroluje je a polozi events.json vedle TEST i produkcni appky."
Write-Host "  Appka samotna se neposila - do publish/ jde jen ten jeden soubor."
Write-Host "  Prubeh se zapisuje do zalohy\akce.txt."
