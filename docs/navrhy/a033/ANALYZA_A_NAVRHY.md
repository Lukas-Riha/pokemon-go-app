# A033 — UI audit a návrh Nastavení / Transferu
2. 11. 2026. Návrh, nikoli implementace. Aplikace nebyla změněna.

## Rozsah a měřítko
Lokální TEST 2.13 ve fresh Playwright profilu: desktop 1500×1000; roster a vyhledávání také 500×1000. Roster ověřen vestavěnými třemi demo kusy, nikoli osobním rosterem. Externí sprity se v prostředí nenačetly — jejich absenci nezapočítávám do skóre. Nejde o audit správnosti výpočtů, WCAG ani výkonu velkého rosteru. Kalendář hodnocen v týdenním pohledu; měsíc/seznam v tomto kole nejsou kompletně prověřené. Subjektivní skóre UI: 5 funkční, ale neuhlazené; 7 dobrý základ; 8 dotažené s konkrétními dluhy; 9 výborné. 10 je aspirace, nikoli objektivně nezlepšitelný produkt či certifikace trendů roku 2026.

| Sekce | Skóre | Závěr |
|---|---:|---|
| Přehled | 7/10 | Silná atmosféra, nedotažené rozměry obsahu |
| Pokémoni | 7,5/10 | Dobré karty, příliš složitá horní lišta |
| Kalendář | 7/10 | Užitečné pohledy, malé texty a velká hustota |
| Vyhledávání | 8/10 | Nejucelenější struktura, jemně doladit |
| Nastavení | 4/10 | Srozumitelnost nestačí složitosti voleb |
| Transfer | 5/10 | Funkce existují, hlavní úkol utopený v doplňcích |

## Přehled
Ponechat 3 obrazové akce, atmosféru navigace a propojení s kalendářem. Na screenshotu home.png titulek Halloween Part II ve dvou řádcích koliduje s popiskem bonusu: opravit skutečný tok textu, nikoli absolutní posuny. CTA zarovnat pomocí flex/grid, min-height místo pevné výšky textu. Dlouhý titulek testovat i s 200% zoomem. Bonus je anglicky — obsahová práce pro Clauda.
Karty jsou na desktopu velmi vysoké a první obrazovka téměř celá patří událostem. Zmenšit ilustraci, zachovat čitelnost a dostat nad přehyb i relevantní raidy/Max nebo další krok. Ilustrace louky u Halloweenu působí obecně: mapovat tematickou grafiku jen z explicitního typu/tématu, jinak neutrální pozadí. Prodloužené akce oddělit od krátkých dnešních příležitostí. Pruh lig má slabou hierarchii a drobný text; jasné Teď / Potom, výrazné názvy, tlumený termín. Hero titul je zbytečně velký vůči informacím pod ním.

## Pokémoni
Ponechat dlaždice a detail; není důvod další redesign. CP a jméno mají stabilní místo, typy/verdict se dobře hledají. Zjednodušit řazení: jeden výběr kritéria + přepnutí směru, případně 3 nejpoužívanější zkratky. Dnes CP↑/↓, A–Z/Z–A, IV↑/↓, L↑/↓ a role soupeří v jedné dlouhé řadě. Zrušit filtry zobrazovat nebo aktivovat jen při skutečném filtru.
Stav zálohy ponechat viditelný, ale běžný stav zmenšit do řádku s detailem; výstrahu používat při skutečném riziku. Prázdný roster dnes současně hlásí žádné výsledky filtrů, žádná data a instrukce k obnově: rozlišit první spuštění, prázdný výsledek a podezření na ztrátu dat. Nevyvozovat výkon ze tří demo kusů; před implementací ověřit reálných 200+ karet.

## Kalendář
Ponechat týden/měsíc/seznam, barevné kategorie a návaznost na detail. Horní ovládání sjednotit do stabilních zón: Dnes + šipky + interval / režim / typy. Výběr nesmí měnit pořadí ovladačů. Na desktopu je kalendář zúžen bočním detailem a sedm sloupců má malé popisy. Boční panel zobrazovat po výběru, možnost sbalit; na tabletu dolní panel. Nepoužívat sedm miniaturních sloupců pro 500 px, tam denní agenda. Vícedenní pruhy opticky oddělit od časovaných akcí; dlouhodobý sezonní obsah dát do sbalitelného pásu. Nevytvářet další carousel pro přepínání týdnů. Stav focus/selected poznat i jinak než barvou.

## Vyhledávání
Ponechat současnou kompozici. Nejlepší z posuzovaných sekcí: hledání → identita druhu → CP → podrobnosti. Změkčit zelenou Shiny dostupné, aby nebyla vizuálně silnější než hlavní hodnocení. Dvě úrovně záložek dnes používají téměř shodné podtržení: hlavní Přehled/Typy/Evoluce/Rozbor zachovat, sekundární PvP/Raidy/Gym/Mega/Max dát kompaktní segmentový přepínač. Méně vnořených rámů, více jemných oddělovačů. V ligách zdůraznit hledaný druh, ostatní evoluční stupně volitelně rozbalit. Na 500 px před výsledky zabírá identita a CP téměř celou obrazovku; nabídnout kompaktní CP sekci, zachovat dostupné údaje. Prázdné hledání doplnit posledními lokálními hledáními / příklady, nikoli doporučenými náhodnými Pokémony.

## Návrh Nastavení
Aktuální stav se liší od starého předání: už obsahuje několik sloupců a skupin, ale tři nové PvP pojistky stojí nahoře mimo skupiny. U třetí je viditelný opakovaný text o tiebreaku a nesouvisející dlouhé vysvětlení — Claude ověřit vazbu pole/text a opravit obsah v enginu.
Desktop: vnitřní navigace kategorií, vpravo vždy jedna oblast. Kategorie Ligy a PvP; Raidy, gym a Max; Kusy a kopie; Prach a vylepšování; Transfer a čištění; Data a zálohy. Vyhledávání napříč názvy i vysvětleními. Každé pole: název, krátké vysvětlení, zarovnaná hodnota, přesná jednotka, rozbalitelné původní podrobnosti. Žádné ořezání textu uprostřed řádku. Důležité podmínky neskrývat jen do hover tooltipů.
Mobil/tablet: kategorie jako přístupný výběr a jeden sloupec, nikoli boční menu zabírající půlku šířky. Číselné vstupy s validací; přepínače jen pro skutečné booleany. Prahy neměnit na nepřesné slidery. Zachovat současné automatické ukládání; nevymýšlet tlačítko Uložit, když se už změna provedla. Dopad na roster pouze ze skutečného výpočtu enginu, se stavy výpočet / žádná změna / změněné kusy. Reset má přesně říct rozsah, potvrzení a ideálně návrat hodnot.
Implementace: přesouvat existující uzly, neduplikovat ID, zachovat listenery, SETTING_IDS, skrytá pole i místa pro výstup enginu. Nové krátké texty na mockupu jsou návrh k autorizaci Claudem, nikoli hotová náhrada výkladu pravidel.

## Návrh Transferu
Aktuálně velký modal: před hlavním filtrem leží bonbóny z výměn, obecný trade-evolution filtr, vlastní předfiltry, ověření. Hlavní cíl je až dole. Obecný výměnný filtr může zahrnout ponechané kusy — vizuálně musí být oddělen od filtrů k puštění.
Navržený modal 1000–1150 px desktop, na 500 px plná šířka; stabilní header, scroll jen těla, přístupné zavření a návrat focusu. Pořadí: zdroj a jeho čas → počet kusů → hlavní filtry → pokročilé možnosti → pomocné výměnné filtry. Nabízet jen skutečně dostupné zdroje: čištění, smazané, import, roster. Ve vizuálu jsou reprezentativní 3; smazané musí implementace podporovat také. U zdroje smazané zachovat ruční potvrzení puštění ve hře, kopírování jej nikdy nesmí vyvolat.
Kategorie Hromadně / Po jednom / Nejdřív vyměnit s počty; při nenulové výměně může engine určit vhodné výchozí pořadí. Nulové kategorie neukazovat jako použitelné. Filtr: číslo dávky, počet kusů, readonly text, hlavní Kopírovat, rozbalit seznam kusů. Stav Zkopírováno není Pustil jsem ve hře. Ponechat existující kontrolu filtru vůči celému rosteru i pravidla vyloučených kusů. Neoznačovat filtr za bezpečný pro neznámé nové úlovky.
Ruční kontrolu dát do samostatné viditelné skupiny s počtem, důvodem a konkrétními kusy. Neschovávat ji mezi pokročilé volby. První ověření syntaxe musí být viditelné, pokud je engine vyžaduje; pozdější Ověřit znovu může být pokročilé. Limit dnešní dávky zachovat jako volbu. Prázdný stav odlišit dle důvodu: nic k puštění / hra nepovoluje / chybí data.

## Priority
1. Nastavení + Transfer jako hlavní návrhová práce.
2. Opravit kolizi textu homepage a vazby vysvětlení v Nastavení.
3. Zklidnit příkazy rosteru, prázdné stavy a stav záloh.
4. Typografie kalendáře a sjednocené ovládání.
5. Jemný polish Vyhledávání; bez celkové přestavby.

## Artefakty
navrh-nastaveni.png/.html a navrh-transfer.png/.html jsou samostatné statické vizuální koncepty. Nejsou napojené na engine, neobsahují všechny stavy ani kompletní nastavení. Screenshoty ostatních souborů zachycují lokální skutečný TEST, nikoli produkci. Při implementaci samostatně ověřit 500/768/1500 px, dlouhé české názvy, 200% zoom, klávesnici, světlé téma a plný roster.
