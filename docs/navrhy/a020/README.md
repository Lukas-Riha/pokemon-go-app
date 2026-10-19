# Kalendář — tři pohledy a společné ovládání období

8. 10. 2026. Pouze návrhy, bez změny aplikace. Termíny v návrzích pocházejí z lokálního data/events.json, nejsou v tomto kole nezávisle ověřené proti aktuální hře.

## Společný přepínač

`Dnes | ‹ | 5.–11. října 2026 ▾ | ›` a oddělený segment `Týden | Měsíc | Seznam`.

- Šipky mění období: týden/seznam o sedm dní, měsíc o měsíc. V seznamu je výslovně vidět rozsah týdne; nejde o nekonečnou agendu, kde by šipky byly nejasné.
- Datum otevře malý výběr dne s měsíční mřížkou a rychlou volbou Dnes. Volba dne zachová režim, zobrazí příslušné období a označí den.
- Přepnutí pohledu zachová datum, kategorii i vybranou akci, pokud se vejde do nového období. Jinak detail přejde do výzvy k výběru, nikoli na náhodnou událost.
- Mobil: datum a šipky na jednom řádku; segment pohledů na dalším. Cíle alespoň 44 px jako návrhový komfortní cíl. Přejetí je jen doplněk, ne jediné ovládání.
- Dnešek: malá tečka nebo obrys. Vybraný den: modrý podklad. Tyto stavy nezaměňovat. Návrhy mají vybraný čtvrtek 8. 10. 2026.

## 1. Měsíc — kdy se vyplatí hrát

Po–Ne, skutečný počet potřebných týdnů. Říjen 2026 má při pondělním začátku pět řádků od 28. 9. do 1. 11. Na desktopu buňka obsahuje číslo a nejvýše 2–3 krátké položky (čas, název, barevná kategorie). Žádné obrázky uvnitř buněk. Zbytek odkaz +N další otevírá program dne; neztrácí události.

Vícedenní krátké akce v souvislém pruhu, na hranici týdne pokračování. Dlouhé sezóny jednou v části Probíhá tento měsíc pod mřížkou. Neodvozovat počet +N ze všech dat bez filtru; počítat skutečně nezobrazené položky daného dne a kategorie. Stanovit stabilní pořadí a nekopírovat tutéž událost do buňky i jejího pruhu bez důvodu.

Vybraný den otevře vpravo program, ne automaticky celý detail první akce. Klik na konkrétní akci otevře náhled/detail podle stávajícího chování. Na mobilu mřížka s čísly a značkami, program dne pod ní. Obrazový návrh vynechává část událostí kvůli čitelnosti, není vzorem pro zahazování dat.

## 2. Týden — co běží v konkrétní čas

Výchozí pohled desktopu. Sedm sloupců a stejné denní hlavičky pro obě části. Nejprve časované akce s malou ilustrací, jménem a časem, potom vícedenní pruhy. Všechny dosavadní vícedenní události zůstávají dostupné; nevracet automatické sbalení proti předchozímu přání uživatele.

Vyhnout se hodinové mřížce 00–24, protože většina dnů má málo akcí. Čas napsat na kartu. Napravo kompaktní vybraná událost a jedno hlavní CTA. Na mobilu týdenní pás dnů a program vybraného dne; neprůstřelné datové vazby jako desktop, ne sedm miniaturních sloupců.

## 3. Seznam — rychle projít program

Agenda zvoleného týdne, skupiny podle dnů. Každá krátká akce: obrázek, jméno, čas, kategorie, otevření detailu. Jeden přínos jen tehdy, když je doložený a patří do daného okna. V tomto návrhu nejsou domyšlené bonusy.

Vícedenní akce společně v části Probíhá v tomto týdnu, s konkrétními intervaly. U jednotlivých dnů lze ukázat odkaz Probíhá také, který seznam zúží na daný den; neopakovat plnou kartu sezóny sedmkrát. Dny bez krátké akce nevydávat za dny bez obsahu. Zachovat možnost zobrazit jejich probíhající akce.

Na telefonu toto doporučuji jako nejpohodlnější alternativu k týdennímu pásu. Uživatelova ruční volba režimu má přednost před automatickým přepnutím podle šířky.

## Podkladová data pro ilustrace

- 5. 10. Sizzlipede, 06:00–21:00.
- 7. 10. raidová hodina Yveltal, 18:00–19:00.
- 8. 10. hodina Elgyem, 18:00–19:00.
- 10. 10. Zorua Community Day, 14:00–17:00.
- Yveltal a Mega Blastoise: 7. 10. 06:00 až 13. 10. 22:00.
- 12. 10. Rookidee, 06:00–21:00; 14. 10. Dialga 18:00–19:00; 15. 10. Stufful 18:00–19:00; 17. 10. Sandile 11:00–17:00.

## Před realizací

Odsouhlasit všechny tři pohledy; společné datum a filtry mají jediný stav. Ověřit přelomy měsíců/roku, změnu času, událost bez hodin, překryvy, prázdný filtr, více než tři akce za den a dlouhý název. Návrhy negarantují přesnost typografie či kalendářních čísel generátoru: aplikace musí všechny buňky, pruhy a termíny generovat z dat.

Obrázky vytvořeny vestavěným image_gen. Případné generované chybné popisky nebo datumy nejsou implementační zadání. Autoritativní je tato specifikace a datový model.

### Upřesnění proti generovaným obrázkům

Týdenní obrázek slouží hlavně jako návrh ovladače a výběru data. Generátor zjednodušil geometrické zarovnání: implementace musí mít skutečných sedm sloupců a pruhy Yveltal/Mega Blastoise od středy, ne od začátku týdne. Sizzlipede patří do Max, nikoli Chytání; Twilight Trails je sezóna, nikoli speciální výzkum. Popover dne musí mít správné kalendářní datumy z knihovny/modelu, ne opisovat generovanou mřížku. Navigace všech návrhů má zůstat jednotná podle specifikace, drobné odchylky ikon a pořadí v obrázcích nepřebírat.
