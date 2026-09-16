"""Kontrola, že se sestavy Týmu GO Rocket OPRAVDU obnovují.

Scraper je jediné místo, které se rozbije tiše: pokemondb změní strukturu
stránky, parser vrátí prázdno a appka dál radí proti sestavám z loňska.
Tenhle test proto nekontroluje jen výsledný soubor, ale i to, že parser na
uložené stránce pořád funguje — a že se zastaví, když je stránka rozbitá.

Spuštění:  python tests/raketa.test.py
"""
import importlib.util
import io
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

passed = 0
failures = []


def check(nazev, ok, detail=""):
    global passed
    if ok:
        passed += 1
        print("  ok   " + nazev)
    else:
        failures.append(nazev + (" -> " + str(detail) if detail else ""))
        print("  FAIL " + nazev + (" -> " + str(detail) if detail else ""))


def nacti_modul():
    cesta = ROOT / "tools" / "build_raketa.py"
    spec = importlib.util.spec_from_file_location("build_raketa", cesta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


print("\n1) parser na ulozene strance porad funguje")
mod = nacti_modul()
RAW = ROOT / "data" / "raw" / "pokemondb_shadow.html"
check("stazena stranka je v repu", RAW.exists(), str(RAW))
dok = RAW.read_text(encoding="utf-8", errors="replace") if RAW.exists() else ""
tab = mod.tabulky(dok)
check("na strance jsou aspon dve tabulky", len(tab) >= 2, len(tab))

grunti = []
if len(tab) >= 2:
    for r in mod.radky(tab[0])[1:]:
        b = mod.bunky(r)
        if len(b) < 5:
            continue
        q = re.search(r"<q[^>]*>(.*?)</q>", b[1], re.S)
        if not q:
            continue
        grunti.append({"typ": mod.cisty(b[0]), "hlaska": mod.cisty(q.group(1)),
                       "sloty": [mod.jmena_z_bunky(b[2]), mod.jmena_z_bunky(b[3]),
                                 mod.jmena_z_bunky(b[4])]})
check("parser vytahne aspon patnact gruntu", len(grunti) >= 15, len(grunti))
check("kazdy grunt ma hlasku", all(g["hlaska"] for g in grunti),
      [g["typ"] for g in grunti if not g["hlaska"]][:3])
check("kazdy grunt ma aspon jeden slot obsazeny",
      all(any(g["sloty"]) for g in grunti),
      [g["typ"] for g in grunti if not any(g["sloty"])][:3])

print("\n2) rozbita stranka parser ZASTAVI, netvari se, ze je vse v poradku")
check("prazdny dokument nevrati zadnou tabulku", len(mod.tabulky("<html></html>")) == 0)
check("tabulka bez radku nevrati nic", len(mod.radky("<table></table>")) == 0)
check("bunka bez obrazku a odkazu nevrati jmeno",
      mod.jmena_z_bunky("<td>nic</td>") == [], mod.jmena_z_bunky("<td>nic</td>"))

print("\n3) vysledny soubor sedi s tim, co parser vidi")
OUT = ROOT / "data" / "raketa.json"
check("data/raketa.json existuje", OUT.exists(), str(OUT))
data = json.load(io.open(OUT, encoding="utf-8")) if OUT.exists() else {}
check("v souboru je stejne gruntu jako v HTML",
      len(data.get("grunti") or []) == len(grunti),
      "%d v souboru vs %d v HTML" % (len(data.get("grunti") or []), len(grunti)))
check("jsou tam i vudci", len(data.get("vudci") or []) >= 3,
      len(data.get("vudci") or []))
# Tataz hlaska u dvou gruntu je v poradku — zdroj vede zvlast muzskou
# a zenskou variantu se stejnou vetou a jinou sestavou. Chyba by byl
# DOSLOVA stejny radek, to uz je zdvojeny parser.
cele = [json.dumps(g, sort_keys=True, ensure_ascii=False)
        for g in data.get("grunti") or []]
check("zadny grunt tam neni dvakrat cely", len(set(cele)) == len(cele),
      "%d unikatnich z %d" % (len(set(cele)), len(cele)))
hlasky = [g.get("hlaska") for g in data.get("grunti") or []]
check("hlasek je vic nez typu (kazda neco rika)",
      len(set(hlasky)) >= 15, len(set(hlasky)))

print("\n4) datum stazeni dava smysl")
stazeno = (data.get("_meta") or {}).get("stazeno") or ""
check("datum je vyplnene", bool(stazeno), stazeno)
if stazeno:
    try:
        stari = (date.today() - date.fromisoformat(stazeno)).days
        check("datum neni z budoucnosti", stari >= 0, stari)
        # Jen upozorneni, ne chyba: ceho se to tyka, rekne audit dat.
        if stari > 45:
            print("  pozn: sestavy jsou %d dni stare" % stari)
    except ValueError:
        check("datum je ve tvaru RRRR-MM-DD", False, stazeno)

print("\n%d kontrol proslo, %d selhalo" % (passed, len(failures)))
if failures:
    for f in failures:
        print("  x " + f)
    sys.exit(1)
