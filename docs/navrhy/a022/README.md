# A-022 — Pozadí událostí a použití v kartách (16. 10. 2026)

Návrh, nikoli implementace. Aplikace, výpočty ani pořadí událostí se neměnily.

## Obrazové listy
- 01-pozadi-koncept.png: čtyři prostředí, nahoře raid / Max, dole chytání / výzkum.
- 02-karty-desktop-mobil.png: kompozice v rozhraní; texty jsou ukázkové, nejsou herní data.

## Směr
Pozadí je dekorace kategorie. Pokémon a skutečný obsah se vykreslí zvlášť z dat. Nezapékat název, datum, bonus nebo sprite do pozadí. Pokud druh neznáme, použít čistou scénu. Nezobrazovat náhodného bosse ani vymyšlený bonus. Barevnost obrázků nemění existující barvy filtrů/štítků aplikace.

Raid: modrá noční aréna. Max: fialový energetický vír. Chytání: prosluněná louka. Výzkum: noční průzkumný tábor. Smíšené a neurčené akce použijí neutrální krajinu; mapování má vycházet ze skutečného typu události, ne z odhadu podle názvu. Sezónní a speciální varianty až po odsouhlasení tohoto směru.

## Rozvržení
Desktop zachovat tři existující doporučené akce, nikoli pevné tři kategorie. Obraz 16:9, pod ním skutečný název, termín, doložený přínos a CTA. Název rezervuje dva řádky, tlačítka se zarovnají dolů; dlouhý text nesmí překrýt termín. Text může pokračovat v těle karty. Na širokém monitoru nezvětšovat samotný obraz do nepřiměřené výšky: použít omezený obrazový blok, více místa dát obsahu.

Mobil: první karta velká, zbývající dvě jako řádky s náhledem přibližně 96–112 px, nadpisem a termínem. U kompaktní karty celý řádek otevírá detail; nevnořovat do něj druhé klikací tlačítko. Spodní navigaci zachovat.

Obrazový list ukazuje i výzkumný banner jako příklad hlavičky detailu. Není to pokyn přidat čtvrtou kartu na homepage. Hamburger, textové logo ATLAS a chybějící spodní navigace jsou odchylky generovaného mockupu: nepřebírat je, zachovat aktuální logo i navigaci.

## Obrazy a čitelnost
Použít object-fit: cover, nikdy fill; výchozí object-position: 50% 40%, u konkrétní scény upravit ohnisko. Sprite Pokémonů samostatně s object-fit: contain, bez deformace. Přechod do barvy karty vykreslit CSS a ověřit i světlé téma. Text má převážně vlastní klidnou plochu; kontrast zkontrolovat se skutečným nejdelším názvem i nejsvětlejší scénou. Význam nesmí být nesen jen barvou. Dekorativní obrazy mají prázdný alt.

Před nasazením vytvořit samostatné čisté soubory jednotlivých scén (tento 2×2 list je koncept, ne finální atlas pro CSS). Připravit menší varianty pro mobil a rozumnou kompresi, rezervovat rozměry kvůli poskakování. První viditelný obraz načíst prioritně, další podle potřeby. Ověřit 390/820/1440/1920 px, dlouhý titulek, akci bez druhu, více druhů a výpadek obrázku. Nepoužívat hlavní banner jako drobné pozadí každé buňky měsíčního kalendáře.

## Původ návrhů
Vygenerováno vestavěným imagegen. První prompt: 2×2 list čtyř jednotně stylizovaných krajin pro ATLAS — modrá noční raidová aréna, magenta Max vír, slunná louka, noční výzkumný tábor; bez textu, postav a log, volný střed pro sprite, tmavý spodní přechod. Druhý prompt použil první list jako referenci pro desktop se třemi kartami, mobil s jednou velkou a kompaktními dalšími kartami a příklad výzkumného banneru; české ukázkové texty, žádné vymyšlené termíny nebo bonusy. Generované ilustrace určují směr, nikoli přesná data či závaznou podobu navigace.
