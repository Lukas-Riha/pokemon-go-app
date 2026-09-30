# Vyhledávání: co na té stránce má být (analýza, 30. 9. 2026)

Podklad pro nový návrh. První část je rozbor — co ta stránka řeší, co
appka umí a co ne. Druhá část je zadání pro Astru.

Inspirace, o kterých padla řeč: karty raid bossů z Instagramu (LeekDuck,
FlareBlaze, TrainersGO) a `db.pokemongohub.net`. Z prvních se dá vzít
**hustota čísel na malé ploše**, z druhého **členění do sekcí, kde část
je vidět hned a část po rozbalení**.

## 1. Na co se člověk téhle stránky ptá

V tomhle pořadí, podle toho, jak často:

1. **„Mám ho chytat / nechat?"** → v čem ten druh vede (ligy, raidy, gym)
   a jak vysoko v tom stojí.
2. **„Jaké CP má dokonalý kus?"** → abych u obrazovky poznal hunda:
   z raidu, z raidu v počasí, z vejce, z výzkumu.
3. **„Na co ho vzít / proti čemu je slabý?"** → typová stránka věci.
4. **„Jaké útoky mu dát?"** → nejlepší sestava pro tu roli.
5. **„Co s ním musím udělat a co to stojí?"** → evoluce, podmínky, cena.
6. **„A co MŮJ kus?"** → po vyplnění CP a IV.

Otázka 1–4 se pokládá u obrazovky ve hře, často na telefonu a ve spěchu.
Otázka 5–6 doma. Z toho plyne rozvržení: 1–4 hned, 5–6 na dosah.

## 2. Co appka má a co ne

### Má a je ověřené

| Údaj | Odkud | Pozn. |
| --- | --- | --- |
| Obrázek druhu a formy | PokeMiners, s fallbackem na PokeAPI | už se používá |
| Typy | pokédex | |
| CP dokonalého kusu na jakémkoli levelu | `atlasCP(jméno, level)` | L15 výzkum, L20 raid a vejce, L25 raid v počasí, L40/L50 strop |
| Počasí, které typ boostuje | `atlasPocasi(typ)` | |
| Shiny: ano / zatím ne / neověřeno + odkud padá | `atlasShiny` | tři stavy, ne dva |
| Pořadí v ligách, raidech, gymu + doporučené útoky | `prohlidkaModel` | pořadí DRUHU |
| Typová účinnost oběma směry | `typeChart`, `pokrytiKombinaci` | počítá se na kombinaci typů, ne na čisté typy |
| Evoluční řada včetně větvení a jiných forem | `evoLinie`, `formyDruhu` | |
| Mega forma (staty, typy) | `mega` v pokédexu | pořadí mega v datech NENÍ, jen priorita do raidů |
| Podmínky evoluce (km, předmět, lákadlo, úkol) | `evoPodminky` | |
| Cena: bonbóny na evoluci, prach a bonbóny na vylepšení | `evoCandy`, `upgradeCost` | „z 0 na max" jde spočítat |
| Bloky „na co je / na co není" | rozbor druhu v enginu | |
| Rozbor konkrétního kusu (CP, IV, útoky) | režim „Posoudit můj kus" | |

### Šlo by doplnit, ale ještě to tam není

- **Shiny obrázek.** Zdroj ho má: `pm25.s.icon.png` vedle `pm25.icon.png`
  (ověřeno, vrací 200). Přepínač normal/shiny je tedy práce na vrstvě,
  ne na datech. U forem je potřeba ověřit, že `.s` existuje i pro ně —
  když ne, přepínač se u té formy nenabídne.
- **Cena „z 0 na max" jedním číslem.** Data jsou, jen se to musí složit:
  bonbóny za všechny kroky evoluce + prach a bonbóny z L1 na L40 (a XL
  na L50). Musí být vidět, že XL jsou zvlášť a že se nedají koupit.

### Nemá a nemá si vymýšlet

- **Šance na shiny.** V datech není žádné číslo, jen jestli shiny existuje.
- **„Je teď v raidech?"** Jen z rozpisu akcí — a ten mluví o akcích, ne
  o trvalém poolu. Když akce o druhu nic neříká, appka neví.
- **Seznam nejlepších counterů jako na těch obrázcích z Instagramu.**
  Ty počítá Pokebattler ze simulací, appka je nemá. Co appka umí, je
  typová rada („na tohohle vezmi Steel") a **Counter mód nad tvým
  rosterem** — to je navíc něco, co ty obrázky neumí: řekne, koho máš TY.
  Na stránku druhu proto patří odkaz do Counter módu, ne vymyšlený
  žebříček.
- **PvP simulace se štíty a energií.** Appka bere pořadí z PvPoke, sama
  souboje nepočítá.
- **Počty XL bonbónů a co má hráč v inventáři.** Nikde to není.

## 3. Návrh členění: co hned a co po rozbalení

Odpověď na otázku „všechno vidět, nebo schovat": **obojí, ale ne
náhodně.** Rozhoduje, jestli ten údaj potřebuje člověk u obrazovky ve
hře (hned), nebo při plánování doma (na rozbalení). Sekce jdou vždycky
ve stejném pořadí, takže se dá učit, kde co je; nahoře stojí kotvy
(jako na pokemongohub), kterými se dá skočit.

### Vždycky vidět

1. **Hledání a režim** — pole, „Prozkoumat druh" / „Posoudit můj kus".
2. **Identita** — obrázek s přepínačem normal/shiny, jméno, typy, shiny
   (stav + odkud), a jednou větou, v čem ten druh vede.
3. **Čísla úlovku** — pás čísel: raid L20 · raid v počasí L25 · vejce L20
   · výzkum L15 · strop L40. U každého popisek, co to je. Tohle je ta
   hustota z instagramových karet a je to druhá nejčastější otázka.
4. **Role a výsledky** — záložky PvP / Raidy / Gym / Mega, v PvP ligy,
   a jedna tabulka: druh (vstup + evoluce), pořadí druhu, doporučené
   útoky. Tahle část už hotová je.

### Po rozbalení (na širokém okně může být otevřená rovnou)

5. **Typy** — do čeho je silný a co je silné do něj. Počítá se na jeho
   kombinaci typů, ne na čisté typy, takže to nelže ani u dvojtypů.
6. **Evoluce** — strom včetně větvení, jiných forem a mega, u každého
   kroku podmínka. Pod tím cena: bonbóny na dotažení řady, prach a
   bonbóny na vylepšení do stropu, XL zvlášť.
7. **Na co je a na co není** — čtyři bloky (raid, gym, mega, strop CP),
   jak je má appka dnes.
8. **Můj kus** — CP, IV, útoky; otevře se samo při přepnutí do režimu
   „Posoudit můj kus". Po vyplnění přibude v tabulce sloupec o kusu.

### Proč zrovna takhle

- **Neschovávat to, kvůli čemu tam člověk přišel.** Body 1–4 odpovídají
  na otázky 1, 2 a 4 ze seznamu nahoře.
- **Schovat to, co je dlouhé a čte se jednou.** Typová tabulka a evoluce
  s cenami jsou přes celou obrazovku; když je člověk nepotřebuje, jen
  ho odsunou od toho, co hledá.
- **Stav si appka pamatuje.** Co si člověk rozbalí, zůstane rozbalené i
  příště — jinak to rozbaluje pokaždé znovu.
- **Na telefonu je sbalené všechno kromě 1–4.** Na širokém okně můžou
  být 5–7 otevřené, protože místo je.

## 4. Pravidla, na kterých se nesmí ustoupit

Platí dál z A-015 a z toho, co appka drží všude:

- **Nic se nevymýšlí.** Když údaj v datech není, řekne se to („neověřeno",
  „sestavu appka nemá"), nedoplňuje se odhadem.
- **Pořadí druhu ≠ IV rank kusu ≠ připravenost.** Tři různé údaje, tři
  různá místa.
- **Shiny má tři stavy** (ano / zatím ne / neověřeno) a obecné ANO neříká
  nic o tom, jestli shiny padá z raidu.
- **CP z raidu jsou referenční hodnoty**, ne tvrzení, že ten druh teď
  v raidech je.
- **Žádný kód v UI** — žádné názvy funkcí, souborů ani cest.
- **Telefon:** nic nepřetéká do stran, klikací prvky aspoň 44 px.
- **Roster se hledáním nemění.** Klepnutí na evoluci zvýrazní řádek,
  nepřepíše vstup ani nic neuloží.

## 5. Zadání pro Astru (návrh V3)

**Co nakreslit:** stránku Vyhledávání se všemi osmi sekcemi z bodu 3,
v pořadí, jak jsou tam napsané. Kotvy nahoře (skok na sekci) jsou
součástí zadání.

**Stavy, které potřebuju vidět:**

1. Druh s bohatými daty (Eevee — osm evolucí, hraje ligy).
2. Druh chudý na data (Magmar — dva řádky v tabulce; nesmí tam zůstat
   prázdno přes půl obrazovky).
3. Raidový boss (Xerneas nebo podobný) se záložkou Raidy vepředu.
4. Druh s mega formou (Charizard) — jak vypadá mega v evolučním stromu.
5. Režim „Posoudit můj kus" s vyplněným CP a IV.
6. Prázdné hledání a neznámý druh.

**Šířky:** 1440 a 390 px. Na 390 sbalené sekce 5–8, klikací prvky 44 px.

**Na co si dát pozor:**

- Čísla v návrhu ber jako ilustrativní, ale **popisky ne** — když v návrhu
  bude „Hodnocení druhu", appka pro to nemá data a buňka zůstane prázdná.
  Radši napiš, jaký údaj tam má být, a já řeknu, jestli ho appka má.
- **Seznam counterů jako na těch obrázcích z Instagramu nekresli** —
  appka ta data nemá a vymýšlet je nebude. Místo toho počítám s odkazem
  do Counter módu, který řekne, koho má na toho bosse LUKÁŠ v rosteru.
- U shiny počítej se **třemi stavy**, ne se dvěma.
- U mega počítej s tím, že **pořadí mega v datech není** — jen priorita
  do raidů.

**Co zůstává z V2 a nemá cenu překreslovat:** záložky rolí s ikonami,
ligové pilulky, výsledková tabulka (druh / pořadí / doporučené útoky),
mřížka evolucí s obrázky, pruh „Údaje mého kusu". To je hotové a sedí.
