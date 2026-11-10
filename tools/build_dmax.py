"""Stáhne žebříček Dynamax útočníků po typech a upeče z něj data/dmax.json.

Proč: pořadí Dmax kusů si appka do teď počítala sama — poškozením podle typu
a výdrží, protože žádný zdroj, ze kterého čte, Max Battle neřeší. Byl to
poctivý odhad, ale pořád odhad. Pokémon GO Hub svůj žebříček publikuje přímo
v HTML (ne doplňovaný JavaScriptem), takže se dá číst stejně jako akce
z LeekDucku.

Co z toho appka navíc získá: **seznam druhů, které Dynamax vůbec umí**. Ten
dosud nebyl nikde — appka poznala Dmax kus jen podle značky, kterou nastavil
sken nebo člověk.

Čte se stránka jednoho typu: `pokemon-list/best-dynamax-per-type/<typ>`.
Má **CELÝ** žebříček (u Normal 44 řádků) i s Hubovou známkou SS…F. Dokud
se četla souhrnná stránka `best/dynamax-attackers-per-type`, měla appka jen
top 10 na typ — druh jako Feebas v ní nebyl vůbec a v appce to vypadalo, že
Max formu nemá. Souhrn se už nečte: Hub z něj mezitím sloupec „Max Move
Damage" odstranil, takže nenesl nic navíc.

Pořadí i známka jsou MODEL POKÉMON GO HUBU, ne appky — všude, kde se
ukazují, musí být napsané odkud jsou.

Spuštění:
    python tools/build_dmax.py              # použije cache v data/raw/
    python tools/build_dmax.py --refresh    # stáhne znovu
"""
import json
import re
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_TYP = ROOT / "data" / "raw"
OUT = ROOT / "data" / "dmax.json"
URL_TYP = "https://db.pokemongohub.net/pokemon-list/best-dynamax-per-type/%s"

# Pořadí odpovídá hře; velké písmeno je klíč, pod kterým typ zná appka.
TYPY = ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug",
        "Ghost", "Steel", "Fire", "Water", "Grass", "Electric", "Psychic",
        "Ice", "Dragon", "Dark", "Fairy"]

# Kolik typů stránka vede. Když jich najdeme výrazně míň, změnila se struktura
# a je lepší skončit chybou než zapéct půlku dat — denní úloha pak vrátí zálohu.
MIN_TYPU = 15
MIN_RADKU = 3
# Celý žebříček má přes tři stovky řádků. Když jich najdeme pár desítek,
# parser trefil jinou tabulku a data by byla horší než ta minulá.
MIN_RADKU_CELKEM = 200

TBODY = re.compile(r"<tbody>(.*?)</tbody>", re.S | re.I)
RADEK = re.compile(r"<tr>(.*?)</tr>", re.S | re.I)
BUNKA = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
TITULEK = re.compile(r'title="([^"]+?)\s+stats[^"]*"', re.I)
ODKAZ = re.compile(r'href="/pokemon/([^"]+)"', re.I)

# Stránka jednoho typu je stavěná jinak: buňky nesou `data-column-id`
# a sloupec se známkou má `rowSpan`, takže u druhého a dalšího řádku téže
# známky chybí. Nese se proto dolů.
BUNKA_ID = re.compile(r'<td data-column-id="([a-z_]+)"[^>]*>(.*?)</td>', re.S | re.I)
ZNAMKA = re.compile(r'data-tier="([A-Z]{1,2})"')
JMENO_CHIP = re.compile(r'data-pokemon-chip-name="true">([^<]+)<')


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


def _stahni(url, cesta, refresh):
    """HTML ze sítě, nebo z cache. Cache je tu kvůli opakovanému spouštění
    (přegenerování z týchž dat nesmí sahat na síť)."""
    if refresh or not cesta.exists():
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (pokemon-go-planner data refresh)"})
        html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        cesta.parent.mkdir(parents=True, exist_ok=True)
        cesta.write_text(html, encoding="utf-8")
        time.sleep(0.4)
        return html
    return cesta.read_text(encoding="utf-8")


def rozloz_jmeno(cele):
    """„Gigantamax Snorlax" → (Snorlax, Gigantamax). Bez předpony to není
    Max útočník, ale normální druh — takový řádek se zahazuje."""
    for forma in ("Gigantamax", "Dynamax"):
        if cele.lower().startswith(forma.lower() + " "):
            return cele[len(forma) + 1:].strip(), forma
    return cele.strip(), ""


def radky_typu(html):
    """Celý žebříček jednoho typu ze stránky `best-dynamax-per-type/<typ>`."""
    tb = TBODY.search(html)
    if not tb:
        return []
    out = []
    znamka = ""
    for rm in RADEK.finditer(tb.group(1)):
        syrovy = rm.group(1)
        bunky = dict(BUNKA_ID.findall(syrovy))
        if "attacker_name" not in bunky or "order" not in bunky:
            continue
        # Známka drží přes `rowSpan`: stojí jen u prvního řádku skupiny.
        zm = ZNAMKA.search(bunky.get("tier", ""))
        if zm:
            znamka = zm.group(1)
        jm = JMENO_CHIP.search(bunky["attacker_name"])
        druh, forma = rozloz_jmeno(text(jm.group(1)) if jm else text(bunky["attacker_name"]))
        poradi = cislo(text(bunky["order"]))
        if not druh or not forma or poradi is None:
            continue
        om = ODKAZ.search(bunky["attacker_name"])
        out.append({
            "poradi": int(poradi),
            "druh": druh,
            "forma": forma,
            "rychly": text(bunky.get("qm_name", "")),
            "nabity": text(bunky.get("cm_name", "")),
            "znamka": znamka,
            "odkaz": om.group(1) if om else "",
        })
    return out


def main():
    refresh = "--refresh" in sys.argv
    typy = {}
    for nazev in TYPY:
        cesta = RAW_TYP / ("dmax_%s.html" % nazev.lower())
        try:
            html = _stahni(URL_TYP % nazev.lower(), cesta, refresh)
        except Exception as e:                                # noqa: BLE001
            print("  typ %s se nestáhl: %s" % (nazev, e))
            continue
        r = radky_typu(html)
        if len(r) >= MIN_RADKU:
            typy[nazev] = r

    celkem = sum(len(v) for v in typy.values())
    if len(typy) < MIN_TYPU or celkem < MIN_RADKU_CELKEM:
        print("CHYBA: našlo se jen %d typů a %d řádků (čekám aspoň %d / %d) — "
              "stránka se nejspíš přestavěla a parser je potřeba opravit."
              % (len(typy), celkem, MIN_TYPU, MIN_RADKU_CELKEM))
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
                              "znamka": r["znamka"], "forma": r["forma"]})
    for z in druhy.values():
        z["role"].sort(key=lambda x: x["poradi"])

    out = {
        "_meta": {
            "zdroj": URL_TYP % "<typ>",
            "staženo": date.today().isoformat(),
            "model": "Pořadí i známku (SS…F) počítá Pokémon GO Hub, ne appka.",
            "pozn": "Regeneruj přes: python tools/build_dmax.py --refresh",
        },
        "typy": typy,
        "druhy": druhy,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n",
                   encoding="utf-8")
    print("typů: %d, druhů: %d, řádků: %d" % (len(typy), len(druhy), celkem))
    print("zapsáno: %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
