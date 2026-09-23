# Astra → Claude: koordinace GO Atlas

## A-001 — Společný engine a kontrakt před přesunem UI

Stav: čeká na Claude. Toto ID nahrazuje nečíslované zadání na konci staršího předání níže.

Porovnat `navrh-aplikace/production-test/calculations.js`, `calculations.mjs` a `calculations.test.mjs` s aktuálním enginem a doplnit/potvrdit `activePlan`, `validationIssues`, ochranu čistě sbírkových kusů, API detailu a řazení. UI nesmí při migraci ztratit opravy cen/CP/forem ani izolaci TEST úložiště. `cuteOnly` a `jenZnamka` nemají automaticky totožný význam. Responzivita musí zůstat pro 360 px. Původní nečíslované předání níže je pouze referenční kontext; není potřeba je znovu celé číst.

Hotovo znamená: potvrzený kontrakt, odpovídající regresní testy proti aktuálnímu enginu a odpověď do PREDANI_ASTRA.md s odkazem na A-001. TEST HTML nepřepisovat, nespouštět deploy.

## A-002 — Lucky nesmí zmizet při změně Dynamax / editaci kusu

Stav: čeká na Claude. Uživatel hlásí ztrátu Lucky u Fennekina (91 %, CP 14) po nastavení Dynamax. Tato zpráva neobsahuje přesná tři IV ani celý postup.

Ve snapshotu používaném TESTem samotný handler `.dmax-prepinac` mění pouze `radek.dynamax`. Ztrátu Lucky tímto handlerem nelze ze zdroje potvrdit; prověřit import/ruční editor/normalizaci a současný engine. Nový UI editor Astry upravuje pouze vybraný kus, `forma` a `dynamax` odděleně. Umožňuje explicitně nastavit formu Lucky. Neprovádí automatickou opravu uživatelova Fennekina.

Prosím o regresní pokrytí: přidání/odebrání Dynamax i SHINY/CUTE nemění Lucky, import s chybějící značkou neodstraní ruční značku bez záměrného nahrazení, Lucky ovlivní cenu konzistentně. Definovat v kontraktu representaci Lucky vedle dalších vlastností; nyní se často sdílí `forma`, což neumožňuje bezpečně odvodit podporu kombinací. Nehádat IV triplet z 91 %.

Hotovo znamená: příčina nebo doložené nereprodukování, testy a odpověď s odkazem na A-002. Produkce a TEST výstup se nenasazují.

## A-003 — Integrace společného TESTu a aktuální zdroj vzhledu (10. 9.)

Stav: Astra dokončila místní propojení, žádný deploy/commit/push. Přečíst pouze tento úkol.

Zdroj vzhledu je nyní web-app/atlas/atlas.js a atlas.css. Starý navrh-aplikace/production-test/build.mjs už bezpečně volá tools/build_atlas_test.mjs; archivní moduly nejsou aktuální zdroj UI. Nekopírovat je zpět přes web-app/atlas.

Po převzetí jsem nalezl chybějící atlasDetail/atlasSort/atlas:route a produkční pgo_* namespace v TESTu. tools/sync_reference.py nyní POUZE pro --test používá tools/atlas_test_hooks.py: izolace úložišť, API vykreslení a navázání původního detailu, řazení a route event. Žádné změny výpočtů. Build s obrázky a kontrolou neměnnosti produkce: node tools/build_atlas_test.mjs. Roster se nezapéká; explicitní fixture je pouze v test-fixture.mjs a izolovaných testech.

Opraven můstek: jenZnamka není automaticky CUTE, plán dostává stabilní ID pro rozpočet, neplatné vstupy nedostanou aktivní plán v UI. planKusu vrací první krok, nikoli celou cestu; rozpočet a cena to nyní výslovně uvádějí. Prosím doplnit veřejné API detailu/řazení/route přímo do kontraktu při další práci na enginu, pak může zmizet příslušná část TEST hooks. Produkční zdroj neupravovala Astra.

Nalezen a opraven UI konflikt: body.dataset.atlasRoute kolidoval s delegací kliknutí na [data-atlas-route]. Způsoboval scroll nahoru při událostech a zavření detailu při ukládání. Stav má nyní data-atlas-current-route, akční atribut zůstává jen navigačním prvkům.

Aktuální kontroly: node navrh-aplikace/production-test/test.mjs (91), test-ui-polish.mjs, test-latest-ui.mjs. Poslední pokrývá velikosti a výběr polí, skládání bossů a oddělení lig, scroll eventu, tabulku pro čtení/editaci, import a mobil. Testy proti produkci samy o sobě nekontrolují Atlas runtime.

## A-004 — Výsledek importu a stabilita tabulky (11. 9.)

Stav: lokální TEST implementován, produkce beze změn. Číst pouze tento úkol.

Samostatné tools/atlas_import_hooks.py (volané pouze v --test) doplňují do mergeIntoRoster strukturovaný atlasAudit (updated/added/powered/evolved), zachycený přímo ve větvích skutečného párování. AtlasImportDone nahrazuje pouze závěrečný alert z finishImport; data zůstávají rozhodnutím enginu. Výsledek má počty a skládací seznamy v importním dialogu. Potvrzení nahrazení je rovněž v aplikaci, zrušení nemění roster. Prosím při nejbližší práci na enginu nabídnout veřejný import-result event s těmito seznamy; potom můžeme odstranit příslušné TEST hooks. Neodvozovat párování v UI podle jména.

Veřejné atlasDetail/atlasSort/atlasImage od Clauda jsou již převzaté. tools/atlas_test_hooks.py zůstává jeho izolace úložiště. Atlas nyní používá atlasImage (obrazekHtml z enginu) pro druhy mimo původní balík. Weedle je navíc v atlas-art.json, ostatní používají produkční primární i záložní URL. Detail má jedinou úpravu v hlavičce. Tabulka má na desktopu šířku dle --tabulka-min, aby po přepnutí režimu nekolabovaly pevné sloupce.

Regresní scénáře nově v navrh-aplikace/production-test/test-import-results.mjs: merge s přesnou evolucí a power-upem, nezachycený kus, potvrzení/zrušení replace bez browser dialogu, jeden editor, opakované přepnutí a resize tabulky, dekódování všech zabudovaných obrázků, Weedle a mobilní výsledek. Data jsou umělá v izolovaném profilu.

## A-005 — Dashboard používá výsledky enginu (15. 9.)

Opraveno pouze ve vzhledové vrstvě Atlasu a sestaveno do TESTu. `Na co se zaměřit` vybírá přímo `keepGood`, včetně kusů s upozorněním na údaje, a řadí podle IV. U shody má stabilní pořadí podle levelu, CP a ID. Upozornění na údaje zůstává viditelné; tato karta není pořadím investic.

Raidové pokrytí sčítá výhradně `__pgo.base()[].sloty` s `druh === "raid"`. Typy a jejich pořadí přebírá z enginu. Počty jsou označeny jako obsazené sloty; pruhy porovnávají jejich zastoupení, neslibují plnou připravenost ani pevnou kapacitu šest. Prázdný rozpočet má vlastní zprávu.

Ověření: `test-dashboard.mjs` porovnal obě karty s enginem na 158 kusech, šestikusovém rosteru s neplatným CP, mobilním zobrazení a prázdném rosteru. `test-handoff.mjs` prošel včetně sestav po evoluci, návratu do Atlas detailu po přidání, hromadných útoků a Escape zavírajícího jen horní okno. Bez JS chyb. Produkční soubor se při buildu nezměnil, zámek zachován; nic nebylo nasazeno ani odesláno na git.

Úkol pro Claude: při příští kontrole ověřit stejné dvě karty na vlastním šestikusovém rosteru. Výpočty enginu se v této opravě neměnily.

## A-006 — Přehled akcí, Raidy/Max a datové mezery (17. 9.)

Astra přestavěla Přehled v atlas.js/css. Pouze TEST, bez nasazení. Týdenní výběr dne, detail akce v dialogu, oddělené Raidy/Max, spawny z probíhajících oken, první tři různé kusy z prachovyPlan() a příprava před hraním. A-005 zůstává historické ověření; jeho karty IV a raidového pokrytí už na Přehledu nejsou (změna schválená uživatelem). Detail ukazuje zdrojové sekce a podmínky včetně denních/nočních podnadpisů; neodvozuje živé spawny. Kalendář nezahrnuje sezóny a dlouhá raidová okna, protože raidy jsou zvlášť. Data mají datum z dataInfo.events.

Co prosím doplnit na straně enginu/dat:
1. Strukturovaný seznam aktuálních Max bossů s platností od/do, obtížností a odkazem na zdroj. Nyní lze bezpečně zobrazit jen max-* události s termínem; není to úplný katalog Power Spotů.
2. Veřejné společné API parsování termínů a aktivních oken, včetně date-only, místního času, UTC a podoken den/noc. Atlas nyní používá opatrný vlastní filtr a zachovává textové podmínky. Chybějící termín nikdy nepovažuje za aktuální akci.
3. Potvrzené evoluční okno/exkluzivní útok jako strukturovaná pole a vazba na kusy v rosteru. Bez toho UI nedoporučuje časově kritickou evoluci jen podle obrázku nebo názvu eventu.
4. Veřejné otevření Taháku na konkrétním bossovi a vyhodnocení aktuálního týmu (ne potenciálu). Zatím tlačítko poctivě říká Otevřít Tahák; žádná tvrzení o připravenosti.

Doporučené kroky zachovávají pořadí prachovyPlan(); vyřazují neplatné vstupy, rezervu a čistě sbírkové kusy. Cena zůstává z existujícího AtlasJourney a výslovně jde o power-up, ne potvrzení dostupného rozpočtu. Engine ani computed nebyly přepsány.

Opraven také bod 6 z předání: capture tooltip neblokuje klik na .evo-klikaci. Žádné provedení evoluce bez dialogu uživatele.

Cílené testy: navrh-aplikace/production-test/test-overview-events.mjs (izolované profily, skutečný roster a syntetické události). Pokrývá kalendář, oddělení Raid/Max, vyloučení neznámých termínů, detail, Escape, týdny, shodu pořadí investic, mobil a prázdné stavy. Screenshots prehled-akce-pc.png / prehled-akce-mobil.png. Obrázky při offline testu závisí na lokálně dostupném artu; síťové obrázky jsou v testu blokovány.

## A-007 — Kompaktní dlaždice rosteru (18. 9.)

Na přímé zadání Lukáše: stručný seznam změněn na responzivní dlaždice (1440 px čtyři sloupce, 1920 px pět; mobil jeden). Krok/cena/chybějící údaje odstraněny z rowHTML; úplná tabulka ani detail se nemění. Důvody nadále vykresluje atlasDuvody a měří srovnejDuvody, přidaný ResizeObserver aktualizuje +N po změně šířky. Hvězdička je stávající indikátor, nikoli nové editační tlačítko. Klik/klávesnice otevírají stejný detail, CSS přidává jemný vstupní přechod s respektováním prefers-reduced-motion.

Změny JS pouze v rowHTML, odstranění hlavičky staré řádkové tabulky a ResizeObserver. Zdroj nebyl přeformátován. Existující necommitnuté CSS opravy čištění boxu zachovány. Bez deploy/commitu/pushe.

Test dlaždic: navrh-aplikace/production-test/test-roster-tiles.mjs — 1920/1440/768/390/360 px, bez přetečení, 24 kusů na stránce, stránkování, původní detail, omezení animací, žádné chyby JS. Náhledy screenshots/roster-dlazdice-1440.png a roster-dlazdice-390.png.

Pro Claude: zachovat nové rozložení i absenci kroku/ceny/chybějících údajů ve stručných kartách při dalších funkčních úpravách.

## Starší nečíslovaný kontext (archiv)

Stav: 9. 9. 2026, po přečtení PREDANI_ASTRA.md a ATLAS_KONTRAKT.md.
Toto je lokální předání k přečtení; neproběhlo automatické odeslání do Claude chatu.

## Rozdělení práce a ochrana výstupu

Souhlasím s jedním společným enginem a odděleným UI. Navrhuji: Claude spravuje engine, data a jeho testy; Astra UI, responzivitu a integrační testy. Před každou další dávkou přečíst obě předání. Každý zapisuje vlastní předání, druhému je nepřepisuje. Uvést soubory, stav práce, změny kontraktu a skutečně provedené kontroly.

Současný TEST je stále sestaven z původního snapshotu. Přesun ještě NEPROBĚHL. Zdrojové UI není ručně spravované jen v obřím HTML: moduly leží v `navrh-aplikace/production-test/` a HTML generuje tamní `build.mjs`. Proto převzít tyto zdroje, ne extrahovat starší HTML.

Zámek produkce zachovat. Žádný commit, push, nasazení ani použití -Odemknout. TEST nemažeme předem. Před přesunem záloha aktuálního souboru a zkouška společného buildu do odděleného výstupu; cílový soubor má během integrace jediného zapisovatele (Astra). Je to návrh dohody, ne potvrzení, že Claude již převzal úkol.

## Co přenést do společného enginu

Zdroje: `navrh-aplikace/production-test/calculations.js`, `calculations.mjs`, `calculations.test.mjs`. Patches z `.mjs` nesměřovat slepě na nový engine, jsou vázané na snapshot. Porovnat, které opravy už aktuální engine obsahuje.

- `validationIssues`: rozporné CP/IV/level nebo neznámá forma blokují investice; chybný kus nemá vytlačit platnou kopii.
- `activePlan`: jeden konkrétní cíl pro detail, roster i rozpočet. Potřebná pole: `id`, `key`, `cilJmeno`, `cilCp`, `uroven`, `role`, `league` (kde existuje), `cena:{dust,candy,xl}`, `evoluce`, `route`, `evoCandy`, `nedotazeny`, `fullLevel`, `popis`. ID se mění při změně výchozího levelu, formy, IV a cíle, aby uložený výběr nepoužil zastaralou cenu.
- `cuteOnly`: nyní přímo z `cuteZachranil`. V dodaném rosteru jde o 5 kusů. Mewtwo Armored, Latias a Pinsir chybně dostávali investiční cíle, nyní žádný čistě CUTE kus automatický plán nemá. `jenZnamka` není přesný synonymní název: dle kontraktu zahrnuje také 100 %. Domluvit a testovat oba významy.
- Obecné Evolvovat: Ano bez konkrétního evolučního cíle je nově Zvážit. U aktivního evolučního cíle je uveden důvod. Podmínky evoluce a útoky stále vyžadují ověření.
- Zachovat regresní opravy: zaokrouhlení Shadow/Purified candy a XL po každém power-upu; canonical Armored Mewtwo; úplné prohledání IV u maxima SP; HP minimum a Shedinja; striktní Shadow/formové ranky; účinnost jednotlivých útoků; rozlišení cupů od otevřených lig. Úplný seznam viz AUDIT_VYPOCTU_TEST.md.

Upřesnění k předání: aktuální TEST ceny nepočítá samostatnou UI tabulkou. `atlasTarget` volá `upgradeCost` uvnitř closure enginu a `atlasFinalize` sjednocuje výsledky. Přesto tento dodatečný zásah musí při migraci nahradit společný engine. Odebrat ho až po přenosu funkcí a prokázání shodných výsledků, jinak opravy ztratíme.

## Co již UI umí a potřebuje zachovat

- Rozpočet s rezervou, výběrem celých cílů, součtem, filtry LC/GL/UL/ML, per-profile uloženým výběrem a režimem bez XL.
- Ligový filtr zatím filtruje aktivní cíl, nepřepočítává kus na jinou alternativní ligu. Cena je pouze za power-upy, nikoliv za evoluce a odemčení útoků. Zásoby candy nejsou známé.
- Rychlé pohledy celý box / investice / všechny CUTE / jen CUTE / neplatná data.
- Detail zprava na PC, téměř celoobrazovkový panel zespodu na mobilu. Rozhodnutí, plán, ligy, role a útoky viditelné bez rozbalování; metodika a doplňky skládací. Předchozí/další respektuje pořadí filtrovaného rosteru.
- `ivPct` i `kvalitaKusu` jsou podíly: při zobrazení procent násobit 100. Nedávná oprava UI.
- Izolace pgo_test_* se musí zachovat i po přechodu na společný build; TEST nesmí načíst produkční cloudové přihlašovací údaje nebo souborové handly.
- Je potřeba veřejné API pro vykreslení a navázání detailu, řazení a oznámení změny/route; nynější build doplňuje `atlasDetail`, `atlasSort`, `atlasOpenLeagues` a události `atlas:route`, `atlas:refresh-detail`. Domluvit náhrady v kontraktu.

## Důležité korekce kontraktu

Uživatel chce mobilní aplikaci. Již testujeme 360 a 390 px. Limit 500 px v kontraktu tedy nesmí být převzat jako nový produktový požadavek.

Uživatel výslovně chce pro další UI návrhy také obrázkové náhledy. Při návrhu je přikládat; při realizaci lze přiložit skutečné screenshoty PC a mobilu.

Souhlas s externími obrázky a ručně aktivovanými testovacími daty. Preferovat jednotlivé assety / manifest cest před stažením 30MB base64 JSON najednou. Dosavadní CSV seed byl výslovně pro lokální TEST, nic se nepublikovalo. Před případným nasazením musí seed z veřejného artefaktu zmizet; uživatelův existující TEST profil zachovat.

## Ověření a další krok

Poslední UI sada: 80 kontrol prošlo; výpočetní sada 23 kontrol prošla při předchozí změně výpočtů. Existuje i čistý test modelu rozpočtu s 2232 kombinacemi. Nejde o totéž jako Claudeho 1931 regresí a 68 auditních kontrol; ty Astra v této dávce nespouštěla.

Obrázkové výstupy: `navrh-aplikace/production-test/screenshots/detail-pc.png` a `detail-mobil.png`.

Navržený další krok pro Claude: porovnat engine s výše uvedenými opravami a doplnit/potvrdit rozšíření kontraktu pro activePlan, validationIssues, příznaky sbírky a detail/řazení. Odpověď zapsat do PREDANI_ASTRA.md. Poté Astra přesune UI na společný build a ověří obě sady testů proti stejnému enginu, bez nasazení.

## A-008 — Ilustrovaný Přehled a pozadí menu (21. 9.)

Hotovo v lokálním TESTu: nový blok na konci atlas.css, noční park v menu, obrazové karty událostí, kompaktní týden pod kartami a menší řádky raidů/Max. Mobil má první událost velkou a další jako menší řádky. Roster, detail a výpočty se v této dávce neměnily.

Podklad je v web-app/atlas/assets/night-park-v1.png. CSS se vkládá do HTML, proto cesta atlas/assets/night-park-v1.png vychází z web-app. Při kopírování TESTu zachovat i tuto složku. Pozadí je dekorace, Pokémoni a termíny pocházejí z dat. Soubor vznikl vestavěným imagegen: noční modrý park, vzdálená kruhová věž vlevo, jezero, les, tmavá horní polovina, bez textu, UI a Pokémonů.

Dřívější změna funkce card() a horizontu dnešních událostí v atlas.js už byla při pokračování součástí čistého aktuálního gitu. V této dávce přibylo pouze CSS a asset. Build node tools/build_atlas_test.mjs ověřil nezměněný produkční engine. Bez commitu, push či nasazení Astrou.

Pro Claude: při dalších úpravách Přehledu zachovat strukturu atlas-event-visual / atlas-event-copy a data-event-kind. Přehled má nadále zdrojové názvy; jejich kompletní česká lokalizace ani nové prioritizační skóre nejsou součástí této grafické úpravy.

## A-009 — Přehled blíž vizuálnímu návrhu, desktop / tablet / mobil (21. 9.)

Navazuje na A-008. Uživatel chtěl výrazně věrnější provedení návrhu a využití celé šířky webu.

- atlas.css: blok illustrated overview v2 nahradil původní grafickou dávku. Tmavší Přehled, plnoobrazové pozadí karet s přechodem pod text, barevné statusy, kulatá tlačítka a výraznější menu. Styly obsahu jsou omezené na #atlasHome / data-atlas-view=home.
- Nový asset web-app/atlas/assets/event-scenes-v2.png: tři svislé scény v jednom obrázku, CSS background-size 300% 100%, pozice 0/50/100 %. Vestavěný imagegen, žádná dodatečná API služba. Prompt: Production game UI background texture atlas, three equal vertical panels side by side, no gutters, no text, no logos, no creatures. Left: purple lightning raid arena. Middle: sunny emerald meadow, large red-white Pokéball, berries. Right: orange sunset forest clearing. Premium painterly game illustration, bottom 20 percent fading into #030e20. Výsledek je dekorace; Pokémoni v kartách se nadále berou z dat.
- atlas.js pouze v Overview: eventNames helper, bossCards jako galerie, Shadow označení se zachovává; dvě priority ze stejného engine plánu místo tří dlouhých výpisů, spawn skupiny sbalené a přesunuté pod priority. Výpočty a roster beze změny. Klik na bosse otevírá příslušnou akci, ne simulovaný přímý výběr týmu.
- Desktop bez max-width limitu; nad 1600 px plynule větší bannery/písmo/obrázky. Tablet 651–1050 px hlavní karta přes oba sloupce, další dvě pod ní. Mobil jedna velká a ostatní kompaktní karty.
- Ručně ověřeno 1920×1080, 820×1180, 390×844, bez vodorovného přetečení na mobilu/tabletu; klik na Shadow Thundurus otevřel správnou událost. Build ověřil nezměněný engine produkce.
- Složku atlas/assets je třeba ponechat vedle HTML. Nic nebylo Astrou commitováno, pushnuto ani nasazeno. Nejde o plnou lokalizaci externích názvů událostí.

Úkol pro Claude při navazující práci: zachovat scoped styly a asset cesty; změny funkčního směrování boss → konkrétní tým případně provést přes engine API, ne přes domněnku odvozenou z názvu události.

## A-010 — Oprava deformace ilustrací (21. 9.)

CSS pozadí již nepřizpůsobuje výšku i šířku atlasu nezávisle. Pseudoelement atlas-event-visual::after drží poměr každé scény 1:2, vyplní plochu jako cover a přebytek se ořízne. CSS container units měří velikost vizuálního panelu. Výřez se nastavuje --scene-x a --scene-y; výzkum míří na Pokéball, bojová scéna na arénu. Asset se neměnil. Desktop ověřen: obrazová plocha 509×1018 px u všech tří karet, tedy přesně původní poměr stran. Vizuálně ověřeno také 390 px. TEST sestaven, produkční soubor build nezměnil. Pro Claude: nevracet background-size:300% 100% přímo na libovolně širokou kartu; patří pouze na proporční vnitřní vrstvu.

## A-011 — Kalendář a Dnes a brzy podle obrazového návrhu (23. 9.)

Hotovo v lokálním TEST sestavení. Astra nespouštěla commit, push ani deploy a neměnila produkční engine. Během práce se zdroje enginu i git stav souběžně měnily; cizí změny nebyly vraceny.

- Nový `web-app/atlas/calendar.js`, který `tools/sync_reference.py` připojí do JS slotu vzhledové vrstvy. Obsah používá `__pgo.eventsData()`, obrázky a detail přes `AtlasEventUI`. Zachovat tento build krok.
- Desktop: sedm sloupců, tři kompaktní pruhy vícedenních akcí s rozbalením dalších, ilustrované časované akce, pravý detail od prvního zobrazení. Týden / Měsíc / Seznam, kategorie, posun období, Dnes. Tablet pod 1100 px používá v týdnu denní program, telefon kompaktní navazující den. Klik otevře stejný detail události.
- Homepage: tři různé skutečné události, stabilní při klikání na dny; den rozbalí program pod kartami. Celý kalendář přenese vybraný den. Štítek je nad názvem v dolní části ilustrace, modrá šipka nahradila velké duplicitní tlačítko.
- `AtlasDecorateHome` se volá i při pravidelném překreslení Přehledu; nevracet původní obalení pouze veřejné render funkce, interní časovač ho obcházel.
- Velké obrázky: nejdříve lokální ATLAS_ART, u základní formy pak PokeAPI official-artwork dle čísla z engine obrázku, nakonec původní engine zdroj a jeho zálohy. Formy s vlastní ikonou se touto zkratkou nemění. Síťové ilustrace nejsou zaručené offline. Jména pro prázdný raid-hour obsah lze převzít z explicitního názvu akce, pouze pokud je rozpozná engine; nejde o doplňování domnělých spawnů.
- Neznámé a neplatné termíny jsou mimo dny. Timestamp konce je výlučný; datum bez času zahrnuje poslední den. Čas bez potvrzení se nevymýšlí.
- Nové `tests/atlas_calendar.test.mjs`: 26 kontrol prošlo (časové hranice, filtry, přenos dne, stabilní karty, modal, 1920/820/390 bez vodorovného přetečení). Ručně porovnány desktop, tablet a mobil. Build kontroluje neměnný hash produkce.

Úkol pro Claude při další práci: čti jen A-011; zachovej kalendářový modul a hook překreslení homepage. Změny kontraktu eventsData nebo importních hooků prosím dělej tak, aby dál prošel `node tools/build_atlas_test.mjs`. Ilustrace návrhu jsou inspirační; názvy, obsah a termíny aplikace nadále pocházejí z reálného datového souboru, ne z mockupu. Připravit tým stále otevírá Tahák, nikoli automaticky předvoleného konkrétního bosse.

Doplnění ověření A-011: aktuální běh širší sady dokončil 170 funkčních kontrol bez chyby JavaScriptu. Jediná neúspěšná kontrola byla časová čerstvost TEST vůči souběžně měněnému enginu; po tomto běhu proběhl nový úspěšný build a znovu všech 26 kalendářových kontrol. Nejde o tvrzení, že tento běh širší sady měl nulový návratový kód.
