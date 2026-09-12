# -*- coding: utf-8 -*-
"""Ikony typů do data/type_icons.json.

Zdroj: https://github.com/partywhale/pokemon-type-icons (MIT, © 2022 James
Watkins) — ruční SVG rekonstrukce herních typových symbolů. Herní PNG od
Nianticu použít nejde: jsou to jejich assety a appka se sdílí dál. Tahle
sada je pod MIT, takže se smí zabalit i redistribuovat; podmínkou je
uvést copyright, což appka dělá v kartě „Odkud se to bere".

Z každého souboru se bere JEN bílý symbol (třída cls-1). Kolečko si appka
kreslí sama v barvě typu, kterou používá všude jinde — jinak by ikony
měly jiné odstíny než zbytek rozhraní.

Spuštění:
    python tools/build_typ_ikony.py            # použije cache, když existuje
    python tools/build_typ_ikony.py --refresh  # stáhne znovu
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "type_icons"
OUT = ROOT / "data" / "type_icons.json"
BASE = "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/"
LICENCE = "MIT © 2022 James Watkins — github.com/partywhale/pokemon-type-icons"

TYPY = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting",
        "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost",
        "Dragon", "Dark", "Steel", "Fairy"]


def stahni(refresh):
    RAW.mkdir(parents=True, exist_ok=True)
    out = {}
    for typ in TYPY:
        soubor = RAW / (typ.lower() + ".svg")
        if refresh or not soubor.exists():
            print("stahuji %s.svg …" % typ.lower())
            req = urllib.request.Request(
                BASE + typ.lower() + ".svg",
                headers={"User-Agent": "pokemon-go-planner (local build)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                soubor.write_bytes(r.read())
        out[typ] = soubor.read_text(encoding="utf-8")
    return out


def symbol(svg, typ):
    """Vytáhne z SVG jen symbol, bez podkladového kolečka a bez stylů.

    Podklad se pozná jako `<circle r="128">` (celá plocha), ne podle barvy —
    „bílá" je v každém souboru jiná (#fff, #fbfdfd, …). Všechno ostatní je
    symbol. Barva se nechává na appce, takže se z tvarů odstraní `class`
    i `fill` — obarví je `<g fill>` kolem.

    Vrací dvojici (vnitřek, viewBox)."""
    vb = re.search(r'viewBox="([^"]+)"', svg)
    telo = svg.split("</defs>")[-1]
    kusy = []
    for m in re.finditer(r"<(path|circle|ellipse|polygon|polyline|rect)\b([^>]*?)/?>", telo):
        tag, atr = m.group(1), m.group(2)
        if tag == "circle" and re.search(r'\br="128(\.0+)?"', atr):
            continue                      # podkladové kolečko
        atr = re.sub(r'\s*class="[^"]*"', "", atr)
        atr = re.sub(r'\s*fill="[^"]*"', "", atr)
        kusy.append("<%s%s/>" % (tag, atr.rstrip("/").rstrip()))
    if not kusy:
        raise SystemExit("%s: v souboru není žádný tvar se symbolem" % typ)
    return "".join(kusy), (vb.group(1) if vb else "0 0 256 256")


def main():
    refresh = "--refresh" in sys.argv
    svgy = stahni(refresh)
    ikony, viewboxy = {}, set()
    for typ in TYPY:
        vnitrek, vb = symbol(svgy[typ], typ)
        ikony[typ] = vnitrek
        viewboxy.add(vb)
    if len(viewboxy) != 1:
        raise SystemExit("ikony mají různé viewBoxy: %s" % viewboxy)
    data = {"_meta": {"zdroj": BASE, "licence": LICENCE,
                      "pozn": "Regeneruj: python tools/build_typ_ikony.py --refresh"},
            "viewBox": viewboxy.pop(), "ikony": ikony}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print("ikon: %d, viewBox %s, velikost %d B -> %s"
          % (len(ikony), data["viewBox"], OUT.stat().st_size, OUT))


if __name__ == "__main__":
    main()
