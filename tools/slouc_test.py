# -*- coding: utf-8 -*-
"""Vytáhne vzhledovou vrstvu z ručně upravované testovací kopie do vlastních
souborů, aby se testovací verze dala skládat z AKTUÁLNÍHO enginu.

Proč: dokud vzhled žil uvnitř `pokemon_tracker_TEST.html`, byla to zamrzlá
kopie celé appky. Každá oprava v produkci se do testu musela přenášet ručně
a merge dvaadvaceti tisíc řádků nikdo dělat nechce. Po tomhle přesunu je
vzhled ve třech souborech a test se sestaví jedním příkazem:

    python tools/slouc_test.py        (jednorázově — přesune vrstvu)
    python tools/sync_reference.py --test

Co se odkud bere (hranice jsou v té kopii jednoznačné):
  * `<style id="atlas-design">` … poslední styl před `<body>`  -> atlas.css
  * `window.ATLAS_ART = {...}`                                  -> atlas-art.json
  * zbytek posledního `<script>`                                -> atlas.js

Engine se nepřenáší. Ta kopie ho měla na deseti místech upravený zevnitř;
co z toho bylo rozhodování (kontrola vstupu, plán kusu), umí engine sám
a vrstva si to bere jako `validationIssues` a `planKusu()`.

Spouštět opakovaně nemá smysl a skript to hlídá: když vrstva už ve vlastních
souborech je, řekne to a nic nepřepíše.
"""
import io
import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
TEST = ROOT / "web-app" / "pokemon_tracker_TEST.html"
ATLAS = ROOT / "web-app" / "atlas"

# Hlavička, kterou skript pozná vlastní výstup a nepřepíše ruční úpravy.
ZNACKA = "/* Vytaženo z pokemon_tracker_TEST.html (tools/slouc_test.py). */"

# Most mezi jmény, která vrstva čekala, a tím, co engine opravdu nabízí.
# Vrstva `computed` NEPŘEPISUJE — dostane vlastní obohacenou kopii.
SHIM = ZNACKA + '''
/* Vzhledová vrstva appky. Zapéká se do testovací verze při buildu
   (tools/sync_reference.py --test). Engine se odsud NEUPRAVUJE — co chybí,
   doplní se do enginu jako pojmenované pole i s testem.
   Kontrakt: docs/ATLAS_KONTRAKT.md */
(function () {
  "use strict";
  if (!window.__pgo) return;
  document.body.classList.add("atlas-test");

  /* Obrázky se do appky nezapékají (třicet megabajtů). Když nejsou,
     vrstva musí pořád jít — chybí jen art u vybraného kusu. */
  window.ATLAS_ART = window.ATLAS_ART || {};

  /* Engine vrací `jenZnamka` (drží ho jen CUTE nebo 100 %) a plán kusu
     samostatnou funkcí. Vrstva čekala `cuteOnly` a `activePlan` přímo na
     vyhodnoceném kusu, tak se jí připraví obohacená KOPIE — do enginu se
     tím nesahá a jeho verdikty zůstávají jeho. */
  var puvodni = window.__pgo.getComputed;
  window.__pgo.getComputed = function () {
    var c = puvodni.apply(window.__pgo, arguments);
    var plany = {};
    try { plany = window.__pgo.planKusu(); } catch (e) { plany = {}; }
    var out = {};
    Object.keys(c).forEach(function (id) {
      var z = c[id], kopie = {};
      Object.keys(z).forEach(function (k) { kopie[k] = z[k]; });
      kopie.cuteOnly = !!z.jenZnamka;
      kopie.activePlan = plany[id] || null;
      out[id] = kopie;
    });
    return out;
  };
})();

'''


def hlavni():
    if not TEST.exists():
        raise SystemExit("Testovací kopie %s neexistuje — není co přesouvat." % TEST)
    ATLAS.mkdir(parents=True, exist_ok=True)

    css_out = ATLAS / "atlas.css"
    js_out = ATLAS / "atlas.js"
    art_out = ATLAS / "atlas-art.json"

    hotovo = js_out.exists() and ZNACKA in js_out.read_text(encoding="utf-8")
    if hotovo and "--znovu" not in sys.argv:
        print("Vrstva už ve vlastních souborech je. Přepsat: --znovu")
        return

    text = TEST.read_text(encoding="utf-8", errors="replace")

    # ---------- styly ----------
    zac = text.find('<style id="atlas-design">')
    if zac < 0:
        raise SystemExit("V kopii není <style id=\"atlas-design\"> — jiná struktura, "
                         "přesuň vrstvu ručně podle docs/PREDANI_ASTRA_10_9.md")
    telo_body = text.find("<body", zac)
    css_usek = text[zac:telo_body]
    # z úseku vytáhnout obsah všech <style> bloků
    css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", css_usek, re.S)).strip()
    if not css:
        raise SystemExit("Styly se nepodařilo vytáhnout.")

    # ---------- skripty ----------
    # Vrstva má vlastní <script id="atlas-app">, obrázky sedí ve svém.
    # Hledá se podle obsahu, ne podle pořadí — `rfind("<script>")` mine
    # otevírací značku s atributem a vytáhne se pak jen půlka.
    def telo_skriptu(kde):
        zac = text.find(">", kde) + 1
        kon = text.find("</script>", zac)
        return text[zac:kon] if kon > 0 else ""

    skripty = [(m.start(), m.group(0)) for m in re.finditer(r"<script[^>]*>", text)]
    ui, art = "", ""
    for kde, znacka in skripty:
        # Engine v té kopii má taky `atlas*` funkce, takže se nesmí hledat
        # podle obsahu — bralo by se celých 1,4 MB enginu. Vrstva má vlastní
        # značku `id="atlas-app"`; obrázky se poznají podle proměnné.
        jeUI = 'id="atlas-app"' in znacka or "id='atlas-app'" in znacka
        telo = telo_skriptu(kde) if (jeUI or "ATLAS_ART" in text[kde:kde + 400]) else ""
        if not telo:
            continue
        if "window.ATLAS_ART" in telo and not art:
            m = re.search(r"window\.ATLAS_ART\s*=\s*", telo)
            i = telo.index("{", m.end())
            hloubka, j = 0, i
            while j < len(telo):
                if telo[j] == "{":
                    hloubka += 1
                elif telo[j] == "}":
                    hloubka -= 1
                    if hloubka == 0:
                        break
                j += 1
            art = telo[i:j + 1]
            zbytek_art = (telo[:m.start()] + telo[j + 1:].lstrip(";").lstrip()).strip()
            if zbytek_art:
                ui = (ui + "\n" + zbytek_art).strip()
        elif jeUI:
            ui = (ui + "\n" + telo).strip()
    zbytek = ui
    if not zbytek:
        raise SystemExit("Skript vrstvy se nenašel — jiná struktura, "
                         "přesuň vrstvu ručně podle docs/PREDANI_ASTRA_10_9.md")

    # ---------- zapsat ----------
    css_out.write_text(ZNACKA + "\n" + css + "\n", encoding="utf-8")
    js_out.write_text(SHIM + zbytek.strip() + "\n", encoding="utf-8")

    obrazku = 0
    if art:
        try:
            data = json.loads(art)
            obrazku = len(data)
            art_out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            print("  obrázky se nepodařilo přečíst jako JSON (%s) — nechávám je být" % e)

    print("styly:    %d znaků -> %s" % (len(css), css_out.name))
    print("vrstva:   %d znaků -> %s" % (len(zbytek), js_out.name))
    print("obrázky:  %d kusů -> %s" % (obrazku, art_out.name if obrazku else "(žádné)"))
    print()
    print("Dál:  python tools/sync_reference.py --test")
    print("      a pak smaž web-app/pokemon_tracker_TEST.html — od téhle chvíle")
    print("      ho vyrábí build z aktuálního enginu.")


if __name__ == "__main__":
    hlavni()
