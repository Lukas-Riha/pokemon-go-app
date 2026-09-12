# -*- coding: utf-8 -*-
"""Pískoviště — testovací verze appky, která NIKDY nejde na OneDrive.

K čemu to je: zkoušet změny, u kterých ještě nevíš, jestli je chceš. Ostrá
appka zůstane nedotčená, ANet o pokusech neví.

Jak to funguje: testovací soubor se VYGENERUJE z ostré appky a na ni se
navrch nalepí pokusy z web-app/pokusy/*.py. Nedrží se tedy druhá kopie, která
by se rozešla — pokus je vždycky nad aktuální ostrou verzí. Když se pokus
osvědčí, přesune se do normálního patch skriptu a ze složky pokusy zmizí.

    python tools/pisek.py                 vygeneruje pískoviště
    python tools/pisek.py --seznam        vypíše, jaké pokusy jsou k dispozici
    python tools/pisek.py --bez menu      vygeneruje bez pokusu "menu"
    python tools/pisek.py --jen menu      jen ten jeden pokus

Výsledek: web-app/pokemon_tracker_TEST.html  (otevři dvojklikem)

Každý pokus je soubor web-app/pokusy/<jmeno>.py s funkcí:

    NAZEV = "krátký popis do hlavičky"
    def uprav(html: str) -> str: ...

Když pokus spadne nebo nenajde, co hledá, skript to řekne a pokračuje
s ostatními — jeden rozbitý pokus nezablokuje zbytek.
"""
import importlib.util
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OSTRA = ROOT / "web-app" / "pokemon_tracker_app.html"
TEST = ROOT / "web-app" / "pokemon_tracker_TEST.html"
POKUSY = ROOT / "web-app" / "pokusy"

# Vizuální razítko, aby se testovací verze nedala splést s ostrou. Sedí
# na okraj stránky, takže nezavazí, ale je pořád vidět.
RAZITKO = """
<style>
  .pisek-pas { position: fixed; left: 0; top: 0; bottom: 0; width: 6px; z-index: 999;
    background: repeating-linear-gradient(45deg, #d08a1f 0 10px, #6b4a12 10px 20px); }
  .pisek-stitek { position: fixed; left: 10px; bottom: 10px; z-index: 999;
    background: #d08a1f; color: #241a05; font: 700 11px/1 system-ui, sans-serif;
    padding: 6px 10px; border-radius: 6px; letter-spacing: .06em;
    box-shadow: 0 2px 10px rgba(0,0,0,.4); cursor: help; }
</style>
<div class="pisek-pas"></div>
<div class="pisek-stitek" title="__POPIS__">PÍSKOVIŠTĚ — nejde na OneDrive</div>
"""


def nacti_pokusy(jen=None, bez=None):
    if not POKUSY.exists():
        return []
    out = []
    for cesta in sorted(POKUSY.glob("*.py")):
        jmeno = cesta.stem
        if jmeno.startswith("_"):
            continue
        if jen and jmeno not in jen:
            continue
        if bez and jmeno in bez:
            continue
        spec = importlib.util.spec_from_file_location("pokus_" + jmeno, cesta)
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except Exception as e:
            print("   CHYBA při načítání pokusu %s: %s" % (jmeno, e))
            continue
        if not hasattr(mod, "uprav"):
            print("   pokus %s nemá funkci uprav(html) — přeskočeno" % jmeno)
            continue
        out.append((jmeno, getattr(mod, "NAZEV", jmeno), mod.uprav))
    return out


def zkontroluj_syntaxi(html):
    """Rychlá kontrola, že vygenerovaný JavaScript vůbec jde načíst.

    Bez toho se rozbitý pokus pozná až v prohlížeči podle prázdné stránky
    a hledá se pak dlouho. Potřebuje node; když není, kontrola se přeskočí."""
    import subprocess
    import tempfile
    zac = html.find("<script>")
    kon = html.rfind("</script>")
    if zac < 0 or kon < 0:
        return None
    js = html[zac + len("<script>"):kon]
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js)
        cesta = f.name
    try:
        r = subprocess.run(["node", "--check", cesta], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=60)
        if r.returncode == 0:
            return None
        radky = [x for x in (r.stderr or "").splitlines() if x.strip()]
        return " | ".join(radky[:4])
    except FileNotFoundError:
        return None
    except Exception as e:
        return "kontrolu se nepodařilo spustit: %s" % e
    finally:
        try:
            Path(cesta).unlink()
        except Exception:
            pass


def main():
    args = sys.argv[1:]
    jen = set()
    bez = set()
    if "--jen" in args:
        jen = set(args[args.index("--jen") + 1:])
    if "--bez" in args:
        bez = set(args[args.index("--bez") + 1:])

    if not OSTRA.exists():
        print("Nenašel jsem ostrou appku: %s" % OSTRA)
        sys.exit(1)
    POKUSY.mkdir(parents=True, exist_ok=True)

    pokusy = nacti_pokusy(jen or None, bez or None)

    if "--seznam" in args:
        print("pokusy ve složce web-app/pokusy:")
        for jmeno, nazev, _ in nacti_pokusy():
            print("   %-16s %s" % (jmeno, nazev))
        if not nacti_pokusy():
            print("   (zatím žádné)")
        return

    html = OSTRA.read_text(encoding="utf-8")
    puvodni_delka = len(html)
    hotove, spadle = [], []
    for jmeno, nazev, uprav in pokusy:
        try:
            nove = uprav(html)
            if nove == html:
                print("   %-16s NIC NEZMĚNIL (hledaný kus v appce není?)" % jmeno)
                spadle.append(jmeno)
                continue
            html = nove
            hotove.append((jmeno, nazev))
            print("   %-16s %s" % (jmeno, nazev))
        except Exception as e:
            print("   %-16s SPADL: %s" % (jmeno, e))
            spadle.append(jmeno)

    popis = "; ".join(n for _, n in hotove) if hotove else "bez pokusů, čistá kopie"
    # POZOR na první vs. poslední: v kódu taháku je řetězec "</body></html>",
    # takže replace od začátku vlepí razítko doprostřed JavaScriptu a appka
    # se rozsype. Musí se to lepit na POSLEDNÍ výskyt.
    konec = html.rfind("</body>")
    if konec < 0:
        print("   POZOR: nenašel jsem </body>, razítko se nepřidalo")
    else:
        html = html[:konec] + RAZITKO.replace("__POPIS__", popis) + html[konec:]
    html = html.replace("<title>", "<title>[TEST] ", 1)

    chyba = zkontroluj_syntaxi(html)
    if chyba:
        print()
        print("   VYGENEROVANÝ SOUBOR MÁ ROZBITÝ JAVASCRIPT:")
        print("   " + chyba)
        print("   Soubor se přesto uloží, ať se dá kouknout, co je špatně.")

    TEST.write_text(html, encoding="utf-8")

    print()
    print("pískoviště: %s" % TEST)
    print("   %d pokusů nalepeno, %d neprošlo, velikost %d B (ostrá %d B)"
          % (len(hotove), len(spadle), len(html), puvodni_delka))
    print("   Ostrá appka ani OneDrive se nezměnily. Otevři dvojklikem.")
    if spadle:
        print("   Neprošly: " + ", ".join(spadle))


if __name__ == "__main__":
    main()
