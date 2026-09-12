# Routy — plánovač cesty

Samostatný soubor `web-app/routy.html`. S trackerem nesdílí data ani kód, je to
jiná úloha: kudy jít, ne co si nechat.

## Proč ručně

Niantic pro Routes žádné veřejné API nemá. Komunitní mapy (PogoMap.info) jsou
crowdsourcované, bez dokumentovaného exportu a bez záruky, že tvoje okolí vůbec
někdo zanesl. Routy se proto zadávají ručně — jednou, a pak se to jen používá.

## Co se zadává

**Stopa:** název, zeměpisná šířka a délka, příznak „gym".
Souřadnice nejsou povinné, ale bez nich se nedá kreslit mapa ani počítat
vzdálenost mezi konci rout — tedy ani hledat trasu.

Zadávají se **ručně**, jinak to nejde: seznam pokéstopů nikdo nezveřejňuje.
Zkusil jsem to obejít přes OpenStreetMap — tlačítko hledalo místa z kategorií,
ze kterých pokéstopy vznikají (sochy, kapličky, hřiště). V praxi to netrefilo
skoro nic: kde měla hra deset stop, OpenStreetMap znal tři úplně jiná místa.
Odebráno 12. 9. 2026, protože to slibovalo něco, co to neumělo.

Nejrychleji se stopy zadávají z mapy: **pravé tlačítko do prázdna** ji založí
na tom místě a rovnou otevře kartičku, kde se přepíše jméno a zaškrtne gym.
Pravé tlačítko **na existující stopu** otevře tutéž kartičku. Mapa přitom
zůstane, kde byla — kvůli přejmenování se nemusí do jiné záložky, jinak by
se po každém bodu ztratil výřez.

**Routa:** název, odkud, kam, délka v metrech, čas v minutách a trasa po
silnici. Délku i čas jde nechat prázdné a dopočítají se v tomhle pořadí:

1. co je zadané ručně (nejlíp opsané ze hry),
2. délka nalezené cesty po silnici, sečtená po úsecích,
3. vzdušná čára mezi konci × 1,35 na to, že ulice nejsou rovné.

Čas se počítá z délky a zadaného tempa chůze.

Vzdálenosti se všude ukazují a zadávají **v metrech**: routa má pár set metrů
a „0,42 km" se čte hůř než „420 m". Hra hlásí délku taky v metrech, takže se
opisuje beze změny. Uvnitř a v záloze zůstávají kilometry, aby starší zálohy
nebylo nutné přepočítávat.

### Založení routy z mapy

Vyber na mapě začátek a cíl a nabídne se **Založit routu odsud tam**. Otevře
se okno, kde jsou oba konce už vyplněné; doplní se jen název. Metry i minuty
se předvyplní z cesty, kterou mezitím našel směrovač, a přepíšou se, když hra
hlásí něco jiného. **Uložit routu** ji založí i s tou nalezenou cestou, takže
je hned nakreslená po ulicích. **Zrušit** nezaloží nic.

Bez internetu se metry předvyplní jen odhadem ze vzdušné čáry a okno to
řekne.

Routa je **směrová**. Odměna se počítá, jen když ji projdeš od začátku ke
konci; zpátky se dá jít pěšky, ale jako routa se to nepočítá. Kdo chce
i opačný směr, založí druhou routu s prohozenými konci.

## Trasa routy

Nejkratší čára mezi konci **není** trasa routy. Hra ji vede po ulicích a
pěšinách, a to bývá oklika kolem parku nebo přes lávku.

Kreslení zapne tlačítko **Trasa** u routy, nebo pravé tlačítko na routu
v mapě. Lišta nad mapou pak svítí, dokud se nedá Hotovo.

**Cestu nakreslí appka sama.** Hned po zapnutí se zeptá směrovače, kudy se
tam dojde pěšky, a odpověď vykreslí. Ruční klikání po ulicích je zbytečné —
je to jen oprava toho, co se nakreslilo.

Opravuje se takhle:

* klik do mapy přidá **průchozí bod**, kterým musí cesta vést, a hned se
  hledá znovu;
* tažením se bod posune, pravým tlačítkem zmizí, a pokaždé se cesta přepočítá;
* **Najít cestu po silnici** hledá znovu, když napoprvé nevyšla;
* **Vymazat tvar** zahodí body i cestu a vrátí routu na přímou čáru.

V liště se vybírá i **začátek a konec**. Dřív se to dalo jen v tabulce, kam
ten, kdo kreslí na mapě, nechodí — a routa bez vybraného konce se kreslila
jako smyčka od posledního bodu zpátky na první. Když je začátek i konec
tatáž stopa, lišta na to upozorní.

Nalezená cesta se použije na délku a ta pak na čas, takže plán počítá s tím,
co se opravdu ujde. Klikatostí se **nenásobí**: je to skutečná cesta, ne
vzdušná čára, přirážka by ji nafoukla podruhé.

Uložená cesta si pamatuje otisk zadání, ze kterého vznikla. Jakmile se body
nebo konce změní, přestane platit a kreslí se rovné spojnice, dokud nedorazí
nová. Bez toho by na mapě visela cesta, kterou už nikdo nezadal.

Routy zadané dřív žádnou cestu nemají a počítají se pořád po staru. Nic se
nemusí překreslovat zpětně.

### Směrovač

Valhalla od FOSSGIS nad daty OpenStreetMap, bez klíče a bez registrace,
s pěším profilem. Veřejný OSRM by byl po ruce taky, jenže umí jen auto:
na osmi stech metrech chůze vracel skoro dvanáct kilometrů objížďky
jednosměrkami.

Bez internetu to nejde a lišta to řekne. Body zůstanou zadané a spojí se
rovnými čarami, takže se dá kreslit dál a cestu dohledat doma.

## Mapa

Podklad se stahuje přes Leaflet z CDN. **Spolu se směrovačem je to jediné
místo v celé sadě, které sahá na internet.** Bez sítě se Leaflet nenačte
a stránka místo mapy nakreslí schéma z týchž souřadnic — body na správných
místech, jen bez ulic.
Obojí umí skoro totéž: vybrat začátek a cíl, otevřít stopu pravým tlačítkem,
přidávat i mazat body trasy. Jediné, co ve schématu nejde, je táhnout bodem;
je to nouzový režim, ne druhá mapa.

Vedle podkladu je i přepínač, **které routy se kreslí**: všechny, jen
vybranou, nebo žádné. Ve městě se jich přes sebe navrství tolik, že pod nimi
není vidět mapa, a při kreslení jedné konkrétní jsou ostatní jen šum.
Právě kreslená routa je vidět vždycky, i při vypnutých routách — jinak by se
kreslila naslepo. Volba se pamatuje.

Podklad se přepíná v liště a volba se pamatuje:

| | |
| --- | --- |
| Přehledná | výchozí, světlá a čitelná pod barevnými body |
| Ulice | běžná OpenStreetMap, nejvíc detailů |
| Světlá | skoro bez barev, body vyniknou |
| Pěšiny | vrstevnice a stezky, k dohledání kudy routa vede |
| Satelit | letecký snímek, když v mapě cesta chybí |

Všechny jedou bez registrace a bez klíče. CARTO by se sem hodilo nejvíc,
jenže od letoška maluje přes dlaždice „API KEY REQUIRED" — a protože je to
obrázek jako každý jiný, nepozná se to jinak než okem. Test proto hlídá, že
mezi podklady není hostitel, který klíč chce.

## Hledání trasy

Zadání je „z A do B a **co nejvíc rout**", ne nejkratší cesta. To je
orienteering: maximalizuje se počet posbíraných rout při stropu na čas. Bez
toho stropu by odpověď byla „projdi všechny routy ve městě".

Prohledává se do hloubky s dvojím prořezáním:

* **dolní odhad zbytku cesty** je vzdušná čára bez přirážky. Musí být
  nepodstřelitelný — s přirážkou 1,35 vycházel odhad delší než skutečná cesta
  po routách a hledání se ořízlo hned v kořeni;
* **strop 250 000 stavů**. Když se na něj narazí, výsledek je označený jako
  „nejlepší nalezená", ne nutně nejlepší možná.

Routy se z každé stopy zkoušejí od té nejbližší, takže dobré řešení se najde
brzy a odpověď je použitelná i po naražení na strop. Naměřeno: 20 rout
a 90 minut je pod 10 ms; 46 rout a 300 minut je nejhorší případ, 2,6 s
a strop.

## Do mobilu

Tlačítko **Uložit plán do mobilu** stáhne `routy_plan.html` — samostatný
soubor jen s naplánovanou cestou. Žádná mapa, žádná databáze rout: venku jde
o to vědět, co teď aktivovat a kam jít dál. Kroky se odškrtávají ťuknutím,
odškrtnuté se přeškrtnou a další v pořadí se označí jako **TEĎ**. Funguje
offline, stav se drží v telefonu.

## Data

Vše je v `localStorage` toho prohlížeče, kde se soubor otevřel. Tím pádem to
zmizí se smazanou historií, změnou prohlížeče i přesunem souboru jinam —
záložka **Záloha** proto umí stáhnout a načíst JSON. Zálohovat po každém
větším doplňování.

U routy se v záloze veze i trasa: `body` jsou naklikané průchozí body,
`tvar` je cesta po silnici a `tvarZ` otisk zadání, ze kterého vznikla.
Starší záloha je nemá a načte se beze změny.

## Testy

`node tests/routy.test.mjs`. Běží dvakrát: se zablokovanou sítí, kde se místo
mapy kreslí schéma (tahle část musí projít i na počítači bez připojení),
a s Leafletem, když se ho podaří stáhnout. Když ne, druhý blok se přeskočí,
ať celá sada nepadá na tom, že je zrovna vlak v tunelu.
