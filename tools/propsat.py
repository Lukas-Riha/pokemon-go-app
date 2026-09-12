# -*- coding: utf-8 -*-
"""Propsání pokusu z pískoviště do ostré appky.

Pokus se aplikuje na `web-app/pokemon_tracker_app.html` úplně stejně, jako se
aplikoval do pískoviště — takže to, co jsi odsouhlasil v testu, je přesně to,
co skončí v produkci. Soubor pokusu se pak přesune do `web-app/pokusy/hotovo/`,
ať se nenalepuje podruhé.

    python tools/propsat.py menu utoky      propíše jmenované pokusy
    python tools/propsat.py --vse           propíše všechny
    python tools/propsat.py --seznam        jen vypíše, co je k dispozici

Po propsání pusť testy a deploy — skript sám nic nenasazuje.
"""
import importlib.util
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OSTRA = ROOT / "web-app" / "pokemon_tracker_app.html"
POKUSY = ROOT / "web-app" / "pokusy"
HOTOVO = POKUSY / "hotovo"

# V produkci už to není pokus, tak ať to tak nevypadá ani v komentářích.
PREJMENOVAT = [
    ("// ---------- POKUS: ", "// ---------- "),
    ("/* ---------- POKUS: ", "/* ---------- "),
]


def nacti(jmeno):
    cesta = POKUSY / (jmeno + ".py")
    if not cesta.exists():
        return None
    spec = importlib.util.spec_from_file_location("pokus_" + jmeno, cesta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def zkontroluj_syntaxi(html):
    zac, kon = html.find("<script>"), html.rfind("</script>")
    if zac < 0 or kon < 0:
        return None
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(html[zac + len("<script>"):kon])
        cesta = f.name
    try:
        r = subprocess.run(["node", "--check", cesta], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=60)
        if r.returncode == 0:
            return None
        return " | ".join([x for x in (r.stderr or "").splitlines() if x.strip()][:4])
    except FileNotFoundError:
        return None
    finally:
        try:
            Path(cesta).unlink()
        except Exception:
            pass


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dostupne = sorted(c.stem for c in POKUSY.glob("*.py") if not c.stem.startswith("_"))

    if "--seznam" in sys.argv or (not args and "--vse" not in sys.argv):
        print("pokusy k propsání:")
        for j in dostupne:
            mod = nacti(j)
            print("   %-14s %s" % (j, getattr(mod, "NAZEV", "") if mod else "(nejde načíst)"))
        if not dostupne:
            print("   (žádné — pískoviště je prázdné)")
        if not args and "--vse" not in sys.argv:
            print("\nPoužití: python tools/propsat.py <jmeno> [...]  nebo  --vse")
        return

    vybrane = dostupne if "--vse" in sys.argv else args
    chybi = [j for j in vybrane if j not in dostupne]
    if chybi:
        print("Tyhle pokusy neznám: " + ", ".join(chybi))
        sys.exit(1)

    html = OSTRA.read_text(encoding="utf-8")
    puvodni = len(html)
    hotove = []
    for jmeno in vybrane:
        mod = nacti(jmeno)
        if not mod or not hasattr(mod, "uprav"):
            print("   %-14s nejde načíst — přeskočeno" % jmeno)
            continue
        try:
            nove = mod.uprav(html)
        except Exception as e:
            print("   %-14s SPADL: %s" % (jmeno, e))
            sys.exit(1)
        if nove == html:
            print("   %-14s nic nezměnil — je už propsaný?" % jmeno)
            continue
        html = nove
        hotove.append((jmeno, getattr(mod, "NAZEV", jmeno)))
        print("   %-14s %s" % (jmeno, getattr(mod, "NAZEV", jmeno)))

    if not hotove:
        print("\nNic k propsání.")
        return

    for co, cim in PREJMENOVAT:
        html = html.replace(co, cim)

    chyba = zkontroluj_syntaxi(html)
    if chyba:
        print("\nVÝSLEDEK MÁ ROZBITÝ JAVASCRIPT — do produkce nic nezapisuju:")
        print("   " + chyba)
        sys.exit(1)

    OSTRA.write_text(html, encoding="utf-8")
    HOTOVO.mkdir(parents=True, exist_ok=True)
    for jmeno, _ in hotove:
        shutil.move(str(POKUSY / (jmeno + ".py")), str(HOTOVO / (jmeno + ".py")))

    print()
    print("propsáno do %s" % OSTRA.name)
    print("   %d pokusů, velikost %d B (bylo %d B)" % (len(hotove), len(html), puvodni))
    print("   soubory pokusů přesunuty do web-app/pokusy/hotovo/")
    print()
    print("Teď:  node tests/web_app.test.mjs")
    print("      python tools/pisek.py          (pískoviště bude čistá kopie)")
    print("      powershell -ExecutionPolicy Bypass -File tools\\deploy.ps1")


if __name__ == "__main__":
    main()
