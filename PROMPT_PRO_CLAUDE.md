# Prompt pro Claude — opravy logiky a UI Pokémon GO plánovače

Pracuješ na aplikaci Pokémon GO plánovač v projektu:
`C:\Users\lukas\Automatizace\pokemon-go-planner`

GitHub: https://github.com/Lukas-Riha/pokemon-go-app
Publikovaná aplikace: https://lukas-riha.github.io/pokemon-go-app/

Aplikace pomáhá rozhodovat, které pokémony ponechat, přenést, vylepšit, evolvovat, očistit nebo používat v PvP, raidech a gymech.

Chci, abys na základě následujícího auditu opravil rozhodovací logiku a následně zlepšil UI. Nezůstaň u návrhu: ověř nálezy proti aktuálnímu kódu, implementuj opravy a otestuj výsledky. Pracuj postupně a zachovej funkční aplikaci.

## DŮLEŽITÝ KONTEXT

Audit vycházel z verze 9. 9. 2026 12:04. Od té doby se mohl kód změnit. Nálezy ber jako konkrétní hypotézy k ověření, nikoli jako pokyn slepě přepisovat současné řešení.

Hlavní zdroj aplikace:
`web-app/pokemon_tracker_app.html`

Další důležité soubory:
- tools/build_meta.py
- tools/build_events.py
- tools/build_publish.py
- tools/sync_reference.py
- tools/audit_data.py
- tests/web_app.test.mjs
- tests/audit_app.test.mjs
- data/pokedex.json
- data/moves.json
- data/meta.json
- data/events.json

V době auditu bylo na Gitu pouze publish/ a .gitignore. Zdrojové nástroje, testy a data byly lokální. Nezveřejňuj je automaticky. Neměň pravidla publikování ani nenahrávej osobní rostery, exporty, zálohy nebo přístupové údaje.

Zachovej offline fungování a možnost výslednou aplikaci distribuovat jako samostatný HTML soubor. Zachovej kompatibilitu uložených rosterů, profilů, importů, poznámek, značek a historie.

Bez dalšího pokynu neprováděj push ani nasazení. Lokální implementaci a ověření dokonči.

## HLAVNÍ CÍL

Uživatel má u každého konkrétního pokémona snadno zjistit:
1. Co s ním udělat.
2. Proč.
3. Co udělat jako další krok.
4. Kolik to skutečně stojí.
5. Co je ověřený údaj a co pouze odhad.

Tabulka, detail, čištění boxu, role a rozpočet si nesmějí odporovat.

## ETAPA 1 — OPRAV SPRÁVNOST DOPORUČENÍ

### 1. Sjednoť cíle vylepšení

Audit našel rozpor u ukázkového Azumarilla:
- Ponechat pro Great League.
- PvP cíl L37,5 → 1490 CP.
- Obecné „Vylepšit: Ano — 448 tis. → L50“.

Prověř zejména:
- analyze()
- b.cost = upgradeCost(r.level, CPM_STROP)
- sestavení powerup/powerupSub
- ligovaCesta()
- prachovyPlan()

Zaveď společný plán konkrétního kusu obsahující:
- cílovou roli a konkrétní ligu/formát;
- cílovou formu;
- cílový level a CP;
- potřebné útoky;
- kroky ve správném pořadí;
- náklady;
- omezení a nejistoty.

Všechny obrazovky musí čerpat ze stejného plánu. Alternativní využití zobraz odděleně. Doporučení pro PvP nesmí zároveň navádět k překročení jeho CP limitu.

### 2. Oprav výpočet nákladů konkrétního kusu

upgradeCost(fromLevel, toLevel) v auditované verzi pouze sčítal základní tabulku a nezohledňoval Lucky, Shadow ani Purified.

Ověř aktuální herní pravidla včetně zaokrouhlování a implementuj jednotný kalkulátor ceny.

Odděl:
- power-up;
- evoluci;
- odemknutí druhého nabitého útoku;
- očistu;
- potřebné běžné nebo Elite TM;
- případné jiné podmínky.

Nezaměňuj neznámou cenu za nulu. Nevymýšlej stav uživatelových candy, XL ani TM.

Regresní příklad z místních dat:
Základní power-up L24,5 → L37,5 stojí 150 500 prachu.
Lucky varianta stejného úseku má při poloviční ceně stát 75 250.

Správné ceny musí ovlivnit i pořadí investic a porovnávání kopií.

### 3. Odděl běžné a Shadow varianty v PvP datech

Prověř tools/build_meta.py, zejména dex_key(), odstranění shadow přípony a ponechání první varianty pod společným klíčem.

V auditovaných lokálních datech:
- Ninetales GL: běžný #12, Shadow #2; společný záznam dostal #2.
- Snorlax UL: běžný #11, Shadow #3; společný záznam dostal #3.
- Gyarados ML: běžný #57, Shadow #31; společný záznam dostal #31.

Zachovej oddělenou identitu:
- druhu;
- regionální/bojové formy;
- Shadow stavu;
- relevantní varianty movesetu.

Pro pokédex mohou být varianty seskupené, pro bojové doporučení nesmějí přebírat cizí rank a moveset. Mysli na zpětnou kompatibilitu dat.

### 4. Oprav doporučení očisty

Prověř větev rozhodování o purifikaci v analyze().

Pouhé „druh je v PvP seznamu a není vhodný pro raid“ nestačí k doporučení očisty.

Porovnej:
- současnou Shadow variantu;
- výslednou očištěnou variantu;
- změnu IV, levelu a CP;
- způsobilost pro cílovou ligu;
- dostupné útoky včetně Return;
- náklady a ztracené alternativní využití.

Pokud model neumí výhodnost doložit, zobraz „Porovnat před očištěním“ a konkrétní důvod nejistoty. Nevydávej neověřený závěr za jasné doporučení nevratné akce.

### 5. Oprav pravidla způsobilosti pro gym

Auditovaná verze plošně zakazovala Shadow pokémonům obranu gymu. Tento předpoklad byl zakotvený i v testech.

Ověř aktuální herní pravidla a oprav:
- gymBlock;
- přidělování gymových rolí;
- ponechávání kopií z tohoto důvodu;
- vysvětlivky;
- související testy.

Odděluj „lze umístit do gymu“ a „je dobrý obránce“. Zohledni konkrétní výjimky podle herních pravidel, ne jen hrubou kategorii.

### 6. Oprav raidové counter skóre

Prověř counterScore() a cycleDps().

Auditovaná verze vzala vyšší typový násobek rychlého a nabitého útoku a aplikovala jej na celé DPS. Smíšený moveset tím dostává neoprávněnou výhodu.

Aplikuj účinnost každého útoku před složením výsledného skóre.

Dále prověř, zda se Shadow nevýhoda nepočítá dvakrát:
- úpravou obranného statu;
- a další penalizací ve jmenovateli.

Sjednoť význam raidových metrik napříč rolemi, countery a investičním plánem. Model označ jako odhad, pokud nesimuluje skutečný průběh boje.

## ETAPA 2 — OPRAV DATA A HRANICE MODELU

### 7. Validuj soulad CP, IV a levelu

Vestavěný Azumarill měl:
CP 1489, L24,5, IV 12/14/15.
Z místních dat tato kombinace dává 1082 CP.

Oprav ukázková data tak, aby tvořila skutečně platné kombinace. Ideálně je generuj z výpočtu.

Při importu rozliš:
- konzistentní známé údaje;
- neúplné údaje;
- rozporné údaje.

Při rozporu nezvol potichu libovolný údaj jako pravdu. Vysvětli, co je potřeba ověřit, a omez závažnost doporučení.

### 8. Počítej skutečné maximum stat productu

speciesMaxSP() v auditované verzi prohledával:
Attack IV 0–15, Defense a Stamina pouze 8–15.

Odstraň nepodložený předpoklad, že optimum vždy leží v této části mřížky. Použij všech 4096 kombinací s vhodnou cache nebo předvýpočtem.

Audit našel odchylky mimo aktuální meta výběr u některých druhů pod 500 CP. U aktuálních meta druhů Little/Great/Ultra se odchylky nepotvrdily. Neprezentuj tedy opravu jako důkaz, že byly všechny současné výsledky špatně.

### 9. Rozliš konkrétní PvP formáty

tools/build_events.py odvozoval aktivní ligy podle výskytu textů „Great League“, „Ultra League“ apod. v názvu události.

„Retro Cup: Great League Edition“ není automaticky otevřená Great League.

Zaveď explicitní formát, CP limit a pravidla způsobilosti. Pokud pro konkrétní pohár nejsou odpovídající data, přiznej omezení a nepoužívej otevřenou metu jako ověřené pořadí daného poháru.

### 10. Oprav aliasy a duplicity bossů

V událostech byli současně:
- Zacian (Hero)
- Zacian (Hero of Many Battles)

Prověř bossZAkci(). Slučuj podle kanonické identity druhu a formy, nikoli pouze podle očištěného zobrazovaného názvu. Zachovej rozdíly mezi skutečně odlišnými formami a typy raidů.

### 11. Zpřesni označení výsledků

Důsledně odděl:
- IV %;
- kvalitu stat productu v dané lize;
- pořadí druhu v metě;
- kvalitu movesetu;
- modelovou raidovou sílu;
- připravenost k použití teď;
- potenciál po investici.

„Top Flying“ u Pidgeyho nesmí působit jako tvrzení, že jde o špičkového raidového útočníka.

„Mimo šest vybraných kandidátů“ neznamená „nemá herní využití“.
„Nesplňuje nastavený práh“ neznamená „liga je ztráta času“.

Pokud se neoptimalizuje složení PvP týmu a jeho matchupy, používej „PvP kandidáti“, nikoli slib hotového optimálního týmu.

### 12. Zpřehledni kvalitu dat a import

Ukaž zvlášť:
- verzi aplikace;
- datum aktualizace pokédexu;
- datum mety;
- datum útoků;
- datum událostí.

Nezaměňuj datum regenerace souboru se skutečným datem získání zdroje.

U importu zobraz počty nových, aktualizovaných a nejistě spárovaných kusů i rozpory. Zachovej existující ochrany proti ztrátě poznámek, značek, profilů a návratu odstraněných kusů.

Shoda CP, druhu a útoků bez jednoznačného identifikátoru nemusí dokazovat identitu pokémona. Nejisté sloučení má být dohledatelné a opravitelné.

## ETAPA 3 — ZJEDNODUŠ UI A SJEDNOŤ VZHLED

Současné problémy:
- 12 stejně výrazných hlavních záložek.
- 18 sloupců i v režimu „Rozhodnutí“.
- PvP a útoky schované za vodorovným posuvníkem.
- Příliš mnoho stejně výrazných tlačítek.
- Opakované upozorňování na zálohu na několika místech.
- Drobné texty a špatně čitelné zelené verdikty v tmavém režimu.
- Mnoho červených křížků pro nepodstatné nebo nepoužitelné role.
- Detail vložený do široké tabulky s vnořenými posuvníky.
- Dlouhé vývojářské a historické vysvětlivky v běžných uživatelských obrazovkách.
- Na mobilu hlavní obsah začíná příliš nízko kvůli bannerům a filtrům.

Navržená hlavní navigace:
1. Přehled
2. Moji Pokémoni
3. Týmy
4. Investice
5. Události

Pokédex, typovou tabulku, metodiku a nastavení umísti do vedlejší navigace. Zachovej dostupnost všech užitečných existujících funkcí.

Základní seznam:
Pokémon | CP a IV | Doporučení | Hlavní důvod | Další krok | Detail

Kompletní tabulku zachovej jako pokročilé zobrazení.

Příklad základního doporučení:
„Ponechat pro Great League“
„Nejlepší z tvých tří kopií.“
„Další krok: odemknout druhý nabitý útok.“

Detail uspořádej takto:
1. Rozhodnutí a hlavní důvod.
2. Konkrétní další kroky a jejich cena.
3. Současný stav versus cílový stav.
4. Porovnání s vlastními kopiemi.
5. Alternativní využití.
6. Výpočty, zdroje a podrobná data.

Na desktopu použij vhodný samostatný detailní panel nebo stránku, na mobilu přehledný detail přes dostupnou šířku. Zamez zbytečným vnořeným posuvníkům.

Režim „Čistit box“ zachovej a rozvíjej jako hlavní pracovní cestu:
- velký obrázek;
- jasné doporučení;
- stručný důvod;
- srovnání s lepší kopií;
- dostupné Přeskočit a Zpět;
- informace o neúplných datech.

Vizuální směr:
- klidná moderní herní utilita;
- Pokémon a doporučení mají nejvyšší vizuální prioritu;
- jedna hlavní akcentní barva;
- stavové barvy mají jednotný význam;
- nepodstatné role jsou neutrální, nikoli červené chyby;
- čitelnější typografie a kontrast;
- konzistentní velikosti obrázků, ikon, tlačítek a odznaků;
- méně rámečků a více smysluplného prostoru;
- zachovat světlý i tmavý režim;
- nezahlcovat dekoracemi a animacemi.

Zálohu zobraz jako jeden srozumitelný stav s možností rozbalení. Funkční ochranu dat neodstraňuj.

Sjednoť češtinu a herní terminologii. Metodiku nech dostupnou, ale běžný uživatel nemá číst historii vývoje vzorce, aby mohl použít výsledek.

## ETAPA 4 — UDRŽITELNOST A TESTY

Hlavní HTML měl přes 22 tisíc řádků. Postupně odděl:
- normalizaci a datové modely;
- čisté výpočetní funkce;
- rozhodovací pravidla;
- import a ukládání;
- UI.

Výsledný build může dál být jeden samostatný HTML soubor. Nedělej rozsáhlý přepis do nového frameworku jen kvůli reorganizaci.

Prioritou je společný strukturovaný výsledek doporučení, který používají všechny obrazovky.

Ověření:
- node tests/web_app.test.mjs
- node tests/audit_app.test.mjs
- python tools/audit_data.py

V auditované verzi prošlo 1872 regresních kontrol a 68 výpočetních kontrol; audit dat měl 9 varování. Tato čísla nejsou cílem sama o sobě.

Doplň smysluplné regresní testy zejména pro:
- jednotný cílový level v tabulce, detailu a rozpočtu;
- zákaz doporučení překročit limit cílové PvP ligy;
- ceny Lucky/Shadow/Purified;
- oddělené PvP varianty a jejich movesety;
- očistu měnící způsobilost pro ligu;
- způsobilost gymových obránců;
- smíšené raidové movesety;
- úplné maximum stat productu;
- rozpory CP/IV/levelu;
- aliasy bossů;
- odlišení otevřené ligy a omezeného poháru;
- zachování uživatelských dat při importu a případné migraci.

Nesprávný test oprav podle doloženého herního pravidla. Nepovažuj existující očekávání testu za autoritu a neupravuj test jen proto, aby prošel.

UI prohlédni na desktopu i mobilu, ve světlém i tmavém režimu, s prázdným stavem i reprezentativním větším rosterem. Ověř čitelnost, ovládání klávesnicí, filtrování, detail a čištění boxu.

## PRACOVNÍ POSTUP A VÝSTUP

Nejdřív stručně shrň, které nálezy jsou v aktuálním kódu potvrzené, již opravené nebo nejisté. Pak pokračuj implementací bez čekání na schválení každé běžné změny.

Dodrž pořadí:
1. Správnost doporučení a nákladů.
2. Datová konzistence.
3. Jednotný výsledek napříč obrazovkami.
4. UI a grafika.
5. Potřebná reorganizace a dokumentace.

Nezaváděj nevyžádané funkce, které odvádějí od těchto cílů. Rozsáhlý nový bojový simulátor ani globální optimalizátor týmů nejsou podmínkou dokončení: pokud je současný model heuristický, správně jej označ a nepřeháněj jeho závěry.

Na konci napiš:
- co bylo potvrzeno a opraveno;
- co se změnilo v uživatelském ovládání;
- jak byly změny ověřeny;
- jaká omezení modelu zůstávají;
- zda je hotový lokální build;
- co případně ještě brání dokončení.

Neoznačuj neověřenou herní domněnku ani neotestovanou část za hotovou.
