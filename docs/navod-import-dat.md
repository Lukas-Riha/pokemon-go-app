# Jak dostat svoje pokémony do trackeru (návod krok po kroku)

## Nejdřív odpověď na otázku „nemůže to číst rovnou můj účet?"

**Ne, žádná appka nedokáže číst tvůj přihlášený účet napřímo.** Niantic nemá
veřejné API a nepustí k datům účtu nikoho zvenčí. Existuje jen neoficiální
reverse-engineered cesta, která porušuje podmínky a hrozí za ni ban účtu — tou
nejdeme.

Calcy IV ani Poké Genie se k účtu **nepřipojují**, nepotřebují přihlašovací
údaje a nic za tebe ve hře nedělají. Fungují úplně jinak: **čtou obrázek tvojí
obrazovky**. Pustíš hru, ony si přes systémové nahrávání obrazovky přečtou, co
je zrovna vidět, a z toho spočítají IV. Proto jsou v souladu s podmínkami hry.

Praktický důsledek: **pokémona musíš mít v tu chvíli na obrazovce.** Sken tedy
znamená projet si box ve hře — appka si u toho čte, co jí proběhne pod rukama.

> Kdyby po tobě někdy nějaká appka chtěla přihlašovací údaje k Pokémon GO, je to
> podvod. Legitimní k nim nemá důvod.

## Kolik práce to reálně je

| Situace | Práce |
|---|---|
| První sken celého boxu | jednou pomalu projet box, cca 2–5 minut |
| Další dny | naskenovat jen nové úlovky, pár sekund |
| Vyhodnocení | nula — soubor přetáhneš do trackeru |

**Úplně bez práce to nepůjde** a nepůjde to nikdy — data z účtu legální cestou
nikdo nevytáhne. Tohle je nejblíž, jak se k tomu jde dostat.

## Kterou appku

| | Android | iPhone |
|---|---|---|
| **Calcy IV** | **doporučeno** — zdarma včetně CSV exportu | funguje, ale hůř (horší možnosti překryvu) |
| **Poké Genie** | taky dobrá, ale CSV export je placený | lepší volba než Calcy IV, export ale placený |

Na Androidu tedy **Calcy IV a nic neplatíš**. Zbytek návodu je pro něj; pro
Poké Genie je postup skoro stejný, jen se export skrývá za jednorázový nákup
„Scan Pro" (a jak se mu vyhnout, je popsané níže).

---

## Krok 1 — nainstalovat Calcy IV

Google Play → **„Calcy IV – Fast IV & PvP Ranks"** (vývojář TeSMath).

Zdarma, s reklamami. Funguje offline, bez přihlašování, počítá všechno
v telefonu ze snímků obrazovky.

## Krok 2 — první spuštění a povolení

1. Otevři Calcy IV a projdi úvodním nastavením.
2. Nastav **jazyk / zemi hry** tak, aby to sedělo s tím, co máš v Pokémon GO —
   jinak bude špatně číst jména a čísla. Tohle je nejčastější důvod, proč to
   někomu „nefunguje".
3. Povol **nahrávání obrazovky** a **zobrazování přes ostatní aplikace**.
4. Zapni překryv (overlay) — na obrazovce ti zůstane malé plovoucí tlačítko.

## Krok 3 — zkouška na jednom pokémonovi

1. Přepni do Pokémon GO a otevři libovolného pokémona.
2. Klepni na plovoucí tlačítko Calcy IV.
3. Ukáže ti IV, level, DPS a PvP ranky.

Když čísla nesedí, vrať se ke kroku 2 a zkontroluj jazyk hry.

## Krok 4 — projet celý box

1. V Pokémon GO otevři **seznam pokémonů**.
2. Spusť sken přes plovoucí tlačítko.
3. **Pomalu scrolluj boxem shora dolů** — appka čte pokémony za pochodu.
4. Naskenované najdeš v historii skenů.

Tip: než začneš, seřaď si box (třeba podle čísla), ať víš, kde jsi skončil.

## Co je Appraisal a proč na něm záleží

**Appraisal (Zhodnocení) je funkce přímo ve hře** — vůbec nesouvisí s Calcy IV.
Vedoucí tvého týmu (Blanche / Candela / Spark) ti k pokémonovi řekne, jak je
dobrý, a ukáže **sloupcový graf** se třemi pruhy: Útok, Obrana, HP.

Ty tři pruhy jsou to podstatné. Délka každého pruhu odpovídá jednomu IV
(0 až 15) — je to jediné místo ve hře, kde se hodnoty jednotlivých statů dají
vidět. Číselně ti je hra neukáže nikdy, jen jako pruhy.

Nahoře je navíc hvězdičkové hodnocení, které říká, v jakém pásmu je součet IV:

| hvězdy | součet IV | celkem |
|---|---|---|
| ★★★★ | 45 / 45 | 100 % |
| ★★★ | 37–44 | zhruba 82–98 % |
| ★★ | 30–36 | zhruba 67–80 % |
| ★ | 23–29 | zhruba 51–64 % |
| bez hvězd | 0–22 | do 49 % |

**Proč to Calcy IV potřebuje:** z CP, HP a ceny prachu umí spočítat jen množinu
možných kombinací IV. Pruhy z Appraisal tu množinu zúží na jednu jedinou —
proto sken s otevřeným Appraisal dá přesné číslo, zatímco sken při chytání
vrátí rozsah.

### Jak naskenovat s Appraisal — krok za krokem

1. V Pokémon GO klepni na **Poké Ball** dole uprostřed → **Pokémon**.
2. Klepni na pokémona, kterého chceš změřit.
3. Vpravo dole je **tlačítko se třemi vodorovnými čárkami** (☰). Klepni na něj.
4. Z nabídky vyber **„Appraise" / „Zhodnotit"**.
5. Vedoucí týmu chvíli mluví — **proklikej to až na obrazovku se sloupcovým
   grafem** (tři pruhy: Útok, Obrana, HP).
6. **Teď, když je graf na obrazovce**, klepni na plovoucí tlačítko Calcy IV.
7. Calcy IV pruhy přečte a doplní přesná IV. V historii skenů se ten pokémon
   objeví znovu, tentokrát s přesnou hodnotou místo rozsahu.

Tenhle postup dělej **jen u kusů, které tě zajímají** — u zbytku je to zbytečná
práce.

## Nastavení Calcy IV, které se vyplatí

V nastavení Calcy IV je **doba, po kterou se drží historie skenů**, a volba
**nechat doskenované (appraised) kusy natrvalo**. Na obojím záleží víc, než to
vypadá.

| nastavení | doporučení | proč |
|---|---|---|
| jak dlouho držet historii | **co nejdéle** (min. 30 dní) | Při 1 dni ti sken celého boxu zmizí dřív, než ho stihneš vyexportovat. Průchod boxem je práce na několik minut — nemá cenu ji dělat dvakrát. |
| nechat doskenované natrvalo | **zapnout** | Kusy, u kterých sis dal práci s Appraisal, ti v historii zůstanou napořád. Právě ty jsou v trackeru nejcennější. |

Kombinace obojího dává hezkou vlastnost: **doskenování s Appraisal se stane
„přišpendlením"** — tenhle kus bude ve všech budoucích exportech, zatímco
jednorázové skeny odpadu se samy odmažou. Historie se tím sama uklízí a nemusíš
řešit staré kusy, které jsi dávno transferoval.

## Krok 5 — export do CSV

V nastavení Calcy IV je sekce **„Export / Backup"** — jedním klikem uloží
historii skenů do souboru v telefonu. Export **obsahuje i PvP ranky** a je
součástí bezplatné verze.

Soubor se jmenuje `history_RRRRMMDD_HHMMSS.csv` a má 51 sloupců. **Tracker ho
umí načíst bez jediného kliknutí navíc** — mapování je na tenhle formát
odladěné a otestované na reálném souboru:

| co tracker vezme | ze kterého sloupce |
|---|---|
| druh | `Name` |
| IV | `ØATT IV`, `ØDEF IV`, `ØHP IV` |
| IV % | `ØIV%` (a `min IV%` / `max IV%` na kontrolu přesnosti) |
| PvP ranky | `GL Rank (min)`, `UL Rank (min)` |
| útoky | `Fast move`, `Special move`, `Special move 2` |
| přezdívka | `Nickname` → poznámka |

Soubor pak přeneseš do počítače, jak ti to vyhovuje — kabelem, mailem, cloudem.

### Dvě věci, které z exportu nevyplynou

**Nejednoznačné skeny.** Calcy IV počítá IV z CP, HP a ceny prachu na vylepšení.
Tomu ale často odpovídá víc kombinací IV, takže místo přesné hodnoty vyplní
rozsah — třeba 42,2 % až 51,1 %. Chybějící informaci doplní až **hodnocení
(Appraisal)** — ten sloupcový graf ve hře. Tracker nepřesný sken pozná, u IV %
ukáže otazník a do shrnutí napíše „sken nejednoznačný". Takový kus
**přeskenuj znovu s otevřeným Appraisal**, jinak doporučení stojí na odhadu.

**Shadow / Purified.** V exportu není použitelný příznak (sloupce `Form`
a `ShadowForm` jsou vnitřní číselná ID), takže se to nepřenese. U shadow kusů
si formu přepni v trackeru ručně ve sloupci **Forma** — má to vliv, shadow kusy
engine chrání před zahozením.

## Hvězdička — co si nechávám

Úplně první sloupec tabulky je hvězdička. **Klik ji rozsvítí, druhý klik zhasne.**
Nic nepočítá, je to tvoje vlastní značka — postup je jednoduchý:

1. Projdi roster (klidně s filtrem *Jen „Zvážit zahození"* naopak vypnutým).
2. Komu appka řekne **Ponechat** a ty s tím souhlasíš, klikni na hvězdičku.
3. **Ve hře dej tomu samému pokémonovi „Oblíbený"** (srdíčko) — oblíbené kusy
   hra nepustí do hromadného transferu, takže si je omylem nesmažeš.
4. Zbytek (bez hvězdičky) můžeš ve hře v klidu pustit.

Nahoře v souhrnu je dlaždice **Označené ★** s počtem; klik na ni tabulku
vyfiltruje. Ve výběru *Zobrazit* přibyly i *Jen označené ★* a *Jen neoznačené* —
druhé se hodí, když se k projíždění boxu vracíš a chceš vidět, co ti ještě zbývá.

Značka se ukládá do prohlížeče spolu se zbytkem rosteru, takže **přežije zavření
stránky i import nového skenu** (včetně režimu *Nahradit roster*). V exportu CSV
je jako poslední sloupec `Označeno` a při zpětném importu se načte zpátky.

### Oblíbení ze hry se natáhnou sami

Calcy IV exportuje i sloupec `Favorite` — to je srdíčko přímo v Pokémon GO.
Import ho automaticky napojí na hvězdičku, takže **co si označíš ve hře, dorazí
i do trackeru**. Ruční hvězdičku import nepřepíše, jen doplní chybějící.

### Dynamax kusy se nikdy nemažou

V exportu je i sloupec `Dynamax`. Kus označený `D` (Dynamax) nebo `G`
(Gigantamax) jde získat jen z Max Battle u Power Spotu a hra nepustí do
transferu poslední z nich. Tracker takový kus **nikdy neposílá do koše** — má
u jména růžový štítek **DMAX**, vlastní filtr *Jen Dynamax* a v seznamu „nechat"
svou kategorii. Kdyby to Calcy nepoznal (`?`), dá se to dopsat ručně ve sloupci
*Dynamax?* v zobrazení *Vše*.

### Smazat všechno ostatní najednou

Jakmile máš označeno, objeví se v liště nad tabulkou červené tlačítko
**„Smazat neoznačené (N)"**. Nechá v rosteru jen kusy s hvězdičkou.

Důležité: smazané kusy si appka **zapamatuje**. Když příště naimportuješ nový
export z Calcy IV, nevrátí se — i když je Calcy má pořád v historii skenů. Tím
se řeší otázka „nenahraje se mi po appraisu zase všechno znovu?": nenahraje.

### Vrátit jen jednoho konkrétního

Tlačítko **„Smazané (N)"** vedle otevře panel se seznamem všeho, co import
přeskakuje — u každého kusu je **jméno, CP, level a datum smazání**. Nahoře je
vyhledávací pole, takže se to dá zúžit i mezi stovkami řádků.

Tlačítko **Vrátit** u řádku ho dá **rovnou zpátky do rosteru**, i s IV a útoky —
tracker si spolu se zápisem odkládá i celý řádek. Importovat kvůli tomu nemusíš.

U kusů smazaných starší verzí appky je místo toho **Odblokovat** — ta data se
tenkrát neukládala, takže se vrátí až s dalším importem CSV.

Kdybys chtěl zpátky opravdu všechno, je tam i **Zapomenout vše**.

### Aby paměť nerostla donekonečna

V panelu je volba **Paměť držet**: `30 dní` / `60 dní` / `90 dní` / `navždy`
(výchozí 60). Starší záznamy se zahodí samy — při každém otevření appky
i hned po přepnutí volby.

Praktický důsledek: pokémona, kterého jsi smazal před půl rokem a zase ho chytíš,
tracker po vypršení pustí zpátky jako každý jiný nový úlovek. Naopak s volbou
*navždy* ti paměť poroste s každým úklidem — po roce hraní to jsou tisíce
záznamů.

Typický běh po velkém úklidu:

1. označíš hvězdičkou, co si necháváš,
2. **Smazat neoznačené**,
3. ve hře pustíš to samé (oblíbené hra do hromadného transferu nepustí),
4. u zbylých kusů doskenuješ Appraisal,
5. exportuješ z Calcy a naimportuješ **Sloučit s rosterem** — doplní se přesná IV
   jen u těch, co sis nechal.

## Gym a raid — koho na ně poslat

Karta **Gym a raid** nad rosterem. Napíšeš, kdo ten gym brání (nebo kdo je raid
boss), jména oddělená čárkou — klidně i s CP:

```
Blissey 3200, Snorlax 2900, Steelix 2400, Milotic, Umbreon 2100
```

Nahoře dostaneš **party — šestku, kterou si dej do souboje** (tolik se jich do
gymu i do raidu bere). U každého je napsané, na koho je nejlepší; ve hře se mezi
nimi během boje přepíná ručně. U jednoho raid bosse je to prostě šest nejlepších
proti němu.

### Podle čeho se pořadí počítá

U každého kusu je **síla v procentech** — 100 % má ten nejlepší proti tomu
obránci, ostatní jsou relativně k němu. Počítá se:

```
útok na jeho levelu × DPS jeho sestavy × typová výhoda ÷ √(přijaté poškození)
```

Odmocnina u obrany je schválně: odolnost boj prodlouží, ale vlastní poškození ho
zkracuje přímo, takže útok váží víc.

Důležité je to **„na jeho levelu"**: typová výhoda ×1,6 sama o sobě nestačí.
Kus s 234 CP s výhodou neublíží tolik jako vylevelovaný kus bez ní — a appka to
tak počítá. Shadow kusy dostanou +20 % útoku a −20 % obrany, jak to má hra.

### Když ti někdo v boji padne

Gym se málokdy dobude na jeden zátah — obránci mají motivaci a musíš je porazit
opakovaně. **Do dalšího kola jdi klidně stejnou sestavou**; poškození si pokémoni
nesou dál, takže mezi koly lítej, koho to stojí za to.

Když ti někdo padne a nemáš revivy, klikni na **✕** u jeho jména v partě. Appka
ho vyřadí a doplní náhradu — a schová ho i z rozpisu po obráncích. Nahoře pak
uvidíš *„Mimo hru: …"* a tlačítko **Vrátit všechny**.

Vyřazení se nikam neukládá: je to stav jednoho útoku, po zavření stránky
(nebo po *Vymazat*) je pryč.

Pod tím appka u **každého obránce zvlášť** vypíše tři nejlepší kusy z tvého rosteru,
jejich útoky a čísla `útok ×1,6 · schytá ×0,63`. Po jednom proto, že v gymu se
bojuje jeden na jednoho.

U každého obránce je i jeho **slabina**. Když na ni v rosteru nikoho nemáš,
napíše se to — pak víš, co si má cenu chytit. Dole je souhrn, kolika pokémony
celou sestavu pokryješ, a **koho tam po dobytí nechat bránit**.

CP obránce je jen pro přehled: na to, kdo je proti němu dobrý, nemá vliv.

### S překlepy si poradí

Jména se opisují z malé obrazovky, takže překlep je normální. Když napíšeš
`Bubasaur` nebo `Magnazone`, tracker najde nejbližší druh a dosadí ho — nahoře
se objeví poznámka *„Opraveno na nejbližší druh: Bubasaur → Bulbasaur"*, ať víš,
s čím počítá. Opravuje jen tehdy, když je výsledek jednoznačný; úplný nesmysl
nechá nerozpoznaný.

### Proč se to nedá naskenovat

Obrazovku gymu nepřečte legálně žádná appka. Calcy IV ani Poké Genie neumí
cizí sestavu — čtou snímek obrazovky s detailem *tvého* pokémona. Vlastní skener
by musel dělat to samé s obrazem gymu a bylo by to hodně práce na něco, co
napíšeš za dvacet vteřin.

## Typová tabulka a počasí

Karta **Typová tabulka a dnešní počasí** nad panelem gymů. Celá tabulka 18×18,
kdo koho bije.

Řádek je **útočící typ**, sloupec **bránící typ**:

| hodnota | znamená |
|---|---|
| **×1,6** | super efektivní |
| **·** | ×1 — běžné poškození |
| **×0,625** | neefektivní |
| **×0,39** | dvojitě neefektivní |

U dvojtypů se násobí obojí: 1,6 × 1,6 = **×2,56**, 1,6 × 0,625 = **×1**.

Nahoře vybereš **dnešní počasí** a boostnuté typy se zvýrazní v tabulce i v
typových chipech nad rosterem. Boost znamená o 20 % silnější útoky toho typu
a chytají se silnější kusy. Volba se pamatuje.

## Skutečné staty místo CP

Pod CP je teď malým písmem **Útok / Obrana / HP** na aktuálním levelu. To je to,
co v souboji doopravdy rozhoduje — CP je jen jejich slepenec a dva kusy se
stejným CP můžou být hodně rozdílné.

U shadow kusů je bonus započítaný (+20 % útok, −20 % obrana). Najetím myší se
zobrazí, jak se to počítá.

## Kolik stojí evoluce

U sloupce **Evolvovat?** je v podřádku cena v bonbónech a je i v seznamu
„Koho evolvovat". Kolik bonbónů zrovna máš, tracker nezjistí — Calcy to
neexportuje, takže tuhle část si musíš ohlídat ve hře.

Žluté **Ano · jinak k ničemu** znamená, že ten kus bez evoluce nemá smysl —
těm dej bonbóny první.

## Záloha, která přežije vymazání prohlížeče

Roster se ukládá do prohlížeče a to má jednu slabinu: když v Chrome vymažeš
**„Soubory cookie a jiná data webů"**, zmizí s tím. *(Čištění cache je
neškodné — to je jiná položka.)*

Proto je v liště tlačítko **„Zálohovat do souboru…"**. Klikneš, vybereš, kam
soubor uložit, a od té chvíle se do něj roster **ukládá sám** při každé změně.
Ten soubor je na disku, takže mu vymazání dat prohlížeče nic neudělá — v nejhorším
ho přetáhneš zpátky do **Importovat data**.

Vedle tlačítka je stav:

- *„Bez zálohy — vymazání dat prohlížeče by roster smazalo"* — ještě jsi ji nenastavil
- *„Zálohuje se do souboru ✓"* — všechno v pořádku
- *„Obnovit zálohu do…"* — po znovuotevření stránky chce prohlížeč přístup k souboru
  potvrdit; jeden klik a jede to dál

Záloha obsahuje i **hvězdičky** a **Dynamax** příznaky, takže se z ní obnoví
všechno.

## Klikni na jméno a uvidíš všechno

Klik na jméno pokémona v tabulce rozbalí pod řádkem **rozbor**:

- **nahoře** jméno, barevné štítky typů a případně Shadow / LEG / DMAX
- **barevný pruh s verdiktem** a odůvodněním
- **pruhy statů** (útok / obrana / HP na jeho levelu) vedle **pruhů IV** —
  ty vypadají stejně jako sloupečky v Appraisal ve hře
- **strop CP** velkým písmem, včetně toho, kolik z něj bude po evoluci
- **karty** s tím, co s ním teď (vylepšit za kolik prachu, evolvovat za kolik
  bonbónů, purifikovat, tradovat, doskenovat)
- **karty rolí** — Raid, Gym, PvP, Mega, u každé proč ano nebo ne
- **útoky** jako štítky a co na ně říká PvPoke

Druhý klik (nebo křížek vpravo) to zase zavře. Filtrovat na jeden druh se dá
přes vyhledávací pole nahoře.

## „raid ≠ liga" — když si role odporují

Někdy je jeden pokémon dobrý do raidu **i** do ligy, ale každá role po něm chce
**jiný rychlý útok** — a ten můžeš mít jen jeden. Typicky Gyarados:

| | sestava | proč |
|---|---|---|
| **na raid** | Waterfall + Hydro Pump | STAB a čisté poškození |
| **do Ultra League** | Dragon Breath + Aqua Tail / Twister | víc energie a pokrytí Dragonů |

Tady nejde o to, že by jedna byla špatně. **V lize se nehraje na surové
poškození** — rozhoduje, jak rychle nabiješ nabitý útok a jestli soupeře vytlačíš
štíty. Proto tam Dragon Breath bez STAB porazí Waterfall se STAB.

Když appka takový rozpor najde, napíše ve sloupci **Útoky** žluté
**„raid ≠ liga"**. Najeď myší nebo klikni na jméno a uvidíš obě sestavy vedle
sebe. Ve výběru *Zobrazit* je i filtr **Jen konflikt útoků**.

Rada „přeučit" se u takového kusu změní na **„do ligy přeučit — na raid nech"**,
ať to nevypadá, že máš něco špatně.

## Elitní TM — na koho ho spálit

V **Power up listu** vpravo dole je sekce **Na koho spálit Elitní TM**. Elitní TM
je jediný, kde si útok vybíráš (běžný dá náhodný) a je vzácný, takže tracker
doporučí jen kusy, kterým to reálně pomůže:

- musí umět **legacy útok**, který běžným TM nedostane,
- musí mít **roli** (raid, PvP, gym, Master League) nebo být legendární,
- a nesmí ten legacy útok **už mít**.

U každého je, o kolik % stoupne DPS a na co přeučit.

## Označit všechny ponechané najednou

Tlačítko **„Označit ponechané (N)"** v liště dá hvězdičku všem kusům s kladným
verdiktem. Po velkém importu ušetří klikání po jednom. Hvězdičky jen přidává —
co jsi označil ručně, zůstane.

## Přeučil jsem útoky

Taky se spáruje — řádek se přepíše na nové útoky, nový pokémon nevznikne.

## Vylepšil nebo vyvinul jsem pokémona a naskenoval ho znovu

Nepřidá se podruhé. Tracker ho spáruje s původním řádkem ve třech krocích:

1. **stejný sken** (druh, CP, level, útoky) — běžný případ,
2. **stejný druh, jiné CP** — vylepšený kus; IV se vylepšováním nemění, takže
   se porovnají (u nejistého skenu stačí, že se rozsahy nevylučují),
3. **stejná evoluční rodina** — vyvinutý kus; řádek se přepíše na novou formu.

Hvězdička, forma a ruční poznámky zůstanou. Po importu ti appka napíše, kolik
kusů takhle poznala.

CP přitom nesmí klesnout — vylepšovat i evolvovat se dá jen nahoru, takže dva
opravdu různé kusy stejného druhu se nespojí.

## Evolvovat vs. Nechat – evolvovat

Je to **stejná akce**. Liší se jen to, co který sloupec říká:

- **`Evolvovat? = Ano`** — tenhle kus se vyplatí vyvinout.
- **`Nechat – evolvovat`** (verdikt) — evoluce je **jediný důvod**, proč ho
  v boxu držet. Bez ní by šel pryč.

Takže kusů s `Evolvovat = Ano` je vždycky víc: může držet místo kvůli shadow
formě, vysokému IV nebo vlastní ligové roli a evoluce je až bonus navíc.
Prioritu dej těm s verdiktem `Nechat – evolvovat` — v **Power up listu** je
vpravo sloupec **Koho evolvovat** přesně v tomhle pořadí.

### Proč má kus s IV 60 % smysl evolvovat

Protože **v lize s CP limitem se na IV % nehraje**. Vysoké IV % znamená hlavně
vysoký útok, a ten ti v Great nebo Ultra League bere místo, které by mohla zabrat
obrana a HP. Rookidee s IV 60 % proto udělá **97 % nejlepšího možného
Corviknighta pro Great League** — zatímco jako raidový útočník by za nic nestál.

Bublina u verdiktu to napíše, kdykoli je IV pod 80 %.

## Najeď myší, appka řekne proč

Skoro každý verdikt v tabulce má bublinu s odůvodněním — najeď na buňku myší
a chvilku počkej. Vysvětlí `Ponechat/Zahodit`, `Vylepšit`, `Evolvovat`,
`Do gymu`, `Do raidu`, `Kopie`, `Mega`, `Útoky` i `PvP tým`.

Užitečné hlavně u dvou věcí, které se pletou:

**„Nechat – vyvinout"** znamená, že ten druh sám nikde nehraje, ale jeho evoluce
ano. V bublině je na co se vyvine, v jaké lize to hraje a na kolikátém místě —
třeba *„Grumpig je v Great League na místě #44; tenhle kus by z něj udělal
99,7 % nejlepšího možného"*.

**„Evolvovat = Ano" není totéž.** Ten sloupec říká jen „tohohle se vyplatí
vyvinout" a je jich vždycky víc — kus může držet místo kvůli shadow formě,
vysokému IV nebo vlastní ligové roli a evoluce je pak jen bonus. Verdikt
*Nechat – vyvinout* dostane jen ten, kdo v boxu zůstává **právě kvůli** té
evoluci.

## Kamarádův roster a co si tradovat

Karta **Kamarádův roster**. Vlož do ní buď **celý jeho CSV export** (ať si ho
pošle z appky přes *Exportovat CSV*), nebo jen pár kusů ručně:

```
Machamp 2100 15/14/13
Tyranitar 3000
```

Dostaneš u nich **stejný rozbor jako u vlastního rosteru** — verdikty, role,
útoky, staty. A pod tím tři návrhy:

| | co to je |
|---|---|
| **Nabídni mu** | tvoje přebytky, které stejně pouštíš, a on ten druh nemá — ty dostaneš bonbóny, on nový záznam v pokédexu |
| **Chtěj od něj** | druhy, které má on a ty ne |
| **Na Lucky se vyplatí** | druhy, u kterých se hodí, že Lucky kus má minimum 12/12/12 IV a vylepšuje se za poloviční prach |

**Jeho data se nikam neukládají.** Analyzují se stranou, tvůj roster to
nezasáhne a po zavření stránky je to pryč.

Trade jde jen **osobně** — musíte být u sebe. Denně máte omezený počet výměn
a speciální kusy (legendární, shiny, co druhý nemá v pokédexu) stojí výrazně
víc prachu.

## Eventy a raid bossové

Karta **Eventy a raid bossové** ukazuje, kdo je zrovna v raidech — a u každého
rovnou **trojku z tvého rosteru**, kterou na něj poslat. Nemusíš nic psát.

U bosse je jeho typ, **CP v jakém ho chytneš** a jestli může být shiny. Pod tím
je kalendář eventů; co zrovna běží, svítí zeleně.

### Jdete ve dvou?

V panelu **Gym a raid** rozbal **„Jdeme ve dvou — přidat kusy od kamaráda"**
a napiš, co má po ruce:

```
Machamp 2100 15/14/13
Tyranitar 3000
```

CP i IV jsou nepovinné (bez IV se počítá s patnáctkami). Appka jeho kusy zahrne
do výběru a u každého napíše **kamarád**, takže hned vidíš, kdo koho posílá.
Poskládá tak společnou partu na bosse.

### Proč se to nestahuje samo

Appka běží z disku a nikam nechodí — to je záměr, drží ti to data u sebe.
Oficiální stránka Niantiku s eventy je navíc **prázdná JS schránka za
přihlášením**, takže se z ní strojově nedá vytáhnout vůbec nic.

Data se proto **zapékají dovnitř** a tím stárnou. Po týdnu se v kartě objeví
upozornění. Obnovení:

```bash
python tools/build_events.py --refresh
```

a pak `python tools/sync_reference.py`. Když nasazuješ přes `deploy.ps1`,
dělá se to samo.

Zdroj je **ScrapedDuck** — komunitní scraper LeekDuck, ne oficiální data
Niantiku. Ber to podle toho.

## Pokrytí typů — ať si nevymažeš celý typ

Po prvním pořádném úklidu ti zbydou nejlepší kusy, ale klidně **žádný Electric
ani Grass**. Pak přijde vodní raketák a nemáš proti němu vůbec nic. Kartu
**Pokrytí typů** appka projede sama a hlásí tři úrovně:

| Sekce | Co znamená |
| --- | --- |
| **Díry** | Na tenhle typ ti po smazání nezbyde nikdo s typovou výhodou. Zachraň nabízený kus. |
| **Oslabení** | Někoho na ten typ máš, ale zahazuješ někoho **výrazně lepšího** (aspoň 1,5×). |
| **Tohle nemáš vůbec** | Výhodu na ten typ nemáš nikde v rosteru — hvězdičkou to nespravíš, musíš si někoho chytit. |

U každého řádku je tlačítko **☆ Označit**, které kus rovnou ohvězdičkuje, takže
ho „Smazat neoznačené" nesebere. Dole je **Označit všechny záchranáře** na jeden
klik. Když jeden kus zalátá víc typů (typicky Charizard: Bug, Grass, Ice, Steel),
je to u něj napsané a v hromadném počtu se počítá jednou.

Co se považuje za „co ti zbyde": **hvězdičky**, když nějaké máš. Dokud nemáš ani
jednu, appka bere verdikt z tabulky.

## Team GO Rocket

V panelu **Gym a raid** přepni **Režim** na *Team GO Rocket — parta 3*.

Grunt svůj typ **vyhlásí v hlášce, než souboj začne**, ale jména jeho pokémonů
neuvidíš. Proto stačí napsat rovnou typ:

```
Water
```

Hláška ale typ nepojmenuje vždycky česky ani stejně, tak jde vložit **celá tak,
jak ji hra napsala**:

```
These waters are treacherous!
```

Appka z ní typ vyčte sama a nad výsledkem napíše, co si z ní přečetla — takže
vidíš, jestli se trefila. Když v hlášce typ nezazní ani jedním slovem a appka ji
zatím nezná, řekne to; stačí ji poslat Claudovi a doplní se do tabulky hlášek.

Appka pak vybere trojku, kterou na grunta poslat. Jde napsat i víc typů čárkou,
nebo konkrétní jména, když je znáš.

### Cliff, Arlo, Sierra a Giovanni

Vůdci **žádný typ nevyhlašují** — jejich hláška o něm neříká nic. Když je napíšeš
jménem (`cliff`), appka to pozná a vysvětlí, ne že by tvrdila, že jméno nezná.
Jejich sestava je ale v dané rotaci **pevná**, takže:

1. souboj jednou prohraj nebo si jen zapiš, koho poslali,
2. napiš ta jména sem (`Machamp, Tyranitar`) a partu ti spočítám,
3. do další rotace to platí — první pokémon se u nich nemění.

Dvě věci, které v Rocket soubojích rozhodují:

- **Vůdci a Giovanni mají štíty.** Nejdřív z nich vylákej štíty levným nabitým
  útokem a teprve pak pal ten silný — jinak ti ho zablokují.
- **Ber kusy, které hodně dávají.** Obrana se tu vyplácí míň než rychlé
  dokončení souboje.

## Kamarádův roster

Karta **Kamarádův roster** je hned **nad tvým vlastním rosterem** a vypadá stejně
— stejné sloupce, stejný rozbor, stejné barvy. Navíc má úplně vlevo sloupec
**Proti tobě**:

| Hodnota | Znamená |
| --- | --- |
| **Nemáš vůbec** | Tenhle druh ti chybí v pokédexu — má cenu ho po něm chtít. |
| **Druh nemáš** | Máš jiný stupeň té evoluční řady (máš Marill, on Azumarill). |
| **Má lepšího** | Ze stejného druhu má lepší IV než tvůj nejlepší kus (o víc než 2 %). |
| **Máš lepšího** | Tvůj je lepší. |
| **Zhruba stejné** | Rozdíl do 2 %, nemá cenu to řešit. |

Nad tabulkou je pás s čísly: kolik má kusů, kolik druhů má a ty ne (a naopak)
a u kolika kusů je lepší on / ty.

Načíst jeho data jde třemi způsoby:

- **Načíst jeho CSV soubor…** — otevře dialog, vybereš jeho export. Nejrychlejší.
- **Přetáhnout soubor** rovnou na textové pole.
- **Napsat pár kusů ručně**, jeden na řádek: `Machamp 2100 15/14/13`.
  CP i IV jsou nepovinné.

Jeho data se **nikam neukládají** — po zavření stránky jsou pryč. Tvůj roster
zůstane nedotčený.

## Když po importu chybí pokémoni

Nejčastější příčina **není v appce, ale ve skenu**. Calcy IV zapisuje jen to, co mu
stihne proscrollovat pod prstem — když se box projede rychle, část kusů prostě
přeskočí a v CSV pak vůbec nejsou.

Proto je v importu políčko **„Kolik pokémonů máš ve hře"**. Číslo si přečteš
rovnou v boxu nahoře (`276/325` → napiš `276`) a appka porovná:

| Hlášení | Co to znamená |
| --- | --- |
| **Skenu chybí N z M kusů** | Calcy jich N nezachytil. Projdi box znovu **pomaleji** a exportuj nanovo. |
| **Sedí to** | Sken zachytil přesně tolik, kolik máš. |
| **Sken má o N kusů víc** | Jsou v něm kusy, které jsi mezitím pustil. Zúž okno na *poslední hodiny* a dej *Nahradit roster*. |

Skutečný případ z 22. 8. 2026: export měl 728 řádků, ale poslední průchod boxem
zachytil jen **225 kusů**, zatímco ve hře jich bylo **276**. Calcy tedy přeskočil
**51**, tedy skoro každý pátý. Zbylých 503 řádků v souboru byla historie z 20. a
21. srpna — kusy, které už neexistují.

### Mazat historii v Calcy? Ano, ale až po importu

Když si historii v Calcy pravidelně mažeš, zmizí celá jedna třída problémů:
export pak obsahuje **jen to, cos právě naskenoval**, nejsou v něm kusy, které jsi
dávno pustil, a nemusíš vůbec řešit okna skenů. Trvalé úložiště je stejně záloha
v trackeru, ne historie v Calcy — Calcy stačí, aby unesl jeden průchod.

Pořadí je ale důležité: **naskenovat → exportovat → naimportovat → ověřit, že
počet sedí → teprve pak smazat historii.** Smazat ji dřív znamená, že po
nepovedeném importu nemáš z čeho opakovat.

### Podle toho, co jsi naskenoval, se liší i režim importu

| Co jsi skenoval | Režim | Proč |
| --- | --- | --- |
| **celý box** | *Nahradit roster* | Roster = to, co máš. Zmizí i kusy, které jsi mezitím pustil. |
| **jen dnešní úlovky** | *Sloučit s rosterem* | Přidá se to k tomu, co appka zná. *Nahradit* by ti zbytek smazal. |

Appka to pozná sama z políčka *Kolik pokémonů máš ve hře*: když je ve skenu míň
než 60 % z toho čísla, napíše

> Tohle vypadá na sken jen části boxu — je v něm 20 kusů, ve hře jich máš 800.
> Dej **Sloučit s rosterem**… **Nahradit roster** by ti zbylých 780 smazalo.

a **nehlásí to jako chybu**, protože to žádná chyba není.

### Pokémoni v gymech se do skenu nedostanou

Kus nasazený v gymu se **do počtu v boxu počítá**, ale při průchodu boxem ho Calcy
nenaskenuje — v seznamu k projetí prostě není. Roster pak vyjde o tolik menší
a kontrola by hlásila díru, která žádná není.

Proto je vedle políčka *Ve hře mám* ještě **z toho v gymech**. Napíšeš, kolik jich
máš venku, a appka je odečte:

```
sedí — v rosteru je přesně 89 kusů (94 ve hře minus 5 v gymech)
```

Když manko gymy nevysvětlí, hlásí se dál. Obě čísla se ukládají, takže je stačí
vyplnit jednou a měnit, jen když se počet obránců změní.

Až obránce z gymů stáhneš, nastav *v gymech* zpátky na 0 a projdi box znovu —
teprve pak je appka uvidí i s údaji.

### Aktualizace appky roster nerozbije

Nová verze souboru uložený roster **jen čte**. Testy to hlídají: podstrčí se stav
uložený starší verzí, appka se spustí a musí sedět roster, hvězdičky, ruční
poznámky, forma, prahy i paměť smazaných — a v úložišti nesmí přibýt ani znak.

K tomu dvě pojistky:

- **Zavření záložky nikdy nezapíše prázdný roster** přes uložený neprázdný.
  Kdyby se appka z jakéhokoli důvodu načetla prázdná, zavřením se data teprve
  doopravdy ztratí — tohle tomu zabrání.
- **Před destruktivní akcí se uloží snímek.** *Nahradit roster*, *Smazat
  neoznačené* i *Vymazat vše* nejdřív zapíšou do zálohovací složky soubor
  `roster-pred-nahrazeni-2026-08-23_214530.csv`. Nic nepřepíše a nemusíš na to
  myslet.

Takže postup „dám F5 a jedu dál" je v pořádku. Záloha před úklidem je pořád
dobrý zvyk, ale už není to jediné, co tě chrání.

### Záloha: složka s generacemi, ne jeden přepisovaný soubor

Jeden pořád přepisovaný soubor **není záloha, je to zrcadlo**. Když se roster
rozbije — naimportuje se celá historie skenů, něco se hromadně smaže — zápis ten
rozbitý stav věrně uloží a předchozí je nenávratně pryč.

Proto se zálohuje **do složky**:

| Soubor | Co v něm je |
| --- | --- |
| `roster.csv` | Aktuální stav. Přepisuje se při každé změně. |
| `roster-2026-08-23.csv` | Konec dnešního dne. Během dne se přepisuje, proto nemá v názvu čas ani počet. |
| `roster-2026-08-22.csv` | Včerejšek. **Už se nikdy nezmění.** |
| … | Drží se posledních 30 dní, starší se mažou. |

Když si dnes roster rozbiješ, včerejší soubor je nedotčený — naimportuješ ho
a jsi zpátky.

### Zálohovat teď

Tlačítko **Zálohovat teď** uloží **nový soubor** — nikdy nic nepřepíše. V názvu
je datum, čas a **počet kusů**:

```
roster-2026-08-23_214530-49ks.csv
```

Hodí se, až budeš s úklidem hotový a chceš mít ten stav zapsaný natvrdo.

Datum je vepředu schválně: složka se pak řadí chronologicky a hledá se v ní podle
„kdy to ještě bylo v pořádku". Počet kusů na konci je to, podle čeho poznáš
rozbitý stav na první pohled — `49ks` vedle `300ks` je vidět hned.

Stejné pojmenování mají i automatické snímky před destruktivní akcí:

```
roster-pred-nahrazeni-2026-08-23_214530-300ks.csv
```

Bez připojené složky se snímek prostě stáhne přes prohlížeč.

Připojení složky prohlížeč po zavření stránky chce jednou potvrdit — objeví se
na to tlačítko. Kdo má nastavený starý jednosouborový režim, funguje mu dál,
jen appka u něj připomene, že se soubor přepisuje.

### Když roster nabobtnal a nesedí s hrou

Nic mazat v prohlížeči není potřeba — *Nahradit roster* to udělá za tebe (maže
i paměť smazaných). Postup:

1. **Exportovat CSV** v trackeru. Snímek toho, co tam je teď, kdyby v tom bylo
   něco, co budeš chtít zpátky.
2. **Zálohovat do souboru…** a vybrat soubor na disku. Od téhle chvíle je roster
   i mimo prohlížeč.
3. V **Calcy vymazat historii skenů** a vypnout *Save appraised forever*.
4. **Projít box** (klidně s appraisem) a exportovat.
5. V trackeru **Importovat data** → do políčka *Kolik pokémonů máš ve hře* napsat
   číslo z boxu → počkat, až appka napíše **„Sedí to"** → **Nahradit roster**.

Když místo „Sedí to" napíše, že skenu kusy chybí, projdi box ještě jednou
pomaleji. Hvězdičky přežijí — páruje se podle otisku, ne podle útoků.

### Nastavení v Calcy IV

| Volba | Doporučení | Proč |
| --- | --- | --- |
| **Save appraised forever** | **vypnout** | Jinak se z historie nikdy nic nesmaže a export postupně obsahuje i kusy, které jsi dávno pustil. Přesně tak vznikne roster o 141 kusech, když jich ve hře máš 49. |
| **Storage duration** | 30 dní, klidně míň | Do trackeru se stejně importuje poslední průchod boxem. |

Trvalé úložiště je **záloha do souboru** v trackeru, ne historie v Calcy. Calcy
stačí, aby unesl jeden průchod boxem. Před velkým skenováním se vyplatí historii
v Calcy vymazat — export je pak menší a nejsou v něm duchové.

**Appraisal při skenování je v pohodě.** Appraisnutý kus zapíše Calcy jako druhý
sken téhož pokémona a tracker si je spáruje podle otisku (výška + váha), takže
z jednoho kusu nevzniknou dva řádky — a to i tehdy, když se odhad IV před
appraisem netrefil do skutečnosti. V rosteru zůstane ta přesná IV.

### Jak appka pozná „tentýž kus, jen vylepšený"

Appraisal na tohle **není potřeba**. Rozhoduje se v tomhle pořadí:

1. **Otisk kusu: druh + výška + váha.** Obojí se losuje při chycení a
   **vylepšováním ani přeučením se nemění**, takže dva různí Mareanie mají skoro
   vždycky jiný otisk. Když otisk sedí, je to tentýž kus. Když ho oba kusy mají
   a *liší se*, jsou to prokazatelně dva různé kusy a nesloučí se, ať už IV
   vypadají jakkoli.
2. **Přesná IV** (jen u kusů proklikaných přes Appraisal).
3. **Jednoznačnost.** Když ani jedno není k dispozici, sloučí se to jen tehdy,
   když sedí **jediný** řádek. Sedí-li víc, kus se přidá jako nový a napíše se to
   v hlášení.

Proč zrovna výška a váha: v reálném exportu (225 kusů, z toho **211 s nepřesnými
IV**) otisk uvnitř druhu **nekolidoval ani jednou** a napříč skeny našel přesně
jeden vylepšený kus — Gyaradose 652 → 1 479 → 2 195 CP. Párování podle IV jich
přitom „našlo" 54, protože u rozsahů sedí každý na každého.

Calcy výšku a váhu nepřečte vždycky (v tom exportu u 181 z 225 kusů). Tam, kde
chybí, nastupují body 2 a 3.

**Nemusíš tedy appraisovat 300 pokémonů.** Appraisal pomůže jen u kusů, kterým
Calcy nepřečetl ani výšku s váhou — a to je menšina.

### Můžou chybějící kusy být v „Smazaných"?

Můžou, a je to potřeba vědět. Když kus smažeš, appka si zapamatuje jeho **klíč**
(druh + CP + level + útoky), aby ho příští import nevrátil zpátky. Ten klíč je
ale hrubý: nově chycený Feebas 10 CP se Splash vypadá stejně jako dávno smazaný
Feebas 10 CP se Splash.

Na reálných datech se to stalo **jednou z 225 kusů** — a byla to falešná blokace
(nový Feebas s jiným otiskem). Appka proto na tohle používá stejný otisk jako
u slučování:

- **Otisk sedí** → je to opravdu ten smazaný kus, zůstane zablokovaný.
- **Otisk se liší** → prokazatelně jiný kus, **projde**.
- **Otisk chybí** (Calcy ho nepřečetl) → rozhoduje se podle data, jako dřív.

Po importu appka vždycky napíše, kolik kusů kvůli tomu nepustila:
*„Naimportovat se nepokoušelo N kusů, které jsi tady dřív smazal."* Tlačítko
**Smazané** je otevře — dají se v nich hledat a jednotlivě vracet.

### Vyplatí se paměť smazaných občas vymazat?

Nemusí to být potřeba, ale škodit to nebude — a když je jich moc, appka na to
sama upozorní (pás v panelu *Smazané*, když je jich víc než kusů v rosteru).

Tři způsoby, jak začít od nuly:

| Kde | Jak |
| --- | --- |
| **V appce** | Panel *Smazané* → **Zapomenout vše**. |
| **V appce, důkladně** | Import přes **Nahradit roster** — ten paměť maže sám, protože od té chvíle je roster autoritativní. |
| **Automaticky** | *Paměť držet* → **7 nebo 14 dní**. Čím kratší, tím menší šance na falešnou blokaci. Výchozí je 30 dní. |

V **Calcy IV** je to nezávislá věc: má vlastní historii skenů (ta je zdrojem
starých řádků v exportu). Když si ji tam smažeš, budou exporty menší a nebudou
v nich kusy, které už nemáš — pak stačí okno *celé historie*. Appka o Calcy nijak
nerozhoduje.

### Které okno použít

- **Poslední hodiny** + *Nahradit roster* = roster je přesně poslední průchod
  boxem. Nejčistší, ale funguje jen když ten průchod byl úplný.
- **Celá historie** = všechno, co Calcy kdy vidělo, **včetně už puštěných kusů**.
  U výše zmíněného souboru to je 726 řádků místo 276.
- **Sloučit s rosterem** (místo *Nahradit*) = co appka zná, zůstane, a sken to jen
  aktualizuje. Tohle použij, když sken část přeskočil. Cena: zůstanou i kusy,
  které jsi mezitím pustil — ty pak smaž ručně.

### Co appka po importu hlásí

- **„Z toho N poznáno jako vylepšených (jiné CP, sedící IV)"** — kusy, které jsi
  vylepšil, přeučil nebo vyvinul. Appka je přepsala místo přidání duplikátu.
  **Když je to číslo výrazně vyšší, než kolik jsi jich doopravdy vylepšil, něco
  je špatně** — nahlas to. Přesně na tomhle se v srpnu 2026 našla chyba, která
  mazala kusy (viz níž).
- **„U N kusů sedělo víc řádků najednou"** — ten druh máš vícekrát a IV jsou jen
  odhad, takže se nedalo poznat, který řádek přepsat. Appka je radši **přidala
  jako nové**. Doskenuj je s Appraisal a příště se spárují.
- **„Naimportovat se nepokoušelo N kusů, které jsi tady dřív smazal"** — paměť
  smazaných. Jde otevřít tlačítkem *Smazané* a jednotlivě vrátit.
- **„Sloučeno N opakovaných skenů téhož kusu"** — tentýž kus naskenovaný dvakrát.

## Trading — co za co

Nejdřív to nejdůležitější, protože se podle toho rozhoduje všechno ostatní:

> **Při výměně se IV přehází.** Kus, který dostaneš, dostane **nová náhodná IV**.
> Spodní hranice roste s úrovní kamarádství, u **Lucky** je 12/12/12.

Takže **nemá smysl se vyměňovat proto, že ten druhý má lepší kus** — to lepší IV
si s sebou nepřinese. Vyměňuj se kvůli:

1. **Druhu, který nemáš** — nový záznam v pokédexu je jediná věc, kterou jinak
   nezískáš.
2. **Bonbónům** — dostanou je oba, a čím dál od sebe jste chytali, tím víc.
3. **Lucky** — minimum 12/12/12 a **poloviční prach** na vylepšování. Tohle je
   jediný způsob, jak z výměny vyjít se *silnějším* kusem, než jsi dal.

Vedlejší efekt, který se hodí: **kus s mizernými IV má cenu poslat pryč** — příjemci
se přehodí a může padnout líp. Appka to píše ve sloupci *Tradovat?* jako
„Zvážit · přehodí IV".

### Sekce „Co za co"

Appka spáruje **tvůj přebytek** (kus, který stejně pouštíš, a on ten druh nemá)
s **jeho kusem**, který ty nemáš. Vyjde z toho očíslovaný seznam
`dáš X ⇄ dostaneš Y`, který se dá odshora odbavit.

Žlutý štítek znamená **speciální výměnu**:

| Štítek | Kdy |
| --- | --- |
| `nový do pokédexu` | Příjemce ten druh ještě nemá zaregistrovaný. |
| `legendární` | Legendární, mytický nebo Ultra Beast. |

Speciální výměna jde **jedna za den** a stojí mnohonásobně víc prachu, takže appka
rovnou spočítá, **kolik dní** vám seznam zabere. Běžných výměn (druh, který oba
znáte) zvládnete až stovku denně, ale ty jsou jen o bonbónech.

Cena v prachu padá s **úrovní kamarádství**. Než pálit prach hned, vyplatí se
počkat na vyšší stupeň — u Best Friends je zlomková.

Shadow kusy **se tradovat nedají** vůbec, appka je do párů nedává.

### Sekce „Co spolu zvládnete líp"

Vyměňovat si kus, který jeden z vás už má, nemá smysl — ale **jít spolu do raidu**
ano. Tahle sekce projde typy a řekne, kdo z vás má na který výrazně silnější kus:

- **Na tohle spoléhej na něj** — typy, kde tě přebíjí (nebo kde nemáš nikoho).
- **Na tohle spoléhá on na tebe** — kde jsi silnější ty.

Kompletní společnou partu poskládá panel **Gym a raid** → *Jdeme ve dvou*.

## Výměna rosterů přes sdílenou složku

Když máte s kamarádem **tu samou složku namapovanou na disku** (OneDrive,
Dropbox, cokoli), nemusíte si posílat žádné CSV.

Konkrétně pro Lukáše a ANet slouží složka **`PokemonShare`** — ta samá, ve které
chodí i appka. Každý **zapisuje jen do své** podsložky a z té druhé jen čte:

| Kdo | Píše do | Čte z |
| --- | --- | --- |
| Lukáš | `PokemonShare\Luky roster\roster-lukas.csv` | `PokemonShare\Anet roster\roster-anet.csv` |
| ANet | `PokemonShare\Anet roster\roster-anet.csv` | `PokemonShare\Luky roster\roster-lukas.csv` |

Na disku to je u Lukáše `C:\Users\lukas\OneDrive\PokemonShare\…`, u ANet
`C:\Users\<její jméno>\OneDrive\PokemonShare\…`. V obou podsložkách leží
`PrectiMe.txt` s tímhle postupem.

Aby to ANet viděla u sebe na disku, musí mít složku `PokemonShare` **přidanou do
svého OneDrivu** (v OneDrive na webu → *Sdíleno se mnou* → PokemonShare →
*Přidat zástupce do Moje soubory*) a **sdílenou s právem upravovat**, ne jen
prohlížet — jinak jí do ní appka nezapíše.

Nastavení v appce (každý u sebe, stačí jednou). V kartě **Kamarádův roster**
rozbal *Vyměňovat si rostery přes sdílenou složku*:

1. **Sdílet můj roster…** — najdi složku `Rostery` a napiš název **svého**
   souboru. Od té chvíle do něj appka zapisuje tvůj roster **při každé změně**,
   stejně jako záloha.
2. **Načíst kamarádův soubor…** — vyber ten **druhý** soubor. Appka ho načte
   a rovnou udělá celý rozbor včetně návrhů na trade.
3. **Načíst znovu** — když víš, že něco změnil a OneDrive to už stáhl.

Do `PokemonShare` **CSV exporty z Calcy IV ručně nekopíruj** — ty obsahují celou
historii skenů. Do podsložek s rostery píše jen appka a dává tam jen jméno, CP,
IV a útoky.

### Co do sdílené složky patří: finální roster, ne importy

Appka do sdíleného souboru zapisuje **tvůj aktuální roster** — to, co máš právě
teď, po všech úklidech, sloučeních a smazáních. To je přesně to, co druhý potřebuje:
otázka u trade zní „*který druh ti chybí*“, a na tu odpoví jen aktuální stav.

Syrové CSV exporty z Calcy IV tam **nepatří**:

- Nesou **historii skenů**, takže obsahují i kusy, které jsi dávno pustil. Kamarád
  by tě žádal o výměnu za něco, co už nemáš.
- Jsou v nich **duplicity** téhož kusu z různých skenů.
- Je jich hodně (3–5 denně) a musel by je někdo slučovat ručně.

Zálohu (`Zálohovat do souboru…`) a sdílený soubor drž **jako dva různé soubory**.
Appka umí obojí zároveň a do obou píše při každé změně. Záloha je tvoje záchranná
síť — ta ať leží na lokálním disku, protože v OneDrivu, kam sahá i někdo jiný, může
skončit jako konfliktní kopie.

Po zavření a otevření stránky prohlížeč jednou chce **potvrdit přístup**
k souborům — objeví se na to tlačítko, jedno kliknutí a jede to dál.

Pár věcí, které je fér vědět:

- Ruční vstup v textovém poli **má přednost**. Když do něj něco napíšeš, vidíš
  jeho; vymažeš ho a appka se vrátí ke sdílenému souboru.
- **Do sdílené složky vidí i ten druhý.** Appka tam píše jen roster — jméno, CP,
  IV, útoky. Nic o účtu, žádné přihlašovací údaje, žádnou polohu.
- Synchronizaci řeší OneDrive, ne appka. Když má kamarád vypnutý počítač, prostě
  se načte jeho poslední verze.
- Funguje to v **Chrome a Edge**. Firefox tenhle přístup k souborům neumí a appka
  to v té sekci napíše.

## Max Battle (Dynamax)

V panelu **Gym a raid** je zaškrtávátko **Max Battle (Dynamax)**. Zapneš ho
a appka počítá s tím, že:

- do party jde **jen tři** pokémoni, ne šest,
- a **jen ti s Dynamaxem** — ostatní se do Max Battle vůbec nedostanou.

Bosse napiš normálně jménem, jako každého jiného; jestli je to Max Battle boss,
appka z jména nepozná (je to obyčejný druh), proto ten přepínač. V samotném boji
chceš mít od každé role jednu: **Max Attack** (poškození), **Max Guard** (štít)
a **Max Spirit** (léčení).

## Jak poznám, o kterou ligu jde

Ve sloupci **PvP tým?** je liga přímo ve verdiktu:

| co uvidíš | znamená |
|---|---|
| `Ano – LC` | **Little Cup** — do 500 CP |
| `Ano – GL` | **Great League** — do 1500 CP |
| `Ano – UL` | **Ultra League** — do 2500 CP |
| `ML #12` | **Master League** — bez limitu |
| `IV rank #1534` | do žádné ligy nepatří, tohle je jen pořadí v rámci druhu |

V podřádku je buď `hlavní · rank #37` (nejlepší kus toho druhu, co máš),
nebo `záloha`, nebo procento potenciálu. Ve sloupci **PvP potenciál (z IV)**
v zobrazení *Vše* jsou pak všechny ligy vedle sebe včetně CP a levelu, na který
ho vylepšit.

Ranky bere tracker ze sloupců `LL Rank`, `GL Rank`, `UL Rank` a `ML Rank`
z exportu Calcy IV — namapují se samy.

## Útoky v PvP

Ve sloupci **PvP tým?** se u kusu, který do ligy patří, kontroluje i **jestli má
správné útoky**. Když ne, napíše se rovnou, na co přeučit — třeba
*„přeučit na Bubble + Ice Beam / Play Rough"*. Najdeš je i přes dlaždici
**Přeučit útoky**.

Doporučení bere tracker z **PvPoke**, který souboje simuluje. Nebere jen jednu
„nejlepší" sestavu — útok projde, když ho simulace reálně používá. Proto
Medichamovi neřekne, ať přeučí Counter na Psycho Cut: obojí se v lize hraje.

Najeď na buňku myší a v bublině je celé vysvětlení včetně doporučené sestavy.
U druhů, které PvPoke v žebříčku nemá, je tam jen **odhad** — a je to tak
napsané, protože odhad neumí ocenit štíty ani útoky měnící staty.

## Kolik si toho nechávat

V **Nastavení prahů** rozhodují hlavně tři čísla:

| co | výchozí | co dělá |
|---|---|---|
| Kolik kopií druhu si nechat | **2** | od každého užitečného druhu necháš zálohu |
| Práh „vysoké IV" | **90 %** | nad tím je kus kvalitní bez ohledu na roli |
| Práh PvP potenciálu | **96 %** | pustí i použitelné kusy, ne jen dokonalé |

Změřeno na reálném rosteru o 389 řádcích:

| nastavení | ponechat |
|---|---|
| 1 kopie · IV 90 · PvP 98 | 41 |
| 1 kopie · IV 100 | 30 |
| **2 kopie · IV 90 · PvP 96** (výchozí) | **57** |
| 3 kopie · IV 90 · PvP 96 | 60 |
| 2 kopie · IV 85 · PvP 96 | 72 |

Z toho plyne, kde se vyplatí hýbat: **třetí kopie druhu přidá skoro nic**, ale
povolený PvP práh 96 místo 98 přidá rovnou dvanáct kusů. Když ti přijde, že
appka nechává málo, sáhni po PvP prahu a po prahu IV — ne po počtu kopií.

### Nebojte se s tím hýbat — je to vidět hned

Změna prahu se projeví **okamžitě**: přepočítají se dlaždice v souhrnu nahoře
i celá tabulka. Zajímá tě hlavně dlaždice **Ponechat** (kolik ti zbyde)
a **Zahodit / zvážit**. Klikni na kteroukoli a tabulka se podle ní vyfiltruje.

Takže nemusíš nic hádat: posuň práh, koukni na číslo, posuň zpátky. Nic se tím
nemaže — mazání je vždycky až tvůj samostatný krok.

### Dvě PvP pole se dají snadno splést

- **Práh PvP potenciálu — procenta (%)**: vyšší číslo = přísnější. 96 je
  doporučeno, **100 znamená, že neprojde skoro nikdo**.
- **Práh „elitní" PvP rank — pořadí, ne %**: pořadí kusu v rámci druhu
  (1 = nejlepší možný), takže **menší číslo = přísnější**. Běžně 50–200.

Když do některého napíšeš hodnotu, po které engine přestane cokoli propouštět,
appka to napíše rovnou pod to pole.

Tlačítko **„Nastavit doporučené"** vrátí všechny prahy na výchozí kalibraci.
Hodí se, když sis někdy něco přenastavil a nevíš už co.

A jedna věc na závěr: appka neříká „tohle musíš vyhodit", ale „tohle má práci".
Když nejsi na hraně kapacity, není důvod mazat cokoli.

## Jak to používat dál (denní provoz)

**Starý box** proscrolluješ jednou. **Nové úlovky se skenují samy** při chytání,
pokud běží překryv — nemusíš pro ně dělat nic.

Háček: sken z obrazovky chytání je skoro vždycky **jen rozsah**, protože při
chytání není k dispozici Appraisal. Takže:

1. chytáš normálně, všechno se odkládá do historie,
2. u kusu, který si chceš nechat, ho pak v boxu otevřeš, rozklikneš
   **Appraisal** a naskenuješ znovu → teď máš přesná IV,
3. u zbytku ti rozsah stačí (kus s 40–55 % je odpad tak jako tak).

Pro PvP je rozdíl podstatný: mezi 98 % a 94 % se rozhoduje, jestli je kus
použitelný, a rozsah osmi procentních bodů je na to k ničemu.

**Nemá cenu skenovat všechno s Appraisal** — u odpadu ti přesné číslo verdikt
nezmění. Tracker proto dělá předvýběr sám: sloupec **„Doskenovat s Appraisal?"**
a stejnojmenný filtr. Napíše u toho i strop („může být až 95 %"), ať víš, o co
hraješ. U kusů, kde na přesnosti nesejde, řekne rovnou „Nemusíš".

### Celý cyklus

```
1. chytáš       → Calcy IV skenuje sám (rozmezí IV)
2. export       → přetáhneš do trackeru
3. tracker      → filtr „Jen doskenovat s Appraisal" = seznam na doskenování
4. doskenuješ   → jen ty kusy, s otevřeným Appraisal
5. export       → přetáhneš znovu, „Nahradit roster"
6. tracker      → rozmezí nahradí přesnými hodnotami a řekne, co s nimi
```

V kroku 5 se opakované skeny automaticky slučují (viz níže), takže ti roster
nenaroste a u doskenovaných kusů zmizí otazník u IV %.

### Co když něco naskenuju dvakrát a nevím o tom

Nic se nerozbije, tracker počítá s tím, že o svých skenech nemáš přehled.
Rozlišuje tři situace:

| co se stalo | jak to pozná | co udělá |
|---|---|---|
| tentýž kus naskenovaný znovu | stejný druh, CP, level, útoky a IV si neodporují | **sloučí** a nechá přesnější sken |
| dva různé kusy se stejným CP | IV se navzájem vylučují (3/5/2 vs 10/11/12) | **nechá oba**, přebytečný označí k zahození |
| tentýž kus po vylepšení | stejná IV, ale jiné CP a level | **nechá oba** a napíše „Zkontroluj — možná ten samý kus" |

Ta třetí situace je ta zrádná: IV se vylepšováním **nikdy nemění**, CP ano. Kdyby
appka slučovala jen podle CP, tenhle případ by jí utekl a radila by ti zahodit
pokémona, kterého máš jen jednou. Proto místo doporučení dostaneš varování
a rozhodneš sám.

## Krok 6 — nasypat to do trackeru

1. Otevři `web-app/pokemon_tracker_app.html` (dvojklik, otevře se v prohlížeči).
2. Klikni na **Importovat data**.
3. **Přetáhni soubor** na vyznačenou plochu — nebo klikni a vyber ho.
4. Tracker ukáže, jak přiřadil sloupce. Zelená fajfka = rozpoznal sám; zbytek
   doladíš v rozbalovacích seznamech. Dole je náhled prvních řádků.
5. Klikni na **Sloučit s rosterem**.

### Sloučit, nahradit, nebo přidat?

Export z Calcy IV je **celá historie skenů**, ne jen to nové. Takže:

| tlačítko | kdy |
|---|---|
| **Sloučit s rosterem** | **skoro vždycky.** Co sedí, aktualizuje (doskenovaná IV přepíšou nepřesná), co je nové, přidá — a **ruční úpravy jako Forma = Shadow nebo poznámky zůstanou**. |
| Nahradit roster | první import, nebo když chceš začít načisto. Zahodí i ruční úpravy, proto se ptá na potvrzení. |
| Přidat vše | prakticky nikdy — přidá řádky bez ohledu na to, co už tam je, takže si roster zdvojíš. |

Kdyby tam bylo jen „Nahradit", přišel bys po každém importu o ručně označené
shadow kusy a poznámky. Proto je „Sloučit" výchozí.

Hotovo. U každého pokémona vidíš, jestli ho nechat, zahodit, vylepšit,
evolvovat, mega-evolvovat, poslat do gymu, do raidu nebo do PvP týmu.

Roster se sám uloží do prohlížeče, takže příště ho tam najdeš. Pro zálohu nebo
přenos na jiný počítač použij **Exportovat CSV**.

---

## Když nechceš nic instalovat nebo nemáš export

### Rename trick (funguje i v bezplatné Poké Genie)

Obě appky umí **zdarma** vygenerovat přezdívku, která nese IV pokémona — třeba
`Metagross 15/14/13 93%` — a zkopírovat ji do schránky. Tu pak ve hře vložíš
pokémonovi do jména. IV tak máš uložená přímo ve hře.

**Tracker si je odtud přečte.** Nepotřebuje CSV ani sloupce, stačí mu holý
seznam jmen. Dej *Importovat data* a vlož třeba:

```
Metagross 15/14/13 93%
Azumarill 0/15/15 89%
Blissey 10-15-15
```

Vytáhne z toho druh, IV i procenta, dohledá typy a evoluce a původní přezdívku
uloží do poznámky.

Háček: přejmenovat se musí každý pokémon zvlášť. Vyplatí se to u těch, na
kterých ti záleží.

### Úplně ručně

Napiš do trackeru jen **jména druhů** (přes *+ Přidat pokémona* nebo hromadně
přes import). I bez jediného čísla ti řekne:

- typy pokémona a jestli je to finální evoluce,
- jestli má mega evoluci a jakou má prioritu pro raidy,
- jestli je to TOP raidový útočník nebo gymový obránce,
- kolik kopií daného druhu máš a které jsou přebytečné.

S **CP a IV** k tomu přibude plná analýza včetně PvP potenciálu.

Proč se IV nedají opsat ze hry: **hra je nikdy neukáže číselně.** V detailu
pokémona je jen slovní hodnocení a sloupcový graf (Appraisal). Přesně 14/15/13
z toho nevyčteš — a právě proto ty skenovací appky existují.

### Oficiální žádost o data u Niantic

V Pokémon GO: **Nastavení → Help → Chat with us → „Request my data"**, nebo mail
na privacy@nianticlabs.com. Zdarma, data přijdou za **2–4 týdny**. Jestli je
v nich i seznam pokémonů s IV, se mi ověřit nepodařilo — jako pravidelný postup
se to nehodí, jako jednorázová zkouška to nic nestojí.

---

## Shrnutí

| Cesta | Cena | Práce | Co z toho tracker dostane |
|---|---|---|---|
| **Calcy IV + CSV export (Android)** | **zdarma** | sken boxu, přenést soubor | všechno včetně PvP ranků |
| Poké Genie + Scan Pro | jednorázový nákup | sken boxu, export | všechno |
| Rename trick + opsat jména | zdarma | přejmenovat kus po kuse | všechno, ale jen u přejmenovaných |
| Jen jména druhů | zdarma | pár minut psaní | druh, typy, evoluce, mega, duplicity |
| Žádost o data u Niantic | zdarma | čekat 2–4 týdny | neověřeno |

## Tradování

Sloupec **„Tradovat?"** hlídá tři věci:

- **Evoluce zdarma po tradu.** Kadabra, Machoke, Graveler, Haunter, Boldore,
  Gurdurr, Karrablast, Shelmet, Phantump a Pumpkaboo se po vytradování vyvinou
  **za nula bonbónů**. Když má kolega to samé, vyměníte si to a oba ušetříte celou
  evoluci. Tracker takový kus označí, dokud není vyvinutý.
- **Přehození IV.** U slabého kusu druhu, na kterém záleží, navrhne trade —
  IV se při výměně počítají znovu.
- **Shadow se tradovat nedá**, takže u něj rovnou řekne, ať to nezkoušíš.

Filtr **„Jen na trade"** ti vypíše seznam, se kterým můžeš rovnou jít za
kamarádem.

## Kde tracker najdu a komu se co posílá

Tracker je **jeden jediný soubor** na tvém disku:

```
C:\Users\lukas\Automatizace\pokemon-go-planner\web-app\pokemon_tracker_app.html
```

Dvojklik → otevře se v prohlížeči. Nic se neinstaluje, nic neběží na pozadí.
Vyplatí se udělat si na něj zástupce na plochu nebo si ho přidat mezi oblíbené
v prohlížeči.

**Nikam nic neposíláš.** Import i všechny výpočty běží v prohlížeči na tvém
počítači, soubor z Calcy IV se nikam neodesílá a roster se ukládá jen do úložiště
tvého prohlížeče. Když appku pošleš někomu dál, **posíláš prázdný nástroj** —
tvoje data v tom souboru nejsou.

## Víc lidí

Když bude každý používat svůj počítač, není co řešit. Data se ukládají do
úložiště prohlížeče, **ne do souboru** — takže když ten HTML soubor pošleš dál,
posíláš prázdný nástroj a každý si v něm vidí jen na svoje.

(V appce je připravené i přepínání profilů — víc rosterů vedle sebe v jednom
prohlížeči — ale zatím je schované, protože ho nikdo nepotřebuje. Zapíná se
jednou proměnnou v kódu.)

## Co znamená CP (a proč podle něj nefiltrovat)

**CP je jedno číslo slepené ze tří věcí:** ze síly druhu, z jeho IV a z toho,
na jaký level je vylepšený. Proto se z něj kvalita poznat nedá:

- **CP roste vylepšováním.** Čerstvě chycený kus má nízké CP bez ohledu na to,
  jak je dobrý.
- **CP se nedá porovnávat mezi druhy.** Blissey má strop úplně jinde než
  Azumarill — CP 2000 znamená u každého druhu něco jiného.
- **Pro Great League je vysoké CP spíš na obtíž**, protože liga má strop 1500.

Reálné příklady z appky (všechno kusy se 100% nebo skoro 100% IV):

| pokémon | CP teď | strop na L40 |
|---|---|---|
| Magikarp | 120 | 268 → **3378 jako Gyarados** |
| Bagon | 500 | 1156 → **3749 jako Salamence** |
| Rattata | 500 | 734 → 1730 jako Raticate |
| Blissey s 20 % IV | 2000 | 2399 |

Magikarp s CP 120 je cennější než ta Blissey s CP 2000. **Nikdy nefiltruj podle
CP** — filtruj podle druhu a IV, což je přesně to, co appka dělá.

Proto je v tabulce sloupec **„CP na L40"**: ukáže, kolik z toho kusu bude po
vylepšení, a u nevyvinutých i po evoluci (IV se evolucí nemění). Najetím myší
se ukáže vysvětlení.

A pro jistotu: **při hromadném skenu boxu si stejně nevybíráš** — Calcy IV čte,
co mu proteče pod rukama. Nic tím neušetříš. Šetřit se dá až u doskenování
s Appraisal, a tam ti seznam udělá appka sama.

## Dvě zobrazení tabulky

Nad tabulkou je přepínač **Zobrazení**:

- **Rozhodnutí** (výchozí) — 16 sloupců, jen to podstatné: kdo to je, jak je
  dobrý a co s ním. Na běžné obrazovce se vejde bez posouvání.
- **Vše (editace)** — všech 33 sloupců včetně jednotlivých IV, útoků a ranků.
  Sem přepni, když chceš něco ručně opravit (třeba označit Shadow).

Sloupec se jménem zůstává přišpendlený vlevo, takže i při posouvání doprava
víš, čí řádek čteš.

## Sloupec Forma (a proč se nevyplní sám)

**Forma** rozlišuje Shadow / Purified / Lucky kusy. Není to kosmetika:

- **Shadow** má o 20 % vyšší útok — nejlepší volba do raidů. Zato se **nedá
  tradovat** a vylepšení stojí víc.
- **Lucky** má poloviční cenu prachu na vylepšení a minimálně 12/12/12 IV.
- **Purified** je levnější na vylepšení a má o 2 vyšší každé IV.

Engine podle toho rozhoduje — shadow a lucky kusy nikdy neposílá do koše.

**Všechny tři se načtou samy.** Lucky má Calcy IV ve vlastním sloupci `Lucky?`,
a **shadow i purified píše rovnou do jména** — v exportu stojí
`Girafarig Shadow`. Tracker to vytáhne do sloupce **Forma** a jméno nechá čisté.

Sloupce `Form` a `ShadowForm` k tomu potřeba nejsou a schválně se ignorují: jsou
to vnitřní číselná ID (`ShadowForm` má hodnoty 1, 2 a 7, kde 7 zjevně znamená
„druh má mega evoluci"). Spoléhat se na ně by byla sázka do loterie.

**Jak shadow poznáš ve hře:** má kolem sebe **fialovočerný kouřový opar** a
v detailu ikonu Team GO Rocket. Dostaneš ho jen porážkou Rocketů.

### Shadow vs. Purify — není to totéž

**Shadow** je stav, ve kterém pokémon je. **Purify je akce**, kterou ho z toho
stavu vyvedeš — a je **nevratná**.

| | Shadow | po purifikaci |
|---|---|---|
| útok | **+20 %** | normální |
| obrana | −20 % | normální |
| IV | jaké jsou | **+2 ke každému** (max 15) |
| level | jaký je | zvedne se aspoň na 25 |
| vylepšení a evoluce | dražší | **levnější** |
| nabitý útok | Frustration (jde přeučit jen v akcích) | Return |

Pro **raidy se purifikace skoro nikdy nevyplatí** — +20 % útoku je víc než +2 IV.
Pro **PvP** je to naopak: −20 % obrany tam bolí a levnější vylepšení pomáhá.

Tracker na to má vlastní sloupec **„Purifikovat?"** a filtr „Jen purifikovat":

| co uvidíš | co to znamená |
|---|---|
| **Nechat** · +20 % útok | raidový druh — shadow bonus je cennější než +2 IV |
| **Ano** · PvP: obrana −20 % | PvP kus, kde shadow spíš škodí |
| **Ano** · do raidů nepatří | druh, kterého do raidu stejně nedáš |
| ✕ | není shadow, netýká se ho to |
| Hotovo | už purifikovaný |

Hranice je 60 % špičky svého typu.

## Filtry: souhrn a typy

Dlaždice v souhrnu jsou **klikací** — klikneš na „Na trade" a v tabulce zůstanou
jen ty kusy. Znovu klikneš na „Celkem v rosteru" a filtr zmizí.

Pod nimi je druhý řádek: **Silný proti typu**. Ukazuje, kolik máš pokémonů
použitelných proti kterému typu. Jdeš na Water raid bosse → klikneš na
**Water** a vidíš, koho vzít.

Počítá se to z **vlastních typů pokémona** (útoky svého typu mají bonus), takže
Charizard (Fire/Flying) je silný proti Grass, Ice, Bug, Steel a Fighting.
Je to odhad podle druhu — **rozhodující je konkrétní moveset**, ten appka nezná.

To mimochodem odpovídá na otázku „k čemu je Charizard, když má u gymu, raidu
i PvP napsáno Ne": do TOP 4 raidových útočníků svého typu se sice nevejde, ale
pořád je použitelný proti pěti typům a má mega evoluci.

## Když pokémona ve hře transferuješ

Tohle je jediné místo, kde export z Calcy IV nestačí: **transfer ve hře se do
historie skenů nijak nepromítne.** Calcy IV si sken drží dál a neví, že už toho
pokémona nemáš.

Řešení je jednoduché a **nevyžaduje nic promazávat**:

> **Pozor při prvním importu.** Když naimportuješ celou 30denní historii přes
> „Sloučit", dostaneš do rosteru i všechno, co jsi mezitím transferoval — roster
> pak ukazuje víc kusů, než reálně máš. Appka na to při importu upozorní.
> Náprava: projdi box, naimportuj znovu s oknem **„poslední hodiny"** a dej
> **Nahradit roster**.

### Průběžně: Sloučit

Chytáš, skenuje se to samo, jednou za čas naimportuješ a dáš **Sloučit
s rosterem**. Nové kusy přibydou, doskenované se aktualizují. Transferované
kusy ti v rosteru chvíli zůstanou navíc — nevadí, engine je stejně označí jako
duplicity nebo „Zahodit".

### Po úklidu boxu: přepiš roster posledním skenem

Když si ve hře uděláš pořádek (hromadný transfer), udělej **jeden průchod
boxem** a při importu vyber:

```
Použít jen skeny z:  [poslední hodiny (po průchodu boxem)]
```

Okna jsou: poslední hodina, 3 hodiny, den, 7 dní, 30 dní. **Krátká okna jsou
tam kvůli tomu, že během chození něco transferuješ** — ranní úlovky, které jsi
mezitím pustil, zůstanou v dnešní historii. Když si po návratu projdeš box
a zvolíš „poslední hodinu", dostaneš přesně to, co reálně máš.

Appka ukáže „vybráno N kusů, nejnovější sken 20. 8. 2026 — s Nahradit roster
bude roster přesně tohle". Dáš **Nahradit roster** a hotovo: roster se rovná
tomu, co máš reálně v boxu. **Nic ručně nemažeš.**

Ten výběr se dělá podle sloupce `Scan date` v exportu, takže se ignoruje celá
starší historie včetně kusů, které jsi mezitím transferoval.

### Když máš v Calcy IV zapnuté „doskenované natrvalo"

Při importu můžeš zaškrtnout **„Jen kusy s přesnými IV (doskenované s Appraisal)"**.
Tím se do trackeru dostanou jenom ty, u kterých máš přesná čísla — přesně ta
množina, kterou si Calcy IV drží natrvalo. Hodí se, když nechceš roster plnit
jednorázovými skeny odpadu.

Kombinuje se to s výběrem podle data: můžeš vzít třeba „poslední den + jen
přesné" a mít roster jen z toho, co sis dnes pořádně změřil.

### Když přece jen smažeš řádek ručně

Křížek na konci řádku funguje dál a appka si pamatuje, že ten kus už nemáš —
při dalších importech ho přeskočí a napíše kolik. **Pamatuje si k tomu i datum
skenu**, takže když ti později padne úplně stejný pokémon (stejný druh, CP,
level i útoky), pozná ho jako nový úlovek a normálně ho pustí. Tlačítko
**„Zapomenout smazané (N)"** paměť vymaže; „Nahradit roster" ji vymaže taky,
protože roster je od té chvíle autoritativní.

## Kam dát prach jako první

Filtr „Vylepšit prioritně" umí vrátit sedmdesát kusů, což k rozhodnutí nepomůže.
Nad tabulkou je proto karta **„Kam dát prach jako první"**, která z každé role
vybere **jeden pořádný kus** — druhý Fire útočník ti nepřinese nic, co první
neumí.

Dělí se na tři části:

- **Do raidů — jeden útočník na typ.** Pro každý útočný typ ten nejlepší kus,
  co máš, s movesetem a cenou. U každého je i **kolik procent špičky** to je —
  tedy jak si stojí proti nejlepšímu možnému útočníkovi toho typu ve hře.
  To je důležitý rozdíl: „nejlepší, co mám" neznamená „dobrý".

  | příklad | co to znamená |
  |---|---|
  | Metagross · Steel · **100 % špičky** | lepší Steel útočník ve hře není, investuj |
  | Charizard · Fire · **77 % špičky** (nej: Blacephalon) | solidní, klidně investuj |
  | Blissey · Fairy · **43 % špičky** (nej: Enamorus) | náhražka — appka poradí počkat |

  Hranice je 55 %: pod ní se u návrhu objeví **„vyplatí se počkat"**, protože
  prach do takového kusu se ti vrátí hůř než u toho, co chytneš příště.
- **Do PvP — nejlepší kusy do ligy.** Tři na Great a tři na Ultra, každý druh
  jen jednou.
- **Na gym — obránce.** Dva nejlepší.

Dole je součet: *„Na šest nejlepších raidových typů potřebuješ dohromady
848 tis. prachu."* Do plánu se nedostanou kusy, které engine sám posílá do koše,
ani horší kopie.

Klikni na řádek a vyfiltruje se ti ten pokémon v tabulce.

## Hledání a řazení

- **Hledání** — políčko nad tabulkou, píšeš jméno druhu.
- **Klik na jméno** v tabulce udělá to samé jedním kliknutím; druhý klik filtr
  zruší.
- **Řazení** — klik na hlavičku sloupce. Řadí se i podle verdiktů (Vylepšit,
  Útoky, PvP tým…), nejen podle čísel.
- **Druhotné řazení** — **Shift + klik** na jiný sloupec. V hlavičce se objeví
  ▲2. Hodí se třeba na „seřaď podle typu a v rámci typu podle CP".

## Tahák na ven

Karta **„Tahák na ven — koho na koho"** vygeneruje jednu obrazovku, kterou si
vezmeš do mobilu:

- **Na bosse typu…** — pro všech 18 typů tři nejlepší kusy, co máš, i s CP
  a movesetem. Typy, kde nemáš nikoho s typovou výhodou, jsou označené
  **„bez typové výhody"**; kde máš jen slabé kusy, svítí **„slabé"** — to jsou
  díry v pokrytí, které stojí za doplnění.
- **Nechat / Pustit** — jednoznačný seznam. Každý kus je právě v jedné
  kategorii, u každého je důvod:

  | kategorie | proč se nechává |
  |---|---|
  | Raidoví útočníci | nejlepší na svůj typ **a aspoň 50 % špičky** |
  | PvP týmy | nejlepší kusy do Great / Ultra ligy |
  | Obránci gymů | vysoké Def + HP |
  | Na trade (evoluce zdarma) | Machoke, Haunter, Kadabra… |
  | Speciální formy | Shadow / Purified / Lucky |
  | Mega evoluce | nejlepší kus druhu, co má mega |
  | Vysoké IV | nad nastaveným prahem |
  | Ještě dovyvinout | nevyvinuté kusy, které za to stojí |

  Co nespadne ani do jedné, je v **Pustit** — se jménem a CP, ať se to dá
  odklikat s telefonem v ruce. Každý transfer je navíc bonbón.

  Speciální forma se připíše i ke kusu, který drží místo z jiného důvodu —
  u Shadow Tyranitara je vidět „Rock · 85 % špičky · Shadow", ať ho omylem
  nepustíš.
- **Nechat v gymu** — nejlepší obránci.
- **Great / Ultra League** — týmy i s CP, na jaké je vylepšit.

Tlačítko **„Stáhnout do telefonu"** uloží `pokemon_go_tahak.html` — samostatnou
stránku se vším uvnitř. Přeneseš ji do mobilu a otevřeš v prohlížeči.
**Funguje offline**, nic se nestahuje, žádné odkazy ven.

Jde i vytisknout — styl na tisk je připravený.

## Counter mód — koho vzít na raid

Pod souhrnem je tlačítko **„Counter mód (na koho jdu?)"**. Po zapnutí se z typových
filtrů stane výběr **typu raid bosse** (klikni na jeden nebo dva typy) a tabulka
se seřadí podle toho, kdo se na něj hodí nejlíp. Sloupec „Silný proti typům" se
přejmenuje na „Proti Fire" a ukáže skóre.

Skóre počítá tři věci dohromady:

1. **DPS movesetu**, který ten kus reálně má,
2. **typovou výhodu útoku** proti bossovi (×1,6 za super efektivitu, u dvojtypého
   bosse se to násobí — až ×2,56),
3. **kolik sám schytá** (odolnost dělí, slabina sráží).

Příklad proti Fire bossovi:

| pokémon | skóre | proč |
|---|---|---|
| Tyranitar | 100 % | útok ×1,6, schytá jen ×0,63 |
| Gyarados | 99 % | útok ×1,6, schytá ×0,63 |
| Machamp | 52 % | neutrální na obě strany |
| Charizard | 43 % | Fire proti Fire je ×0,63 |
| Metagross | 30 % | ještě k tomu schytá ×1,6 |

Najetím myší na skóre uvidíš přesné násobky i moveset, se kterým se počítalo.
Když útoky vyplněné nejsou, počítá se s nejlepším možným movesetem a v tooltipu
je to označené jako odhad.

## Legendární a mytičtí

Hra **nepustí legendární, mytické ani Ultra Beasty do hromadného transferu** —
při potvrzení výběru napíše, že jsi vybral aspoň jednoho takového. Mytické
(Mew, Celebi, Meltan, Melmetal…) nejdou transferovat **vůbec**.

V tabulce je poznáš podle **barevného štítku hned za jménem**:
**LEG** (legendární), **MYT** (mytický), **UB** (Ultra Beast). Najetím myší se
ukáže celé slovo. Ve filtru je i volba **„Jen legendární a mytičtí"**.

Tracker to ví a takové kusy nikdy neposílá do koše, i kdyby měly mizerná IV.
Dostanou **Ponechat** a pod tím důvod: *„legendární — hra nepustí hromadný
transfer"* nebo *„mytický — nejde transferovat"*. Do seznamu „Pustit" se
nedostanou, takže při hromadném výběru na tuhle hlášku už nenarazíš.

## Čemu v doporučeních věřit

Dole v appce je **tabulka zdrojů**. Rozděluje doporučení na tři skupiny:

| co | odkud | jistota |
|---|---|---|
| typy, evoluce, mega, CP, stat product, duplicity, trade evoluce | herní data | **tvrdá** — buď to tak je, nebo ne |
| kdo je v které lize PvP meta | PvPoke top 200 | názor komunity, mění se s patchi |
| TOP raidoví útočníci a gymoví obránci | ruční seznam | nejvíc náchylné zastarat |

U každého zdroje je datum a stáří ve dnech. Když je něco starší než 90 dní,
appka na to sama upozorní.

### Kdy koukat na PvPoke

Na [pvpoke.com/rankings](https://pvpoke.com/rankings/) se vyplatí jít, když:

- appka u kusu napíše **„pod prahem"** a ty váháš, jestli do něj sypat prach,
- nesedí ti, že druh **„není v PvPoke top 200"**,
- proběhl větší **balance patch**.

**Co tam hledat:** vyber ligu (Great / Ultra / Master) a najdi svého pokémona.
Číslo vlevo je pořadí — to samé, co appka píše jako „PvPoke #". Rozklikni ho
a zkontroluj **doporučený moveset** (rychlý + nabité útoky).

To je totiž největší díra v doporučeních: **útoky appka vůbec neřeší.** Pokémon
se skvělými IV a špatnými útoky je k ničemu a tracker to nepozná. U kusů, do
kterých chceš investovat prach, si moveset ověř.

### Aktualizace dat

Data nejsou zamrzlá, jdou obnovit dvěma příkazy v projektu:

```bash
python tools/build_meta.py --refresh      # PvP žebříčky z PvPoke
python tools/build_pokedex.py --refresh   # herní data (nové druhy, mega formy)
python tools/sync_reference.py            # zapéct do appky
```

## Bezpečnost

Calcy IV ani Poké Genie se **nepřipojují k tvému účtu** a nepotřebují tvoje
přihlašovací údaje. Čtou jen obrázek obrazovky, což Niantic toleruje — proto
tyhle appky existují roky a mají desítky milionů stažení.

---

## Zdroje

- [Calcy IV – Google Play](https://play.google.com/store/apps/details?id=tesmath.calcy)
- [Calcy IV – changelog s CSV exportem a PvP ranky (APKMirror)](https://www.apkmirror.com/apk/tesmath/calcy-iv/calcy-iv-3-35-release/)
- [Calcy IV – průvodce (pokeep.com)](https://www.pokeep.com/pokemon-go/calcy-iv.html)
- [Poke Genie – Google Play](https://play.google.com/store/apps/details?id=com.cjin.pokegenie.standard)
- [Poke Genie – průvodce (TheGamer)](https://www.thegamer.com/pokemon-go-poke-genie-guide/)
- [Jak funguje PokeGenie a jestli je povolený](https://iwherego.com/location/pokegenie/)
- [Jak požádat Niantic o svoje data](https://www.sportskeeda.com/pokemon/how-request-pokemon-go-data-niantic)
