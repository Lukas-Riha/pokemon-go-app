# Co se 10. 9. 2026 změnilo v enginu

Pro vzhledovou vrstvu. Všechno je v `web-app/pokemon_tracker_app.html`,
nasazeno jako `fbd7ebd`. Kdo staví na kopii z 9. 9., má tohle navíc.

Podrobný kontrakt je v `ATLAS_KONTRAKT.md`; tenhle soubor je seznam změn.

## Nová pole na vyhodnoceném kusu

### `utoky` — posudek každého útoku zvlášť

Dřív existovalo jen shrnutí celé sestavy (`movesTitle`, „62 % nejlepšího
movesetu"). To neřekne, KTERÝ ze tří útoků je ten špatný, a přeučuje se
po jednom.

`getComputed()[id].utoky` je pole záznamů: `jm`, `typ`, `rychly`, `druhy`,
`stav` (`nej` / `dobry` / `preucit` / `nezna`), `znacka` (`★` u elitního)
a `proc` — celá věta do bubliny.

Počítá se to jednou v enginu, takže tabulka i rozbor říkají doslova totéž.
**Nepočítej si to ve vrstvě znovu.**

Jak vzniká `stav`: spočítá se cyklus s tím útokem a cyklus s nejlepší
náhradou. Do 5 % ztráty je útok v pořádku, protože přeučit ho stojí víc než
ten rozdíl. Nad tím je kandidát na přeučení a ve `proc` stojí o kolik.
Útok z doporučené sestavy PvPoke je v pořádku i tehdy, když do raidu nevede.

### `movesBest` — nejlepší možná sestava druhu

Text, například `Bite + Brutal Swing`. Používá se u kusu **bez útoků**: tam
je to jediná užitečná informace. Dřív byla schovaná ve větě o tom, že sken
útoky nezachytil, a zanikala.

## Nová funkce

`dpsSestavy(druh, rychlyUtok, nabityUtok)` vrátí poškození za vteřinu celého
cyklu. Je to číslo, podle kterého se počítá raidová role.

Používá se ve výběru útoku místo surové síly. Surová síla o volbě
nerozhoduje: neříká, jak dlouho útok trvá ani kolik energie stojí. U Machampa
má Karate Chop sílu 13 a Counter 12, a přesto je Counter lepší — 23,4 proti
23,3 DPS.

## Opravy chování

| Co | Bylo | Je |
| --- | --- | --- |
| filtry na sloupce Typy a Silný proti | neudělaly nic | filtrují |
| import z Poké Genie | druh se bral z čísla | bere se z `Name` |
| regionální forma při importu | ztratila se | přilepí se ke jménu |
| shadow/purified z Poké Genie | ztratilo se | čte se z čísla 1 a 2 |

Ten filtr stojí za vysvětlení: obě větve byly přidané do funkce, která
začínala „když není zapnutý ligový filtr, pusť všechno". Zkratka je
přeskočila. Klikat šlo, jen se nic neodfiltrovalo.

## Kde to vidět v produkci

- **Tabulka**, bublina u buňky Útoky — shrnutí a pod ním každý útok zvlášť.
- **Rozbor kusu**, sekce Útoky — štítky s typem, barevný pruh podle posudku.
- **Vyhledávání**, sekce Nejlepší útoky — co má ten druh umět, do raidu
  a do každé ligy, kterou hraje.

Ve vyhledávání není konkrétní kus, takže se tam neposuzuje „nechat, nebo
přeučit" — jen se ukazuje, co má ten druh mít.

## Jak to dostat do testovací verze

Testovací build vyrábí `python tools/sync_reference.py --test`. Vezme
**aktuální engine** a vloží do něj `web-app/atlas/atlas.css` a `atlas.js`.
Dnešní změny se tím do testu dostanou samy — engine je jeden a společný.

Dokud ale `pokemon_tracker_TEST.html` je ručně upravovaná kopie, build do něj
odmítne sáhnout: přepsat ho by znamenalo zahodit celou vzhledovou vrstvu.
Proto je potřeba ten přesun.

### Co je v testovací kopii čí

Prošel jsem ji. Vzhledová vrstva je ve čtyřech souvislých blocích a jde
přesunout mechanicky:

| Řádky | Co to je | Kam |
| --- | --- | --- |
| 2638–2696 | `<style id="atlas-design">` a `.atlas-section-guide` | `atlas.css` |
| 22671 | `window.ATLAS_ART` | `atlas-art.json`, načítat až na vyžádání |
| 22675 a dál | `AtlasTags`, `AtlasRole`, vykreslování, routování | `atlas.js` |
| 7314–7419 | `atlasOpenLeagues`, `atlasIssues`, `atlasEvolution`, `atlasTarget`, `atlasFinalize`, `atlasPlanHtml` | viz níž |

### Deset míst, kde vrstva sahá do enginu

Tohle je jediná skutečná překážka. Na těchhle řádcích jsou zásahy uvnitř
mých funkcí, takže se nedají přesunout — musí zmizet:

| Řádek | Zásah |
| --- | --- |
| 3426 | přepisuje `EVENTS.ligy[3]` přes `atlasOpenLeagues` |
| 4151 | `atlasEvolution` uvnitř evolučních variant |
| 4564 | `atlasIssues` v `counterScore` |
| 7752 | `atlasIssues` v počítání kopií |
| 7881 | `atlasIssues` filtruje vstup do `pridelSloty` |
| 9291 | `atlasFinalize` přepisuje `computed` po výpočtu |
| 15216 | `atlasIssues` v `usableForPlan` |
| 16142 | `activePlan` a `atlasIssues` v prachovém plánu |
| 21582–21596 | `atlasSort`, `atlasOpenLeagues`, `atlasDetail` v exportu |
| 21930 | `atlas:route` událost při přepnutí záložky |

Osm z těch deseti volá jednu jedinou věc: `atlasIssues(b)`, tedy kontrolu,
že CP, IV a level dávají dohromady smysl. **To patří do enginu**, ne do
vzhledu — je to rozhodování, ne zobrazení. Totéž platí pro `atlasTarget`,
tedy jednotný plán kusu.

Nabízím, že obojí do enginu převezmu jako pojmenovaná pole `validationIssues`
a `activePlan` i s testy. Tím osm z těch deseti zásahů zmizí samo a zbydou
dva, které jsou opravdu o vzhledu: `atlas:route` a `atlasDetail`. Ty se dají
udělat čistě přes `window.addEventListener` a vlastní vykreslování.

## Co z toho chce frontend

Tři věci stačí přenést:

1. Vykreslit `c.utoky` jako štítky s typem a bublinou. Barvu typu vzít
   z `typeColors()`, stav namapovat na barvu okraje.
2. U kusu bez útoků ukázat `c.movesBest` a nic víc.
3. Ve výběru útoku psát `dpsSestavy(...)` místo síly.

Vše ostatní je uvnitř enginu a vrstva se toho nemusí dotýkat.
