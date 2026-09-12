# -*- coding: utf-8 -*-
r"""Porovná roster proti typovému a ligovému rozpočtu.

Odpovídá na otázku „kolik kusů si mám nechat a na co" — ne kus po kuse
(to dělá appka), ale po ROLÍCH: kolik mám na každý útočný typ do raidu,
kolik do každé ligy, kolik na gym, a co nemá roli žádnou.

Použití:  python tools/rozpocet.py "cesta\k\rosteru.csv"
"""
import json, sys, csv, io, collections, os

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def nacti(jm):
    with io.open(os.path.join(KOREN, "data", jm), encoding="utf-8") as f:
        return json.load(f)


DEX = nacti("pokedex.json")
SPECIES = DEX["species"]
MEGA = DEX["mega"]
REF = nacti("reference.json")
META = nacti("meta.json")["leagues"]

# Typy, které pokrývají 100 % bossů (viz analýza pokrytí). Pořadí = pořadí,
# v jakém je greedy hledání vybralo, tedy podle přínosu.
TYPY_POKRYTI = ["Ice", "Ground", "Ghost", "Fairy", "Fighting",
                "Steel", "Fire", "Dark", "Rock", "Electric"]
JADRO = 8          # prvních 8 typů = 95 % bossů
NA_TYP = 6         # parta do raidu
NA_LIGU = 6        # 3 do týmu + 3 odpovědi
GYM_CIL = 8
# Base útok finální evoluce, od kterého má smysl kus do raidu vůbec brát.
# Špička má 250-300; pod 200 už kus jen prodlužuje souboj.
NAHRADNIK_UTOK = 200

# ---------------------------------------------------------------- klíčování
RUCNE = {
    "nidoran♀": "nidoranf", "nidoran♂": "nidoranm",
    "shellos east sea": "shellos-eastsea", "shellos west sea": "shellos-westsea",
    "zygarde 10%": "zygarde-tenpercent", "zygarde 50%": "zygarde-fiftypercent",
    "stunfisk galarian": "stunfisk-galar", "mr. mime": "mrmime",
    "basculin blue striped": "basculin-bluestriped",
    "basculin red striped": "basculin-redstriped",
    "squawkabilly blue": "squawkabilly-blue",
    "squawkabilly green": "squawkabilly-green",
}
PODLE_JMENA = collections.defaultdict(list)
for k, v in SPECIES.items():
    PODLE_JMENA[v[1].lower()].append(k)


def klic(jmeno):
    n0 = jmeno.strip().lower()
    if n0 in RUCNE:            # Nidoran♀ ≠ Nidoran♂, pohlaví se tu uříznout nesmí
        return RUCNE[n0]
    n = n0.replace("♂", "").replace("♀", "").strip()
    if n in RUCNE:
        return RUCNE[n]
    if n in PODLE_JMENA:
        # bez formy = základní varianta (nejkratší klíč)
        return sorted(PODLE_JMENA[n], key=len)[0]
    kk = n.replace(" ", "-").replace(".", "").replace("'", "")
    return kk if kk in SPECIES else None


# --------------------------------------------------------- evoluční řetězec
NASLEDNIK = collections.defaultdict(set)
for e in json.load(io.open(os.path.join(KOREN, "data", "raw",
                                        "pokemon_evolutions.json"), encoding="utf-8")):
    a = klic(e["pokemon_name"])
    for n in e.get("evolutions", []):
        b = klic(n["pokemon_name"])
        if a and b:
            NASLEDNIK[a].add(b)


def retezec(k):
    """Kus + všechno, čím se ještě může stát.

    Formy se do řetězce přidávají i pod základním klíčem: referenční seznamy
    znají „Stunfisk" jako gym obránce, ale kus v rosteru je „stunfisk-galar"
    a bez tohohle by se nespároval. Za cenu občasného falešného páru
    u regionálních forem s jinými typy — na roli materiálu to nevadí,
    typy se dál čtou z konkrétní formy."""
    vid, fronta, out = {k}, [k], [k]
    while fronta:
        x = fronta.pop()
        for y in NASLEDNIK.get(x, ()):
            if y not in vid:
                vid.add(y); fronta.append(y); out.append(y)
    for x in list(out):
        zaklad = x.split("-")[0]
        if zaklad != x and zaklad in SPECIES and zaklad not in vid:
            vid.add(zaklad); out.append(zaklad)
    return out


# ------------------------------------------------------------- role z dat
RAID = collections.defaultdict(list)      # klíč druhu -> [(typ, rank, mega?)]
for e in REF["raidAttackers"]:
    for mn in e.get("matchNames", []):
        k = klic(mn)
        if k:
            f = e.get("form") or ""
            RAID[k].append((e["type"], e["rank"], "Mega" in f or "Primal" in f))

GYM = set()
for e in REF["gymDefenders"]:
    for mn in e.get("matchNames", []):
        k = klic(mn)
        if k:
            GYM.add(k)

LIGY = {"little": "LC", "great": "GL", "ultra": "UL", "master": "ML"}


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def analyzuj(cesta, rank_limit=50):
    rows = list(csv.DictReader(io.open(cesta, encoding="utf-8-sig")))
    kusy = []
    nezname = []
    for r in rows:
        k = klic(r["Pokémon"])
        if not k:
            nezname.append(r["Pokémon"]); continue
        ch = retezec(k)
        role = {"raid": [], "pvp": {}, "gym": False, "mega": []}
        for c in ch:
            for (t, rank, jeMega) in RAID.get(c, ()):
                role["raid"].append((t, rank, jeMega, c))
            if c in GYM:
                role["gym"] = True
            if c in MEGA:
                role["mega"].append(c)
        for lg, zk in LIGY.items():
            # LC se hraje na 500 CP, takže tam patří kus JAK JE, ne po evoluci
            kand = [k] if lg == "little" else ch
            nej = None
            for c in kand:
                z = META[lg].get(c)
                if z and (nej is None or z[0] < nej[0]):
                    nej = (z[0], z[1], c)
            if nej and nej[0] <= rank_limit:
                role["pvp"][zk] = nej
        kusy.append({"row": r, "key": k, "chain": ch, "role": role,
                     "iv": num(r.get("IV %")), "cp": num(r.get("CP")),
                     "lvl": num(r.get("Level")),
                     "jmeno": r["Pokémon"]})
    return kusy, nezname


def nahradnici(kusy, typ, uz_mam):
    """Kusy, které daným typem útočí s bonusem (typ mají na sobě po evoluci),
    ale nejsou v referenční čtyřce nejlepších. Řadí podle base útoku finální
    evoluce — to je to, co v raidu rozhoduje."""
    mam = {id(x) for x in uz_mam}
    out = []
    for x in kusy:
        if id(x) in mam:
            continue
        fin = SPECIES[x["key"]][7] or x["key"]
        v = SPECIES.get(fin)
        if not v or typ not in v[2]:
            continue
        hv = "" if v[3] >= NAHRADNIK_UTOK else " slabý"
        out.append({"utok": v[3], "x": x,
                    "popis": f"{x['jmeno']}→{v[1]} ({v[3]}{hv})"})
    out.sort(key=lambda z: -z["utok"])
    videl, res = set(), []
    for z in out:                      # každý druh jen jednou
        if z["x"]["key"] in videl:
            continue
        videl.add(z["x"]["key"]); res.append(z)
    return res


def tisk(kusy, nezname, nadpis):
    n = len(kusy)
    print("=" * 66)
    print(nadpis, "—", n, "kusů")
    if nezname:
        print("nerozpoznáno:", nezname)
    print("=" * 66)

    # ---------------------------------------------------------------- RAIDY
    print("\n--- RAIDY: 6 kusů na typ ---")
    print(f"{'typ':10}{'mám':>5}{'cíl':>5}{'chybí':>7}   kusy")
    chybi_celkem = 0
    ma_raid = set()
    for i, t in enumerate(TYPY_POKRYTI):
        m = [x for x in kusy if any(r[0] == t for r in x["role"]["raid"])]
        for x in m:
            ma_raid.add(id(x))
        chybi = max(0, NA_TYP - len(m))
        if i < JADRO:
            chybi_celkem += chybi
        popis = ", ".join(sorted({x["jmeno"] for x in m})) or "—"
        hv = "" if i < JADRO else "  (nad jádro)"
        print(f"{t:10}{len(m):>5}{NA_TYP:>5}{chybi:>7}   {popis[:58]}{hv}")
        if chybi:
            nahr = nahradnici(kusy, t, m)
            # Roli přiznáváme i za Rock a Electric: do jádra sice nepatří,
            # ale bez nich není pokrytí 100 % a jiný materiál na ně není.
            for z in nahr:
                if z["utok"] >= NAHRADNIK_UTOK:
                    ma_raid.add(id(z["x"]))
            if nahr:
                print(f"{'':22}zaskočí: " + ", ".join(
                    x["popis"] for x in nahr[:5]))
    print(f"\nchybí do jádra ({JADRO} typů × {NA_TYP}) = {JADRO*NA_TYP} kusů: "
          f"{chybi_celkem} kusů")

    # ------------------------------------------------------------------ PvP
    print("\n--- PvP: 6 kusů na ligu, druh do #50 ---")
    ma_pvp = set()
    for zk in ("LC", "GL", "UL", "ML"):
        m = [x for x in kusy if zk in x["role"]["pvp"]]
        for x in m:
            ma_pvp.add(id(x))
        m.sort(key=lambda x: x["role"]["pvp"][zk][0])
        # Do týmu jdou tři RŮZNÉ druhy, druhá kopie téhož druhu nekupuje nic.
        druhy, videl = [], set()
        for x in m:
            if x["key"] in videl:
                continue
            videl.add(x["key"]); druhy.append(x)
        navic = len(m) - len(druhy)
        popis = ", ".join(f"{x['jmeno']}#{x['role']['pvp'][zk][0]}" for x in druhy[:7])
        print(f"{zk:4}{len(druhy):>4} / {NA_LIGU} druhů"
              + (f" (+{navic} kopií navíc)" if navic else "" ) + f"   {popis}")

    # ------------------------------------------------------------ GYM, MEGA
    gym = [x for x in kusy if x["role"]["gym"]]
    meg = [x for x in kusy if x["role"]["mega"]]
    print(f"\n--- GYM: {len(gym)} / {GYM_CIL} ---")
    print("   " + (", ".join(sorted({x["jmeno"] for x in gym})) or "—"))
    print(f"\n--- MEGA (druhů, co umí megu): {len({x['key'] for x in meg})} ---")
    print("   " + (", ".join(sorted({x["jmeno"] for x in meg})) or "—"))

    # ------------------------------------------------------------ BEZ ROLE
    bez = [x for x in kusy if id(x) not in ma_raid and id(x) not in ma_pvp
           and not x["role"]["gym"] and not x["role"]["mega"]]
    print(f"\n--- BEZ ROLE: {len(bez)} kusů ({100*len(bez)//max(1,n)} %) ---")
    for x in sorted(bez, key=lambda y: -(y["cp"] or 0)):
        print(f"   {x['jmeno']:26} CP {int(x['cp'] or 0):>5}  "
              f"IV {int(100*(x['iv'] or 0)):>3} %")
    return {"n": n, "bez": len(bez), "chybi": chybi_celkem}


if __name__ == "__main__":
    c = sys.argv[1]
    k, nz = analyzuj(c)
    tisk(k, nz, os.path.basename(c))
