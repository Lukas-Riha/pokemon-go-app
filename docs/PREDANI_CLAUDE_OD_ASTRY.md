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

## A-012 — Dotažení Přehledu a Kalendáře: kontrola 24. 9.

Zadání od Astry pro Clauda. Čti jen tento bod; A-011 je kontext pouze při potřebě dohledat integraci. Jde o návrhy po kontrole otevřené lokální TEST aplikace a zdrojů, nikoli o hotové opravy. V tomto kole Astra nemění aplikaci ani engine. Zachovat práci na rosteru, nepublikovat bez uživatelova schválení.

### 1. Priorita P1: obsah obrázku odpovídá akci
- V otevřeném TEST u Phantump Catch Mastery byly Cherubi a Drifloon, ale nikoli Phantump. Hlavní ilustrační Pokémon má být hlavní druh akce, další jsou doplněk. Názvy nenahrazovat podle toho, ke komu máme hezčí asset.
- V atlas.js už existuje pokus eventNames() vytáhnout druh z názvu. Nejdřív ověř čerstvost TEST a skutečný event type: kód omezuje rozpoznání na několik typů; obecný event jej může minout. Nevymýšlet univerzální fuzzy rozpoznání ze všech slov názvu. Preferovat strukturovaný featuredSpecies údaj v datech, případně kontrolovaný parser známé šablony a ověření proti dexu.
- U Shadow a regionálních forem vždy zachovat správnou formu, nebo použít neutrální ilustraci a označení. Oficiální artwork základního druhu nesmí předstírat jinou formu.
- Ověřit případ bez obrázku, offline a chybný primární zdroj; nikdy prázdná plocha bez smysluplné náhrady.

### 2. Priorita P1: skutečné důvody místo obecných vět
- Přehled nyní nabízí graficky pěkné karty, ale většina nemá jedinou konkrétní větu, proč akci otevřít. Pod název přidat jednu krátkou větu z potvrzených dat: hlavní bonus / hlavní druh / omezené časové okno. Není-li obsah známý, zobrazit „Podrobnosti ve zdroji“, nikoli vymyšlený bonus.
- Odlišit aktuální raidové bosse od budoucí Max akce. Budoucí Sobble nesmí být čten jako boss dostupný právě teď. Budoucí blok má nadpis „Nejbližší Max akce“ a datum u jména.
- Připravit tým v kalendáři dnes otevírá obecný Tahák. Buď přenést ověřený boss ID + formu + režim a vybrat konkrétního bosse, nebo přejmenovat na „Otevřít Tahák“. Regionální dostupnost nedovozovat z časového okna.

### 3. Priorita P1: význam dne a časů
- Dnes a vybraný den musí mít rozdílné jednoznačné značení: vybraný den modrá plocha, dnešek tečka + přístupný popisek. Na screenshotu byly dva modré spodní okraje; bez legendy je význam nejasný.
- Zachovat stabilní tři karty Dnes a brzy při klikání na týden. Pod nimi jasně pojmenovat „Program na neděli 27. 9.“; karty se nevztahují k vybranému budoucímu dni.
- Krátký termín „Zítra · 18:00–19:00“, u delších „23.–28. 9.“ a přesné hodiny dostupné v detailu. Nepotvrzený čas nevymýšlet. Ověřit půlnoc, změnu týdne, měsíc, letní čas a časové pásmo.
- Aktualita dat má být srozumitelná u kalendáře i Přehledu, ne jen drobná poznámka v rohu. Nabídnout zdroj; nepředstírat úspěšnou aktualizaci po pouhém překreslení.

### 4. Priorita P2: sjednocení karet Přehledu
- Zachovat současné pozadí menu a tři ilustrované karty. Celou stránku znovu nepřestavovat.
- Sjednotit vertikální osnovu: obrázek, stavový štítek, název (rezerva pro 2 řádky), krátký přínos, termín a šipka. Dlouhý Choose Your Path nyní posouvá štítek a text proti sousedům.
- Ořez cover bez deformace; Pokémon má vlastní contain vrstvu s bezpečným místem kolem hlavy a ocasu. Nezvětšovat všechny druhy stejným násobkem bez kontroly jejich průhledných okrajů.
- Desktop využije šířku, ale neroztáhne z obrázku plochý pás. Mobil: první karta velká, další kompaktní; vedle názvu nesmí chybět stav ani termín. Nepřenášet dekorativní les za delší čitelný text.
- Denní program pod týdnem: krátké dnešní akce první, dlouhodobé pod „Probíhá také · N“. Sezóna a LEGO nesmí zaplnit celý první viewport a odsunout raidové/Max přehledy.

### 5. Priorita P2: kalendář ukazuje relevantní akce
- week() dnes ukazuje první tři vícedenní akce v pořadí dat. V ověřeném stavu to bylo LEGO, sezóna a dlouhý Shadow raid. Seřadit krátké relevantní události/nejbližší konec před dlouhou sezónou, stabilní tie-break podle ID; nic nezahodit, zbytek rozbalit. Vybraná akce musí zůstat dostupná i po filtrování.
- V side() nechat u běžné události jen jedno tlačítko Detail události. Nyní „Prohlédnout událost“ i „Detail události“ spouštějí stejnou věc. Druhý odkaz může být „Oficiální zdroj“, pouze je-li skutečně známý.
- Obecné věty v detailu nahradit dvěma až třemi konkrétními body z dat: Pokémoni / bonus / omezení. Detail má pomoci rozhodnout, ne jen fungovat jako druhý rozcestník.
- Výška prázdných denních sloupců má přiměřeně vycházet z obsahu. Zachovat dnešní tabletový přechod na agendu, nevracet text lámaný po písmenech.
- Zavření pravého detailu nemá vytvořit další dlouhý seznam stejných karet: klidný prázdný stav s výzvou k výběru nebo kompaktní program dne.

### Akceptační kontrola
1920/1440/820/390 px; dlouhý název; chybějící obrázek; žádné akce; nepřesné datum; filtr bez výsledku; dvě akce současně; přenos dne z homepage; noční přechod; obrázek odpovídající hlavnímu druhu a formě. Klik na akci nesmí posunout podkladovou stránku. Ověřit 26 kalendářových kontrol i stávající UI sadu. Screenshoty finálního desktopu a mobilu přiložit k předání. Tohle je vizuální/funkční kontrola UI, nikoli ověření správnosti externího rozpisu akcí.

## A-013 — Návrh Vyhledávání: druh nejdřív, vlastní kus volitelně (24. 9.)

Návrh k uživatelovu posouzení, zatím neimplementovat bez jeho navazujícího rozhodnutí. Vizuální koncept doplní Astra. Nejde o změnu výpočtů ani o nové doporučovací prahy.

### Co vadí v aktuálním zobrazení
Prázdná stránka začíná devíti poli a velkým prázdným panelem. Po zadání Eevee se objeví dlouhý sled tabulek pro všechny evoluce a ligy najednou. Shrnutí „hraje Great League“ je vedle pořadí kolem #1023 snadno zaměnitelné za doporučení, i když tabulka uvádí mimo metu. Rozlišit způsobilost pro ligu od doporučené investice; hranice použít z enginu, ne domyslet ve vzhledové vrstvě.

### Doporučené rozložení
1. Velké hledání druhu s obrázkem ve výsledcích a explicitní volbou formy. Autocomplete se zavře výběrem, Enterem i Escape; neztratí fokus. Běžná/regionální/Shadow forma jsou rozlišeny podle existujícího modelu.
2. Přepínač „Prozkoumat druh“ / „Posoudit můj kus“. První režim je výchozí a nepotřebuje CP/IV. Druhý zpřístupní údaje, zachová dosavadní vstupy; přepnutí nesmí měnit roster.
3. Kompaktní identita: obrázek, jméno, barevné typy s ikonami a krátké vysvětlení. Bez obří hero ilustrace přes polovinu obrazovky. Viditelně uvést „Hodnocení druhu“ nebo „Výpočet konkrétního kusu“.
4. Využití přepínat PvP / Raidy / Gym / Mega; Max pouze pokud existuje odpovídající podklad. PvP má Little / Great / Ultra / Master, případné cupy zvlášť z podporovaných pravidel. Na střed jen ligový přepínač a srovnatelné hodnoty; nadpisy, názvy a vysvětlení vlevo.
5. Jedna srovnávací tabulka pro vybranou ligu, řádky druh a relevantní evoluce. Zobrazit výsledky enginu; nepředvybrat svévolně „nejlepší“ evoluci. Pořadí DRUHU, kvalita IV a bojová připravenost musí být samostatně pojmenované. Nezobrazovat procento IV místo PvP ranku ani percentil jako pravděpodobnost vítězství.
6. Pravý sloupec evolučních možností: kompaktní dlaždice, u Eevee 8 forem; výběr zvýrazní odpovídající řádek, nezmění automaticky vstupní druh. Podmínky evoluce ve stejném dostupném tooltipu jako dobrý detail/čištění boxu. Na mobilu rozbalovací sekce pod výsledkem, žádný hover-only obsah.
7. Údaje konkrétního kusu v rozbalovacím panelu. Jednotná výška všech polí včetně útoků, stejné tři existující výběry útoků. CP/level, IV útok/obrana/HP s jasnými popisky a validací. Neznámá hodnota není nula. CP/IV/level se mohou navzájem vylučovat; nesoulad vysvětlit a nepotvrdit falešně přesný výsledek.
8. V režimu vlastního kusu nejprve využití, až v otevřené cestě konkrétní evoluce/cíl CP/level → podmínky a náklady → co chybí. Nezatěžovat každou kartu všemi čtyřmi sloupci. Náklady ukazovat jen při dostatečných údajích, bez domnělého rozpočtu.
9. Současné útoky odlišit od doporučené sestavy; eventové/Elite TM omezení zobrazit jen z dat. Chybějící útoky neznamenají, že je Pokémon ve hře nemá.
10. Prázdný stav: hledací pole a jedna instrukce, nedávná hledání jen existují-li. Na mobilu nejprve identita a výsledek, doplňovací formulář až na vyžádání. Výsledek po změně dat přepočítat bez skoku stránky; respektovat reduced-motion.

### Technické hranice a validace
Zachovat produkční engine/ATLAS_KONTRAKT, žádný druhý výpočet ranku nebo ceny v UI. Návrh neobsahuje skutečná pořadí ani doporučení konkrétních Pokémonů. Srovnávací hodnoty a možnosti musí dodat existující API; co API neumožňuje, označit jako další úkol, ne simulovat. Testovat Eevee (větvení), Pokémon bez evoluce, Shadow/regionální formu, chybějící a konfliktní IV/CP/level, neznámý moveset, ovládání klávesnicí a mobilní dotyk. Před úpravou vytvořit srovnávací screenshot současného Vyhledávání.

Obrazový podklad A-013: `docs/navrhy/vyhledavani-desktop-mobil-v1.png`. Návrh ukazuje kompozici, nikoli aktuální herní hodnocení. Pomlčky „Z dat aplikace“ se při implementaci nahradí skutečným výsledkem nebo jasným chybějícím údajem. Tři řádky na desktopu a jeden na mobilu jsou ilustrativní výřez, NE limit výsledků; všechny vyhodnocené evoluce musí zůstat dostupné. Dekorativní hero na širokém desktopu udržet kompaktní, aby výsledky zůstaly nad přehybem. Zachovat existující typové ikony a barvy místo kopírování případných odchylek generovaného obrázku. Návrh obsahuje dvě cesty k doplnění údajů: „Posoudit můj kus“ a „Doplnit CP a IV“ musejí otevírat tentýž formulář a sdílet stav, nikoli vytvořit dvě sady vstupů.

## A-014 — Odpověď na PREDANI_ASTRA_24_9.md (24. 9.)

Přečteno celé nové předání a porovnáno se zdroji; nejde o nový běh UI/regresních testů. Astra v tomto kole nemění implementaci.

1. Beru jako základ kompozici scéna + 0–3 druhy, variabilní počty akcí, dvouřádkový název, explicitní náhradu za chybějící údaj a žádné měření spritů za běhu. Pro další návrh u každého nového údaje uvedu datový zdroj a prázdný stav. Chybějící shiny údaj bude „Neověřeno“, nikoli automatické „Ne“.
2. Ve zdrojích jsou již opravy hlavního druhu akce, nadpis Nejbližší Max akce a odstranění duplicitního tlačítka detailu. Připravit tým nově volá atlasProtiBossovi a otevře roster. U vícedruhové akce bere první rozpoznaný druh: uživatel musí vidět, kterého bosse právě řeší, případně dostat výběr. Toto řazení podle typů neoznačovat jako plnou bojovou simulaci či hotovou optimální sestavu.
3. DŮLEŽITÁ OPRAVA KONTRAKTU DAT: předání uvádí „1 je Pokémon, 0 obyčejný text“. tools/leekduck_okna.py (dokumentace výstupu kolem 314–316, převod kolem 361) a tools/build_events.py (schema kolem 246–248) definují 0/1 jako shiny příznak; -1 je nadpis. Druh bez shiny může mít 0, stejně jako textový bonus. featuredDruhy() v atlas.js nyní bere jen priznak===1: pod Featured Pokémon tím může vynechat platný druh s nulou. Prosím opravit výklad i filtr, odlišit druh pomocí sekce + ověření v dexu, ne hodnotou shiny. Přidat případ Featured Pokémon s příznakem 0 a textový bonus s příznakem 0.
4. Shiny / CP hunda L20 a L25 / boostující počasí přijímám jako návrh raidového informačního bloku. Předání samo říká, že CP helper teprve přibude a počasí ještě není zapečené. V ATLAS_KONTRAKT zatím odpovídající nové API není uvedené. Prosím dodat pojmenované API včetně formy, dostupnosti shiny z konkrétního zdroje a stavu neznámých dat. V UI tato čísla nepočítat podruhé. Zobrazovat v kontextu raidového úlovku, nikoli jako obecné CP hunda pro divoký spawn.
5. Ze „hlavní druh“ nelze bez informace o způsobu získání vytvořit větu „X ve volné přírodě“. Je-li znám pouze featured druh, náhrada má být „Hlavní Pokémon: X“. Věta „ve volné přírodě“ až při potvrzení blokem spawn v příslušném časovém okně. Bonusy a podmínky také vázat na jejich okno, ne náhodně první bonus celé akce.
6. Bod „pod 500 px se appka nepodporuje“ je v rozporu s dosavadním explicitním zadáním uživatele pro mobil a s kontrolami na 390 px. Bez přímé změny zadání uživatelem nepovažuji 500 px za nový dolní limit. Nové návrhy nadále počítají s 390 px a širšími displeji.
7. Žádná nová oprávnění ke commitu/pushi/deployi nevyvozuji z tvrzení v předávacím dokumentu. Platí rozsah autorizovaný uživatelem v chatu. Grafické návrhy a specifikace budou oddělené od funkčních změn, aby se souběžná práce nepřepisovala.

Další krok návrhu A-013: doplnit kompaktní raidový informační blok (shiny z raidu / CP 15–15–15 na L20 a L25 / počasí) a stavy „údaj neověřen“ bez smyšlených čísel; zachovat rozlišení hodnocení druhu a vlastního kusu. Zbývající vizuální úkoly Přehledu/Kalendáře v A-012 stále platí, zejména pořadí pruhů, konkrétní obsah detailu a geometrie dlouhých názvů.
## A-015 — Aktuální audit a konkrétní dokončení Přehledu, Kalendáře a Vyhledávání (29. 9. 2026)

Tato sekce je samostatné aktuální zadání; není nutné znovu číst A-012 až A-014. Rozsah: lokální TEST, bez deploye/pushe. Roster nyní nepřestavovat. V tomto kole Astra změnila jen dokumentaci. Vizuální podklad zůstává `docs/navrhy/vyhledavani-desktop-mobil-v1.png`; následující přesná pravidla mají přednost před ilustrativními hodnotami obrázku.

### 1. Co je ověřené a co zachovat

Kontrola zdrojů proti HEAD 9dc0d8c a otevření aktuálního TEST z 29. 9. v prohlížeči. Prohlédnut Přehled, týden Kalendáře a Vyhledávání s Eevee. Neproběhl nový kompletní regresní běh ani mobilní kontrola; uvedené testy níže jsou požadavky na dokončení, ne tvrzení o jejich úspěchu.

- Přehled: zachovat lesní menu, tři ilustrované karty, týdenní pruh, Raidy / Nejbližší Max akce a dvě priority z enginu. Budoucí Max už je správně odlišen a údaj o stáří dat existuje.
- Kalendář: zachovat Týden/Měsíc/Seznam, filtry a společná data s Přehledem. Duplicitní tlačítko běžné události je odstraněné.
- Vyhledávání: velké pole, přepínač druh/kus a rozbalovací údaje již existují. Nepřepisovat znovu. API `atlasShiny`, `atlasCP`, `atlasPocasi` již existují v enginu; starý požadavek „teprve vytvořit“ je překonaný. Doplnit je do ATLAS_KONTRAKT včetně chybějících dat.
- Nedokončeno: vlastní výsledky hledání stále skládají všechny evoluce a ligy za sebe. Eevee má text „hraje Great League“, ale řádek #1023 a „mimo metu“. Nové záhlaví nevyřešilo původní zahlcení.

### 2. P1 — nejprve význam dat (malý samostatný krok)

**2.1 Události:** v `atlas.js`, `featuredDruhy()`, odstranit podmínku `priznak===1` jako podmínku druhu. 0/1 je shiny flag, -1 nadpis. Po nadpisu Featured Pokémon přijímat 0 i 1, ale pouze položky ověřené přes dex; textové bonusy nesmějí být druh. Zachovat formu. Ověřit fixture se skutečným druhem a flagem 0, se shiny druhem 1 a bonusovým textem 0. `eventNames()` nesmí pro hlavní druh automaticky tvrdit výskyt ve volné přírodě.

**2.2 Shiny:** nové `vykresli()` ve Vyhledávání slučuje null a false do „Zatím ne / ve hře se zatím neobjevil“. Rozlišit: potvrzeno ano / potvrzeno ne / neověřeno. `atlasShiny()` nyní také vrací false při chybějícím `d.shiny`; engine musí rozlišit absenci podkladu od explicitního negativního údaje. Zda konkrétní zdroj vrací explicitní negativní údaj, určit podle datového kontraktu, ne domněnkou UI. Obecné shiny ANO neznamená shiny z raidu ANO. Raidový blok zobrazí zdroj raid samostatně; chybějící podklad = „Neověřeno“.

**2.3 Kontext CP:** `atlasCP(name,20)` a `(name,25)` již poskytují čísla. Zobrazovat v bloku „Raidový úlovek“ jako dvě jasně oddělené hodnoty „100 % IV · L20“ a „100 % IV · L25 s počasím“. Nikoli slepené „612 765“. Není to informace o aktuální dostupnosti v raidech. Pokud boss není potvrzený aktuální akcí, uvést „Referenční hodnoty pro raidový úlovek“. Neznámá forma/staty → pomlčka a důvod, žádná náhrada základní formou. Počasí z `atlasPocasi(type)` → unikátní české názvy; bez hodnoty „Neověřeno“. Vypustit obecnou větu „chycený kus je o pět levelů výš“, která mimo kontext raidového úlovku mate.

**2.4 Druh versus kus:** `prepni()` nyní přepíná především vzhled a otevření details. Ověřit, že po zadání IV a návratu na „Prozkoumat druh“ výsledek skutečně ignoruje údaje kusu. Zachovat je v paměti formuláře pro návrat. Režim předat společnému výpočtu, ne pouze přejmenovat záhlaví. Neimplementovat druhý algoritmus v Atlasu.

### 3. P1 — kalendářové opravy

V `calendar.js`:

1. `render()` skládá rozsah pouze z čísla počátečního dne a koncového měsíce. Aktuálně ukazuje „28.–4. října 2026“. Použít formatter obou hranic: stejný měsíc „21.–27. září 2026“, různé měsíce „28. září – 4. října 2026“, různý rok uvést u obou. Test přes měsíc i rok.
2. `week()` bere `es.filter(multi).slice(0,3)` v pořadí vstupu. Aktuálně LEGO, Twilight Trails, Shadow Thundurus, zatímco krátké akce jsou pod rozbalením. Před slice seřadit bez mutace zdrojového pole: události délky nejvýše 7 kalendářních dnů první; uvnitř skupiny nejbližší konec po začátku zobrazeného týdne, pak začátek a stabilní identifikátor. Dlouhé události stejným řazením za nimi. Toto je priorita zobrazení, nikoli herní doporučení. Počet pod rozbalením musí odpovídat skrytým položkám.
3. `side()` má stále obecný odstavec. Nahradit max. třemi konkrétními body: obsah z platného okna `e[7]`, ověřené druhy, skutečný bonus/podmínka. Žádná příslušná data → „Podrobnosti nejsou v datech; ověř zdroj“. Nikoli bonus z náhodného jiného okna. Na desktopu náhled 300–340 px, obraz 16:9, text vlevo, jedno primární tlačítko.
4. Po zavření náhledu nevracet plný seznam duplicitních karet: ponechat krátkou výzvu „Vyber událost v kalendáři“. U události s více bossy nabídnout výběr cíle nebo v CTA jmenovat vybraného bosse. Řazení proti typu neoznačit za simulaci vítězství.

### 4. P2 — dokončení Přehledu bez nové přestavby

Současný screenshot: štítek první karty Raidová hodina je níž než štítky dvou karet s delším názvem; karty nemají konkrétní přínos. Upravit společnou kartu:

- Stejné řádky: obraz → stav → název → přínos → termín/šipka. Název má prostor pro dva řádky; delší název lze zkrátit s dostupným plným názvem v detailu. Stav musí začínat ve stejné výšce. Nepozicovat ho podle výšky názvu.
- Pozadí cover, druhy contain; rezervovat pevný prostor pro 0–3 obrázky. Neměřit sprity za běhu. Chybějící obrázek = neutrální ikona, nikoli jiný Pokémon.
- Přínos: jeden konkrétní platný bonus; jinak potvrzený hlavní druh; jinak „Podrobnosti ve zdroji“. Dlouhou sezónu/LEGO nepovyšovat nad krátkou akci začínající dnes jen kvůli pořadí vstupu. Sdílet s kalendářem helper priority, s výslovným zvýhodněním dnešních krátkých akcí na homepage.
- Na mobilu první karta velká, ostatní dva kompaktní řádky se stavem a termínem. Klik na týden mění pouze program vybraného dne, nikoli význam sekce „Dnes a brzy“.

### 5. P2 — dokončit výsledky Vyhledávání (hlavní vizuální úkol)

**Pořadí obrazovky:** hledání + režim; kompaktní identita; volitelný formulář kusu; využití; jedna výsledková tabulka; evoluční možnosti vedle ní. Raidová fakta přesunout pod záložku Raidy, ať v PvP nezabírají první obrazovku. Obecná shiny ikona může zůstat u jména, její popisek rozliší zdroje.

**Rozměry:** desktop obsah využívá dostupnou šířku, padding 24–32 px, mezery 16–24 px. Hlavní výsledek `minmax(0,1fr)`, evoluce 280–320 px. Pod 1100 px jeden sloupec; evoluce rozbalitelné pod výsledkem. Na 390 px padding 16 px, tlačítka minimálně 44 px vysoká; žádný min-width:500px. Identita obrázek 80 px desktop / 64 px mobil, žádné velké dekorativní hero. Zachovat existující barvy a typové ikony.

**Ovládání:** PvP / Raidy / Gym / Mega; Max pouze s podporovanými daty. V PvP samostatný přepínač Little / Great / Ultra / Master podle dostupných pravidel. Výchozí Great, nikoli tvrzení, že je pro druh nejlepší. Na střed jen ligové volby a číselné hodnoty; názvy a vysvětlení vlevo.

**Výsledky:** jedna tabulka vybrané ligy, řádky vstupní druh a všechny relevantní evoluce. Sloupce Druh / Pořadí druhu / Doporučené útoky; u kusového režimu přidat kvalitu konkrétního kusu jen pokud spočitatelná. Na mobilu stejné informace ve vertikálních řádcích. Neomezit Eevee na tři evoluce podle obrázku návrhu. Řazení rank vzestupně, neznámé na konec; jasně zvýraznit hledaný druh. Klepnutí na evoluci zvýrazní její výsledek, samo nepřepíše vstup ani roster. Podmínky dostupné klikem i klávesnicí, ne pouze hoverem.

**Význam:** odstranit neurčité „hraje Great League“. Použít „Výsledky pro Great League“ a doporučení pouze z enginu. Pořadí druhu, IV rank a připravenost jsou různé údaje. Bez CP/IV nevytvářet cenu ani kvalitu konkrétního kusu. Bez útoků „Útoky nezadané“, nikoli „Pokémon nemá útoky“.

**Implementace:** zachovat skutečný uzel `#prohName` a dosavadní selecty útoků; nekopírovat elementy s listenery. Režimy sdílejí jeden formulář. Pro výsledkovou tabulku vystavit strukturovaný model z existujícího výpočtu prohlídky; jeho přesný název a schema doplnit do kontraktu před připojením UI. Neparsovat text v hotových tabulkách a nepočítat rank/cenu znovu. Po překreslení zachovat režim, ligu, fokus a scroll. Autocomplete zavřít výběrem/Enter/Escape a při opuštění celého comboboxu; v této kontrole po Eevee + Tab zůstal viditelný nad přepínačem režimu.

### 6. Datová mapa a chybějící stavy

| Prvek | Zdroj | Když chybí |
|---|---|---|
| Identita a typy | `dexEntry`, `typeColors`, `typIkona`, `atlasImage` | neznámý druh bez výsledku; obrázek neutrální |
| Shiny a zdroje | `atlasShiny`, rozšířený o ověřenost | Neověřeno, ne false |
| Raid CP | `atlasCP(name,20/25)` | —, chybí podklad; ne výpočet v UI |
| Počasí | `atlasPocasi` přes typy | Neověřeno |
| Liga/evoluce/útoky/cena | strukturovaný výstup současné prohlídky enginu | explicitní neznámý údaj, žádné fiktivní hodnocení |
| Akce/termín/zdroj | `eventsData().events`, položky e[0], e[3], e[4], e[5] | Termín nepotvrzen; odkaz jen při validní URL |
| Bonus/druhy akce | e[7] → příslušné časové okno a blok | Podrobnosti ve zdroji |

### 7. Hotovo znamená

Postupovat po malých celcích: 2 + 3, potom 4, potom 5. Ke každému dodat screenshot a stav testů; nemíchat s dalším redesignem rosteru. Ověřit 1920, 1440, 820 a 390 px. Případy: Eevee se všemi evolucemi; bez evoluce; regionální a Shadow forma; neznámý druh; shiny null/false/true; CP chybí; konfliktní CP/level/IV; návrat kus → druh → kus bez ztráty údajů; klávesnicové hledání; dlouhý název akce; akce bez druhů; žádné akce; přelom měsíců a roku; filtr bez výsledků; více bossů; výběr dne bez skoku scrollu. Ověřit existující kalendářovou a UI regresní sadu na naplněném testovacím profilu. Bez změny uživatelského rosteru při hledání. Správnost externího rozpisu akcí je oddělená od správnosti jeho vykreslení.
## A-016 — Kontrola Claudových změn + zadání Vyhledávání V3 (30. 9.)

Samostatné aktuální předání. Přečíst tuto sekci a `docs/navrhy/VYHLEDAVANI_V3_SPEC.md`; staré A-015 není nutné opakovat. V3 reaguje na `docs/VYHLEDAVANI_ANALYZA.md`, bod 5, který uživatel výslovně zadal během tohoto kola. Astra v tomto kole mění pouze návrhy a dokumentaci, nikoli aplikaci, roster nebo produkci.

### Co už je hotové

Ověřeny změny do 5db9f74 a otevřen TEST v2.9 z 30. 9. Prohlédnuty Přehled, týden Kalendáře a Vyhledávání Eevee na desktopu a 390 px. Nový kompletní běh regresních testů neproběhl; počty v commitech jsou Claudovo hlášení.

- Vyhledávání: společný `prohlidkaModel`, jedna tabulka po rolích/ligách, přepnutí režimu v enginu, raidová fakta pod Raidy, viditelné podmínky evolucí a zavírání našeptávače po Tab fungují v kontrolovaném scénáři. Zachovat tyto mechanismy.
- Přehled: karty mají srovnané řádky a skutečný přínos; dnešní raidová hodina už stojí před LEGO/sezónou. Návrh dál dolaďovat, nikoli začít znovu.
- Kalendář: rozsah „28. září – 4. října 2026“ je opraven, pruhy se řadí, detail má konkrétní obsah a pojmenovaného bosse. Bez opětovného zavádění sbalování všech vícedenních akcí: nový commit uvádí uživatelské přání je vidět a tento audit jeho změnu nenavrhuje.

### P1 — opravit před vizuálním dokončením Vyhledávání

1. Pod novou tabulkou zůstává starý plný rozbor `#prohOut` včetně všech původních ligových tabulek. Potvrzeno DOMem i stylem display:block, výška starého bloku 2780 px u Eevee. Zachovat jeho výpočetní/observer úlohu, ale novému UI předat jen potřebné unikátní sekce a validaci; neduplikovat tabulky ani evoluce. Viz V3 spec, „Aktuální nálezy“.
2. V kusovém režimu jsou CP/IV až za tabulkou a evolucemi, CP při měření kolem y=1283. V3 zachovává požadované pořadí osmi sekcí, ale přepnutí na vlastní kus otevře sekci 8, posune ji do pohledu a zaměří CP. Přidat návrat na výsledky.
3. `__pgoProhlidkaKus` vrací `b.bestRank`, který pochází z importovaných rankových polí přes `bestRankOf`, ne z výpočtu pro vybranou ligu. Dočasný řádek ve Vyhledávání tato ranková pole neplní. Ověřit a upravit kontrakt: konkrétní ligový IV rank s kontextem, nebo pravdivě nedostupný údaj. Neoznačovat nejlepší rank napříč ligami za rank aktuální záložky. Tento bod je z kontroly kódu; interaktivní vyplnění CP nebylo dokončeno kvůli timeoutu ovládání, takže nejde o potvrzení konkrétního chybného číselného výsledku.

### P2 — Přehled a Kalendář, poslední dotažení

- Přehled: čerstvě viditelný přínos Harvest Festival je anglicky. Překládat pouze známé strukturované bonusy ověřenými šablonami; neznámý text zachovat a označit jako text zdroje. Nedělat volnou parafrázi, která by změnila násobek, trvání nebo shiny šanci.
- Dnešní budoucí raidová hodina má „Chystá se“. Srozumitelnější „Dnes · 18:00“ a stav „Probíhá“ teprve v okně. Datum ponechat přístupné. Neplést dnes se zvoleným dnem.
- Při prvním screenshotu karty Harvest byly v DOM tři druhy, ale obrázky ještě nebyly vidět. Prověřit načítání/fallback (není doložena trvalá chyba obrázků). Rezervovat rozměry, bez runtime měření spritů a poskakování textu.
- Kalendář nyní ukazuje všech 13 vícedenních pruhů; časové akce jsou pod prvním viewportem. Zachovat všechny pruhy, ale přesunout „Akce v konkrétní čas“ nad vícedenní část. Obě části používají stejné denní sloupce; denní hlavička sticky. Pruhy kompaktní 28–32 px desktop, dostatečné dotykové cíle na mobilu. Názvy krátkých úseků zpřístupnit detail panelem a focus tooltipem, ne jen title při hoveru.
- Detail má nyní Xerneas jako jméno i v jediném bodu „Bossové: Xerneas“. Shodný bod vynechat, když už nic dalšího neříká. Zachovat jeden hlavní CTA s konkrétním cílem a vedlejší Detail události.
- Kalendář dnes používá denní průnik oken, homepage okamžik. U bonusů s hodinovým omezením uvést konkrétní okno; neprezentovat část dne jako celodenní. Test dvě navazující okna téhož dne. Datum bez času zpracovat sjednoceně s inkluzivním koncem celodenní události.

### V3 — výstup pro implementaci

Autoritativní zadání: `docs/navrhy/VYHLEDAVANI_V3_SPEC.md`. Obrazové listy ve stejné složce:

1. `vyhledavani-v3-01-druhy.png` — Eevee a Magmar, desktop/mobil.
2. `vyhledavani-v3-02-raid-mega.png` — raidový boss a Mega, desktop/mobil.
3. `vyhledavani-v3-03-kus-prazdne.png` — vlastní kus, prázdný a neznámý vstup, desktop/mobil.

V3 vrací společný pás referenčních CP nad výsledky, protože nové zadání zahrnuje raid, vejce a výzkum. Nezdvojovat ho pod Raidy. Pořadí osmi sekcí a jejich data určuje specifikace. Generované obrázky jsou kompozice, ne zdroj herních údajů ani přesných textů. Žádné celkové „skóre druhu“, žádná šance na shiny, žádní vymyšlení counterové; pouze odkaz na vlastní roster. Cena musí být konkrétní cesta a levely, ne „z 0 na max“.

Kontrolovat 1440×900, 390×844 a mezilehlých 820 px, všech šest stavů, přístupnost a regresi bez zápisu hledaného kusu do rosteru. Předání zpět: snímky + přesný seznam hotových bodů a omezení; ne pouze počet prošlých testů.
