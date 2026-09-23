# -*- coding: utf-8 -*-
"""Cislo verze appky.

Produkce a test maji vlastni cislo a test je vzdy o krok napred: co je
v testu, to produkce teprve dostane. Diky tomu se da na prvni pohled
poznat, jestli mam pred sebou uz nasazenou verzi, nebo tu rozpracovanou.

    python tools/verze.py            -> vypise obe cisla
    python tools/verze.py --povysit  -> produkce dostane cislo testu,
                                        test jde o jednu vys

`--povysit` vola `tools/deploy.ps1` sam pri nasazeni, rucne neni potreba.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOUBOR = ROOT / "data" / "verze.json"


def nacti():
    return json.loads(SOUBOR.read_text(encoding="utf-8"))


def verze(testovaci):
    """Cislo pro sestaveni: test ma svoje, produkce svoje."""
    d = nacti()
    return d["test"] if testovaci else d["produkce"]


def dalsi(cislo):
    """2.1 -> 2.2. Drzi se dvou cisel, nic slozitejsiho appka nepotrebuje."""
    hlavni, _, vedlejsi = cislo.partition(".")
    return "%s.%d" % (hlavni, int(vedlejsi or 0) + 1)


def povysit():
    """Produkce dostane cislo testu, test jde o jednu vys."""
    d = nacti()
    stara = dict(d)
    d["produkce"] = d["test"]
    d["test"] = dalsi(d["test"])
    SOUBOR.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    return stara, d


if __name__ == "__main__":
    if "--povysit" in sys.argv:
        stara, nova = povysit()
        print("produkce: %s -> %s" % (stara["produkce"], nova["produkce"]))
        print("test:     %s -> %s" % (stara["test"], nova["test"]))
    else:
        d = nacti()
        print("produkce: " + d["produkce"])
        print("test:     " + d["test"])
