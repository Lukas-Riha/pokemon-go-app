# Pravidla předávání Astra ↔ Claude

Uživatel schválil 9. 9. 2026:

- Astra zapisuje úkoly pro Claude do `PREDANI_CLAUDE_OD_ASTRY.md`, s trvalými ID **A-001**, **A-002** atd.
- Claude zapisuje úkoly pro Astru do `PREDANI_ASTRA.md`, s trvalými ID **C-001**, **C-002** atd.
- ID se nepřečíslovávají ani znovu nepoužívají. U každého úkolu uvést stav, zadání, soubory a podmínku dokončení.
- Odpověď odkazuje na původní ID. Uživatel dostane jen název souboru a konkrétní ID k přečtení, nikoliv kopii technického předání.
- Soubor není automatická zpráva ani automatické spuštění druhého agenta. Předání čeká, dokud ho příjemce skutečně nepřečte a nepotvrdí.
- Nepsat současně do stejného výstupu. TEST sestavuje Astra během integrace UI. Produkce zůstává zamčená.
- Každý další návrh UI doprovodit obrázkovým náhledem PC/mobilu podle rozsahu změny.
