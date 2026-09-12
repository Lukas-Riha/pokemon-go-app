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
