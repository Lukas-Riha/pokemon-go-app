# Automatické skenování boxu přes ADB

Projde box v Pokémon GO a nechá Calcy IV naskenovat každý kus, aby se nemuselo
ručně swipovat. Rychlost tady není cíl — Calcy čte obrazovku, ne paměť hry,
takže **musí** se swipovat pomalu. Smysl je, že u toho nemusíš sedět.

## Než to spustíš — o riziku

Tohle je automatizace herního klienta a to je proti podmínkám Niantiku.
Riziko není nulové a je na tvém účtu. Co k tomu můžu říct poctivě:

- **Neběží to v emulátoru a nemodifikuje to hru.** Právě tyhle dvě věci
  Niantic prokazatelně detekuje a banuje. Skript posílá obyčejné dotykové
  události do nemodifikovaného telefonu s oficiální aplikací.
- **Nesahá to na síť ani na polohu.** Žádný spoofing, žádné chytání, žádné
  získávání předmětů. Jen se prochází vlastní box.
- **Calcy IV samo je overlay, který čte obrazovku** a s Niantikem vůbec
  nekomunikuje. Používají ho roky statisíce lidí.
- **Co zbývá jako reálné riziko je chování**: dokonale pravidelný rytmus
  klepání vypadá strojově. Proto prodlevy nejsou rovnoměrně náhodné —
  rovnoměrné pásmo 0,8–1,2 s je pořád strojové. Mají pravostranný ocas
  (většina svižná, občas výrazně delší), k tomu občasné delší zakoukání
  a občasný návrat o kus zpátky. A hlavně: skript **pozná konec boxu**
  a přestane. Ťukat dál, když už není kam, je nejjasnější strojový podpis.

Souhrn: podstatně menší riziko než emulátor nebo spoofer, ale ne nula.
Není to záruka — je to odhad podle toho, co se o detekci ví.

## Okno místo příkazů

`Skenovat box.bat` v kořeni projektu (dvojklik) otevře `ovladac.pyw` —
stav telefonu, připojení, kalibrace klikáním do snímku, posuvník tempa,
zkouška, celý box, živý výpis. Je to jen slupka nad `skenovat.py`; logika
skenování zůstává tam.

## Jak to používat s co nejmenší expozicí

Zjištěno průzkumem (srpen 2026), ne odhadem:

- **Nikdy neroot.** Niantic přešel na Play Integrity a hledá `su`, stopy
  Magisku, upravený `init.rc`, odemčený bootloader. **Tohle je jediná věc
  z okolí téhle metody, za kterou se prokazatelně banuje.** Existuje nižší
  cesta injektáže dotyků (`sendevent` do `/dev/input`), která by obešla
  `deviceId = -1` — jenže na většině telefonů chce root, takže by tě
  přesunula z nevynucované kategorie do vynucované. Špatný obchod.
- **Jedna delší relace denně, ne pět krátkých.** Expozice roste s počtem
  připojení, ne s délkou běhu.
- **Vypni Bezdrátové ladění, když neskenuješ.** `ADB_ENABLED` je stav
  zařízení a aplikace si ho může přečíst.
- **Nech si humanizování časování** — proti behaviorální detekci funguje
  a nestojí nic.
- **Po updatu hry** první běh sleduj a při čemkoli divném přestaň.

Co hraje ve prospěch: přejíždění boxu **negeneruje žádný síťový provoz**.
Na rozdíl od spoofingu, který je vidět serverově, tady není co pozorovat na
jejich straně — detekce by musela běžet v klientovi a hlásit původ dotyků.

Doložených banů za tuhle techniku jsem nenašel žádné. Dělá to ale málo lidí,
takže málo hlášení je očekávatelné tak jako tak — není to důkaz bezpečí.

## Co je potřeba

1. **Platform-Tools od Googlu** (obsahují `adb`) — stáhnout, rozbalit,
   přidat složku do PATH. Ověření: `adb version`.
2. **Možnosti pro vývojáře** v telefonu: Nastavení → O telefonu → 7× klepnout
   na číslo sestavení.
3. Propojení s počítačem — **kabel není nutný**:
   - *Bez kabelu* (Android 11+): Možnosti pro vývojáře → **Bezdrátové ladění**
     → *Spárovat pomocí kódu* → `adb pair IP:PORT`, opsat kód, pak
     `adb connect IP:PORT` (jiný port, ten z hlavní obrazovky).
   - *Kabelem*: zapnout **Ladění USB**, připojit a potvrdit dotaz na displeji.

   Ověření: `adb devices` musí ukázat zařízení se stavem `device`.

   Kabel je rychlejší — skript si při hledání konce boxu stahuje z telefonu
   pruh obrazovky. Po Wi-Fi to jde taky, jen o pár minut pomaleji.

> **Všechny `python` příkazy níž se spouštějí z kořene projektu.** Terminál
> se otevírá jinde (obvykle `C:\WINDOWS\System32`), tak se tam nejdřív
> přepni - jinak dostaneš `No such file or directory`:
>
> ```
> cd C:\Users\lukas\Automatizace\pokemon-go-planner
> ```

## Postup

### 1. Kalibrace (jednou pro daný telefon)

V telefonu si otevři **detail prvního pokémona** v boxu, tak jak to vypadá
při běžném skenování — včetně plovoucí bubliny Calcy na obrazovce. Pak:

```
python tools/adb/kalibrace.py
```

Stáhne snímek obrazovky a otevře stránku, kde do něj naklikáš tři místa:

| bod | co to je |
| --- | --- |
| `calcy` | bublina Calcy — **nepovinné**, potřeba jen s `--klepat` |
| `swipe_z` | odkud táhnout — vpravo od středu, **ne u kraje** |
| `swipe_do` | kam dotáhnout — stejná výška, vlevo od středu, **ne u kraje** |

Když má Calcy **automatické skenování**, skript na bublinu vůbec nesahá —
jen posouvá box a čeká. To je výchozí chování.

Svislé okraje obrazovky patří systémovému **gestu zpět** (pruh asi 20 dp).
Tah, který v něm začne, zavře detail místo přepnutí na dalšího pokémona.
Skript na to při spuštění upozorní.

Stránka nabídne ke stažení `kalibrace.json`. Ulož ho do `tools/adb/`.

Souřadnice se přepočítají na skutečné rozlišení, takže nevadí, že je snímek
v prohlížeči zmenšený.

### 2. Zkouška nasucho

```
python tools/adb/skenovat.py --pocet 5 --sucho
```

Nic neklepne, jen vypíše, co by dělal a s jakými prodlevami.

### 3. Krátký ostrý běh

```
python tools/adb/skenovat.py --pocet 5 --bez-detekce
```

**Dívej se u toho na telefon.** Ověřuje se jediné: trefuje se klepnutí do
Calcy a přepne swipe na dalšího pokémona? Když ne, kalibrace je vedle.
`--bez-detekce` je tu proto, aby ti hlídání konce boxu do téhle zkoušky
nemluvilo.

### 4. Celý box

```
python tools/adb/skenovat.py
```

Počet zadávat nemusíš — **konec boxu skript pozná sám** podle toho, že se
obrazovka po přejetí přestane měnit (ověřuje si to dvakrát). `--pocet` je
jen pojistka proti nekonečné smyčce (výchozí 400 kroků); když na ni narazí,
hlasitě to napíše.

Pokrytí si skript hlídá **pozicí v boxu**, ne počtem kroků — proto ho
občasný návrat zpátky nemůže připravit o kusy na konci.

Zastavení: `Ctrl+C`, nebo vytvoř vedle skriptu soubor `STOP`.

### 5. Export do appky

V Calcy: Menu → History → export do CSV. V trackeru pak Import →
**Sloučit s rosterem** (nikdy „Nahradit").

### Co to nenaskenuje

Kusy nasazené **v gymu** a v **Dynamax power spotu** Calcy nepřečte —
appraisal zvládne, ale nespojí si ho se jménem a levelem. Přidávají se
v trackeru ručně tlačítkem **+ Ručně (gym / Dmax)** a zůstanou označené,
dokud je nenaskenuješ po návratu domů.

## Ladění prodlev

Nejdřív zkus jeden přepínač na všechno — přenásobí všechna čekání:

```
python tools/adb/skenovat.py --tempo 0.7     (svižnější)
python tools/adb/skenovat.py --tempo 1.4     (opatrnější, když Calcy nestíhá)
```

Na pevné čekání jen na scan:

```
python tools/adb/skenovat.py --pocet 10 --cekani-scan 4.5
```

Až se najde hodnota, na které to jde spolehlivě, přepiš `SCAN_MIN`/`SCAN_MAX`
v `skenovat.py`. Lepší delší čekání než špatně přečtená čísla — chybný scan
se totiž pozná až v appce, a to už nevíš, u kterého kusu.

## Pojistka

`skenovat.py` na začátku ověří, že rozlišení telefonu odpovídá tomu, na kterém
kalibrace vznikla. Kdyby se telefon otočil nebo se změnila velikost písma,
skript by jinak hodinu klepal vedle a poznalo by se to až podle prázdného
exportu.
