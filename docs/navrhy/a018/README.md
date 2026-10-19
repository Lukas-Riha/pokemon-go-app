# Vyhledávání — jemné doladění skutečné stránky

7. 10. 2026. Pouze obrazový návrh, bez změn aplikace.

Podkladem je přiložený skutečný snímek lokálního TESTu v2.10 s Eevee. Návrh zachovává pořadí: hledání → identita a statistiky → čtyři CP karty → sekce → role → ligy → výsledky. Ruší se doporučení A-017 přesouvat CP do vedlejšího rozbalovacího panelu: uživatel chce současnou strukturu zachovat.

## Pět drobných zásahů

1. CP karty: popisky, čísla a levely mají pevné společné řádky. Počasí nesmí posouvat hlavní číslo. Zachovat všechny čtyři hodnoty i jejich kontext.
2. Identita: vyrovnané odsazení obrázku, statů, hodnocení a shiny. Zjemnit zelenou a okraje, zachovat viditelné staty.
3. Záložky: hlavní sekce s podtržením, bojové role s klidnou podkladovou plochou, liga nadále zřetelně vybraná modře. Neměnit texty ani logiku.
4. Tabulka: o něco čitelnější jméno a rank, tišší doplňkový text, jemné dělení řádků. Zachovat viditelné útoky, tlačítka i všechny evoluce.
5. Povrchy: zjemnit okraje vnořených panelů a sjednotit mezery. Les v menu, hlavička a celkové rozložení zůstávají.

Tooltipy nejsou na zachycené obrazovce otevřené, tento návrh proto nedokládá jejich upravený stav. Jejich případné doladění potřebuje vlastní snímek.

## Soubory

- `vyhledavani-skutecny-stav.png`: neupravovaný snímek aplikace.
- `vyhledavani-jemne-doladeni.png`: obrazová úprava tohoto snímku pomocí vestavěného image_gen.
- `PROMPT.txt`: přesné zadání nástroji.

Generovaný návrh není zdrojem čísel, ranků ani textů do aplikace. Případné odchylky generátoru se nepřebírají; skutečné hodnoty a sprite obrázky zůstávají z aplikace. Návrh není schválený k implementaci.
