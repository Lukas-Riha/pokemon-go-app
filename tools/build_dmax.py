"""Stáhne žebříček Dynamax útočníků po typech a upeče z něj data/dmax.json.

Proč: pořadí Dmax kusů si appka do teď počítala sama — poškozením podle typu
a výdrží, protože žádný zdroj, ze kterého čte, Max Battle neřeší. Byl to
poctivý odhad, ale pořád odhad. Pokémon GO Hub svůj žebříček publikuje přímo
v HTML (ne doplňovaný JavaScriptem), takže se dá číst stejně jako akce
z LeekDucku.

Co z toho appka navíc získá: **seznam druhů, které Dynamax vůbec umí**. Ten
dosud nebyl nikde — appka poznala Dmax kus jen podle značky, kterou nastavil
sken nebo člověk.

Čísla jsou MODEL POKÉMON GO HUBU, ne appky: „Max Move Damage" si počítají oni
a appka ho nepřepočítává. Všude, kde se ukazuje, musí být napsané odkud je.

Zdroj: https://db.pokemongohub.net/best/dynamax-attackers-per-type

Spuštění:
    python tools/build_dmax.py              # použije cache v data/raw/
    python tools/build_dmax.py --refresh    # stáhne znovu
"""
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "dmax.html"
OUT = ROOT / "data" / "dmax.json"
URL = "https://db.pokemongohub.net/best/dynamax-attackers-per-type"

# Kolik typů stránka vede. Když jich najdeme výrazně míň, změnila se struktura
# a je lepší skončit chybou než zapéct půlku dat — denní úloha pak vrátí zálohu.
MIN_TYPU = 15
MIN_RADKU = 3

HLAVICKA = re.compile(
    r'<h1 id="([a-z]+)"[^>]*>\s*Top\s+\d+\s+([A-Za-z]+)-type\s+Dynamax\s+Attackers\s*</h1>',
    re.I)
TBODY = re.compile(r"<tbody>(.*?)</tbody>", re.S | re.I)
RADEK = re.compile(r"<tr>(.*?)</tr>", re.S | re.I)
BUNKA = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
TITULEK = re.compile(r'title="([^"]+?)\s+stats[^"]*"', re.I)
ODKAZ = re.compile(r'href="/pokemon/([^"]+)"', re.I)


def text(html):
    """Holý text buňky: značky pryč, entity zpátky, mezery srovnané."""
    t = re.sub(r"<[^>]+>", " ", html or "")
    t = (t.replace("&amp;", "&").replace("&nbsp;", " ")
         .replace("&#x27;", "'").replace("&quot;", '"')
         .replace("&lt;", "<").replace("&gt;", ">"))
    return re.sub(r"\s+", " ", t).strip()


def cislo(s):
    m = re.search(r"-?\d+(?:[.,]\d+)?", s or "")
    if not m:
        return None
    return float(m.group(0).replace(",", "."))


def stahni(refresh):
    """HTML ze sítě, nebo z cache. Cache je tu kvůli opakovanému spouštění
    (přegenerování z týchž dat nesmí sahat na síť)."""
    if refresh or not RAW.exists():
        req = urllib.request.Request(URL, headers={
            "User-Agent": "Mozilla/5.0 (pokemon-go-planner data refresh)"})
        html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        RAW.parent.mkdir(parents=True, exist_ok=True)
        RAW.write_text(html, encoding="utf-8")
        return html
    return RAW.read_text(encoding="utf-8")


def rozloz_jmeno(cele):
    """„Gigantamax Snorlax" → (Snorlax, Gigantamax). Bez předpony to není
    Max útočník, ale normální druh — takový řádek se zahazuje."""
    for forma in ("Gigantamax", "Dynamax"):
        if cele.lower().startswith(forma.lower() + " "):
            return cele[len(forma) + 1:].strip(), forma
    return cele.strip(), ""


def sekce(html):
    """Rozkrájí stránku na úseky podle nadpisu typu."""
    nalez = list(HLAVICKA.finditer(html))
    out = []
    for i, m in enumerate(nalez):
        konec = nalez[i + 1].start() if i + 1 < len(nalez) else len(html)
        out.append((m.group(2).capitalize(), html[m.end():konec]))
    return out


def radky_typu(usek):
    """Řádky první tabulky v úseku. Druhá tabulka (kdyby přibyla) se ignoruje
    schválně — žebříček je ten první."""
    tb = TBODY.search(usek)
    if not tb:
        return []
    out = []
    for rm in RADEK.finditer(tb.group(1)):
        syrovy = rm.group(1)
        bunky = BUNKA.findall(syrovy)
        if len(bunky) < 5:
            continue
        poradi = cislo(text(bunky[0]))
        tm = TITULEK.search(bunky[1])
        cele = text(tm.group(1)) if tm else text(bunky[1])
        druh, forma = rozloz_jmeno(cele)
        if not druh or not forma or poradi is None:
            continue
        om = ODKAZ.search(bunky[1])
        out.append({
            "poradi": int(poradi),
            "druh": druh,
            "forma": forma,
            "rychly": text(bunky[2]),
            "nabity": text(bunky[3]),
            "poskozeni": cislo(text(bunky[4])),
            "faze": cislo(text(bunky[5])) if len(bunky) > 5 else None,
            "odkaz": om.group(1) if om else "",
        })
    return out


def main():
    refresh = "--refresh" in sys.argv
    html = stahni(refresh)
    typy = {}
    for nazev, usek in sekce(html):
        r = radky_typu(usek)
        if len(r) >= MIN_RADKU:
            typy[nazev] = r

    if len(typy) < MIN_TYPU:
        print("CHYBA: našlo se jen %d typů (čekám aspoň %d) — stránka se "
              "nejspíš přestavěla a parser je potřeba opravit." % (len(typy), MIN_TYPU))
        return 1

    # Index podle druhu: kde všude stojí a jak vysoko. Z něj appka pozná
    # i to, že druh Dynamax vůbec umí.
    druhy = {}
    for typ, seznam in typy.items():
        for r in seznam:
            z = druhy.setdefault(r["druh"], {"forma": r["forma"], "role": []})
            # Gigantamax je „víc" než Dynamax: když druh umí obojí, drží se G-Max.
            if r["forma"] == "Gigantamax":
                z["forma"] = "Gigantamax"
            # Forma je u KAŽDÉHO záznamu: Charizard stojí ve Fire dvakrát —
            # jako Gigantamax #2 a jako Dynamax #10. Bez toho by to vypadalo
            # jako tentýž pokémon na dvou místech.
            z["role"].append({"typ": typ, "poradi": r["poradi"],
                              "poskozeni": r["poskozeni"], "forma": r["forma"]})
    for z in druhy.values():
        z["role"].sort(key=lambda x: x["poradi"])

    out = {
        "_meta": {
            "zdroj": URL,
            "staženo": date.today().isoformat(),
            "model": "Max Move Damage počítá Pokémon GO Hub, ne appka.",
            "pozn": "Regeneruj přes: python tools/build_dmax.py --refresh",
        },
        "typy": typy,
        "druhy": druhy,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n",
                   encoding="utf-8")
    print("typů: %d, druhů: %d, řádků: %d"
          % (len(typy), len(druhy), sum(len(v) for v in typy.values())))
    print("zapsáno: %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
