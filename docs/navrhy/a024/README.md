# A-024 — Detail akce: vzhled a úplnost dat
16. 10. 2026. Návrh a audit; aplikace se v tomto kole neměnila.

## Doložený problém
Zdroj porovnání: https://leekduck.com/events/fall-marathon-buddy-trek-2026/ (otevřeno 16. 10.). Porovnáno s data/events.json, funkcemi list/teloAkce/openEvent v atlas.js a tools/leekduck_okna.py.

Lokální JSON má tři okna; do jednoho klíče spawn slučuje běžnou přírodu a dvě období Incense. Renderer podle klíče všechno nazve „Ve volné přírodě“. Zdrojem označené omezení na běžný Incense se ztrácí. Výzkum je plochý seznam, ne vazby úkol → možné odměny. Chybí časovaný výzkum a některé odměny. Parser explicitně ignoruje go-pass s komentářem, že jde o nákupy, ale zdroj má i bezplatný postup a podmíněné bonusy. U novinek zůstávají jména, chybí vysvětlení a podmínky. Zobrazená dostupnost shiny není totéž co zvýšená šance.

## Datová oprava pro Clauda — před vzhledem
1. Neopravovat tuto jednu akci natvrdo v atlas.js. Zachovat zpětnou kompatibilitu e[7]; přidat normalizovaná data detailu (např. pod stávající metadatový objekt e[8]) a adaptér pro staré záznamy. Nejprve ověřit existující kontrakt a jeho konzumenty.
2. encounters: speciesId/form, method (wild/incense/raid/egg/research), start/end, timezone semantics, conditions, shinyAvailable a shinyBoost jako oddělené hodnoty true/false/unknown. Časová okna s nejasnou sémantikou označit, nepřiřadit automaticky celé akci.
3. research: typ (field/timed/special), kroky, úkoly, odměny strukturované dle druhu (Pokémon/item/currency/energy), quantity, varianty odměn anyOf vs allOf, deadline a claimDeadline, free/paid/unknown. Nezaměnit možné odměny za všechny garantované.
4. bonuses: plný účinek, podmínka odemknutí, časové okno, omezení a pass tier. Free track a Deluxe oddělit. Není třeba natahovat obchodní katalog, ale bezplatnou hratelnost a její podmínky nevynechávat.
5. features: nové druhy, evoluční podmínky, speciální útoky a jiné změny; zachovat vztah druhu k popisu. Neodvozovat herní mechaniky z grafiky.
6. Ke každé sekci provenance: sourceUrl/sourceSection, fetchedAt, parseStatus available/absent/unsupported/error. Prázdný parser nesmí znamenat „žádné bonusy“. V UI „Podrobnosti nejsou dostupné“ a zdroj; žádný slib, že je načteno vše.
7. Přidat lokální HTML fixture tohoto eventu a Community Day. Testy rozliší wild/incense, výjimku běžného Incense, dvě okna a hranici přepnutí, vazby úkol/odměna, free vs paid a odlišný deadline vyzvednutí. Výslovně testovat neznámá data a změnu šablony zdroje.

## Vzhled
Obrázek detail-akce-navrh.png ukazuje kompozici, ne hotovou aplikaci. Hero 220–280 px desktop, cca 170 px mobil; skutečné sprity na samostatné dekorativní krajině. Nativní dialog, sticky krátká hlavička s X, dlouhý hero odscrolluje. Desktop max 1100–1180 px a max-height viewport minus 32 px; mobil celá obrazovka, safe area. Scrolluje tělo, footer nesmí překrýt obsah. Focus trap, Escape a návrat focusu na původní kartu.

Pořadí: název + celý skutečný termín → 2–4 konkrétní doložené přínosy → Kde Pokémony získat → výzkumy → bonusy/GO Pass → novinky/evoluce → skutečný zdroj a stav aktualizace. Přínosy mají být konkrétní odpovědi, ne jen názvy sekcí jako v ilustraci. Pokud není podklad, kartu vynechat. Výzkum ani bonusy nesmějí být jen v patičce za dlouhým seznamem.

Desktop příroda a Incense vedle sebe, mobil pod sebou. Každá skupina má metodu a vlastní období. Aktivní časové okno předvybrat podle času uživatele; předchozí zpřístupnit. Celá akce seskupí období, neslije druhy do falešného souběhu. Stejný Pokémon může legitimně figurovat u různých metod. Aktuální datum nesmí přepnout minulou akci na vymyšlené „aktivní“ období.

Dlaždice druhů obdélníkové, jméno pod ilustrací, mírný rámeček; žádné dlouhé řady pilulek. Mobil raději grid 3 sloupců než pět nečitelných popisků z generovaného obrázku. Zobrazit všechny nabídne zbytek bez zavření modalu. Podmínky bonusů nikdy neuseknout ellipsis. Úkol/odměna jeden řádek desktop, mobil pod sebou.

Jedno kontextové CTA podle dat; zde může být prozkoumání nového druhu. Výzkum a GO Pass rozbalitelné, ale důležitý deadline je vždy viditelný nahoře. Nedoplňovat osobní postup, pokud jej aplikace nemá.

## Odchylky obrázku, které NEpřebírat
- Zdroj v obrázku „Niantic“ je chyba generátoru: ověřený zdroj této revize je LeekDuck.
- Datum v hero je zkrácené: skutečný renderer musí ukázat také časy, rok podle kontextu a místní čas.
- „NÁVRH · DATA ZE ZDROJE“ je anotace konceptu, ne produktový štítek.
- Ilustrace Pokémonů jsou generované; v aplikaci použít stávající správné sprity a přesné formy.
- Neopisovat tvrzení o četnosti spawnů z obrázku bez opory ve zdroji.

## Původ grafiky
Vestavěný imagegen. Prompt: moderní tmavý ATLAS detail Fall Marathon: Buddy Trek, desktop dialog a mobil, podzimní hero, tři stručné priority, samostatně wild a Incense, aktuální/předchozí/celé období, rozbalitelné výzkumy/GO Pass/novinky, žádné vymyšlené číselné bonusy a postup uživatele. Výsledek vyžaduje výše uvedené korekce při implementaci.
