# Testovací verze a produkce

Jak dostat opravu z produkce do testu. Od 10. 9. 2026 to je jeden příkaz.

## Jak to je poskládané

Engine je **jeden a společný**: `web-app/pokemon_tracker_app.html`. Vzhledová
vrstva GO Atlas žije ve třech vlastních souborech:

| Soubor | Co v něm je |
| --- | --- |
| `web-app/atlas/atlas.css` | styly, 58 řádků |
| `web-app/atlas/atlas.js` | vrstva, 313 řádků |
| `web-app/atlas/atlas-art.json` | obrázky, 172 kusů, 30 MB |

Build je vloží do enginu mezi značky `ATLAS CSS` a `ATLAS JS`. Styly jdou
na konec `<style>`, takže přebijí výchozí vzhled bez `!important`. Skript jde
až za engine, takže `window.__pgo` v něm už existuje.

## Přenést produkci do testu

```
python tools/sync_reference.py --test
```

Vezme **aktuální** engine i s tím, co do něj právě přibylo, přidá vzhledovou
vrstvu a zapíše `web-app/pokemon_tracker_TEST.html`. Nic se nemerguje ručně
a test nemůže zůstat pozadu.

Obrázky se do testu **nezapékají**, protože z 1,7 MB dělají 31 MB a engine
se pak rozjíždí 1616 ms místo 238 ms. Když je chceš vidět:

```
python tools/sync_reference.py --test --s-obrazky
```

## Produkce

```
python tools/sync_reference.py
```

Bez `--test` se vzhledová vrstva **nezapéká vůbec** a sloty zůstanou prázdné.
Produkce tak nemůže omylem dostat rozdělaný vzhled. Build to vypíše řádkem
`vzhled: do produkce se nezapéká`.

Nasazení je zamčené (`PRODUKCE_ZAMCENA.txt`); odemyká se jen na pokyn.

## Produkce SE vzhledem (`--vzhled`)

```
python tools/sync_reference.py --vzhled
```

Tohle je přepnutí produkce na Atlas. Proti `--test` se liší jen tím, co se
přilepí: úložiště se **nepřejmenovává** (produkce musí číst svoje `pgo_`),
obrázky se nezapékají a testovací popisky zůstanou schované. Před zápisem
běží kontrola: kdyby v souboru zůstalo `pgo_test_`, `LOKÁLNÍ TEST`,
`TESTOVACÍ VERZE` nebo `[TEST]` (název záložky), build se zastaví.

**Dvě věci, které se snadno přehlédnou:**

1. `--vzhled` zapisuje do `web-app/pokemon_tracker_app.html`, tedy do
   zdrojového souboru enginu, a vpichuje do něj funkční můstky
   (`atlas_import_hooks`, `atlas_ui_hooks`). Ty **nejsou idempotentní** —
   druhý build nad stejným souborem skončí hláškou
   `Missing Atlas import integration point`. Po nasazení se proto engine
   musí vrátit:

   ```
   git checkout web-app/pokemon_tracker_app.html
   ```

   Bez toho neprojde ani další `--test`.

2. `tools/deploy.ps1` volá `sync_reference.py` **bez** `--vzhled`. Dokud se
   to nezmění, nasadí se produkce v původním vzhledu, i kdyby se předtím
   ručně pustil `--vzhled` — deploy si appku přepeče znovu.

## Kde je hranice

Vrstva engine **neupravuje**. Co potřebuje, dostane jako pojmenované pole:

| Bylo v testovací kopii | Je v enginu |
| --- | --- |
| `atlasIssues(b)` na osmi místech uvnitř enginu | `validationIssues` na vyhodnoceném kusu |
| `atlasTarget` + `atlasFinalize` přepisovaly `computed` | `planKusu()` vrací plán kusu |
| `atlasOpenLeagues` přepisoval `EVENTS.ligy` | engine sám rozlišuje otevřenou ligu a omezený formát |
| `cuteOnly` | `jenZnamka` |

Poslední dvě jména překlenuje krátký můstek na začátku `atlas.js`: vrstvě
připraví obohacenou **kopii** vyhodnocených kusů. Do enginu se tím nesahá
a jeho verdikty zůstávají jeho.

Celý seznam polí je v `ATLAS_KONTRAKT.md`.

## Když se vzhled změní

Vrstva se edituje v `web-app/atlas/`. Původní ruční kopie už není zdroj —
vyrábí ji build. Kdyby přece jen bylo potřeba vytáhnout vrstvu z ručně
upravené kopie znovu, je na to `python tools/slouc_test.py --znovu`.

## Číslo verze

`data/verze.json` drží dvě čísla a **test je vždycky o krok napřed**:
co je v testu, to produkce teprve dostane.

```
produkce  2.0
test      2.1
```

Nasazení posune obě: produkce dostane číslo, které měl test, a test jde
o jednu výš (2.0/2.1 → 2.1/2.2). Deje se to samo — `tools/deploy.ps1`
volá `python tools/verze.py --povysit` ještě před zapečením, takže
produkce už odejde s novým číslem. Ručně není potřeba dělat nic.

Číslo je vidět na dvou místech: v patě postranní lišty (`verze 2.1`)
a u ražítka sestavení dole pod tabulkou (`Verze 2.1 · 2026-09-23 22:47`).
Když si nejsi jistý, kterou sestavu máš otevřenou, stačí se podívat tam.

## Kontrola

```
node tests/web_app.test.mjs
node tests/audit_app.test.mjs
```

Testy běží proti **produkčnímu** souboru, tedy proti enginu. Když projdou,
projde i test, protože engine je tentýž.

### Důkaz, že v produkci leží to, co se do ní poslalo

```
python tools/porovnej_produkci.py
```

Stáhne živou appku z Pages soubor po souboru a porovná ji s `publish/`.
Konce řádků se před porovnáním srovnají (Git na Windows drží `publish/`
v CRLF, na Pages leží LF — je to týž obsah). Chytí právě to, co okem
nejde poznat: že se některý soubor vůbec nenahrál. Když složka
`atlas/assets` ještě nechodíla do `publish/`, měla produkce jinou grafiku
než test a nikdo o tom nevěděl.

### Důkaz, že produkce je tatáž appka jako test

```
python tools/porovnej_test_a_produkci.py
```

Stáhne živou appku a porovná ji s `pokemon_tracker_TEST.html` řádek po
řádku. Známé rozdíly (prefix úložiště, vlajka testovacího buildu, `[TEST]`
v názvu, testovací odznaky, číslo verze a ražítko sestavení) před porovnáním
srovná. Zbýt má jediný rozdíl: řádek s PWA hlavičkou, který do produkce
patří.

### Důkaz, že to i STEJNĚ VYPADÁ

```
node tools/porovnej_vzhled.mjs
node tools/porovnej_vzhled.mjs --sirka 1600
```

Shodné soubory ještě neznamenají shodný vzhled: appka si část vzhledu
dopočítá až za běhu. Vystřeďování spritů dopisuje `transform` přímo do
značky — a to se stane jen tehdy, když má co měřit, tedy na profilu
s rosterem. Na prázdném profilu (a takový mají všechny testy) ten rozdíl
vůbec nevznikne. Takže pokud něco „vypadá v produkci jinak“ a soubory
přitom sedí, hledej tady.

Skript do obou sestavení nasype tentýž roster, projede sedm stránek
(Přehled, Pokémoni, Týmy, Investice, Události, Data a pravidla, detail kusu),
u každého viditelného prvku si zapíše rozměr včetně transformace a porovná
položku po položce — kolem 17 tisíc prvků. Stránky předtím proroluje, aby
se dotáhly líně načítané obrázky a neporovnával se závod v načítání.

### Důkaz, že se změnou vykreslování nezměnila čísla

```
git show HEAD~1:web-app/pokemon_tracker_app.html > web-app/_pred.html
node tools/porovnej_vypocty.mjs
```

Nasype do obou sestavení tentýž pestrý roster (půl druhé stovky kusů:
neznámá IV, shadow, lucky, bez útoků, kopie, půlleveley) a porovná
položku po položce všechno, co engine spočítá — verdikty, ceny, procenta,
plány, tahák, seznam k chytání i frontu čištění boxu. Použij vždycky,
když se sáhne na vykreslování: že appka vypadá stejně, není důkaz.
