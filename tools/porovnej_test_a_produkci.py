# -*- coding: utf-8 -*-
"""Je v produkci opravdu tataz appka jako v testu?

`porovnej_produkci.py` odpovida na "dorazilo na Pages to, co jsme poslali".
Tohle je o krok dal a odpovida na tu otazku, ktera cloveka doopravdy zajima:
"je ta ziva appka tataz, kterou mam v testu?"

Obe sestaveni vznikaji z jednoho zdroje a lisi se jen v peti vecech:
prefix uloziste (`pgo_test_`), vlajka testovaciho buildu, nazev zalozky
s `[TEST] `, rozsviceni testovacich odznaku a cislo verze a razitko
sestaveni. Skript tyhle znamé rozdily srovna a zbytek porovna znak po
znaku. Kdyz neco nesedi, vypise, ve kterem miste a co tam kazdy z nich ma.

    python tools/porovnej_test_a_produkci.py
    python tools/porovnej_test_a_produkci.py --adresa https://…/

Skonci nulou, kdyz je produkce tataz appka jako test.
"""
import difflib
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEST = ROOT / "web-app" / "pokemon_tracker_TEST.html"
ADRESA = "https://lukas-riha.github.io/pokemon-go-app/"


def stahni(url):
    zadost = urllib.request.Request(url, headers={
        "Cache-Control": "no-cache", "Pragma": "no-cache",
        "User-Agent": "pokemon-go-planner/porovnej_test_a_produkci",
    })
    with urllib.request.urlopen(zadost, timeout=180) as odp:
        return odp.read().decode("utf-8", "replace")


def srovnej(text):
    """Odstrani znamé rozdily mezi testem a produkci."""
    # Prefix uloziste: test pise do `pgo_test_`, produkce do `pgo_`.
    text = text.replace("pgo_test_", "pgo_")
    # Vlajka testovaciho buildu a nazev zalozky s [TEST].
    text = re.sub(r'window\.__ATLAS_TEST_BUILD\s*=\s*(true|false)\s*;?', '', text)
    text = re.sub(r"window\.__ATLAS_TEST_NAZEV\s*=\s*'[^']*'\s*;?", '', text)
    text = text.replace("[TEST] ", "")
    # Testovaci odznaky: v produkci zustavaji schované, v testu se rozsviti.
    text = re.sub(r'\s*data-atlas-test-badge(="[^"]*")?', '', text)
    text = re.sub(r'\s*hidden(?=[\s>])', '', text)
    # Cislo verze a razitko sestaveni se lisi zamerne.
    text = re.sub(r'var VERZE = "[^"]*"', 'var VERZE = "X"', text)
    text = re.sub(r'var BUILD = "[^"]*"', 'var BUILD = "X"', text)
    # Konce radku a prazdne radky, ktere po vyskrtani zbyly.
    text = text.replace("\r\n", "\n")
    text = re.sub(r"\n[ \t]*\n+", "\n", text)
    return text


def main():
    adresa = ADRESA
    if "--adresa" in sys.argv:
        adresa = sys.argv[sys.argv.index("--adresa") + 1]

    if not TEST.exists():
        raise SystemExit("STOP: %s neexistuje - spust tools/sync_reference.py --test" % TEST)

    print("test:     " + str(TEST))
    print("produkce: " + adresa)
    print("")

    t = srovnej(TEST.read_text(encoding="utf-8"))
    p = srovnej(stahni(adresa))

    if t == p:
        print("Produkce je tataz appka jako test (%d znaku po srovnani "
              "znamych rozdilu)." % len(t))
        return 0

    tr, pr = t.split("\n"), p.split("\n")
    print("LISI SE: test %d radku, produkce %d radku" % (len(tr), len(pr)))
    print("")
    kus = 0
    for blok in difflib.SequenceMatcher(None, tr, pr, autojunk=False).get_opcodes():
        tag, i1, i2, j1, j2 = blok
        if tag == "equal":
            continue
        kus += 1
        if kus > 10:
            print("  ... a dalsi")
            break
        print("  radek %d (%s):" % (i1 + 1, tag))
        for r in tr[i1:i2][:2]:
            print("    test:     " + r.strip()[:150])
        for r in pr[j1:j2][:2]:
            print("    produkce: " + r.strip()[:150])
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
