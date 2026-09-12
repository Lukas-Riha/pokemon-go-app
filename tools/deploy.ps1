# Zkopíruje tracker do sdílené OneDrive složky, odkud si ho vezme kolegyně.

#

# Jak to funguje: je na svém PC přihlášená tímhle OneDrivem, takže co sem

# nakopírujeme, se jí samo objeví. Stačí, aby soubor znovu otevřela — žádná

# instalace, žádná aktualizace ručně.

#

# DŮLEŽITÉ: jméno souboru musí zůstat STEJNÉ, ať jí nepřestane fungovat

# zástupce na ploše.

#

# Spuštění:  powershell -ExecutionPolicy Bypass -File tools\deploy.ps1

param([switch]$BezAuditu, [switch]$Odemknout)



$ErrorActionPreference = "Stop"

# Zamek produkce. Dokud v korenu lezi PRODUKCE_ZAMCENA.txt, nic neodejde
# na Pages ani do OneDrivu. Je to levna pojistka proti tomu, aby se
# rozdelana testovaci verze omylem prohnala do produkce - at uz rukou,
# nebo naplanovanou ulohou.
$zamek = Join-Path (Split-Path -Parent $PSScriptRoot) "PRODUKCE_ZAMCENA.txt"
if ((Test-Path $zamek) -and -not $Odemknout) {
    Write-Host ""
    Write-Host "PRODUKCE JE ZAMCENA - nenasazuji." -ForegroundColor Yellow
    Write-Host ""
    Get-Content $zamek | Select-Object -First 12 | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "  Odemknout: smaz $zamek"
    Write-Host "  Jednorazove obejit: deploy.ps1 -Odemknout"
    exit 2
}



$root     = Split-Path -Parent $PSScriptRoot

# Ktery python. Na PATH byva jeste zastupce z Microsoft Store
# (AppData\Local\Microsoft\WindowsApps\python.exe) a ten nema doinstalovane
# knihovny - build kvuli tomu spadl na "No module named PIL". Bere se proto
# skutecna instalace a vypise se, ktera to je.
$python = (Get-Command python -All -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -and $_.Source -notlike "*WindowsApps*" } |
    Select-Object -First 1).Source
if (-not $python) { $python = "python" }
"python:    $python"

$appSrc   = Join-Path $root "web-app\pokemon_tracker_app.html"

$guideSrc = Join-Path $root "docs\navod-import-dat.md"



$shareDir = "C:\Users\lukas\OneDrive\PokemonShare"

$appDst   = Join-Path $shareDir "PokemonTracker.html"
$mobilSrc = Join-Path $root "web-app\pokemon_strop_mobil.html"
$mobilDst = Join-Path $shareDir "StropCP.html"
$rescueSrc = Join-Path $root "web-app\zachrana.html"
$rescueDst = Join-Path $shareDir "ZachranaDat.html"

$guideDst = Join-Path $shareDir "Navod.md"

$readme   = Join-Path $shareDir "PrectiMe.txt"



# 1) Eventy a raid bossové stárnou po týdnech, tak se před nasazením obnoví.

#    Když není síť, použije se to, co je v cache — deploy kvůli tomu nepadá.

"Obnovuji eventy a raid bosse..."

& $python (Join-Path $root "tools\build_events.py") --refresh

if ($LASTEXITCODE -ne 0) { "  (nepodařilo se stáhnout, jedu s tím, co je v data/raw)" }



# 2) Data v appce musí být čerstvá — jinak bychom sdíleli starý pokédex.

"Zapékám data do appky..."

& $python (Join-Path $root "tools\sync_reference.py")

if ($LASTEXITCODE -ne 0) { throw "sync_reference.py selhal - nic se nekopírovalo." }



# 2b) Audit dat. Běží PRÁVĚ TEĎ, protože o krok výš se zapekl nový pokédex,

#     žebříčky a eventy — tohle je jediná chvíle, kdy se ta data mění, takže

#     je to jediná chvíle, kdy má smysl je kontrolovat. Prošlo by sem třeba

#     ligové pořadí ukazující na druh, který v pokédexu není.

#

#     Kontroluje i slučování rosteru: tam se dají data ztratit tiše (špatně

#     spárovaný kus se PŘEPÍŠE), a to je jediná neopravitelná chyba v appce.

#

#     -BezAuditu ho přeskočí. Používej jen tehdy, když víš proč — třeba když

#     zrovna nejede node a potřebuješ nasadit opravu textu.

if ($BezAuditu) {

    Write-Host "Audit dat PRESKOCEN (-BezAuditu)." -ForegroundColor Yellow

} else {

    "Audit dat a slučování..."

    node (Join-Path $root "tests\audit_app.test.mjs")

    if ($LASTEXITCODE -ne 0) { throw "Audit dat NEPROSEL - nic se nekopírovalo. Spust 'node tests/audit_app.test.mjs' a podivej se, co spadlo." }

}



# 3) Pojistka: v appce nesmí být nic osobního. Roster žije v prohlížeči,

#    ne v souboru, ale kdyby se sem někdy dostal export, ať to praskne tady.
#    POZOR: chytne i nevinné použití — název sloupce citovaný v nápovědě
#    appky. Řešení je přepsat nápovědu, ne ubrat z tohohle seznamu.

$html = Get-Content $appSrc -Raw

foreach ($needle in @("Scan date", "history_2", "ØATT IV")) {

    if ($html.Contains($needle)) { throw "V appce je něco z CSV exportu ($needle) - NEPOSÍLÁM." }

}



if (-not (Test-Path $shareDir)) {

    "Zakládám $shareDir"

    New-Item -ItemType Directory -Path $shareDir | Out-Null

}



# Složky na výměnu rosterů. Každý píše do té svojí, čte tu druhou — appka to
# dělá sama, ručně se sem nic nekopíruje. MUSÍ to být tady na OneDrivu: appka
# zapisuje lokálně a k druhému člověku se to dostane jen synchronizací.
# Zálohy sem NEPATŘÍ, ty jsou soukromá historie a zůstávají na disku.
$rosterFolders = @{
    "Luky roster" = @{ kdo = "Lukáš"; druhy = "ANet";  soubor = "roster-lukas.csv"; cizi = "Anet roster\roster-anet.csv" }
    "Anet roster" = @{ kdo = "ANet";  druhy = "Lukáš"; soubor = "roster-anet.csv";  cizi = "Luky roster\roster-lukas.csv" }
}
foreach ($nazev in $rosterFolders.Keys) {
    $d = Join-Path $shareDir $nazev
    if (-not (Test-Path $d)) {
        "Zakládám $d"
        New-Item -ItemType Directory -Path $d | Out-Null
    }
    $i = $rosterFolders[$nazev]
    @"
Sem si $($i.kdo) nechává appkou zapisovat svůj roster.
$($i.druhy) ho odsud jen čte.

NASTAVENÍ V APPCE (stačí jednou, u sebe na počítači):

  Karta "Kamarádův roster"
    -> "Sdílet můj roster..."       -> tahle složka, název: $($i.soubor)
    -> "Načíst kamarádův soubor..." -> ..\$($i.cizi)

Od té chvíle to jede samo:
  - tvůj roster se sem zapisuje SÁM při každé změně,
  - ten druhý se SÁM kontroluje každou minutu (a hned po návratu na záložku).

Po zavření a otevření prohlížeče si Chrome vyžádá potvrzení přístupu
k souborům - je to jedno kliknutí a appka na to sama upozorní.

Aby to fungovalo, musí být složka PokemonShare sdílená s právem UPRAVOVAT
(ne jen prohlížet) a přidaná do tvého OneDrivu jako zástupce.

Nekopíruj sem ručně CSV exporty z Calcy IV - obsahujou celou historii skenů.
Appka sem píše jen roster: jméno, CP, level, IV a útoky.
"@ | Set-Content (Join-Path $d "PrectiMe.txt") -Encoding UTF8
}

# Pojistka: testovací verze z pískoviště se do sdílené složky nesmí dostat
# NIKDY. Kopírují se jen jmenované soubory, takže by se tam sama neobjevila —
# ale kdyby ji tam někdo omylem přetáhl, tady se to pozná a smaže.
Get-ChildItem $shareDir -Filter "*TEST*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "POZOR: ve sdilene slozce byl testovaci soubor $($_.Name) - mazu ho." -ForegroundColor Yellow
    Remove-Item $_.FullName -Force
}

Copy-Item $appSrc    $appDst    -Force
Copy-Item $rescueSrc $rescueDst -Force
# Kapesní stránka do telefonu. Roster nepotřebuje, takže se nesynchronizuje
# a nemá jak se rozejít s tím, co je na počítači.
& $python (Join-Path $root "tools\build_mobil.py")
if ($LASTEXITCODE -ne 0) { throw "build_mobil.py selhal." }
Copy-Item $mobilSrc $mobilDst -Force

Copy-Item $guideSrc $guideDst -Force



@"

Pokémon GO tracker

==================



1. Otevři PokemonTracker.html (dvojklik, spustí se v prohlížeči).

   Udělej si na něj zástupce na ploše, budeš ho otevírat často.



2. V telefonu: Calcy IV -> nastavení -> Export / Backup -> CSV.

   Soubor si přenes do počítače.



3. V trackeru klikni na "Importovat data", přetáhni CSV na vyznačenou plochu

   a dej "Sloučit s rosterem".



Tvoje data zůstávají v tvém prohlížeči na tvém počítači. V tomhle souboru

žádní pokémoni nejsou a nikdo jiný je nevidí.



Kdyz po aktualizaci vidis jine pokemony
---------------------------------------
NIC v trackeru neklikej a hlavne nic nemaz - mohl by si prepsat to,
co je jeste ulozene. Otevri vedle nej ZachranaDat.html z teto slozky.
Ta stranka jen cte, nic neprepisuje, a ukaze:

  - jestli v prohlizeci nejaky roster je (treba pod jinym profilem),
  - a umi ho ulozit do CSV, ktere uz nic neprepise.

Kdyz tam nic neni, tracker bezel jinde - zkus tu stranku otevrit
v jinem prohlizeci (Edge / Chrome / Firefox maji kazdy vlastni ulozeni)
nebo ze slozky, odkud jsi tracker spoustela driv.

Az data najdes: v trackeru "Importovat data" -> vloz CSV ->
"Nahradit roster". A hned potom "Zalohovat do souboru..." - od te chvile
je roster i mimo prohlizec a tohle uz se stat nemuze.

Aktualizace
-----------
Vpravo nahoře v appce je "Verze <datum a čas>". Podle toho se pozná,
jestli máš tu poslední - Lukáš ti řekne, jaké číslo tam má být.

Když se soubor v OneDrive změní:
  1. Zavři záložku s appkou (jinak koukáš na starou kopii v paměti).
  2. V průzkumníku zkontroluj, že u souboru je zelené kolečko s fajfkou
     (= stažený). Modrý mráček znamená "jen v cloudu" - dvojklik ho stáhne.
  3. Otevři ho znovu. Kdyby verze pořád seděla na staré, dej Ctrl+F5.

Tvoje data (roster, hvězdičky, nastavení) zůstávají v prohlížeči a při
výměně souboru se NEZTRATÍ.

Podrobný návod je v Navod.md.

"@ | Set-Content $readme -Encoding UTF8



# --- GitHub Pages: hotova appka pro telefon -------------------------------
# Do repozitare jde JEN slozka publish/ (viz .gitignore v korenu projektu),
# takze se nastroje, stazena data ani zalohy nikam neposilaji.
& $python (Join-Path $root "tools\build_publish.py")
if ($LASTEXITCODE -ne 0) { throw "build_publish.py spadl" }

Push-Location $root
try {
  $maGit = Test-Path (Join-Path $root ".git")
  $maOrigin = $false
  if ($maGit) {
    $maOrigin = ((git remote) -contains "origin")
  }
  if (-not $maGit) {
    Write-Host "Pages: preskoceno - projekt jeste neni git repozitar."
  } elseif (-not $maOrigin) {
    Write-Host "Pages: preskoceno - chybi remote 'origin'. Dokud ho nenastavis,"
    Write-Host "       appka se posila jen do OneDrive."
  } else {
    git add publish .gitignore
    git diff --cached --quiet
    if ($?) {
      Write-Host "Pages: beze zmeny, nic k odeslani."
    } else {
      git commit -q -m ("appka " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
      if ($LASTEXITCODE -ne 0) { throw "git commit spadl" }
      git push -q origin HEAD
      if ($LASTEXITCODE -ne 0) { throw "git push spadl" }
      # Pages servirujou jen koren vetve nebo /docs; obsah publish/ se proto
      # posila jako koren vetve gh-pages.
      #
      # Pres cmd schvalne: git sype prubeh pushe i radek „To <url>" na stderr
      # a PowerShell 5.1 z kazdeho takoveho radku dela NativeCommandError,
      # takze skript koncil chybou i po uspesnem odeslani. `-q` to neumlci,
      # protoze hlaska jde z vnitrniho git push. cmd si stderr slouci sam,
      # navratovy kod projde beze zmeny a o vysledku rozhoduje on.
      cmd /c "git subtree push --prefix publish origin gh-pages 2>&1"
      if ($LASTEXITCODE -ne 0) { throw "git subtree push spadl" }
      Write-Host "Pages: odeslano (vetev gh-pages)"
    }
  }
} finally { Pop-Location }

"OK -> $appDst"
"     $mobilDst"

"     $guideDst"

"     $readme"

""

"Do sdílené složky NIKDY nekopíruj svoje CSV exporty z Calcy IV - obsahujou celou historii skenů."
Write-Host "Slozky Luky roster / Anet roster jsou vyjimka: tam appka sama pise roster na vymenu (jen jmeno, CP, IV, utoky)."
Write-Host "Zalohy tam nepatri - ty zustavaji na disku jako soukroma historie."

