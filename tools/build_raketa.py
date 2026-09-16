"""Stáhne sestavy Týmu GO Rocket a upeče z nich data/raketa.json.

Proč scraper a ne ručně opsaný seznam: hlášky i sestavy se mění s každou
rocket akcí. Ručně psaný seznam by vydržel do první změny a pak by tiše
lhal — a přesně takové seznamy jsme z appky tenhle týden dvakrát vyhazovali
(mega priority, raidoví útočníci). Tohle se obnoví jedním příkazem.

Co se z toho v appce dělá: hláška grunta prozradí typ, takže se dá dopředu
říct, koho postavit. Appka k hlášce dopočítá countery z ROSTERU — proto se
tu ukládají jen jména a typy, žádné doporučení.

Zdroj: https://pokemondb.net/go/shadow

Spuštění:
    python tools/build_raketa.py              # použije cache v data/raw/
    python tools/build_raketa.py --refresh    # stáhne znovu
"""
import html as htmllib
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "pokemondb_shadow.html"
OUT = ROOT / "data" / "raketa.json"
URL = "https://pokemondb.net/go/shadow"


def stahni(refresh):
    RAW.parent.mkdir(parents=True, exist_ok=True)
    if refresh or not RAW.exists():
        print("stahuji", URL, "…")
        req = urllib.request.Request(
            URL, headers={"User-Agent": "Mozilla/5.0 (pokemon-go-planner data build)"})
        with urllib.request.urlopen(req, timeout=90) as r:
            RAW.write_bytes(r.read())
    return RAW.read_text(encoding="utf-8", errors="replace")


def cisty(text):
    return htmllib.unescape(re.sub(r"<[^>]+>", " ", text or "")).strip()


def jmena_z_bunky(bunka):
    """Jména pokémonů z buňky. Bere se `alt` obrázku, protože odkaz nese
    i rozlišení formy („Alolan Sandshrew"), které je v alt textu celé."""
    out = []
    for m in re.finditer(r'<img[^>]*alt="([^"]+)"', bunka):
        jm = htmllib.unescape(m.group(1)).strip()
        if jm and jm not in out:
            out.append(jm)
    if out:
        return out
    # Bez obrázku (textová buňka) — spadne se na odkazy.
    for m in re.finditer(r'<a[^>]*href="/pokedex/[^"]*"[^>]*>(.*?)</a>', bunka, re.S):
        jm = cisty(m.group(1))
        if jm and jm not in out:
            out.append(jm)
    return out


def tabulky(dokument):
    return re.findall(r"<table.*?</table>", dokument, re.S)


def radky(tabulka):
    return re.findall(r"<tr>(.*?)</tr>", tabulka, re.S)


def bunky(radek):
    return re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", radek, re.S)


def main():
    dok = stahni("--refresh" in sys.argv)
    tab = tabulky(dok)
    if len(tab) < 2:
        raise SystemExit("STOP: na stránce nejsou dvě tabulky (grunti + vůdci) —"
                         " pokemondb nejspíš změnil strukturu.")

    grunti = []
    for r in radky(tab[0])[1:]:
        b = bunky(r)
        if len(b) < 5:
            continue
        typ = cisty(b[0])
        # Hláška je v <q>; bez ní je řádek k ničemu, protože podle ní se
        # grunt ve hře pozná.
        q = re.search(r"<q[^>]*>(.*?)</q>", b[1], re.S)
        hlaska = cisty(q.group(1)) if q else cisty(b[1])
        if not typ or not hlaska:
            continue
        grunti.append({
            "typ": typ,
            "hlaska": hlaska,
            "sloty": [jmena_z_bunky(b[2]), jmena_z_bunky(b[3]), jmena_z_bunky(b[4])],
        })

    vudci = []
    for r in radky(tab[1])[1:]:
        b = bunky(r)
        if len(b) < 4:
            continue
        jm = cisty(b[0])
        if not jm:
            continue
        vudci.append({
            "jmeno": jm,
            "sloty": [jmena_z_bunky(b[1]), jmena_z_bunky(b[2]), jmena_z_bunky(b[3])],
        })

    if len(grunti) < 10:
        raise SystemExit("STOP: vypadlo jen %d gruntů — parser nejspíš oslepl."
                         % len(grunti))
    if len(vudci) < 3:
        raise SystemExit("STOP: vypadli jen %d vůdci — parser nejspíš oslepl."
                         % len(vudci))

    out = {
        "_meta": {
            "zdroj": URL,
            "stazeno": date.today().isoformat(),
            "pozn": "Regeneruj přes: python tools/build_raketa.py --refresh",
            "schema_grunt": "{typ, hlaska, sloty: [[1. slot], [2. slot], [3. slot]]}",
            "schema_vudce": "{jmeno, sloty: [[1. slot], [2. slot], [3. slot]]}",
        },
        "grunti": grunti,
        "vudci": vudci,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n",
                   encoding="utf-8")
    print("gruntů: %d, vůdců: %d -> %s (%d B)"
          % (len(grunti), len(vudci), OUT, OUT.stat().st_size))
    print("typy:", ", ".join(sorted(set(g["typ"] for g in grunti))))


if __name__ == "__main__":
    main()
