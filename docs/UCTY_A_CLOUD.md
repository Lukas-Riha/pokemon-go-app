# Účty místo lokálních dat — co by to obnášelo (2. 11. 2026)

Otázka: *„Každý, kdo appku má, jede lokálně. Chtělo by to účty — na PC i na
mobilu se přihlásím stejným účtem a mám stejný roster, každý svůj, a různá
oprávnění uživatelů. Jak je to reálné a co by to obnášelo?"*

Krátká odpověď: **dvě třetiny toho appka už umí; role se bez serveru udělat
nedají a největší práce stejně není v přihlášení, ale ve slučování dat ze
dvou zařízení.**

---

## 1. Kde appka stojí dnes

* **Data žijí v prohlížeči.** `pgo_tracker_v2` = `{ active, profiles: {…} }`,
  zapisuje se zároveň do localStorage (rychlá cesta při startu) a do IndexedDB
  (velká); při startu vyhrává novější podle `ulozenoMs`.
* **Jeden profil = jeden snímek** s osmi kolekcemi: `rows`, `discarded`
  (puštěné kusy), `historie` (paměť pořadí), `rucniUtoky`, `settings`,
  `filterMode`, `sortKey/sortDir`, `posledniImport`.
* **Cloud už v appce je.** Karta „Roster v cloudu" se přihlásí k OneDrivu
  uživatele (OAuth 2.0 + PKCE, oprávnění `Files.ReadWrite.AppFolder` — tedy
  výhradně do vlastní složky appky) a ukládá tam `roster.json`: **celý
  snímek**, se jménem profilu, časem a zařízením. Appka nikdy nepřepíše
  roster sama, vždycky se zeptá.
* **Od 3. 11. je registrace hotová.** `CLOUD_ID_VYCHOZI` nese ID aplikace
  zaregistrované na Lukášův osobní účet (osobní účty, SPA, PKCE), takže se
  každý jen přihlásí. Pořád platí, že to jde jen z https adresy nebo
  z `localhost`, ne z `file://` kopie.
* **Appka je statická.** Jeden HTML soubor (3,1 MB) na GitHub Pages, k tomu
  PWA se service workerem pro telefon. **Žádný server, žádná identita,
  žádné role.**

## 2. Tři požadavky a jejich skutečná cena

| Požadavek | Jak je to těžké | Proč |
|---|---|---|
| Přihlásit se na PC i mobilu a mít stejný roster | **hotovo** | napsané i zaregistrované |
| Každý má svá data | **malé** | vyplývá z prvního — každý ve svém cloudu |
| Různá oprávnění uživatelů | **velké** | role bez serveru neexistují |
| Aby se dvě zařízení nepřepsala | **největší** | o tom je zbytek dokumentu |

To poslední v zadání nebylo, ale je to ta pravá cena. Dnes se do cloudu
posílá **celý snímek**: kdo skenoval v telefonu a mezitím doma pustil pár
kusů, musí si jednu stranu vybrat. Dokud se synchronizuje po celku, účty jen
zpřehlední, jak o data přijdeš.

## 3. Tři cesty

### A. Dotáhnout OneDrive (bez serveru, bez nákladů)

Zaregistrovat appku jednou v Microsoft Entra jako SPA pro osobní účty, vepsat
`client_id` do appky a nastavit adresy přesměrování (GitHub Pages +
localhost). Pak se **každý jen přihlásí svým účtem** a má svůj roster ve svém
OneDrivu; appka k ničemu jinému na disku nemá přístup.

* **Práce:** hodiny, ne dny. Registrace, jedno pole, vyzkoušet na telefonu.
* **Cena:** nula. Provoz taky nula — nic neprovozuješ.
* **Plus:** cizí data nikdy nejsou u tebe. Žádná odpovědnost, žádné zálohy,
  žádný výpadek. Offline režim beze změny.
* **Mínus:** **žádné role.** A musí to být účet Microsoftu.
* **Splní:** přihlášení a „každý svůj". Nesplní oprávnění.

### B. Supabase (účty + databáze + role, pořád bez vlastního serveru)

Přihlášení e-mailem nebo Googlem, data v Postgresu, práva přímo v databázi
(Row Level Security: „vidíš jen řádky se svým `user_id`"), role jako sloupec
v profilu uživatele.

* **Bez knihovny.** Supabase má obyčejné REST rozhraní, takže stačí `fetch()`
  — appka zůstane jeden soubor bez závislostí. Skript z CDN by rozbil
  `file://` i offline režim, takže tudy ne.
* **Práce:** 2–4 dny na přihlášení, synchronizaci, role a migraci stávajících
  profilů. Plus vlastní sada testů.
* **Cena:** zdarma do 500 MB databáze a 50 000 uživatelů měsíčně — roster
  o 420 kusech je v JSONu řádově 150–300 kB, takže limit je mimo dohled.
  **Ale:** free projekt se po týdnu nečinnosti uspí a appka k němu první den
  po pauze nedosáhne, dokud ho ručně neprobudíš. Buď ~$25 měsíčně, nebo si
  projekt držet vzhůru vlastním pingem (což už je provozování služby).
* **Mínus:** stáváš se správcem cizích dat. Roster citlivý není, e-mail ano.
  U appky pro pár lidí stačí poctivě napsat, co se ukládá a jak to smazat —
  ale je to tvoje starost, ne uživatelova.

### C. Vlastní backend (Cloudflare Workers + D1, nebo malý VPS)

Totéž co B, ale pravidla jsou tvoje a nic se neuspává (Workers mají zdarma
100 000 požadavků denně, tedy o několik řádů víc, než kdy padne).

* **Práce:** 1–2 týdny. Přihlášení (nejspíš přes Google OIDC — vlastní hesla
  nedělat), tokeny, rozhraní, zálohy, nasazování.
* **Smysl dává**, až když vadí cizí free tier a jeho pravidla, nebo až má
  appka dělat něco, co databáze sama neumí (sdílené žebříčky, porovnání mezi
  uživateli, upozornění).

## 4. Práce, která je ve všech cestách stejná

Tohle je skutečný rozpočet úkolu — přihlášení je z něj ta levná část.

1. **Identifikátory kusů nejsou jedinečné.** Dnes `r.id = "r" + rowSeq`, tedy
   pořadové číslo v rámci jednoho úložiště. Na PC i na telefonu vznikne
   `r42` — pokaždé jiný pokémon. Pro slučování po záznamech je potřeba
   skutečné UUID a migrace stávajících rosterů (staré číslo si nechat jako
   `puvodniId`, ať se nerozbijí odkazy).
2. **Slučovat se musí čtyři kolekce zvlášť**, ne jeden snímek: kusy, puštěné,
   paměť pořadí a ruční útoky. U každého záznamu je potřeba vědět, **kdy se
   naposledy změnil**, jinak nejde rozhodnout, která strana je novější. Dotkne
   se to importu, čištění boxu i historie.
3. **Mazání se musí replikovat taky.** Kus puštěný v telefonu musí v PC
   zůstat puštěný, ne se vzkřísit zpátky do rosteru. Jinak se při prvním
   sloučení vrátí všechno, co jsi za večer vyházel.
4. **Offline je nepodkročitelné.** Appka se používá v terénu bez signálu,
   takže pravda zůstává v prohlížeči a server je druhá kopie. To vylučuje
   „appka běží pod účtem na serveru" — ta cesta není ani varianta.
5. **Konflikt se musí umět ukázat člověku.** Appka už to pravidlo má
   („nikdy nepřepíšu sám, řeknu kolik kusů, kdy a z jakého zařízení"). Při
   slučování po kusech to chce jemnější verzi: *tyhle tři kusy se liší, tady
   je obojí*.
6. **Role mají smysl jen se serverem.** Cokoli, co appka rozhodne
   v prohlížeči, je nápis, ne oprávnění — zdroj vidí každý. Takže: chceš-li
   role, je to cesta B nebo C, cesta A je nikdy nedá.
7. **Testy.** Dnes jich běží přes 400 proti localStorage. Synchronizace
   potřebuje vlastní sadu: dvě zařízení, offline úprava na obou, mazání proti
   úpravě, prázdný roster proti plnému.

## 5. Co bych udělal

**Rozdělit to na kroky a nepouštět se do dalšího dřív, než bude ten
předchozí vyzkoušený v provozu.**

**Krok 1 — tenhle týden, pár hodin: dotáhnout OneDrive (cesta A).**
Zaregistrovat jednu aplikaci, doplnit `client_id`, vyzkoušet na telefonu. Tím
je splněné „na PC i na mobilu se přihlásím a mám svůj roster", pro tebe
i pro ANet, bez serveru, bez nákladů a bez odpovědnosti za cizí data. Pořád
to bude synchronizace celého snímku s otázkou při konfliktu — to je dnešní
stav a pro jednoho člověka se dvěma zařízeními je snesitelný.

**Krok 2 — až bude potřeba: slučování po kusech.** UUID, `zmeneno`
u záznamu, replikace mazání. Tahle práce platí pro OneDrive i pro Supabase
stejně a je to ta část, bez které jsou účty jen hezčí způsob, jak si přepsat
data. Teprve až tohle stojí, má smysl se ptát na server.

**Krok 3 — jen pokud role opravdu chceš: Supabase (cesta B).** Přes REST,
bez knihovny, local-first zůstává. Uspávání free projektu vyřešit pingem,
nebo to po čase přepnout na placené, až bude jasné, že to někdo používá.

**Čemu se vyhnout:** přepsat appku na serverovou. Přišla by o offline,
o rychlost a o to, že si ji každý může otevřít z disku — a to jsou tři
důvody, proč je použitelná v terénu.

## 6. Co to znamená pro tebe jako provozovatele (cesty B a C)

* Jsi **správce osobních údajů** (e-maily a rostery cizích lidí). Chce to
  větu v appce o tom, co se ukládá, a tlačítko „smazat účet i data".
* Zálohy jsou tvoje starost. U cesty A je má uživatel ve svém OneDrivu.
* Výpadek služby = nefunkční appka pro všechny. U cesty A appka funguje dál,
  jen se nesynchronizuje.
* Podpora: „ztratil jsem heslo", „nevidím svá data na druhém telefonu".
  U appky, která dnes žádné uživatele v evidenci nemá, je to nová práce.

## 7. Plán a stav (Lukáš 2. 11.: měnit se bude na obou zařízeních, takže
slučování po kusech je must-have)

**Etapa 1 — základy. HOTOVO 2. 11.**

* Každý kus dostal **stálé číslo** (`sid`, 32 znaků z generátoru náhody).
  Nemění se a nese si ho všude, takže tentýž kus jde poznat i na druhém
  zařízení. Lokální `id` („r42“) zůstává, jak bylo — nic, co na něj
  odkazuje, se nemuselo přepisovat.
* Kus uložený dřívější verzí appky dostane číslo **při prvním otevření**
  (přiděluje se v `newRow`, kudy projde každý kus: nový, importovaný
  i načtený z úložiště). Žádný ruční převod rosterů.
* Při ukládání se **razítkuje čas změny** (`zm`) — ale jen kusům, které se
  opravdu změnily. Pozná se to porovnáním s tím, co v úložišti leželo,
  takže se na razítko nedá zapomenout při nové úpravě někde v kódu.
* Smazaný kus nechá **hrob** (`smazane: {sid: kdy}`). Bez toho by se kus
  puštěný v telefonu při prvním sloučení vrátil z počítače zpátky.
  Vrácený kus (čištění boxu) hrob zase odklidí; starší než rok se zahodí.
* Kontroly: blok 323 v `tests/web_app.test.mjs` (stálá čísla, razítko jen
  u změněného kusu, hrob po smazání, úklid hrobu po vrácení).

**Etapa 2 — slučování dvou snímků. HOTOVO 2. 11.**

Funkce vezme „můj“ a „jejich“ snímek a vyrobí třetí. Pravidlo je po kusech:

* kus, který má jen jedna strana, se přidá — pokud na něj druhá strana
  nemá pozdější hrob,
* kus, který se liší a sáhla na něj od posledního sloučení jen jedna
  strana, přebere její verzi,
* kus, na který sáhly obě, appka **nerozhoduje**: nechá ten zdejší
  a vypíše ho do konfliktů,
* hrob kus smaže, ale jen když je pozdější než poslední změna toho kusu
  (jinak ho někdo mezitím vrátil nebo znovu naskenoval).

Zvlášť se slučují puštěné kusy (podle klíče skenu, platí pozdější zápis),
paměť pořadí (zápisník — spojit, seřadit podle času, uříznout na limitu)
a ruční útoky (u klíče platí pozdější zápis). Nastavení se nedělí po
políčkách: platí to, co uložilo zařízení, které ukládalo později. Řazení
a filtr se nesynchronizují vůbec, to je stav okna, ne data.

Hroby se od té doby drží i v paměti appky, ne jen v uloženém profilu —
po sloučení jsou mezi nimi i ty z druhého zařízení a jinak by se při
prvním uložení ztratily.

Kontroly: blok 324 v `tests/web_app.test.mjs` (cizí kus přibude, cizí
změna se převezme, moje zůstane, oboustranná změna jde do konfliktů,
hrob maže jen když je pozdější).

**Etapa 3 — cloud. HOTOVO (3. 11.).** Stahování z cloudu
už nenabízí nahrazení rosteru, ale **sloučení**: v otázce stojí, co
přibude, co se převezme, co ubude, a vypíší se kusy, u kterých se verze
rozcházejí. Čas posledního sloučení se drží v prohlížeči — bez něj by
appka nepoznala rozdíl mezi „tohle jsem změnil já“ a „tohle jsme
změnili oba“. Appka je u Microsoftu zaregistrovaná jako jednostránková
aplikace pro osobní účty; adresy, na které se smí vrátit, jsou ostrá
appka na GitHub Pages a `localhost:8778` pro zkoušení. Vrstva Atlas
kartu cloudu schovávala — pravidlo i vypnutí tlačítek jsou pryč, hlídá
to kontrola 88 ve vzhledové sadě. Ověřeno na dvou zařízeních to bude až
po překlopení verze, protože telefon se na `localhost` nedostane.

**Vyzkoušeno naostro 3. 11.** (dvě okna, jeden účet) a vyšlo z toho pět
oprav: appka se neptá, když z cloudu není co převzít (pamatuje si, které
uložení už vyřídila); kliknutím vedle okna se otázka o datech nezahodí;
sloučené kusy jsou vidět hned, ne až po načtení stránky znovu; do cloudu
se appka podívá i při návratu k oknu; a místo jedné věty se otevře okno
jako po importu — kusy po jménech, rozdělené na „přibudou“, „novější
verze“, „ubudou“ a „verze se rozcházejí“.

**Etapa 4 — konflikty v okně. HOTOVO (3. 11.).** U kusu, na který sáhla
obě zařízení, ukáže okno **obě verze vedle sebe** a pod každou jen to, čím
se liší (`rozdilyKusu`). Předvolená je ta zdejší, takže odklepnutí se chová
jako dřív. Vybraná verze dostane **čerstvé razítko** — bez toho by po
sloučení byly obě „staré“ a při dalším spojení by rozhodlo zase jen razítko,
takže by se rozhodnutí samo vrátilo zpět. Takhle vyhraje i na druhém
zařízení. Vedlejší nález: pojistka „neptej se, když není co převzít“ mlčela
i nad konfliktem — a to je přesně ta situace, kdy se ptát musí.
**„Nahradit roster“ — vyřešeno hned, protože by to jinak bylo horší než
nic.** Nahrazení staví kusy znovu, takže by každý dostal nové stálé číslo
a druhé zařízení by to přečetlo jako „celý roster smazán a založen znovu“.
Kus, který sken našel znovu, si proto číslo nechává: páruje se podle klíče
skenu, pak podle klíče bez levelu, a nakonec podle druhu — ale jen když ho
obě strany mají přesně jeden, jinak by si dva Machopové vyměnili čísla
mezi sebou. Ověřeno: nahrazení stejným skenem i se dvěma vylepšenými kusy
nenechá ani jeden hrob; dva nerozlišitelné Machopové dostanou nová čísla,
každý své.
