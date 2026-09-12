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

## Kontrola

```
node tests/web_app.test.mjs
node tests/audit_app.test.mjs
```

Testy běží proti **produkčnímu** souboru, tedy proti enginu. Když projdou,
projde i test, protože engine je tentýž.
