# Vyhledávání V3 — návrh a implementační specifikace

30. 9. 2026. Odpověď Astry na celé `docs/VYHLEDAVANI_ANALYZA.md`, zejména bod 5. Navazuje na implementaci do 5db9f74. Návrh, nikoli změna aplikace. Platí pro lokální TEST, bez publikace.

## Rozhodnutí

V3 má být přehled druhu s rychle čitelnými údaji o úlovku a využití. Zachovat novou výsledkovou tabulku a společné výpočty. Odstranit zdvojení se starým rozborem. Všech osm sekcí má stabilní pořadí. Čísla a role v obrázcích nejsou nové doporučovací prahy.

Přijímám návrat referenčních CP nad záložky: nový požadavek zahrnuje i vejce a výzkum, nejde již pouze o raidová fakta. Tím se v tomto bodě nahrazuje A-015. Pás neříká, že daný druh právě existuje v daném zdroji úlovku.

„Hodnocení druhu“ znamená režim, nikoli číselný ukazatel. V3 raději používá malý štítek „Druh“. Žádná prázdná buňka pro neexistující celkové skóre.

## 1. Hledání, režim a kotvy

- H1, pod ním pole a režim na jednom řádku od dostupné šířky 1000 px. Na menších šířkách režim pod polem. Pole i přepínače 44–48 px vysoké.
- Zachovat skutečný `#prohName`, jeho listenery a existující autocomplete. Výběr/Enter/Escape/odchod zavírá nabídku. Přesun existujícího uzlu, ne duplikace.
- Kotvy: Čísla úlovku / Využití / Typy / Evoluce / Rozbor / Můj kus. Desktop jeden řádek, mobil dva až tři řádky, bez horizontálního přetékání stránky. Každá kotva má dotykovou plochu 44 px. Jemné zvýraznění aktuální sekce.
- Kotva na sbalenou sekci ji otevře, přenese fokus na její nadpis a posune ji pod horní lištu pomocí scroll-margin-top. Respektovat reduced-motion. Běžné přepnutí ligy scroll nemění.

## 2. Kompaktní identita

- Desktop 88–112 px vysoký obsahový pás; obrázek 72 px contain, jméno 24 px, skutečné typové štítky s ikonami, stav shiny jako drobný ovladač s dostupným textem zdrojů. Mobil obrázek 48–56 px, jméno 20 px, zdroje do rozbalení pod stavem. Neopakovat slovo Shiny ve třech řádcích.
- Jedna věta o využití pouze ze strukturovaného výsledku enginu a s kontextem formy/evoluce. Není-li jednoznačné shrnutí, větu vynechat. Vysoký IV či samotná přítomnost v žebříčku nejsou automatické doporučení „nechat“.
- Shiny ano / ne / neověřeno z `atlasShiny().stav`. Přepnutí obrázku běžný/shiny je pouze vizuální stav. Nemění hledanou formu ani roster. Nabídnout pouze pro ověřenou dostupnou URL konkrétní formy; nestačí domněnka, že vložení `.s` funguje všude. Při selhání ponechat běžný obrázek a sdělit nedostupnost varianty.
- Dostupnost shiny a dostupnost obrázku jsou dvě různé věci.

## 3. Čísla úlovku

Nadpis „CP při 100 % IV“. Pět buněk desktop, mobil kompaktní mřížka 2 + 2 + 1; poslední buňka přes šířku. Číslo 22–26 px, popisek 12–13 px, minimum výšky buňky 60 px. Bez dekorativních velkých ikon.

| Popisek | Zdroj | Poznámka |
|---|---|---|
| Raid · L20 | `atlasCP(jmeno,20)` | reference běžného raidového úlovku |
| Raid s počasím · L25 | `atlasCP(jmeno,25)` | počasí z typů a `atlasPocasi` |
| Vejce · L20 | `atlasCP(jmeno,20)` | explicitní reference na L20, ne každé vejce hráče |
| Výzkum · L15 | `atlasCP(jmeno,15)` | reference na L15, ne tvrzení o každé odměně |
| Strop · L40 | `atlasCP(jmeno,40)` | popisek „na L40“, ne absolutní maximum hry |

Pod pásem jedna věta „Referenční CP pro uvedené levely; nejde o seznam dostupných úlovků.“ Hodnoty stejné pro L20 záměrně opakujeme s různým kontextem, ne jako různé výpočty. Chybějící staty/formy = — s důvodem. Žádné odhadování jiné formy. Pokud se nabídne L50, přepnout explicitně popisek i výpočet.

## 4. Role a výsledky

- Zachovat `prohlidkaModel`, PvP/Raidy/Gym/Mega, v PvP ligy. Little Cup, nikoli Little League. Ligy centrované, texty a názvy vlevo. Ikony v záložkách ze stávající sady.
- Řádky doplnit obrázkem 32–40 px, jméno 14–15 px, pod ním menší vztah „po evoluci“ / „jiná forma“. Typové barvy pouze z dexu. Rank samostatně, doprovodné skóre pod ním, ne slepený řetězec.
- Počet řádků určuje výšku. Eevee všech 9 výsledků, Magmar pouze skutečné dostupné řádky. Žádná minimální výška podle nejdelšího druhu a žádné prázdné evoluční postranní místo, když není potřeba.
- Na mobilu řádky jako karty: obrázek+jméno, pojmenovaný rank, doporučené útoky pod tím. Nespoléhat na skryté záhlaví tabulky pro význam údajů. Zobrazit všechny výsledky běžným scrollováním.
- Identita hledaného druhu modrý štítek „Hledaný druh“, vybraná evoluce tenký samostatný outline. Vybraná evoluce nepřepisuje hledání. Pozice zvýrazněného řádku musí být dohledatelná klávesnicí.
- Mega: „Priorita do raidů“, ne prázdný sloupec číselného ranku. Chybějící priorita = „Neověřeno“. Shiny z raidu je zvláštní údaj pod záložkou Raidy, ne odvozený z obecného ano.
- Neopakovat celý pás CP pod Raidy. Zde jen kontext raidové dostupnosti z akcí (potvrzený / neověřený), raidové shiny a typ role.

## 5. Typové výhody a slabiny

- Dvě jasné části: „Čím ho zasáhneš“ (kombinace obranných typů a násobky ze společného enginu) a „Kam se hodí jeho útoky“ (skutečný zvolený typ útoku a matchup). Nevydávat typ Pokémona za všechny útoky, které umí.
- Žádná vlastní tabulka násobků v Atlasu. Použít engine, přesnou signaturu adaptéru zapsat do kontraktu před implementací.
- CTA „Vybrat protihráče z mého rosteru“ předá přesný druh/formu do stávajícího Counter módu. Nepojmenovávat to simulací nebo jistým vítězstvím. Při prázdném rosteru vysvětlit, že nejprve potřebuje import, ne vykreslit fiktivní tým.

## 6. Evoluce a náklady

- Desktop otevřená sekce podle uložené preference, vlevo vizuální strom a vpravo podmínky vybrané cesty; mobil výchozí zavřená, po otevření stejný obsah pod sebou. Eevee 2 sloupce dlaždic, všechny větve dostupné.
- Běžná evoluce plná šipka. Mega oddělené přerušované větve označené „Dočasná mega forma“. Jiná forma není automaticky dosažitelná evoluce. Zachovat formová ID.
- Podmínky pro vybranou cestu viditelné jako text, tooltip je jen doplněk. Žádná nepodložená věta „stačí bonbóny“ pro neznámé podmínky nebo náhodnou větev. Prázdné pole musí znamenat ověřeně žádnou další podmínku, nikoli „data nemáme“; kontrakt to musí rozlišit.
- Cena pro JEDNU vybranou cestu: odkud (druh+level+forma) → kam (druh+level). Bez výběru cesty „Vyber evoluci a cílový level“. Neúčtovat součet všech Eevee větví.
- Druhový režim: volitelný model „Ukázka L1 → L40“, po přepnutí L50 samostatně XL. Žádné „L0“ ani „tvoje cena“, žádný domnělý stav inventáře. Kusový režim použije validovaný skutečný level a formu.
- Prach / běžné bonbóny / XL / předmět / mega energie odděleně. Neznámý člen nákladu zůstane neznámý a součet nesmí být označen za úplný. Mega energie se nepřičítá k bonbónům. Výpočet cesty má dodat engine, UI jej neskládá nezávisle.

## 7. Využití podrobně

Rozbalení přehledu Raid / Gym / Mega / Strop. Použít existující významové bloky a pravidla. Zde může být vysvětlení, proč a za jakých podmínek využití platí, nikoli znovu všechny ligové tabulky. Nedělat druhý obecný verdikt nechat/zahodit mimo kontext rosteru.

## 8. Údaje mého kusu

- Sekce zůstane osmá podle zadání. Při přepnutí do kusového režimu se automaticky otevře A PŘENESOU se k ní scroll a fokus na CP. Jinak je u Eevee formulář přes obrazovku daleko a uživatel změnu nevidí. Nabídnout „Zpět na výsledky“. Návrat do druhového režimu zachová zadané údaje.
- CP / level a IV A/D/HP, poté tři existující útokové selecty stejné výšky. Bez duplicitních formulářů. Validace v místě pole, srozumitelný nesoulad údajů. Nepřepočítávat neplatný vstup na falešně přesný výsledek.
- Výchozí mobilní sbalení sekcí 5–8 neplatí pro právě zvolený kusový režim: sekce 8 musí být otevřená. To je nutné rozlišení dvou stavů zadání.
- Sloupec „Tvůj kus“ má obsahovat jen odpovídající data. Procento IV není IV rank. IV rank musí nést konkrétní ligu, formu a použité omezení levelu. U evoluce neukazovat výsledek vstupního druhu jako výsledek evoluce.

## Aktuální nálezy, které nesmí V3 zakrýt

1. **Duplicitní obsah:** při Eevee je nová tabulka i staré tabulky v `#prohOut` viditelné. DOM měření 30. 9.: starý blok display:block, výška 2780 px. Při V3 nechat `#prohOut` jako interní výpočetní cíl, pokud jej listenery potřebují, ale vykreslit z něj pouze konkrétní unikátní sekce nebo vytvořit strukturovaný model. Neschovat slepě celý blok bez zachování chyb/validace a unikátních informací. Staré tabulky odstranit z vizuálního i přístupnostního stromu.
2. **Formulář mimo dohled:** v kusovém režimu desktop CP začíná kolem y=1283. Řeší řízený přesun v sekci 8, ne další formulář nahoře.
3. **IV rank:** `__pgoProhlidkaKus` vrací `b.bestRank`. Ten pochází z `bestRankOf(r)` a z rankových polí LC/GL/UL/ML; jde o nejlepší z dostupných ranků, nikoli výsledek vybrané záložky. Nový dočasný řádek tato importovaná pole ani neplní. Nelze to prezentovat jako nově vypočtený rank ze zadaných IV. Vystavit explicitní ligový výsledek z existujícího výpočtu, nebo poctivě „IV rank není k dispozici“. Žádný bestRank přenášený beze jména ligy. To je nález z kódu, ne dokončený interaktivní test zadávání.

## Šest stavů pro předání

| Stav | Požadovaný výsledek |
|---|---|
| Eevee | všech 8 evolucí + vstup, přepínání lig bez změny hledání; strom v sekci 6 |
| Magmar | skutečné 1–2 relevantní řádky dle role, obsahová výška, další sekce ihned navazují |
| Xerneas / raid | Raidy aktivní, referenční CP nad výsledky, žádný vymyšlený seznam counterů |
| Charizard / Mega | obě mega větve jako dočasná forma, priorita místo ranku, energie zvlášť |
| Vlastní kus | otevřená a zaměřená sekce 8, ukázkový validní vstup, odlišné druhové/kusové údaje |
| Prázdný / neznámý druh | pouze hledání + instrukce / chyba; žádné prázdné karty, nuly nebo výsledek předchozího druhu |

Obrazové listy: `vyhledavani-v3-01-druhy.png`, `vyhledavani-v3-02-raid-mega.png`, `vyhledavani-v3-03-kus-prazdne.png`. Jde o grafické schéma celé stránky: dlouhý mobil představuje obsah ke scrollování, ne jednu obrazovku telefonu. Text této specifikace je rozhodující u případných odchylek generovaného obrázku. Pomlčky v ranku a CP nejsou finální data. Výběry a popisky v implementaci vždy čerpat z aplikace.

### Přesnost implementace vůči obrazovým listům

Na širokém desktopu lze sekce 5–8 umístit do pravého sloupce vedle hlavní části 2–4, jako na obrazových listech; logické pořadí v DOMu a pořadí kotev zůstává 1–8. Mobil je vždy jeden sloupec. Pás CP je na mobilu vždy rozbalený, s mřížkou 2+2+1 podle této specifikace; případný zúžený pětisloupcový pás či zavřená lišta v ilustraci se nekopíruje. Ligové volby na mobilu 2×2 s cíli 44 px. Podpůrné sekce nemají překrývat tabulku a nic nepřipínat přes její poslední řádky. Vlastní kus: pět číselných polí na telefonu rozdělit do řádku CP/level a dalšího řádku IV útok/obrana/HP, ne pět úzkých polí vedle sebe. Prázdný stav může mít drobnou ilustraci do 120 px, ne obří hero. Názvy, CP levely, shiny zdroje a typy při implementaci zkontrolovat podle dat a textové specifikace, ne přepisovat z kresby.

Na listu 03 generátor nedodržel text vstupu ve spodních stavech: levý prázdný vstup musí být opravdu prázdný s placeholderem a pravý má obsahovat neexistující `Pikachuu`, nikoli platné `Pikachu`. Kotvy při prázdném/neznámém výsledku nezobrazovat. Jde o chybu ilustrace, ne požadovanou funkci. Také případné pořadí Eevee na začátku ilustrace vlastního kusu není pokyn ke změně řazení výsledků — zachovat skutečný rank a zvýraznění vstupu. Tyto detaily ověřit podle textové specifikace při implementaci.

## Akceptace

Ověřit 1440×900 a 390×844 (dále 820 px jako breakpoint). Žádný horizontální scroll stránky, cíle 44 px; text minimálně 12 px podpůrný / 14 px výsledky. Na mobilu výsledek není odsunut zbytečně vysokým blokem shiny. Stav otevřených sekcí si pamatovat odděleně od konkrétních dat; neukládat experimentální kus do rosteru. Přepnutí druhu odstraní stale výsledky i výběr neexistující evoluce. Kotvy otevřou správnou sekci. Shiny obrázek mění jen obrázek. Všechny výše uvedené stavy, null data a konfliktní vstupy testovat naplněným testovacím profilem. Současné regresní počty v commitech jsou hlášení Clauda, nikoli nový běh Astry.
