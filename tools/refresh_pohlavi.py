"""Obnoví seznam druhů, u kterých se samec a samice LIŠÍ VZHLEDEM.

Není to odhad ani ručně opsaný seznam z wiki: berou se čísla druhů, pro
která má mirror PokeMiners vlastní obrázek samice (`pm<id>[.f<FORMA>].g2…`).
Když tedy appka pohlaví nabízí, je i z čeho vzít jinou ikonu.

Spuštění:
    python tools/refresh_pohlavi.py           # jen vypíše, co by se změnilo
    python tools/refresh_pohlavi.py --zapsat  # přepíše seznam v appce
"""

import json
import pathlib
import re
import sys
import urllib.request

KOREN = pathlib.Path(__file__).resolve().parent.parent
APPKA = KOREN / "web-app" / "pokemon_tracker_app.html"
STROM = "https://api.github.com/repos/PokeMiners/pogo_assets/git/trees/master?recursive=1"
ZNACKA = "  var POHLAVI_ROZDIL = {"


def stahni_ids() -> dict[int, int]:
    """Čísla druhů, která mají v mirroru obrázek samice."""
    zadost = urllib.request.Request(STROM, headers={"User-Agent": "pokemon-go-planner"})
    with urllib.request.urlopen(zadost, timeout=120) as odpoved:
        data = json.load(odpoved)
    if data.get("truncated"):
        raise SystemExit("GitHub vrátil zkrácený strom — seznam by byl neúplný.")
    g2: set[int] = set()
    female: set[int] = set()
    for polozka in data.get("tree", []):
        cesta = polozka.get("path", "")
        if "/Addressable Assets/" not in cesta or not cesta.endswith(".icon.png"):
            continue
        jmeno = cesta.split("/")[-1]
        nalez = re.match(r"pm(\d+)\.", jmeno)
        if not nalez:
            continue
        cislo = int(nalez.group(1))
        if ".g2." in jmeno:
            g2.add(cislo)
        elif ".fFEMALE." in jmeno:
            female.add(cislo)
    # 1 = soubor „…g2…" (gen 1–5), 2 = „…fFEMALE…" (gen 6+)
    return {i: (1 if i in g2 else 2) for i in sorted(g2 | female)}


def soucasne() -> dict[int, int]:
    text = APPKA.read_text(encoding="utf-8")
    zacatek = text.index(ZNACKA) + len(ZNACKA)
    konec = text.index("}", zacatek)
    return {int(k): int(v) for k, v in re.findall(r'"(\d+)":(\d)', text[zacatek:konec])}


def zapis(ids: dict[int, int]) -> None:
    text = APPKA.read_text(encoding="utf-8")
    zacatek = text.index(ZNACKA) + len(ZNACKA)
    konec = text.index("}", zacatek)
    novy = ",".join('"%d":%d' % (i, ids[i]) for i in sorted(ids))
    APPKA.write_bytes((text[:zacatek] + novy + text[konec:]).encode("utf-8"))


def main() -> None:
    nove = stahni_ids()
    stare = soucasne()
    pribylo = [i for i in nove if i not in stare]
    ubylo = [i for i in stare if i not in nove]
    print(f"v mirroru: {len(nove)} druhů · v appce: {len(stare)}")
    if pribylo:
        print("přibylo:", pribylo)
    if ubylo:
        print("ubylo:", ubylo)
    if not pribylo and not ubylo:
        print("beze změny")
        return
    if "--zapsat" in sys.argv:
        zapis(nove)
        print("seznam v appce přepsán — nezapomeň na tools/sync_reference.py --test")
    else:
        print("nic se nezapsalo; spusť s --zapsat")


if __name__ == "__main__":
    main()
