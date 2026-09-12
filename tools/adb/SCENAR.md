# Scénář: rozjet automatické skenování — krok za krokem

Pro HONOR Magic6 Lite 5G (2652×1200). Počítej s **hodinou** na první rozjezd,
z toho většinu zabere instalace platform-tools. Podruhé už to je pět minut.

Než začneš, přečti si v [README.md](README.md) odstavec o riziku. Není nulové.

---

## Nejjednodušší cesta: okno místo příkazů

V kořeni projektu je **`Skenovat box.bat`** — dvojklik a otevře se okno,
kde je všechno na tlačítka: stav telefonu, připojení, kalibrace (klikáš
přímo do snímku obrazovky), posuvník tempa, zkouška, celý box a živý výpis.

Zbytek tohohle souboru popisuje totéž z příkazové řádky. Projít ale musíš
**fázi 0 a 1** — instalaci `adb` a zapnutí ladění v telefonu okno nezařídí.

> Do samotné appky (`pokemon_tracker_app.html`) to zabudovat nejde. Ta je
> schválně jeden soubor otevřený přes `file://` a prohlížeč jí nedovolí
> spouštět programy — jinak by každá webová stránka mohla sahat na tvůj
> počítač. Proto je ovládání samostatné okno.

---

## Fáze 0 — příprava počítače (jednou provždy)

**0.1** Stáhni *SDK Platform-Tools for Windows* ze stránek Androidu
(`developer.android.com/tools/releases/platform-tools`). Je to ZIP, ne
instalátor.

**0.2** Rozbal ho někam natrvalo, např. `C:\Users\lukas\platform-tools`.
Nedávej to do Downloads — smaže se to při úklidu a přestane fungovat PATH.

**0.3** Přidej tu složku do PATH:
Win → „Upravit systémové proměnné prostředí" → *Proměnné prostředí* →
v horním seznamu `Path` → *Upravit* → *Nový* → vlož cestu → OK.

**0.4** Otevři **NOVÉ** okno terminálu (staré PATH nezná) a ověř:

```
adb version
```

Musí vypsat verzi. Když píše „není rozpoznán", PATH se nechytil — zkontroluj
cestu a otevři terminál znovu.

---

## Fáze 1 — příprava telefonu (jednou provždy)

**1.1** Nastavení → O telefonu → **7× klepni na „Číslo sestavení"**.
Naskočí hláška „Nyní jste vývojář".

**1.2** Nastavení → Systém → **Možnosti pro vývojáře**. Zapni **Ladění USB**
(pro kabel) nebo **Bezdrátové ladění** (bez kabelu) — podle toho, co si
vybereš v dalším kroku. Klidně obojí.

**1.3** Teď se telefon musí spárovat s počítačem. Jde to **kabelem i bez něj** —
vyber si:

### A) Bez kabelu, přes Wi-Fi (Android 11 a novější)

Telefon i počítač musí být na **stejné Wi-Fi**. Kabel není potřeba vůbec,
ani napoprvé.

1. Nastavení → Možnosti pro vývojáře → **Bezdrátové ladění** → zapnout.
2. Uvnitř: **Spárovat zařízení pomocí párovacího kódu**. Ukáže se
   šestimístný kód a `IP:PORT`.
3. Na počítači (dosaď to, co ukazuje telefon):

```
adb pair 192.168.0.42:37somethin
```

   Zeptá se na kód → opiš ho z telefonu.

4. Pak se připoj. **Pozor: port je jiný** než ten párovací — vezmi ten
   z hlavní obrazovky *Bezdrátové ladění*, ne z párovacího dialogu:

```
adb connect 192.168.0.42:35555
```

> Spárování vydrží natrvalo. Port se ale po každém zapnutí *Bezdrátového
> ladění* mění, takže `adb connect` s aktuálním portem opakuj před každým
> během. Párovat znovu už nemusíš.

### B) Kabelem

Připoj telefon kabelem. Na displeji vyskočí **„Povolit ladění USB?"** —
zaškrtni *Vždy povolit z tohoto počítače* a dej OK.

> Když se dotaz neobjeví: v liště notifikací přepni USB režim z *Nabíjení*
> na *Přenos souborů*.

### Co si vybrat

Bez kabelu je to pohodlnější a telefon může ležet, kde chce. Kabel je
**rychlejší a spolehlivější**: skript si při hlídání konce boxu stahuje
z telefonu pruh obrazovky, a to po Wi-Fi trvá déle. Rozdíl je řádově pár
minut na celý box — když ti to nevadí, klidně jeď bezdrátově.

> Přes Wi-Fi taky hlídej, ať telefon neusne a nepřepne se do úsporného
> režimu — spojení pak spadne uprostřed běhu.

**1.4** Ověř z počítače (platí pro obě varianty):

```
adb devices
```

Musí být vidět řádek končící slovem `device`. Když tam je `unauthorized`,
nepotvrdil se dotaz na displeji. Když je seznam prázdný, je to kabel,
vypnuté ladění, nebo u Wi-Fi chybějící `adb connect`.

---

> **Všechny `python` příkazy níž se spouštějí z kořene projektu.** Terminál
> se otevírá jinde (obvykle `C:\WINDOWS\System32`), tak se tam nejdřív
> přepni - jinak dostaneš `No such file or directory`:
>
> ```
> cd C:\Users\lukas\Automatizace\pokemon-go-planner
> ```

## Fáze 2 — kalibrace (jednou pro tenhle telefon)

Souřadnice klepání se nedají napsat obecně — musí se najít na tvojí obrazovce.

**2.1** V telefonu otevři **Pokémon GO → box → detail prvního pokémona**.
Přesně ta obrazovka, na které normálně skenuješ.

**2.2** Ujisti se, že je vidět **plovoucí bublina Calcy**. Bez ní se nemá
kam klepat.

**2.3** Telefon nech na té obrazovce a **nesahej na něj**. Z počítače:

```
python tools/adb/kalibrace.py
```

**2.4** Otevře se stránka se snímkem tvojí obrazovky. Naklikej **tři body**
v tomhle pořadí (stránka tě vede a čísluje je):

| # | bod | kam přesně |
| - | --- | ---------- |
| 1 | bublina Calcy | doprostřed té plovoucí bubliny — **jen když Calcy nemá automatické skenování**; jinak klikni kamkoli, bod se nepoužije |
| 2 | swipe — odkud | vpravo od středu obrázku, ale **ne u kraje** |
| 3 | swipe — kam | **stejná výška**, vlevo od středu, taky **ne u kraje** |

> **Body 2 a 3 musí být ve stejné výšce.** Šikmý tah hra občas vyhodnotí
> jako něco jiného než přepnutí na dalšího pokémona.

> **Drž se dál od svislých okrajů.** Android má u obou krajů pruh široký
> asi 20 dp (na hustém displeji řádově 60–90 px) vyhrazený **gestu zpět**.
> Když tah začne v něm, místo přepnutí se zavře detail — a vypadá to, jako
> by se box neposouval. Na displeji 1200 px široko dávej body zhruba mezi
> **x = 150 a x = 1050**. Skript na to při spuštění upozorní sám.

### Klepe se vůbec na Calcy?

Když má Calcy zapnuté **automatické skenování**, klepat se nemusí — skript
jen posouvá box a čeká, až si Calcy načte novou obrazovku. To je výchozí
chování a je spolehlivější, protože odpadá jedno místo, kde se dá netrefit.

Klepání zapneš přepínačem `--klepat` (potřebuje bod ① z kalibrace).

**2.5** Klikni **Stáhnout kalibrace.json** a soubor ulož do
`pokemon-go-planner/tools/adb/`.

---

## Fáze 3 — první spuštění (opatrně)

**3.1 Nasucho.** Nic to neklepne, jen vypíše, co by dělalo:

```
python tools/adb/skenovat.py --pocet 5 --sucho
```

Zkontroluj v hlavičce, že sedí model a rozlišení.

**3.2 Pět kusů naostro — a dívej se u toho na telefon:**

```
python tools/adb/skenovat.py --pocet 5 --bez-detekce
```

`--bez-detekce` tu je schválně: teď zkoušíš jen to, jestli se skript trefuje,
a hlídání konce boxu by ti do toho mluvilo.

Sleduj dvě věci:

- **Trefuje se klepnutí do Calcy?** Musí naskočit scan.
- **Přepne swipe na dalšího pokémona?** Musí se posunout box.

Když ne, kalibrace je vedle → zpátky na 2.3.

**3.3 Zkontroluj Calcy historii.** Musí v ní přibýt přesně 5 nových záznamů
se smysluplnými čísly. Když jich je míň nebo jsou tam nesmysly, Calcy nestíhá
číst → zvedni čekání:

```
python tools/adb/skenovat.py --pocet 5 --cekani-scan 4.5
```

Zkoušej po půl sekundě nahoru, dokud nesedí všech pět. Až najdeš hodnotu,
přepiš `SCAN_MIN` a `SCAN_MAX` v `skenovat.py`, ať se nemusí zadávat pokaždé.

> Lepší delší čekání než špatně přečtená čísla. Chybný scan poznáš až
> v appce, a to už nevíš, u kterého kusu vznikl.

---

## Fáze 4 — celý box

**4.1** V Calcy **smaž historii** (Menu → History → smazat). Jedeš celý box,
takže chceš čistý začátek.

**4.2** V telefonu se vrať na **detail prvního pokémona** v boxu.

**4.3** Nastav si v boxu takové řazení, aby se během běhu neměnilo —
např. podle čísla. Řazení „nedávné" se pod rukama přeskládá.

**4.4** Spusť. Počet zadávat nemusíš — **konec boxu skript pozná sám**
podle toho, že se obrazovka po přejetí přestane měnit (ověřuje si to dvakrát,
ať neskončí předčasně):

```
python tools/adb/skenovat.py
```

`--pocet` je jen pojistka proti nekonečné smyčce (výchozí 400 kroků). Když
na ni narazí, hlasitě to napíše — pak ji zvedni, jinak ti zbytek boxu
zůstane nenaskenovaný.

**4.5** Telefon nech ležet a **nesahej na něj**. Vypni automatické zamykání
obrazovky, jinak to usne v půlce.

**4.6** Zastavení kdykoli: `Ctrl+C`, nebo vedle skriptu vytvoř soubor `STOP`.

Odhad času: cca **3 s na kus → 80 kusů ≈ 4–5 minut** (občasné pauzy
a návraty to o kousek natáhnou).

### Když je to moc pomalé nebo naopak Calcy nestíhá

Všechna čekání se dají přenásobit jedním přepínačem:

V okně jsou na to posuvníky, z příkazové řádky:

```
python tools/adb/skenovat.py --tempo 0.7
python tools/adb/skenovat.py --tah-rychly 60 140 --tah-pomaly 350 700
python tools/adb/skenovat.py --podil-pomalych 0.3
```

- **`--tempo`** mění **čekání** mezi kroky (kolik času má Calcy na přečtení)
- **`--tah-rychly MIN MAX`** je pásmo **cvrnknutí** v ms
- **`--tah-pomaly MIN MAX`** je pásmo pomalého **přetažení** v ms
- **`--podil-pomalych`** říká, jak často se sáhne po tom pomalém (0–1)

> **Dvě různé meze.** Krátké *čekání* pozná Calcy — v historii chybí kusy
> nebo jsou tam nesmysly. Krátký *tah* ale může hra vyhodnotit jako fling
> a **přeskočit dva pokémony naráz** — a to v historii nepoznáš, prostě tam
> jeden kus nebude. Po každém zrychlení tažení proto porovnej počet záznamů
> v Calcy s tím, kolik kusů jsi projel.

Postup je vždycky stejný: pusť dvacet kusů, pak zkontroluj Calcy historii.
Když tam jsou všechny a čísla dávají smysl, můžeš jít níž. **Jakmile začne
Calcy vynechávat, vrať se o krok zpátky** — chybný sken poznáš až v appce,
a to už nevíš, u kterého kusu vznikl.

### Co uvidíš ve výpisu

Skript se schválně nechová jako stroj:

- **prodlevy nejsou rovnoměrné** — mají pravostranný ocas, takže většina je
  svižná a občas přijde delší; rovnoměrné pásmo je pořád strojový rytmus
- **`swipe 182 ms`** — rychlost tažení je **dvouvrcholová**, ne jedno pásmo:
  zhruba ve čtyřech pětinách je to krátké cvrnknutí (90–220 ms), ve zbytku
  pomalé vědomé přetažení (420–900 ms). Přesně tak to dělá prst.
- **`(zakoukání 8,2s)`** — občasná delší pauza
- **`(zpět a zase vpřed)`** — občas se vrátí o kus zpátky, ale nikdy dvakrát
  za sebou; ohlédnout se je lidské, couvat po boxu ne

**Pokrytí to nemůže rozbít.** Skript si drží *pozici* v boxu a seznam už
naskenovaných pozic, ne počet kroků. Návrat proto stojí čas, ne kusy — na
známé pozici jen projde (`už naskenováno, jen procházím`) a znovu neskenuje.
Kdyby se počítaly kroky, každý návrat by ukrojil jeden kus z konce a nikdo
by si toho nevšiml, dokud by nebyl export kratší.

---

## Fáze 5 — do appky

**5.1** Calcy → Menu → History → **export do CSV**.

**5.2** Soubor přenes do počítače (kabelem, nebo přes OneDrive — ale
**do soukromé složky, ne do sdílené**, je v něm celá historie skenů).

**5.3** V trackeru: Import → vlož CSV → **Sloučit s rosterem**.

> **Nikdy „Nahradit".** Sloučení aktualizuje, co sedí, zbytek přidá a ruční
> úpravy (poznámky, kusy zadané z gymu) nechá být. Nahrazení by ti smazalo
> všechno, co v tomhle exportu není.

**5.4** Do políčka **„Kolik pokémonů máš ve hře"** opiš číslo z boxu. Když
appka hlásí, že jí kusy chybí, něco se nenaskenovalo — nejčastěji obránci
gymu (ty Calcy nepřečte, viz níž) nebo se běh zastavil dřív.

**5.5** Mrkni na pruh **„Co teď skenovat"** nad rosterem. Po úplném průchodu
boxem má ukazovat `age0&!defender`.

---

## Když něco nesedí

| projev | příčina | co s tím |
| ------ | ------- | -------- |
| `adb` není rozpoznán | PATH | nové okno terminálu, zkontroluj cestu |
| `unauthorized` | nepotvrzený dotaz | odpoj, připoj, potvrď na displeji |
| klepe vedle | špatná kalibrace | fáze 2 znovu |
| skript hlásí jiné rozlišení | otočený telefon nebo změněné písmo | fáze 2 znovu |
| v historii chybí kusy | Calcy nestíhá | `--cekani-scan` výš |
| box se neposouvá | šikmý nebo krátký swipe | body 2 a 3 dál od sebe, stejná výška |
| usne to v půlce | zamykání obrazovky | vypnout automatické zamykání |
| přes Wi-Fi se `adb devices` prázdné | port se po zapnutí bezdrátového ladění mění | `adb connect IP:PORT` s aktuálním portem |
| po Wi-Fi spadne spojení v půlce | úsporný režim / uspaný telefon | vypnout úsporný režim, nebo připojit kabelem |
| skončí hned na začátku („konec boxu") | dva stejné snímky, nebo se swipe neprovedl | zkontroluj kalibraci, nebo pusť s `--bez-detekce` a `--pocet` |

---

## Co to NENAskenuje

Calcy neumí přečíst kusy nasazené **v gymu** ani **v Dynamax power spotu**:
appraisal přečte, ale nespojí si ho se jménem a levelem. Skript je proto
taky nezachytí.

Ty se přidávají ručně: v trackeru tlačítko **+ Ručně (gym / Dmax)** nad
rosterem — jméno, CP, tři IV z appraisalu, a level si appka dopočítá.

> U kusu v gymu je **CP snížené motivací**, takže na žádný level nemusí
> sednout. Appka pak nabídne platná CP; nejjistější je nakrmit kus bobulí
> do plného srdíčka a odečíst CP potom.

Takový kus zůstane v rosteru označený (**sloupec „Sken?" → „Až se vrátí"**
a připomínka v pruhu „Co teď skenovat"). Až se vrátí domů do boxu, naskenuj
ho normálně — sken se s ručním řádkem sám spáruje a značka zmizí.
