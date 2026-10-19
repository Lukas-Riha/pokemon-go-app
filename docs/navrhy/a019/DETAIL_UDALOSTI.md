# Detail události — audit a obrazový návrh

7. 10. 2026. Návrh, nikoli implementace. Vyhledávání nyní ponechat.

## Co bylo skutečně ověřeno

V lokálním TESTu otevřen Kalendář → Zorua Community Day → Detail události. Porovnáno vykreslení s aktuálním `web-app/atlas/atlas.js`, `data/events.json` a stránkou události na LeekDucku. TEST hlásí data 5. 10., JSON na disku 7. 10. Zdrojový JS už obsahuje novější `teloAkce`, otevřená sestava ještě vykresluje starší strukturu po časových oknech. V tomto kole nebyl spuštěn build, změna appky ani nasazení.

Nelze říci, že UI zahazuje všechna chybějící data. Jsou tři oddělené vrstvy problému:

| Vrstva | Doložený stav | Co z toho plyne |
|---|---|---|
| Otevřený TEST | Opakovaný čas, textové shluky bonusů, univerzální odkaz do soubojů, shiny u Stardustu | Zastaralé sestavení a nevhodná prezentace |
| Aktuální renderer | `teloAkce` prochází všechny neprázdné sekce všech oken; `list` už rozlišuje text a druh | Nepřepisovat tyto Claudovy opravy jako neexistující; nejprve ověřit čerstvý TEST |
| Datový import | Zorua má bonus/spawn/vyzkum/shiny/novinky, ale nemá speciální útok ani samostatné prodloužené okno | Samotným CSS nebo přeuspořádáním dialogu nelze obsah doplnit |

### Konkrétní rozdíly proti zdroji

[LeekDuck – Zorua Community Day](https://leekduck.com/events/october-communityday2026/) uvádí evoluci se Sucker Punch do 21:00 a vybrané bonusy trvající do 21:00. JSON má jediné okno 14:00–17:00 a bonusy s hvězdičkou bez vysvětlení. Chybí rovněž vazba výzkumných úkolů na odměny; import zachoval pouze část odměn. Položka Stardust ×500 má příznak 1, který starý detail vykládá jako shiny. Zdroj má omezení pro druhy Incense a Lure, jež prosté názvy bonusů nezachovávají.

Tyto údaje byly ověřeny na komunitním zdroji, ne nezávisle u provozovatele hry. Nejde o důkaz dalších chyb u všech akcí. Audit rozšířit na raid, sezónu, placený a regionální event před plošnou změnou importu.

## Doporučená podoba

Velký detail nad kalendářem, desktop přibližně 1000–1120 px a nejvýše 90dvh; mobil celá obrazovka. Jeden svislý scroll. Zavření a název dostupné i při posuvu, Escape a návrat fokusu i scrollu na původní akci. Obrázek jako krátký banner, ne půl obrazovky.

1. **Hlavička:** název, typ akce, skutečný čas, místní čas / časové pásmo podle zdroje, omezení dostupnosti. Ilustrace z existujících aktiv bez deformace, náhradní vzhled bez obrázku.
2. **Co se vyplatí stihnout:** nejvýše 3–4 doložené přínosy v kartách s ikonou, hodnotou a podmínkou. Na mobilu dvě karty vedle sebe, pokud zůstávají čitelné. Všechny ostatní bonusy dostupné níže; nikoli ztracené oříznutím seznamu.
3. **Důležitý termín:** u CD evoluční okno a útok; u raidu boss a příprava; u výzkumu termín splnění nebo vyzvednutí, pouze pokud existuje. Chybějící údaj neodvozovat z názvu akce.
4. **Pokémoni:** obrázkové karty podle způsobu získání. Oddělit přírodu, raid, vejce a výzkum; ne jeden společný seznam. Shiny dostupnost není automaticky zvýšená šance. Klik otevře Vyhledávání, nikoli úpravu rosteru.
5. **Časová okna:** hlavní akce a prodloužené části jako krátká časová osa se samostatnými podmínkami. Bonus neplatí automaticky po celou dobu akce.
6. **Podrobnosti:** Výzkumy a odměny, další bonusy, speciální podmínky, případně placený obsah. Sbalené doplňky s jasným názvem. Prázdné sekce nekreslit; neznámý stav nezaměnit s neexistencí obsahu.
7. **Zdroj a aktualizace:** skutečné datum dat, odkaz a původ neověřených textů. Jeden kontextový CTA. Univerzální „Otevřít Tahák soubojů“ není vhodný u každé akce.

Desktop: hlavní obsah vlevo, důležitý termín v užším pravém sloupci. Mobil: důležitý termín před dlouhými seznamy. Na screenshotu návrhu jsou položky dosud chybějící v importu označeny; jde o poznámku pro návrh, ne doporučenou technickou hlášku pro hráče.

## Datový kontrakt pro Clauda — návrh, ne existující API

Nejdřív vytvořit dohledatelný obsahový model: u každé položky `kind` (pokemon/item/bonus/move/task/text), původní text, zdroj, platnost od/do, podmínky, případná placenost a nejistota. Pokémon navíc explicitní formu a tříhodnotovou shiny dostupnost. Předměty nikdy nemají shiny.

Výzkum musí zachovat vztah úkol → možné odměny; bonus → konkrétní okno; speciální útok → cílový druh + způsob získání + termín. Neodvozovat vztahy jen ze sousedství textů v UI. Zachovat raw obsah pro diagnostiku a zobrazení neznámých sekcí. Nová pole zavádět kompatibilně s nynějším tuple schématem a popsat v kontraktu.

Překlady známých bonusů mají šablony s parametry a podmínkami, ne volné parafráze, které odstraní výjimku. Neznámý text zobrazit jako text zdroje. Globální aktuální raidový seznam nepřipojovat automaticky k historické akci.

## Pořadí ověření před implementací

1. Porovnat čerstvě sestavený TEST s nynějším zdrojovým rendererem, aby se neopravovalo něco už opraveného.
2. Doplnit parser a kontrakt pro zjištěné mezery; uchovat fixture zdroje pro reprodukovatelný test.
3. Zorua: žádné shiny u předmětu, správná oddělená okna, útok a úkoly se správnými vztahy. Dále raid, sezóna s mnoha okny, regionální/placená akce, neznámé termíny.
4. Teprve potom připojit schválený nový detail. Časy, zdroje a hodnoty bere model, nikoli obrázek návrhu.
5. Ověřit desktop/mobil, dlouhé texty, zavření, klávesnici, zachování pozice a dostupnost všech sekcí bez ztráty obsahu.

## Soubory

- `detail-skutecny-stav.png`: skutečný starší TEST při kontrole.
- `detail-udalosti-navrh.png`: navrhovaný směr desktop/mobil, vestavěný image_gen.
- `PROMPT.txt`: zadání generátoru. Ilustrace není implementační ani datový zdroj.
