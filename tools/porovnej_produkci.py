# -*- coding: utf-8 -*-
"""Dukaz, ze v produkci lezi presne to, co se do ni poslalo.

Nasazeni neni slucovani, je to prestaveni appky z tehoz zdroje — bud
probehne cele, nebo spadne. Zbyva ale jedna vec, kterou okem nepoznas:
jestli se na GitHub Pages doopravdy dostal kazdy soubor. Presne tohle
uz jednou selhalo (slozka `atlas/assets` se do `publish/` vubec
nekopirovala a produkce mela jinou grafiku nez test).

Skript stahne zivou appku soubor po souboru a porovna ji s tim, co je
ve slozce `publish/` — tedy s tim, co posledni nasazeni poslalo.

    python tools/porovnej_produkci.py
    python tools/porovnej_produkci.py --adresa https://…/

Konce radku se pred porovnanim srovnaji: Git na Windows hlida `publish/`
v CRLF, kdezto na Pages lezi soubor s LF. Je to tyz obsah.

Skonci nulou, kdyz je produkce 1:1. Jinak vypise, co chybi nebo sedi jinak.
"""
import hashlib
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLISH = ROOT / "publish"
ADRESA = "https://lukas-riha.github.io/pokemon-go-app/"

# Co se pri porovnani nesmi rozhodit o konce radku. Binarni soubory
# (obrazky) se porovnavaji presne, tam by nahrada bajtu byla chyba.
TEXTOVE = {".html", ".js", ".json", ".webmanifest", ".css", ".svg", ".txt"}


def otisk(data, textovy):
    if textovy:
        data = data.replace(b"\r\n", b"\n")
    return len(data), hashlib.sha256(data).hexdigest()


def stahni(url):
    zadost = urllib.request.Request(url, headers={
        # Bez tohohle by se mohla vratit odpoved z mezipameti a porovnani
        # by mluvilo o necem jinem, nez co na Pages opravdu lezi.
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "User-Agent": "pokemon-go-planner/porovnej_produkci",
    })
    with urllib.request.urlopen(zadost, timeout=120) as odp:
        return odp.status, odp.read()


def main():
    adresa = ADRESA
    if "--adresa" in sys.argv:
        adresa = sys.argv[sys.argv.index("--adresa") + 1]
    if not adresa.endswith("/"):
        adresa += "/"

    if not PUBLISH.is_dir():
        raise SystemExit("STOP: slozka publish/ neexistuje - spust tools/build_publish.py")

    soubory = sorted(p for p in PUBLISH.rglob("*") if p.is_file())
    if not soubory:
        raise SystemExit("STOP: publish/ je prazdna.")

    print("produkce: " + adresa)
    print("porovnava se s: " + str(PUBLISH))
    print("")

    spatne = []
    for cesta in soubory:
        rel = cesta.relative_to(PUBLISH).as_posix()
        textovy = cesta.suffix.lower() in TEXTOVE
        mistni = otisk(cesta.read_bytes(), textovy)
        try:
            stav, data = stahni(adresa + rel)
        except urllib.error.HTTPError as e:
            spatne.append("%s: produkce vraci HTTP %s" % (rel, e.code))
            print("  CHYBI  %s (HTTP %s)" % (rel, e.code))
            continue
        except Exception as e:                                    # noqa: BLE001
            spatne.append("%s: nepodarilo se stahnout (%s)" % (rel, e))
            print("  CHYBA  %s (%s)" % (rel, e))
            continue
        zivy = otisk(data, textovy)
        if stav != 200:
            spatne.append("%s: HTTP %s" % (rel, stav))
            print("  CHYBA  %s (HTTP %s)" % (rel, stav))
        elif zivy == mistni:
            print("  OK     %s (%d B)" % (rel, mistni[0]))
        else:
            spatne.append("%s: jiny obsah (%d B vs %d B)" % (rel, zivy[0], mistni[0]))
            print("  JINE   %s (produkce %d B, publish %d B)" % (rel, zivy[0], mistni[0]))

    print("")
    if spatne:
        print("PRODUKCE NENI 1:1 (%d z %d souboru):" % (len(spatne), len(soubory)))
        for x in spatne:
            print("  " + x)
        return 1
    print("Produkce je 1:1 s poslednim nasazenim (%d souboru)." % len(soubory))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
