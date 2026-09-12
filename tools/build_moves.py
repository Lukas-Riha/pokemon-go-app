"""Upeče data o útocích do data/moves.json.

Zdroj: pogoapi.net — fast_moves, charged_moves, current_pokemon_moves
a pvp_fast_moves + pvp_charged_moves.

Bez tohohle engine neví, že pokémon se skvělými IV může mít mizerné útoky.
PvP má vlastní čísla: v ligách se počítá na tahy (1 tah = 0,5 s), ne na sekundy,
a energie i síla se od raidových hodnot liší. Proto dva samostatné datasety.

Formát je indexovaný (jména útoků jednou v seznamu, pak už jen čísla), aby se
to dalo zapéct do webové appky a nenafouklo ji o stovky kB.

Spuštění:
    python tools/build_moves.py [--refresh]
"""
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "moves.json"
BASE_URL = "https://pogoapi.net/api/v1/"
FILES = ["fast_moves", "charged_moves", "current_pokemon_moves",
         "pvp_fast_moves", "pvp_charged_moves"]

# stejné formy jako v build_pokedex.py — klíče se musí shodovat
REGIONAL = {"alola": "alola", "alolan": "alola", "galarian": "galar", "galar": "galar",
            "hisuian": "hisui", "hisui": "hisui", "paldea": "paldea", "paldean": "paldea"}
BATTLE_FORMS = {
    "therian": "therian", "incarnate": "incarnate", "origin": "origin", "altered": "altered",
    "attack": "attack", "defense": "defense", "speed": "speed", "black": "black", "white": "white",
    "crowned_sword": "crownedsword", "crowned_shield": "crownedshield", "sky": "sky", "land": "land",
    "hero": "hero", "ice_rider": "icerider", "shadow_rider": "shadowrider",
}
FORM_SUFFIX = {**REGIONAL, **BATTLE_FORMS}


def fetch(refresh=False):
    RAW.mkdir(parents=True, exist_ok=True)
    data = {}
    for name in FILES:
        path = RAW / f"{name}.json"
        if refresh or not path.exists():
            print(f"stahuji {name}.json …")
            req = urllib.request.Request(BASE_URL + f"{name}.json",
                                         headers={"User-Agent": "pokemon-go-planner (local build)"})
            with urllib.request.urlopen(req, timeout=90) as r:
                path.write_bytes(r.read())
        data[name] = json.loads(path.read_text(encoding="utf-8"))
    return data


def norm(name):
    s = str(name).lower().replace("♀", "f").replace("♂", "m")
    return re.sub(r"[^a-z0-9]", "", s)


def dex_key(pokemon_name, form):
    base = norm(pokemon_name)
    suffix = FORM_SUFFIX.get(str(form).lower())
    return f"{base}-{suffix}" if suffix else base


def wanted(form):
    f = str(form).lower()
    return f == "normal" or f in FORM_SUFFIX


# Frustration a Return se do learnsetů schválně NEPŘIDÁVAJÍ. PvPoke je vede
# u každého druhu, který má shadow variantu, jenže je nedává DRUH — dává je
# stav kusu. Kdyby se do learnsetu dostaly, appka by je nabízela i u obyčejného
# kusu, který je mít nemůže. Řeší se v appce podle sloupce Forma.
PVPOKE_MIMO = {"FRUSTRATION", "RETURN"}

PVPOKE_GM = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json"


def stahni_gamemaster(refresh=False):
    """PvPoke gamemaster — jediný zdroj, kde jsou hodnoty nových útoků.

    POZOR: má v sobě VÝHRADNĚ PvP čísla. Water Gun tam má sílu 3, což je
    hodnota pro ligy; v raidu má 5 a trvá 500 ms. Doba trvání tam není vůbec,
    takže se z toho raidové DPS spočítat NEDÁ a ani se o to nepokoušíme.
    """
    cesta = RAW / "pvpoke_gamemaster.json"
    if refresh or not cesta.exists():
        print("stahuji pvpoke_gamemaster.json …")
        req = urllib.request.Request(PVPOKE_GM,
                                     headers={"User-Agent": "pokemon-go-planner (local build)"})
        with urllib.request.urlopen(req, timeout=90) as r:
            cesta.write_bytes(r.read())
    return json.loads(cesta.read_text(encoding="utf-8"))


def chybejici_utoky(fast_names, ch_names):
    """Projde žebříčky a vrátí {moveId: slot}, co PvPoke zná a herní data ne.

    Slot se bere z žebříčku (fastMoves vs chargedMoves), ne z hodnot útoku —
    v gamemasteru není pole, které by to říkalo, a hádat se to podle energie
    nedá spolehlivě (část rychlých útoků má nulový zisk energie).
    """
    def klic(j):
        return re.sub(r"[^a-z0-9]", "", str(j).lower())

    znam = {klic(n) for n in fast_names} | {klic(n) for n in ch_names}
    chybi = {}
    for cap in (500, 1500, 2500, 10000):
        cesta = RAW / f"pvpoke_{cap}.json"
        if not cesta.exists():
            continue
        for r in json.loads(cesta.read_text(encoding="utf-8")):
            moves = r.get("moves") or {}
            for skupina, slot in (("fastMoves", 0), ("chargedMoves", 1)):
                for mv in moves.get(skupina) or []:
                    jm = str(mv.get("moveId", ""))
                    if jm and jm not in PVPOKE_MIMO and klic(jm) not in znam:
                        drive = chybi.setdefault(jm, slot)
                        if drive != slot:
                            print(f"  POZOR: {jm} je jednou rychlý a jindy nabitý")
    return chybi


def doplnit_pvp_utoky(fast_names, fast_stats, pvp_fast, ch_names, ch_stats, pvp_ch,
                      refresh=False):
    """Přidá útoky, které herní data (pogoapi) nemají, s PvP hodnotami z PvPoke.

    Raidová čtveřice se zapíše s NULOVOU dobou trvání. Je to schválně a je to
    smluvená značka pro „raidové hodnoty neznáme": appka na ní pozná, že s tím
    útokem nemá počítat DPS, místo aby mu tiše přiřkla nulu a poslala kus
    přeučit. Bez toho by Cramorant s Dive vypadal jako kus se zkaženou sestavou,
    přitom je to útok, který mu PvPoke sám doporučuje.
    """
    chybi = chybejici_utoky(fast_names, ch_names)
    if not chybi:
        return [], []
    gm = stahni_gamemaster(refresh)
    podle_id = {m.get("moveId"): m for m in gm.get("moves") or []}

    def klic(j):
        return re.sub(r"[^a-z0-9]", "", str(j).lower())

    # Kontroluje se JMÉNO, ne moveId. PvPoke má pro některé útoky vlastní ID —
    # AEGISLASH_CHARGE_AIR_SLASH je pořád obyčejný Air Slash, jen zapsaný jinak.
    # Bez téhle kontroly se přidal druhý „Air Slash" s nulovou dobou a protože
    # se útoky páruji podle jména, přebil ten původní u všech druhů.
    znama_jmena = {klic(n) for n in fast_names} | {klic(n) for n in ch_names}

    pridane, bez_hodnot, duplicitni = [], [], []
    for jm in sorted(chybi):
        # Hidden Power je v herních datech JEDEN útok, jehož typ určuje kus.
        # PvPoke ho rozepisuje na 18 typových variant — ty se sem netahají,
        # jinak by appka nabízela 18 útoků, které ve hře nejde vybrat.
        if jm.startswith("HIDDEN_POWER"):
            continue
        m = podle_id.get(jm)
        if not m:
            bez_hodnot.append(jm)
            continue
        typ = str(m.get("type", "")).capitalize()
        nazev = m.get("name") or jm.replace("_", " ").title()
        if klic(nazev) in znama_jmena:
            duplicitni.append(jm + " = " + nazev)
            continue
        znama_jmena.add(klic(nazev))
        if chybi[jm] == 0:
            fast_names.append(nazev)
            fast_stats.append([typ, 0, 0, 0])
            pvp_fast.append([m.get("power", 0), abs(m.get("energyGain", 0)),
                             max(1, m.get("turns", 1))])
        else:
            ch_names.append(nazev)
            ch_stats.append([typ, 0, 0, 0])
            pvp_ch.append([m.get("power", 0), abs(m.get("energy", 0)),
                           1 if m.get("buffs") else 0])
        pridane.append(nazev)
    if duplicitni:
        print("  jiné ID, ale existující útok (přeskočeno): " + ", ".join(duplicitni))
    return pridane, bez_hodnot


def doplnit_z_pvpoke(learn, fast_names, ch_names):
    """Do learnsetů přidá útoky, které zná PvPoke a herní data ne.

    Proč to je potřeba: pogoapi má u části druhů neúplný seznam útoků —
    Staryu tam nemá Quick Attack, Mimikyu Hex, Doublade Shadow Claw. V appce
    se pak takový útok tvářil jako něco, co ten druh neumí, a nešel vybrat.
    PvPoke má seznamy z vlastního parseru game masteru a jsou úplnější.

    Bere se ze VŠECH lig (500/1500/2500/10000), protože každá pokrývá jiné
    druhy. Klíče se párují stejnou funkcí jako v build_meta.py, takže se to
    po nové generaci vyřeší samo.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location("bm", ROOT / "tools" / "build_meta.py")
    bm = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bm)

    dex_path = ROOT / "data" / "pokedex.json"
    znami = set(json.loads(dex_path.read_text(encoding="utf-8"))["species"]) if dex_path.exists() else set()

    def klic_utoku(jmeno):
        return re.sub(r"[^a-z0-9]", "", str(jmeno).lower())

    fast_idx = {klic_utoku(n): i for i, n in enumerate(fast_names)}
    ch_idx = {klic_utoku(n): i for i, n in enumerate(ch_names)}

    pridano_f = pridano_c = 0
    nezname = set()
    for cap in (500, 1500, 2500, 10000):
        cesta = RAW / f"pvpoke_{cap}.json"
        if not cesta.exists():
            continue
        for r in json.loads(cesta.read_text(encoding="utf-8")):
            key = bm.dex_key(r.get("speciesId", ""), znami)
            l = learn.get(key) or learn.get(key.split("-")[0])
            if not l:
                continue
            moves = r.get("moves") or {}
            for skupina, idx, slot in (("fastMoves", fast_idx, 0), ("chargedMoves", ch_idx, 1)):
                for mv in moves.get(skupina) or []:
                    jmeno = str(mv.get("moveId", ""))
                    if jmeno in PVPOKE_MIMO:
                        continue
                    i = idx.get(klic_utoku(jmeno))
                    if i is None:
                        nezname.add(jmeno)
                        continue
                    # elitní varianta se počítá taky — útok, co kus MÁ, není nový
                    if i in l[slot] or i in l[slot + 2]:
                        continue
                    l[slot].append(i)
                    if slot == 0:
                        pridano_f += 1
                    else:
                        pridano_c += 1
    return pridano_f, pridano_c, nezname


def dorovnat_learnsety(current, learn, fast_names, ch_names):
    """Doplní do learnsetů útoky, které v době jejich stavby ještě neexistovaly.

    Learnsety se staví z pogoapi hned na začátku, ale seznam útoků se pak ještě
    rozšiřuje (přeřazené rychlé útoky, útoky z PvPoke gamemasteru). Odkazy,
    které tehdy nešly přeložit, se tiše zahodily. Tady se doplní.
    """
    fi = {n: i for i, n in enumerate(fast_names)}
    ci = {n: i for i, n in enumerate(ch_names)}
    pridano = 0
    for p in current:
        if not wanted(p.get("form", "Normal")):
            continue
        for key in {dex_key(p["pokemon_name"], p.get("form", "Normal")),
                    norm(p["pokemon_name"])}:
            l = learn.get(key)
            if not l:
                continue
            for jmena, idx, slot in (
                (p.get("fast_moves"), fi, 0),
                (p.get("charged_moves"), ci, 1),
                (p.get("elite_fast_moves"), fi, 2),
                (p.get("elite_charged_moves"), ci, 3),
            ):
                for n in jmena or []:
                    i = idx.get(n)
                    if i is None:
                        continue
                    # elitní varianta je ta samá dvojice indexů, jen v jiném
                    # slotu — kontroluje se obojí, ať se útok nezdvojí
                    zakladni = slot % 2
                    if i in l[zakladni] or i in l[zakladni + 2]:
                        continue
                    l[slot].append(i)
                    pridano += 1
    return pridano


def main():
    raw = fetch("--refresh" in sys.argv)

    fast_names, fast_stats, fast_idx = [], [], {}
    for m in raw["fast_moves"]:
        name = m["name"]
        if name in fast_idx:
            continue
        fast_idx[name] = len(fast_names)
        fast_names.append(name)
        # [typ, síla, získaná energie, doba v ms]
        fast_stats.append([m["type"], m["power"], abs(m["energy_delta"]), m["duration"]])

    ch_names, ch_stats, ch_idx = [], [], {}
    preradeno = []
    for m in raw["charged_moves"]:
        name = m["name"]
        if name in ch_idx or name in fast_idx:
            continue
        # pogoapi má Psywave, Metal Sound, Sand Attack a Water Gun Blastoise
        # zařazené mezi nabité útoky. Nejsou. Poznat to jde bez znalosti jmen:
        # nabitý útok energii SPOTŘEBUJE (energy_delta je záporná), rychlý ji
        # dává. Tyhle čtyři ji dávají, takže patří mezi rychlé.
        #
        # Nešlo o kosmetiku: Lapras se Psywave, Corviknight se Sand Attack
        # a Aggron s Metal Sound měli ten útok v learnsetu, ale appka ho neznala
        # jako rychlý, takže se v nabídce vůbec neobjevil a ručně se zadat nedal.
        # Dohromady 66 druhů.
        if m["energy_delta"] > 0:
            preradeno.append(name)
            fast_idx[name] = len(fast_names)
            fast_names.append(name)
            fast_stats.append([m["type"], m["power"], m["energy_delta"], m["duration"]])
            continue
        ch_idx[name] = len(ch_names)
        ch_names.append(name)
        # [typ, síla, spotřebovaná energie, doba v ms]
        ch_stats.append([m["type"], m["power"], abs(m["energy_delta"]), m["duration"]])
    if preradeno:
        print("mezi rychlé přeřazeno (pogoapi je vede jako nabité, ale energii dávají): "
              + ", ".join(preradeno))

    learn = {}
    for p in raw["current_pokemon_moves"]:
        if not wanted(p.get("form", "Normal")):
            continue
        key = dex_key(p["pokemon_name"], p.get("form", "Normal"))
        if key in learn:
            continue
        def idxs(names, table):
            out = []
            for n in names or []:
                if n in table and table[n] not in out:
                    out.append(table[n])
            return out
        learn[key] = [
            idxs(p.get("fast_moves"), fast_idx),
            idxs(p.get("charged_moves"), ch_idx),
            idxs(p.get("elite_fast_moves"), fast_idx),
            idxs(p.get("elite_charged_moves"), ch_idx),
        ]

    # PvP hodnoty se navěsí na stejné indexy jako raidové — typ útoku je stejný,
    # takže se neopakuje. Kdo v PvP datasetu není, dostane null.
    def pvp_table(rows, idx, charged):
        table = [None] * len(idx)
        missing = []
        for m in rows:
            i = idx.get(m["name"])
            if i is None:
                missing.append(m["name"])
                continue
            turns = m.get("turn_duration", 1)
            if charged:
                # nabitý útok v PvP proběhne v jednom tahu; podstatná je cena
                table[i] = [m["power"], abs(m["energy_delta"]),
                            1 if m.get("buffs") else 0]
            else:
                table[i] = [m["power"], abs(m["energy_delta"]), max(1, turns)]
        return table, missing

    pvp_fast, miss_f = pvp_table(raw["pvp_fast_moves"], fast_idx, False)
    pvp_ch, miss_c = pvp_table(raw["pvp_charged_moves"], ch_idx, True)

    # stejná díra jako v pokédexu: druh musí být dosažitelný i holým jménem
    for p in raw["current_pokemon_moves"]:
        plain = norm(p["pokemon_name"])
        if plain in learn:
            continue
        formy = [k for k in learn if k.split("-")[0] == plain]
        if formy:
            learn[plain] = learn[formy[0]]
            continue
        def idxs2(names, table):
            out2 = []
            for n in names or []:
                if n in table and table[n] not in out2:
                    out2.append(table[n])
            return out2
        learn[plain] = [
            idxs2(p.get("fast_moves"), fast_idx),
            idxs2(p.get("charged_moves"), ch_idx),
            idxs2(p.get("elite_fast_moves"), fast_idx),
            idxs2(p.get("elite_charged_moves"), ch_idx),
        ]

    out = {
        "_meta": {
            "zdroj": "https://pogoapi.net (fast_moves, charged_moves, current_pokemon_moves, pvp_fast_moves, pvp_charged_moves)",
            "stazeno": date.today().isoformat(),
            "schema_move": "[typ, síla, energie, doba_ms]",
            "schema_pvp_fast": "[síla, získaná energie, tahy] na stejném indexu jako fastNames (null = v PvP datasetu není)",
            "schema_pvp_charged": "[síla, cena energie, má_buff 0/1] na stejném indexu jako chargedNames",
            "jen_pvp": "útoky s dobou 0 ms: PvPoke je zná, herní data ne — počítá se s nimi jen v PvP",
            "schema_learn": "klíč druhu -> [[rychlé], [nabité], [elitní rychlé], [elitní nabité]] (indexy do seznamů)",
            "pozn": "Regeneruj přes: python tools/build_moves.py --refresh",
        },
        "fastNames": fast_names,
        "fast": fast_stats,
        "chargedNames": ch_names,
        "charged": ch_stats,
        "pvpFast": pvp_fast,
        "pvpCharged": pvp_ch,
        "learn": learn,
    }
    pridane, bez_hodnot = doplnit_pvp_utoky(fast_names, fast_stats, pvp_fast,
                                            ch_names, ch_stats, pvp_ch,
                                            "--refresh" in sys.argv)
    if pridane:
        print(f"z PvPoke gamemasteru doplněno {len(pridane)} útoků (jen PvP hodnoty, "
              f"raidová doba neznámá): " + ", ".join(pridane[:10])
              + (" …" if len(pridane) > 10 else ""))
    if bez_hodnot:
        print(f"  {len(bez_hodnot)} útoků nemá hodnoty ani v gamemasteru: "
              + ", ".join(bez_hodnot))

    # Learnsety se stavěly dřív, než existovaly všechny útoky, takže jim část
    # odkazů propadla. Tenhle průchod je dorovná — bez něj by Delphox neuměla
    # Mystical Fire, i když ten útok už v datech je.
    dorovnano = dorovnat_learnsety(raw["current_pokemon_moves"], learn,
                                   fast_names, ch_names)
    if dorovnano:
        print(f"do learnsetů dorovnáno {dorovnano} odkazů na útoky, které přibyly později")

    pridano_f, pridano_c, nezname = doplnit_z_pvpoke(learn, fast_names, ch_names)
    print(f"z PvPoke doplněno: {pridano_f} rychlých, {pridano_c} nabitých")
    if nezname:
        print(f"  PvPoke zná {len(nezname)} útoků, které v herních datech nejsou: "
              + ", ".join(sorted(nezname)[:8]) + (" …" if len(nezname) > 8 else ""))
        print("  (bez jejich síly a energie se s nimi počítat nedá — proto se ignorují)")

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"rychlé={len(fast_names)} nabité={len(ch_names)} druhů={len(learn)}")
    print(f"PvP pokrytí: rychlé {sum(1 for x in pvp_fast if x)}/{len(pvp_fast)}, "
          f"nabité {sum(1 for x in pvp_ch if x)}/{len(pvp_ch)}")
    # Přepočítat AŽ TEĎ. Seznamy miss_f/miss_c vznikly před doplněním útoků
    # z PvPoke gamemasteru, takže by hlásily jako chybějící i to, co se mezitím
    # přidalo (Mystical Fire, Wildbolt Storm) — výpis by lhal.
    _znama = {re.sub(r"[^a-z0-9]", "", n.lower()) for n in fast_names + ch_names}
    zbyva = [n for n in (miss_f + miss_c)
             if re.sub(r"[^a-z0-9]", "", str(n).lower()) not in _znama]
    if zbyva:
        print(f"  {len(zbyva)} útoků má PvP hodnoty, ale v raidovém seznamu nejsou:",
              ", ".join(zbyva[:10]))
    print("velikost:", OUT.stat().st_size, "B ->", OUT)


if __name__ == "__main__":
    main()
