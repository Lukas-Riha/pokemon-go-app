"""Stáhne veřejná herní data Pokémon GO a upeče z nich kompaktní data/pokedex.json.

Zdroj: https://pogoapi.net (komunitní mirror herního game masteru, veřejné API).
Surová data se cachují do data/raw/, aby build nemusel na síť pokaždé.

Co z toho projekt má:
  * „Je to finální evoluce?" — appka se na to nemusí ptát uživatele
  * mega/primal formy včetně statů (nahrazuje ručně psaný seznam)
  * typy a base staty → skutečné hodnocení PvP (stat product) a raidů

Spuštění:
    python tools/build_pokedex.py            # použije cache, když existuje
    python tools/build_pokedex.py --refresh  # stáhne znovu
"""
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "pokedex.json"
BASE_URL = "https://pogoapi.net/api/v1/"
# Herní GAME_MASTER. Jediný zdroj úkolů před evolucí („porazit 30 duchů");
# pogoapi je nemá. Má 19 MB, takže se do raw/ ukládá jen hotový výtažek.
GM_URL = "https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json"
GM_CACHE = "game_master_extract"
FILES = ["pokemon_names", "pokemon_stats", "pokemon_evolutions", "pokemon_types",
         "mega_pokemon", "cp_multiplier", "pokemon_powerup_requirements",
         "pokemon_rarity", "pokemon_candy_to_evolve"]

# Formy, které mění staty/typy natolik, že se musí rozlišovat.
# Kosmetické formy (kostýmy, Fall_2019, barvy Vivillonu…) se ignorují.
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
            # bez hlavičky vrací pogoapi 403
            req = urllib.request.Request(
                BASE_URL + f"{name}.json",
                headers={"User-Agent": "pokemon-go-planner (local build)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                path.write_bytes(r.read())
        data[name] = json.loads(path.read_text(encoding="utf-8"))
    return data


# Podmínky, které GAME_MASTER umí, přeložené do češtiny. Typy zůstávají
# anglicky — appka je tak píše všude jinde (Water, Ghost, Steel).
def _typy(seznam):
    jm = [t.replace("POKEMON_TYPE_", "").capitalize() for t in seznam or []]
    if len(jm) <= 1:
        return jm[0] if jm else ""
    return " nebo ".join([", ".join(jm[:-1]), jm[-1]])


def ukol_cesky(q):
    """Jeden evolutionQuestTemplate → česká věta, nebo None když mu nerozumíme.

    Radši None než polovičatý překlad: prázdno uživatele nezmate, kdežto
    „splň úkol" u kusu, který chce porazit třicet duchů, ano."""
    typ = q.get("questType")
    cil = (q.get("goals") or [{}])[0]
    n = cil.get("target") or 0
    podm = {c.get("type"): c for c in cil.get("condition") or []}
    typy = ""
    if "WITH_POKEMON_TYPE" in podm:
        typy = _typy(podm["WITH_POKEMON_TYPE"].get("withPokemonType", {}).get("pokemonType"))
    if typ == "QUEST_FIGHT_POKEMON":
        st = podm.get("WITH_OPPONENT_POKEMON_BATTLE_STATUS", {})
        st = st.get("withOpponentPokemonBattleStatus", {})
        soupeř = _typy(st.get("opponentPokemonType"))
        if st.get("requireDefeat") and soupeř:
            return "porazit %d pokémonů typu %s" % (n, soupeř)
        return "porazit %d pokémonů" % n
    if typ == "QUEST_CATCH_POKEMON":
        return "chytit %d pokémonů typu %s" % (n, typy) if typy else "chytit %d pokémonů" % n
    if typ == "QUEST_BUDDY_EARN_AFFECTION_POINTS":
        return "získat %d srdíček jako buddy" % n
    if typ == "QUEST_BUDDY_FEED":
        return "nakrmit ho %d×" % n
    if typ == "QUEST_COMPLETE_RAID_BATTLE":
        return "vyhrát %d raidů" % n
    if typ == "QUEST_COMPLETE_BATTLE":
        boje = (podm.get("WITH_COMBAT_TYPE", {}).get("withCombatType", {})
                .get("combatType") or [])
        kde = "raidů nebo Max Battles" if any("MAX" in b for b in boje) else "raidů"
        if typy:
            return "vyhrát %d %s s pokémonem typu %s" % (n, kde, typy)
        return "vyhrát %d %s" % (n, kde)
    if typ == "QUEST_LAND_THROW":
        hod = (podm.get("WITH_THROW_TYPE", {}).get("withThrowType", {})
               .get("throwType") or "")
        if "EXCELLENT" in hod:
            return "trefit %d× Excellent hod" % n
        if "GREAT" in hod:
            return "trefit %d× Great hod" % n
        return "trefit %d× dobrý hod" % n
    if typ == "QUEST_USE_INCENSE":
        return "použít vonnou tyčinku"
    return None


def gm_key(pokemon_id, form, ponechat):
    """GAME_MASTER klíč (PRIMEAPE / SLOWPOKE_GALARIAN) → klíč pokédexu."""
    base = norm(pokemon_id)
    if not form:
        return base
    pripona = str(form)
    if pripona.startswith(str(pokemon_id) + "_"):
        pripona = pripona[len(str(pokemon_id)) + 1:]
    return dex_key(pokemon_id, pripona.lower().capitalize(), ponechat)


def fetch_gm(refresh, ponechat):
    """Výtažek z GAME_MASTERu: úkoly před evolucí a km na bonbón.

    GAME_MASTER se stahuje celý (19 MB), ale do raw/ se uloží jen výsledek —
    pár kilobajtů, se kterými funguje i offline build."""
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / f"{GM_CACHE}.json"
    if not refresh and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    print("stahuji GAME_MASTER (úkoly před evolucí) …")
    req = urllib.request.Request(
        GM_URL, headers={"User-Agent": "pokemon-go-planner (local build)"})
    with urllib.request.urlopen(req, timeout=180) as r:
        gm = json.loads(r.read().decode("utf-8"))
    quests = {}
    for e in gm:
        d = e.get("data") or {}
        q = d.get("evolutionQuestTemplate")
        if q:
            quests[q.get("questTemplateId")] = q
    out, nezname, buddy = {}, set(), {}
    for e in gm:
        ps = (e.get("data") or {}).get("pokemonSettings")
        if not ps:
            continue
        od = gm_key(ps.get("pokemonId"), ps.get("form"), ponechat)
        # Kolik kilometrů ujdeš na JEDEN bonbón. Rozdíl mezi 1 km a 20 km
        # rozhoduje, jestli má chození vůbec smysl.
        if ps.get("kmBuddyDistance"):
            buddy.setdefault(od, float(ps["kmBuddyDistance"]))
        for b in ps.get("evolutionBranch") or []:
            zobraz = b.get("questDisplay") or []
            if not zobraz:
                continue
            q = quests.get(zobraz[0].get("questRequirementTemplateId"))
            if not q:
                continue
            na = gm_key(b.get("evolution"), b.get("form"), ponechat)
            cil = (q.get("goals") or [{}])[0].get("target") or 0
            if q.get("questType") == "QUEST_BUDDY_EVOLUTION_WALK":
                # Chození už nese pogoapi jako buddy_distance_required —
                # ať se to nenapíše dvakrát, jde to do stejného pole.
                out.setdefault(od, {}).setdefault(na, {})["km"] = float(cil)
                continue
            text = ukol_cesky(q)
            if text:
                out.setdefault(od, {}).setdefault(na, {})["ukol"] = text
            else:
                nezname.add(q.get("questType"))
    if nezname:
        print("  nepřeložené typy úkolů: %s" % ", ".join(sorted(nezname)))
    vysledek = {"ukoly": out, "buddyKm": buddy}
    path.write_text(json.dumps(vysledek, ensure_ascii=False, indent=1), encoding="utf-8")
    return vysledek


def norm(name):
    """'Farfetch'd' -> farfetchd, 'Nidoran♀' -> nidoranf, 'Ho-Oh' -> hooh.

    Stejná normalizace musí být i v JS (funkce dexKey ve webové appce)."""
    s = name.lower().replace("♀", "f").replace("♂", "m")
    return re.sub(r"[^a-z0-9]", "", s)


def dex_key(pokemon_name, form, ponechat=None):
    base = norm(pokemon_name)
    f = str(form).lower()
    if f == "normal":
        return base
    if f in FORM_SUFFIX:
        return f"{base}-{FORM_SUFFIX[f]}"
    if ponechat is not None and (base, f) in ponechat:
        return f"{base}-{form_suffix(form)}"
    return base


def form_suffix(form):
    """Přípona klíče pro formu. Známé formy mají hezký název, ostatní se
    normalizují ('Ten_percent' -> 'tenpercent', 'Baile' -> 'baile')."""
    f = str(form).lower()
    if f in FORM_SUFFIX:
        return FORM_SUFFIX[f]
    return re.sub(r"[^a-z0-9]", "", f)


def zajimave_formy(types_raw, stats_raw):
    """Formy, které se musí rozlišovat, spočítané Z DAT.

    Ručně psaný seznam nestačil: Oricorio má čtyři formy a každá jiný typ
    (Baile Fire/Flying, Pom-Pom Electric/Flying…), Castform tři, Wormadam tři,
    Zygarde tři různě velké. Žádná z nich v seznamu nebyla, takže je appka
    vůbec neznala — a kus jako 'Oricorio Baile' skončil bez typů, bez statů
    a s verdiktem Zahodit, protože nedržel žádnou roli.

    Pravidlo: forma se nechá, když se od 'Normal' formy téhož druhu liší
    typy nebo základními staty. Jinak je kosmetická (barvy Squawkabilly,
    roční období Deerlinga) a stačí základní druh. Nová generace se tím
    vyřeší sama — nikdo nemusí doplňovat seznam."""
    zaklad_typy, zaklad_staty = {}, {}
    for t in types_raw:
        if str(t.get("form", "")).lower() == "normal":
            zaklad_typy[norm(t["pokemon_name"])] = tuple(t["type"])
    for st in stats_raw:
        if str(st.get("form", "")).lower() == "normal":
            zaklad_staty[norm(st["pokemon_name"])] = (
                st["base_attack"], st["base_defense"], st["base_stamina"])

    typy_formy = {}
    for t in types_raw:
        typy_formy[(norm(t["pokemon_name"]), str(t.get("form", "")).lower())] = tuple(t["type"])

    # Formy, které se ve hře chytit nedají — jsou to jen bossové v Max Battle.
    # Eternatus Eternamax má obranu 505 a HP 452, což je mimo cokoli hratelného,
    # a nafoukl by strop Dragon útočníků o třetinu: Rayquaza by z něj vycházel
    # jako poloviční. Pozná se podle toho, že jeho staty jsou násobně vyšší než
    # u vlastní základní formy. Práh 1,4x je schválně vysoko — Calyrex Ice/Shadow
    # Rider (1,31x a 1,32x) jsou legitimní raidové úlovky a musí projít.
    # Co se vyřadí, se VYPÍŠE, ať se to nikdy nestane potichu.
    BOSS_NASOBEK = 1.4
    vyrazene = []

    ponechat = set()
    for st in stats_raw:
        jmeno = norm(st["pokemon_name"])
        f = str(st.get("form", "")).lower()
        if f == "normal":
            continue
        staty = (st["base_attack"], st["base_defense"], st["base_stamina"])
        jine_staty = jmeno in zaklad_staty and staty != zaklad_staty[jmeno]
        moje_typy = typy_formy.get((jmeno, f))
        jine_typy = (moje_typy is not None and jmeno in zaklad_typy
                     and moje_typy != zaklad_typy[jmeno])
        # druh, který 'Normal' formu vůbec nemá (Scatterbug, Perrserker),
        # musí projít taky — jinak by nebyl v pokédexu vůbec
        bez_zakladu = jmeno not in zaklad_staty
        if jmeno in zaklad_staty:
            celkem = sum(staty)
            zaklad_celkem = sum(zaklad_staty[jmeno])
            if zaklad_celkem and celkem / zaklad_celkem >= BOSS_NASOBEK:
                vyrazene.append("%s %s (%.2fx staty základní formy)"
                                % (st["pokemon_name"], st.get("form"), celkem / zaklad_celkem))
                continue
        if jine_staty or jine_typy or bez_zakladu:
            ponechat.add((jmeno, f))
    if vyrazene:
        print("vyřazeno jako nechytatelné (jen boss v Max Battle):")
        for v in vyrazene:
            print("   " + v)
    return ponechat


def main():
    refresh = "--refresh" in sys.argv
    raw = fetch(refresh)

    # které formy se rozlišují, se spočítá z dat (různé typy nebo staty)
    ponechat = zajimave_formy(raw["pokemon_types"], raw["pokemon_stats"])
    print("formy s vlastními staty/typy: %d" % len(ponechat))

    def wanted(name, form):
        f = str(form).lower()
        return f == "normal" or f in FORM_SUFFIX or (norm(name), f) in ponechat

    types_by_key = {}
    for t in raw["pokemon_types"]:
        if wanted(t["pokemon_name"], t["form"]):
            types_by_key[dex_key(t["pokemon_name"], t["form"], ponechat)] = t["type"]
    # druhy bez formy "Normal" (Scatterbug a spol.) by jinak zůstaly bez typů
    for t in raw["pokemon_types"]:
        types_by_key.setdefault(norm(t["pokemon_name"]), t["type"])


    # kdo se ještě umí vyvinout (= není finální evoluce)
    # Formy jsou u evolucí uvedené spolehlivě (Normal/Galarian/Alola/Hisuian),
    # takže se klíčuje přesně — jinak by základní Farfetch'd zdědil evoluci
    # galarské formy a appka by radila evolvovat něco, co evolvovat nejde.
    can_evolve = set()
    evo_next = {}
    for e in raw["pokemon_evolutions"]:
        key = dex_key(e["pokemon_name"], e.get("form", "Normal"), ponechat)
        if e.get("evolutions"):
            can_evolve.add(key)
            for ev in e["evolutions"]:
                evo_next.setdefault(key, []).append(
                    dex_key(ev["pokemon_name"], ev.get("form", "Normal"), ponechat))

    # Podmínky evoluce. Cíl je klíč, protože podmínka platí pro KONKRÉTNÍ
    # přechod: Eevee se na Espeona vyvine po 10 km ve dne, na Umbreona v noci.
    pozadavky = {}
    for e in raw["pokemon_evolutions"]:
        key = dex_key(e["pokemon_name"], e.get("form", "Normal"), ponechat)
        for ev in e.get("evolutions") or []:
            cil = dex_key(ev["pokemon_name"], ev.get("form", "Normal"), ponechat)
            p = {}
            if ev.get("buddy_distance_required"):
                p["km"] = float(ev["buddy_distance_required"])
            if ev.get("must_be_buddy_to_evolve"):
                p["buddy"] = 1
            if ev.get("item_required"):
                p["item"] = ev["item_required"]
            if ev.get("lure_required"):
                p["lure"] = ev["lure_required"]
            if ev.get("gender_required"):
                p["pohlavi"] = ev["gender_required"]
            if ev.get("only_evolves_in_daytime"):
                p["den"] = 1
            if ev.get("only_evolves_in_nighttime"):
                p["noc"] = 1
            if ev.get("no_candy_cost_if_traded"):
                p["tradeZdarma"] = 1
            if ev.get("upside_down"):
                p["vzhuruNohama"] = 1
            if p:
                pozadavky.setdefault(key, {})[cil] = p

    # Úkoly z GAME_MASTERu se přilepí na tytéž přechody. Nepřepisují — jen
    # doplňují, co pogoapi nemá (a `km` bere, jen když tam ještě není).
    def dorovnat(klic, kandidati):
        """Klíč z GM na klíč pokédexu — když sedí základ, ale ne forma."""
        if klic in kandidati:
            return klic
        zaklad = klic.split("-")[0]
        shody = [k for k in kandidati if k.split("-")[0] == zaklad]
        return shody[0] if len(shody) == 1 else klic

    gm = fetch_gm(refresh, ponechat)
    nesparovano = []
    for od, cile in gm["ukoly"].items():
        od = dorovnat(od, evo_next)
        hrany = evo_next.get(od) or []
        for na, extra in cile.items():
            na = dorovnat(na, hrany)
            if na not in hrany:
                nesparovano.append("%s -> %s" % (od, na))
                continue
            p = pozadavky.setdefault(od, {}).setdefault(na, {})
            if extra.get("ukol"):
                p["ukol"] = extra["ukol"]
            if extra.get("km") and not p.get("km"):
                p["km"] = extra["km"]
    if nesparovano:
        print("  úkoly bez odpovídající evoluce: %s" % ", ".join(nesparovano))

    # Km na bonbón — jen pro druhy, které v pokédexu opravdu jsou.
    buddy_km = {k: v for k, v in gm["buddyKm"].items() if k in types_by_key}

    def final_forms(key, seen=None):
        """Koncové články evolučního řetězce. Eevee jich má osm, Bagon jeden."""
        seen = seen or set()
        if key in seen:
            return set()
        seen = seen | {key}
        nxt = evo_next.get(key)
        if not nxt:
            return {key}
        out = set()
        for n in nxt:
            out |= final_forms(n, seen)
        return out

    # jednoznačný cíl evoluce (kvůli „kolik z toho bude, až to vyvinu")
    final_of = {}
    for key in evo_next:
        ends = final_forms(key)
        if len(ends) == 1:
            end = next(iter(ends))
            if end != key:
                final_of[key] = end

    # Legendary / Mythic / Ultra beast — hra je nepustí do hromadného transferu
    # (mythical nejdou transferovat vůbec), takže je appka nesmí posílat do koše.
    rarity_of = {}
    for kind, items in raw["pokemon_rarity"].items():
        if kind == "Standard":
            continue
        short = {"Legendary": "L", "Mythic": "M", "Ultra beast": "U"}.get(kind, "")
        for it in items:
            rarity_of[dex_key(it["pokemon_name"], it.get("form", "Normal"), ponechat)] = short
            rarity_of.setdefault(norm(it["pokemon_name"]), short)

    # kolik bonbónů stojí evoluce toho kterého druhu (dataset je klíčovaný
    # cenou, uvnitř jsou druhy, kterých se týká)
    candy_of = {}
    for cena, items in raw["pokemon_candy_to_evolve"].items():
        for it in items:
            key = dex_key(it["pokemon_name"], it.get("form", "Normal"), ponechat)
            candy_of[key] = int(it.get("candy_required") or cena)
            candy_of.setdefault(norm(it["pokemon_name"]), int(it.get("candy_required") or cena))

    # Druhy, které se v boji PROMĚŇUJÍ. Zdroj u nich má obě podoby a pod
    # holým jménem vyhrávala ta, která byla v datech první — tedy Wishiwashi
    # School (útok 255) místo Solo (46) a Palafin Hero (322) místo Zero (143).
    # V boxu přitom držíš tu základní; appka z těch statů počítá CP i DPS,
    # takže by z Wishiwashiho udělala silného útočníka, kterého nemáš.
    #
    # Našla to křížová kontrola proti PvPoke gamemasteru — dva nezávislé
    # mirrory téhož game masteru se na těchhle třech druzích rozešly.
    ZAKLADNI_FORMA = {
        "wishiwashi": "Solo",
        "palafin": "Zero",
        # Zygarde se skládá z buněk; 50 % je podoba, kterou bere i PvPoke
        # jako výchozí. Konkrétní formy mají vlastní klíče (zygarde-tenpercent).
        "zygarde": "Fifty_percent",
    }

    species = {}
    for s in raw["pokemon_stats"]:
        if not wanted(s["pokemon_name"], s["form"]):
            continue
        key = dex_key(s["pokemon_name"], s["form"], ponechat)
        if key in species:
            continue
        species[key] = [
            s["pokemon_id"],
            s["pokemon_name"],
            types_by_key.get(key, types_by_key.get(norm(s["pokemon_name"]), [])),
            s["base_attack"],
            s["base_defense"],
            s["base_stamina"],
            1 if key in can_evolve else 0,
            final_of.get(key, ""),
            rarity_of.get(key, ""),
            candy_of.get(key, 0),
        ]

    # Dvě díry, na které se přišlo až při hledání obránců gymu:
    #  * Scatterbug / Spewpa / Vivillon nemají formu "Normal", jen dvacet
    #    vzorových (Archipelago, Meadow…). wanted() je všechny zahodí a druh
    #    z pokédexu zmizí úplně. Vzory se liší jen graficky, takže stačí první.
    #  * Perrserker existuje jen jako galarská forma, takže sedí pod klíčem
    #    "perrserker-galar" a pod holým jménem se nenajde.
    # Obojí se řeší stejně: každý druh musí být dosažitelný i holým jménem.
    by_plain = {}
    for s_row in raw["pokemon_stats"]:
        by_plain.setdefault(norm(s_row["pokemon_name"]), []).append(s_row)

    aliased = 0
    for plain, rows in by_plain.items():
        if plain in species:
            continue
        # už existuje jako forma? vezmi ji (Perrserker -> perrserker-galar)
        formy = [k for k in species if k.split("-")[0] == plain]
        if formy:
            # Pod holým jménem má být forma, kterou držíš v boxu — u druhů,
            # co se v boji promění, brala doteď první formu v pořadí, tedy
            # Wishiwashi School (útok 255) místo Solo (46) a Palafin Hero
            # (322) místo Zero (143). Appka z těch statů počítá CP i DPS.
            prefer = ZAKLADNI_FORMA.get(plain)
            vybrana = None
            if prefer:
                cil = plain + "-" + form_suffix(prefer)
                if cil in species:
                    vybrana = cil
            species[plain] = species[vybrana or formy[0]]
            aliased += 1
            continue
        # nemá vůbec žádnou přijatou formu (Scatterbug) -> první, co je
        s_row = rows[0]
        species[plain] = [
            s_row["pokemon_id"], s_row["pokemon_name"],
            types_by_key.get(plain, []),
            s_row["base_attack"], s_row["base_defense"], s_row["base_stamina"],
            1 if plain in can_evolve else 0,
            final_of.get(plain, ""),
            rarity_of.get(plain, ""),
            candy_of.get(plain, 0),
        ]
        aliased += 1
    print(f"doplněno pod holým jménem: {aliased}")

    mega = {}
    for m in raw["mega_pokemon"]:
        key = norm(m["pokemon_name"])
        st = m["stats"]
        mega.setdefault(key, []).append([
            m["mega_name"],
            st["base_attack"], st["base_defense"], st["base_stamina"],
            m.get("type", []),
            m.get("mega_energy_required"),
            "Primal" if str(m["mega_name"]).startswith("Primal") else "Mega",
        ])

    # level chodí jako float (40.0) — klíč musí být „40", ať se v JS dá hledat podle levelu
    cpm = {}
    for c in raw["cp_multiplier"]:
        lvl = float(c["level"])
        key = str(int(lvl)) if lvl.is_integer() else str(lvl)
        cpm[key] = round(c["multiplier"], 8)

    # Zdroj (pogoapi) končí na L45, hra jde do L50 a tabulka cen vylepšení
    # v tomtéž zdroji do L49.5 jde — takže bez tohohle doplnění appka tvrdila
    # "strop je L45" i tam, kde se dá jít dál. Od L40 roste CPM lineárně přesně
    # o 0.0025 na půl levelu (v datech ověřitelné na L40->L45) a extrapolace
    # sedí na známou hodnotu L50 = 0.8403.
    KROK, POSLEDNI_ZE_ZDROJE, STROP = 0.0025, 45.0, 50.0
    zaklad = cpm.get("45")
    if zaklad is not None:
        lvl = POSLEDNI_ZE_ZDROJE
        hodnota = zaklad
        while lvl < STROP - 1e-9:
            lvl += 0.5
            hodnota += KROK
            key = str(int(lvl)) if float(lvl).is_integer() else str(lvl)
            cpm.setdefault(key, round(hodnota, 8))
        kontrola = cpm.get("50")
        if kontrola is None or abs(kontrola - 0.8403) > 5e-5:
            raise SystemExit("CPM pro L50 vyšlo %r, čekáno 0.8403 — zkontroluj zdroj" % kontrola)

    # cena vylepšení o půl levelu: [z levelu, prach, bonbóny, XL bonbóny]
    powerup = []
    for row in raw["pokemon_powerup_requirements"].values():
        powerup.append([
            float(row["current_level"]),
            row.get("stardust_to_upgrade", 0),
            row.get("candy_to_upgrade", 0),
            row.get("xl_candy_to_upgrade", 0),
        ])
    powerup.sort(key=lambda r: r[0])

    # Holé jméno musí v grafu být taky. Species se pod ním doplňují (Flabébé
    # existuje jen jako flabebe-blue a spol., ale appka klíčuje na „flabebe"),
    # a bez téhož doplnění by se evoluční linie u barevných forem nenašla.
    evoluce = {k: sorted(set(v)) for k, v in sorted(evo_next.items()) if v}
    for key in list(species):
        if key in evoluce or "-" in key:
            continue
        varianta = next((k for k in evoluce if k.split("-")[0] == key), None)
        if varianta:
            evoluce[key] = evoluce[varianta]

    # Totéž pro podmínky: bez toho měl holý klíč evoluci, ale ne podmínku,
    # a v evoluční řadě zůstalo prázdno. Přepisuje se jen tam, kde holý klíč
    # vlastní podmínku nemá — forma má vždycky přednost.
    for key in list(evoluce):
        if "-" in key or key in pozadavky:
            continue
        varianta = next((k for k in pozadavky if k.split("-")[0] == key), None)
        if not varianta:
            continue
        prevzato = {}
        for cil, p in pozadavky[varianta].items():
            # Cíl se musí přemapovat na tu formu, na kterou holý klíč opravdu
            # vede: pumpkaboo -> gourgeist-average, ne gourgeist-small.
            zaklad = cil.split("-")[0]
            for skutecny in evoluce[key]:
                if skutecny.split("-")[0] == zaklad:
                    prevzato[skutecny] = p
        if prevzato:
            pozadavky[key] = prevzato

    out = {
        "_meta": {
            "zdroj": "https://pogoapi.net (veřejný mirror herního game masteru)",
            "stazeno": date.today().isoformat(),
            "pozn": "Regeneruj přes: python tools/build_pokedex.py --refresh",
            "schema_species": "klíč -> [id, jméno, [typy], base_attack, base_defense, base_stamina, umí_se_vyvinout(0/1), klíč finální evoluce nebo \"\", vzácnost L/M/U nebo \"\", cena evoluce v bonbónech (0 = nevyvíjí se)]",
            "schema_mega": "klíč -> [[jméno, atk, def, sta, [typy], mega_energie, Mega|Primal], …]",
            "schema_evoPozadavky": "klíč -> {cílový klíč: {km, buddy, item, lure,"
                                   " pohlavi, den, noc, tradeZdarma, vzhuruNohama, ukol}}",
            "zdroj_evoPozadavky_ukol": "herní GAME_MASTER (PokeMiners) — pogoapi"
                                       " úkoly před evolucí nemá",
            "schema_buddyKm": "klíč -> kolik km ujdeš na jeden bonbón",
            "schema_evoluce": "klíč -> [klíče forem, na které se přímo vyvíjí]",
            "pocty": {},
        },
        "cpm": cpm,
        "powerup": powerup,
        "species": species,
        "mega": mega,
        "evoPozadavky": pozadavky,
        "buddyKm": buddy_km,
        # Celý evoluční graf, ne jen koncová forma. Appka z něj umí složit
        # linii oběma směry — dopředu i dozadu — což z „finální evoluce"
        # nešlo: ta neřekne, z čeho kus vznikl, ani kudy vede cesta.
        # U větvených řad (Eevee, Ralts, Cosmog) je to navíc jediný zdroj,
        # protože ty žádnou jednoznačnou koncovou formu nemají.
        "evoluce": evoluce,
    }
    out["_meta"]["pocty"] = {"species": len(species), "mega": len(mega),
                             "evoPozadavky": len(pozadavky), "buddyKm": len(buddy_km),
                             "cpm": len(cpm),
                             "evolucnich_kroku": len(out["evoluce"]),
                             "finalnich_evoluci": sum(1 for v in species.values() if v[6] == 0),
                             "powerup_kroku": len(powerup),
                             "vzacnych": sum(1 for v in species.values() if v[8])}

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(out["_meta"]["pocty"], ensure_ascii=False))
    print("velikost:", OUT.stat().st_size, "B ->", OUT)


if __name__ == "__main__":
    main()
