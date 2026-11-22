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
# Druhy, ktere Dynamax umi, ale Hub je nevede (Pikachu, Vespiquen, …).
NAVIC = ROOT / "data" / "dmax_navic.json"
POKEDEX = ROOT / "data" / "pokedex.json"
MOVES = ROOT / "data" / "moves.json"
# Gigantamax radek Hub hodnoti vys nez tyz druh jako Dynamax; namereno
# na Toxtricity (284 vs 221 = 1,285). Pouziva se jen na zarazeni
# dopocitanych radku mezi Hubove, ne na cislo samotne.
GMAX_BONUS = 1.285

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


# Hub pise jmeno formy pred druh („Crowned Sword Zacian"), appka za nej.
PREJMENOVANI = {
    "Crowned Sword Zacian": "Zacian Crowned Sword",
    "Crowned Shield Zamazenta": "Zamazenta Crowned Shield",
}


def rozloz_jmeno(cele):
    """„Gigantamax Snorlax" → (Snorlax, Gigantamax).

    Tri radky ze 317 predponu nemaji: Eternatus (Dragon #1, SS),
    Crowned Sword Zacian a Crowned Shield Zamazenta (Steel). Driv se
    zahazovaly jako „normalni druh" — Eternatus tak v appce chybel uplne
    a dopocet mu dal S misto Hubova SS (Lukas 21. 11. 2026). Radek v tehle
    tabulce je VZDYCKY Max utocnik, takze bez predpony je to Dynamax.
    """
    cele = cele.strip()
    for forma in ("Gigantamax", "Dynamax"):
        if cele.lower().startswith(forma.lower() + " "):
            jm = cele[len(forma) + 1:].strip()
            return PREJMENOVANI.get(jm, jm), forma
    return PREJMENOVANI.get(cele, cele), "Dynamax"


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
        # Sloupec „DMG": poskozeni jednoho Max utoku, podle nej Hub radi.
        sila = cislo(text(bunky.get("dynamax_maxMoveDamage", "")))
        out.append({
            "poradi": int(poradi),
            "druh": druh,
            "forma": forma,
            "sila": int(sila) if sila is not None else None,
            "rychly": text(bunky.get("qm_name", "")),
            "nabity": text(bunky.get("cm_name", "")),
            "znamka": znamka,
            "odkaz": om.group(1) if om else "",
        })
    return out


def _data(cesta):
    return json.loads(cesta.read_text(encoding="utf-8"))


def doplnit_navic(typy):
    """Druhy, ktere Hub nevede, ale ve hre Dynamax maji.

    Hubove cislo („damage of one Max Attack") je utok druhu krat STAB:
    na vsech 15 radcich Electricu sedi model na 2,5 %. Pro chybejici
    druhy se tedy spocita tataz sila a radek se zaradi tam, kam podle
    ni patri. Poradi i znamka pak nejsou Hubovy — radek si nese
    `dopocitano`, aby to appka mohla rict.
    """
    if not NAVIC.exists():
        return 0
    navic = _data(NAVIC).get("druhy") or []
    if not navic:
        return 0
    pd, mv = _data(POKEDEX), _data(MOVES)
    sp, learn, fast = pd["species"], mv["learn"], mv["fast"]
    cpm40 = pd["cpm"]["40"]

    def klic(jmeno):
        j = jmeno.split(" (")[0].strip().lower()
        for k in (j, j.replace(" ", "_"), j.replace(" ", ""), j.replace("-", "")):
            if k in sp:
                return k
        return None

    def sila(k, typ, forma):
        """Model Hubova „Max Attack damage": utok kusu s 15 IV na L40,
        bonus 1,2 za vlastni typ. Na Hubovych radcich sedi do 2,5 %,
        proto se jeste nasobi 0,976 — at se da porovnavat s jeho cisly."""
        if not k:
            return 0.0
        atk, vlastni = sp[k][3], sp[k][2]
        v = (atk + 15) * cpm40 * (1.2 if typ in vlastni else 1.0) * 0.976
        return v * (GMAX_BONUS if forma == "Gigantamax" else 1.0)

    def typy_utoku(k):
        """Typ Max utoku jde po rychlych utocich a po vlastnim typu —
        na Hubovych radcich to plati 314x ze 314."""
        z = learn.get(k) or [[], [], [], []]
        idx = list(z[0]) + list(z[2] if len(z) > 2 else [])
        ven = {fast[i][0] for i in idx if i < len(fast)}
        return ven | set(sp[k][2])

    pridano = 0
    for jmeno in navic:
        k = klic(jmeno)
        if not k:
            print("  %s: appka ten druh nezna, preskakuji" % jmeno)
            continue
        for typ in sorted(typy_utoku(k)):
            seznam = typy.get(typ)
            if seznam is None:
                continue
            if any(r["druh"] == jmeno for r in seznam):
                continue   # Hub ho uz vede, dopocet nema co delat
            moje = sila(k, typ, "Dynamax")
            kam = len(seznam)
            for i, r in enumerate(seznam):
                # Hubovo cislo ma prednost; model se bere, jen kdyz chybi.
                jeho = r.get("sila")
                if jeho is None:
                    jeho = sila(klic(r["druh"]), typ, r.get("forma"))
                if jeho < moje:
                    kam = i
                    break
            znamka = (seznam[kam - 1]["znamka"] if kam else
                      (seznam[0]["znamka"] if seznam else ""))
            seznam.insert(kam, {"poradi": 0, "druh": jmeno, "forma": "Dynamax",
                                "sila": int(round(moje)), "rychly": "",
                                "nabity": "", "znamka": znamka, "odkaz": "",
                                "dopocitano": True})
            pridano += 1
    for seznam in typy.values():
        for i, r in enumerate(seznam):
            r["poradi"] = i + 1
    return pridano


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

    pridano = doplnit_navic(typy)
    if pridano:
        print("dopočítáno řádků (druhy, které Hub nevede): %d" % pridano)

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
            role = {"typ": typ, "poradi": r["poradi"],
                    "znamka": r["znamka"], "forma": r["forma"]}
            if r.get("dopocitano"):
                role["dopocitano"] = True
            z["role"].append(role)
    for z in druhy.values():
        z["role"].sort(key=lambda x: x["poradi"])

    out = {
        "_meta": {
            "zdroj": URL_TYP % "<typ>",
            "staženo": date.today().isoformat(),
            "model": "Pořadí i známku (SS…F) počítá Pokémon GO Hub, ne appka."
                     " Řádky s `dopocitano` jsou druhy, které Hub nevede:"
                     " jejich sílu počítá appka podle útoku a STAB"
                     " (viz data/dmax_navic.json).",
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
