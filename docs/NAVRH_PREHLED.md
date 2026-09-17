# Návrh modernizace Přehledu

Návrh, nikoli implementace. Obrázek: navrh-prehled-udalosti.png. Události a čísla v obrázku jsou ilustrační, nikoli ověřený živý obsah. Počasí, profil a notifikace přidané generátorem nejsou součástí zadání. Odznak DNES nesmí stát u události zítra.

## Cíl
Do několika sekund odpovědět: co právě běží nebo brzy končí, co pro to mohu udělat se svým rosterem, jaký je další krok a jeho cena. Přehled slouží jako vstup do existujících sekcí; nekopíruje celý kalendář ani rozpočet.

## Obsah v pořadí
1. Dnes a brzy: nejvýše tři karty. Název, skutečný termín, stav probíhá/končí/začne, stručný doložený bonus a jediná hlavní akce. Aktivní krátké události a blízké termíny před dlouhou sezónou. Všechny události dostupné odkazem. Datum bez hodiny nedoplňovat vymyšleným časem. Záznam bez termínu neoznačit jako dnešní. Ukázat stáří dat a zdroj; starý feed neslibuje aktuálnost.
2. Tvůj další krok: nejvýše tři konkrétní kusy. Využití → potřebný krok → cena → chybějící údaje. Investiční pořadí převzít z prachovyPlan(), respektovat rezervu a zvolenou ligu. Doplnění útoků označit jako opravu chybějících údajů, ne automaticky nutné TM. Rezervní nebo pouze CUTE kus nedoporučit k investici. Nedělat žebříček podle IV.
3. Rozpočet: dostupný prach, nastavená rezerva a cena vybraného plánu pouze pokud je aplikace zná. Jinak výzva Nastavit rozpočet. Zelené potvrzení jen při skutečném splnění podmínek. Candy/XL neoznačovat za dostupné, pokud jejich zásoba není známá.
4. Před hraním: nejvýše dvě relevantní výzvy k doplnění údajů nebo projití boxu. Počty pouze z enginu a skutečných dat. Nové kusy uvádět jen při existenci spolehlivé importní historie, nikoli podle pořadí řádků.

## Co z úvodu odstranit
Velký náhodný Pokémon, seznam ponechaných podle IV, obecné poučky a počet hvězdiček. Raidové pokrytí přesunout do podrobného rozpočtu/pokrytí; obsazený slot sám o sobě nepotvrzuje připravený tým.

## Data a hranice implementace
Ověřená API: eventsData(), getRows(), getComputed(), base(), prachovyPlan(), planKusu(). Použít sdílené zpracování termínů událostí. Nepočítat vlastní bojové skóre ani nepřepisovat computed. Napojení konkrétní události na skutečně připravený tým vyžaduje ověřit dostupné engine API; pokud chybí, zobrazit neutrální Otevřít Tahák, ne tvrdit Tým připraven. Neodvozovat aktuální připravenost z raidových slotů či IV.

## Responzivita a vzhled
Desktop: tři události v řadě, pod nimi další kroky a užší rozpočet. Mobil: jedna hlavní událost, dvě úsporné následující položky, kroky a rozpočet pod sebou; bez automatického carouselu. Střízlivé ilustrace, čitelný termín, jeden primární akcent; ne všechny akce stejně výrazné. Existující světlý i tmavý motiv. Bez závislosti na hoveru, viditelný focus, omezené animace.

## Ověření při realizaci v TESTu
Prázdný roster; chybějící útoky a rozpočet; staré či prázdné události; událost bez termínu; místní čas a hranice dne; změna profilu a import; shoda investičního pořadí a cen s enginem; mobil 360/390 px i desktop; žádný zásah do produkčního úložiště. Obrázek je návrh hierarchie, nikoli doklad funkčnosti.

## Realizováno v TESTu (17. 9.)
Kalendář po dnech, dialog akce, Raidy/Max podle potvrzených časových oken, spawny s původními podmínkami, první tři různé kusy z plánu enginu a příprava před hraním. Samostatná rozpočtová karta odstraněna podle následného zadání. Známé mezery dat a další práce enginu jsou v PREDANI_CLAUDE_OD_ASTRY.md / A-006. Žádné nasazení do produkce.
