"""Stáhne aktuální PvP žebříčky z PvPoke a upeče z nich data/meta.json.

Proč: ručně kurátorovaný seznam v reference.json má 39 picků a stárne s každým
balance patchem. PvPoke svoje žebříčky publikuje jako JSON přímo v repu, takže
se dají obnovit jedním příkazem.

Bere se odsud i **doporučený moveset**. Vlastní výpočet poškození za tah tuhle
práci udělat nemůže: neumí ocenit štíty (nabitý útok se dá zablokovat) ani buffy
— Power Up Punch má poškození na energii 0,57, takže by vyšel jako odpad,
přestože je to Medichamova podpisová schopnost. PvPoke souboje simuluje, včetně
obojího.

Shadow varianty se DRŽÍ ZVLÁŠŤ. Dřív se slévaly na klíč základního druhu
a vyhrávala ta výš postavená, takže 86 záznamů napříč ligami ukazovalo pod
holým jménem rank a moveset shadow kusu — Ninetales měl v Great League #2,
což je ale Shadow Ninetales. Shadow se ve hře bije jinak (+20 % útok,
−17 % obrana), takže je to jiný pokémon, ne jiný název téhož.

Zdroj: https://github.com/pvpoke/pvpoke (src/data/rankings/all/overall/)

Spuštění:
    python tools/build_meta.py              # použije cache v data/raw/
    python tools/build_meta.py --refresh    # stáhne znovu
    python tools/build_meta.py --top 300    # kolik picků na ligu si nechat
"""
import json
import re
import subprocess
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "meta.json"
HISTORIE = ROOT / "data" / "poradi_historie.json"

# --- paměť pořadí ---------------------------------------------------------
# PvPoke přepočítává žebříčky tak často, že kus, který appka minulý týden
# poslala vyvíjet, tenhle týden posílala pryč — a za další týden by byl zase
# dobrý. O nechat/pustit proto rozhoduje NEJLEPŠÍ pořadí druhu za posledních
# PAMET_DNI dní, ne jen to dnešní.
PAMET_DNI = 30
# Hlouběji se neukládá: rozpočet bere vážně zhruba prvních padesát míst
# (nastavitelné nejvýš na pár set) a dlouhý ocas by historii jen nafoukl.
PAMET_MAX_RANK = 200


def snimek_poradi(leagues, poradi_vse, shadow, poradi_vse_shadow, max_rank=PAMET_MAX_RANK):
    """Pořadí druhů do `max_rank` jako {liga: {klíč: pořadí}}.

    Shadow varianty jsou pod klíčem ligy s předponou „shadow:" — bijí se
    jinak a mají vlastní pořadí, slévat je s běžným druhem nejde."""
    vys = {}
    for predpona, zdroje in (("", (leagues, poradi_vse)),
                             ("shadow:", (shadow, poradi_vse_shadow))):
        for zdroj in zdroje:
            for liga, tab in (zdroj or {}).items():
                cil = vys.setdefault(predpona + liga, {})
                for k, v in (tab or {}).items():
                    if v and v[0] <= max_rank and k not in cil:
                        cil[k] = v[0]
    return {liga: tab for liga, tab in vys.items() if tab}


def aktualni_poradi(leagues, poradi_vse, shadow, poradi_vse_shadow):
    """Dnešní pořadí BEZ ořezu — druh na #350 je pořád „dnes #350"."""
    return snimek_poradi(leagues, poradi_vse, shadow, poradi_vse_shadow, max_rank=10 ** 9)


def pridej_snimek(historie, datum, snimek):
    """Přidá snímek, jen když se liší od posledního uloženého.

    Skript se pouští i bez --refresh; přegenerování z týchž dat nesmí do
    historie přidat „nový" den, jinak by okno paměti ujíždělo naprázdno."""
    snimky = historie.setdefault("snimky", {})
    starsi = sorted(d for d in snimky if d < datum)
    if starsi and snimky[starsi[-1]] == snimek and datum not in snimky:
        return False
    if snimky.get(datum) == snimek:
        return False
    snimky[datum] = snimek
    return True


def orez_historii(historie, dnes, dni=PAMET_DNI):
    """Smaže snímky starší než okno — kromě posledního PŘED oknem.

    Ten se nechává schválně: jeho pořadí platilo ještě v první den okna
    (další snímek přišel až později), takže do paměti patří."""
    hranice = (dnes - timedelta(days=dni)).isoformat()
    snimky = historie.get("snimky", {})
    pred = sorted(d for d in snimky if d < hranice)
    for d in pred[:-1]:
        del snimky[d]
    return historie


def nejlepsi_poradi(historie, dnes, aktualni, dni=PAMET_DNI):
    """Nejlepší pořadí za posledních `dni` dní — jen tam, kde je LEPŠÍ než dnes.

    Vrací {liga: {klíč: [pořadí, datum]}}. Druh, který dnes v datech vůbec
    není, se bere jako propadlý (paměť ho drží). Snímek z doby před oknem
    dostane datum začátku okna — tehdy ještě platil."""
    hranice = (dnes - timedelta(days=dni)).isoformat()
    snimky = historie.get("snimky", {})
    datumy = sorted(snimky)
    v_okne = [d for d in datumy if hranice <= d <= dnes.isoformat()]
    pred = [d for d in datumy if d < hranice]
    if pred:
        v_okne = [pred[-1]] + v_okne
    vys = {}
    for d in v_okne:
        platnost = d if d >= hranice else hranice
        for liga, tab in snimky[d].items():
            ted = aktualni.get(liga, {})
            cil = vys.setdefault(liga, {})
            for k, r in tab.items():
                t = ted.get(k)
                if t is not None and r >= t:
                    continue
                # Při shodě se nechá POZDĚJŠÍ datum: „ještě před 3 dny #40"
                # řekne víc než „před měsícem #40".
                if k not in cil or r < cil[k][0] or (r == cil[k][0] and platnost > cil[k][1]):
                    cil[k] = [r, platnost]
    return {liga: tab for liga, tab in vys.items() if tab}


def seed_z_gitu():
    """Poprvé se historie poskládá z dřívějších verzí data/meta.json v gitu."""
    historie = {"snimky": {}}
    try:
        hashe = subprocess.run(
            ["git", "log", "--reverse", "--format=%h", "--", "data/meta.json"],
            cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    except Exception:
        return historie
    for h in hashe:
        try:
            obsah = subprocess.run(["git", "show", h + ":data/meta.json"], cwd=ROOT,
                                   capture_output=True, check=True).stdout.decode("utf-8")
            m = json.loads(obsah)
        except Exception:
            continue
        datum = (m.get("_meta") or {}).get("stazeno")
        if not datum or not m.get("leagues"):
            continue
        pridej_snimek(historie, datum, snimek_poradi(
            m.get("leagues"), m.get("poradiVse"), m.get("shadow"), m.get("poradiVseShadow")))
    return historie

BASE = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/"
LEAGUES = {"little": 500, "great": 1500, "ultra": 2500, "master": 10000}
DEFAULT_TOP = 200
# Útok se bere jako v pořádku, když ho simulace použila aspoň takovým podílem
# oproti nejpoužívanějšímu útoku téhož druhu.
OK_SHARE = 0.4
# Samotné „top 200" nestačí: Great a Ultra mají přes tisíc záznamů, takže se
# ořežou na skutečnou metu (nejhorší v seznamu má pořád skóre 83). Little Cup
# jich má jen 168, takže by prošlo úplně všechno včetně Magikarpa na #167.
# Skóre je u PvPoke porovnatelné napříč ligami, tak se přidá i práh na něj.
MIN_SCORE = 70

# přípony ve speciesId, které znamenají jinou formu (musí sedět s dexKey v appce)
FORM_SUFFIX = {
    "alolan": "alola", "alola": "alola", "galarian": "galar", "galar": "galar",
    "hisuian": "hisui", "hisui": "hisui", "paldean": "paldea", "paldea": "paldea",
    "therian": "therian", "incarnate": "incarnate", "origin": "origin", "altered": "altered",
    "attack": "attack", "defense": "defense", "speed": "speed", "black": "black", "white": "white",
    "sky": "sky", "land": "land", "hero": "hero",
}
# přípony, které pro nás nic nemění (shadow řešíme zvlášť, kosmetika nás nezajímá)
IGNORED_SUFFIX = {"shadow", "purified", "normal", "standard"}


def fetch(refresh):
    RAW.mkdir(parents=True, exist_ok=True)
    out = {}
    for league, cap in LEAGUES.items():
        path = RAW / f"pvpoke_{cap}.json"
        if refresh or not path.exists():
            print(f"stahuji žebříček {league} ({cap}) …")
            with urllib.request.urlopen(f"{BASE}rankings-{cap}.json", timeout=90) as r:
                path.write_bytes(r.read())
        out[league] = json.loads(path.read_text(encoding="utf-8"))
    return out


def nacti_pokedex():
    """Klíče druhů, proti kterým se výsledek ověřuje. Bez toho se nedá poznat,
    jestli je 'porygon_z' vlastní druh, nebo Porygon s kosmetickou příponou."""
    cesta = ROOT / "data" / "pokedex.json"
    if not cesta.exists():
        return set()
    return set(json.loads(cesta.read_text(encoding="utf-8"))["species"])


def alias_utoku(jm):
    """PvPoke ID -> název, jak ho zná appka.

    PvPoke má pro pár útoků vlastní ID, které nese i jméno druhu:
    AEGISLASH_CHARGE_PSYCHO_CUT je pořád obyčejný Psycho Cut, jen zapsaný tak,
    aby šlo rozlišit, ve které formě ho Aegislash používá. Bez tohohle převodu
    se doporučený útok nespáruje a appka u Aegislashe tvrdí, že ho neumí.

    Hidden Power je v herních datech JEDEN útok (typ určuje kus), PvPoke ho
    rozepisuje na 18 typových variant — všechny míří na tentýž útok.
    """
    j = str(jm or "")
    if j.startswith("AEGISLASH_CHARGE_"):
        return j[len("AEGISLASH_CHARGE_"):]
    if j.startswith("HIDDEN_POWER"):
        return "HIDDEN_POWER"
    return j


def dex_key(species_id, znami=None):
    """'stunfisk_galarian' -> stunfisk-galar, 'altaria_shadow' -> altaria,
    'porygon_z' -> porygonz, 'ho_oh' -> hooh.

    Dřív se braly jen znaky před prvním podtržítkem, takže z 'ho_oh' vyšlo 'ho'
    (druh, který neexistuje) a z 'porygon_z' vyšlo 'porygon' — a Porygon tím
    dostal ranky Porygona-Z. Teď se poskládá víc kandidátů a vezme se první,
    který v pokédexu opravdu je. Nová generace se tím vyřeší sama."""
    parts = [p.lower() for p in str(species_id).split("_") if p]
    if not parts:
        return ""
    suffix = ""
    jmeno = []
    for i, p in enumerate(parts):
        if i > 0 and p in IGNORED_SUFFIX:
            continue
        if i > 0 and p in FORM_SUFFIX:
            suffix = FORM_SUFFIX[p]
            continue
        jmeno.append(p)

    def cist(x):
        return re.sub(r"[^a-z0-9]", "", x)

    spojene = cist("".join(jmeno))
    zaklad = cist(parts[0])
    kandidati = []
    if suffix:
        kandidati += [f"{spojene}-{suffix}", f"{zaklad}-{suffix}"]
    kandidati += [spojene, zaklad]
    # PvPoke má u části záznamů příponu přilepenou bez podtržítka ("golisopodsh"),
    # takže se zkusí i varianta bez ní
    for pripona in ("shadow", "purified", "sh"):
        if spojene.endswith(pripona) and len(spojene) > len(pripona) + 2:
            kandidati.append(spojene[:-len(pripona)])
    if znami:
        for k in kandidati:
            if k in znami:
                return k
    # nic nesedí (nová generace, kterou pokédex ještě nezná) — vrátí se
    # nejúplnější varianta a audit na to upozorní
    return kandidati[0]


def je_shadow(zaznam):
    """PvPoke značí shadow variantu v ID i v zobrazovaném jméně."""
    sid = str(zaznam.get("speciesId") or "").lower()
    jmeno = str(zaznam.get("speciesName") or "").lower()
    return sid.endswith("_shadow") or sid.endswith("shadow") or "(shadow)" in jmeno


def main():
    refresh = "--refresh" in sys.argv
    top = DEFAULT_TOP
    if "--top" in sys.argv:
        top = int(sys.argv[sys.argv.index("--top") + 1])

    raw = fetch(refresh)
    znami = nacti_pokedex()
    if not znami:
        print("POZOR: pokedex.json chybí, klíče se nedají ověřit")
    nesparovane = []
    leagues = {}
    shadow_leagues = {}
    for league, rows in raw.items():
        table = {}
        shadow_table = {}
        for i, r in enumerate(rows[:top], start=1):
            key = dex_key(r.get("speciesId", ""), znami)
            if znami and key not in znami:
                nesparovane.append(f"{league}: {r.get('speciesId')} -> {key}")
            # Shadow do vlastní tabulky: je to jiný kus, ne jiný název.
            cil = shadow_table if je_shadow(r) else table
            if not key or key in cil:
                continue  # lepší (výš postavená) varianta té formy už tam je
            if float(r.get("score") or 0) < MIN_SCORE:
                continue  # spodek žebříčku už není meta, jen doplněk seznamu
            # moveset = [rychlý, nabitý 1, nabitý 2] v PvPoke ID (POWER_UP_PUNCH);
            # appka si je páruje přes stejnou normalizaci jako jména útoků
            mv = [alias_utoku(x) for x in (r.get("moveset") or [])][:3]
            # Kolikrát simulace který útok použila. Z toho jde poznat útok, který
            # je sice jiný než doporučený, ale pořád v pořádku: Medicham má
            # Counter na 73 % užití Psycho Cutu — to není chyba, jen jiná volba.
            # Zen Headbutt u Miltank má 13 % a to už chyba je.
            ok = []
            for group in ("fastMoves", "chargedMoves"):
                lst = (r.get("moves") or {}).get(group) or []
                most = max([m.get("uses") or 0 for m in lst] or [0])
                if not most:
                    continue
                for m in lst:
                    if (m.get("uses") or 0) / most >= OK_SHARE:
                        ok.append(alias_utoku(m.get("moveId")))
            cil[key] = [i, round(float(r.get("score") or 0), 1), r.get("speciesName", ""), mv, ok]
        leagues[league] = table
        shadow_leagues[league] = shadow_table

    # Kompletní pořadí BEZ ořezu — na otázku „kde ten druh hraje" se nesmí
    # odpovídat metou. Jen [pořadí, skóre], žádné movesety.
    poradi_vse = {}
    poradi_vse_shadow = {}
    for league, rows in raw.items():
        tabulka = {}
        tabulka_sh = {}
        v_mete = leagues.get(league, {})
        v_mete_sh = shadow_leagues.get(league, {})
        for i, r in enumerate(rows, start=1):
            key = dex_key(r.get("speciesId", ""), znami)
            if not key:
                continue
            sh = je_shadow(r)
            cil, hotovo = (tabulka_sh, v_mete_sh) if sh else (tabulka, v_mete)
            if key in cil or key in hotovo:
                # Co je v metě, se sem nepíše: appka se dívá nejdřív tam a odtud
                # bere i moveset. Duplicita by byla 448 zbytečných záznamů.
                continue
            cil[key] = [i, round(float(r.get("score") or 0), 1)]
        poradi_vse[league] = tabulka
        poradi_vse_shadow[league] = tabulka_sh

    # --- posun v žebříčku od minulé obnovy -------------------------------
    # PvPoke přepočítává pořadí často a rosterem to hýbe: Azumarill spadl
    # v Great League z #24 na #32 a s ním se u téhož kusu změnil verdikt.
    # Bez porovnání to vypadá, že se appka rozmyslela sama od sebe.
    # Uloží se pořadí z minulého STAŽENÍ (ne z minulého běhu skriptu) —
    # přegenerování týž den nesmí srovnávací základ zahodit.
    def vsechna_poradi(meta_dict):
        """Pořadí druhů v metě — jen z `leagues`.

        Dlouhý ocas z `poradiVse` se schválně nebere: jsou to stovky druhů
        kolem #500, kde je posun o deset míst bez následku (rozpočet bere
        vážně zhruba prvních padesát). Do appky by to přidalo 26 kB dat,
        která by nikdy nikoho nezajímala."""
        vys = {}
        for zdroj in ("leagues",):
            for liga, tab in (meta_dict.get(zdroj) or {}).items():
                cil = vys.setdefault(liga, {})
                for k, v in (tab or {}).items():
                    if v and k not in cil:
                        cil[k] = v[0]
        return vys

    dnes = date.today().isoformat()
    nova_poradi = vsechna_poradi({"leagues": leagues, "poradiVse": poradi_vse})
    drive = {"datum": None, "ligy": {}}
    if OUT.exists():
        try:
            stary = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            stary = None
        if stary:
            stara_poradi = vsechna_poradi(stary)
            if stara_poradi and stara_poradi != nova_poradi:
                # Pořadí se opravdu pohnulo -> tohle je nový srovnávací základ.
                # Rozhoduje OBSAH, ne datum: skript se pouští i bez --refresh
                # a přegenerování z týchž dat nesmí základ zahodit.
                #
                # Ukládá se JEN to, co se změnilo. Celá tabulka by do appky
                # přidala 26 kB kvůli stovkám druhů, u kterých se nehnulo nic
                # a appka u nich stejně nic neukáže.
                zmenene = {}
                for liga, tab in stara_poradi.items():
                    nove = nova_poradi.get(liga) or {}
                    rozdily = {k: v for k, v in tab.items()
                               if k in nove and nove[k] != v}
                    if rozdily:
                        zmenene[liga] = rozdily
                drive = {"datum": (stary.get("_meta") or {}).get("stazeno") or dnes,
                         "ligy": zmenene}
            else:
                drive = stary.get("poradiDrive") or drive

    # --- paměť pořadí: historie snímků a nejlepší pořadí za okno ----------
    if HISTORIE.exists():
        historie = json.loads(HISTORIE.read_text(encoding="utf-8"))
    else:
        historie = seed_z_gitu()
        print("historie poradi poskladana z gitu:", len(historie.get("snimky", {})), "snimku")
    pridej_snimek(historie, dnes, snimek_poradi(leagues, poradi_vse,
                                                shadow_leagues, poradi_vse_shadow))
    orez_historii(historie, date.today())
    historie["_meta"] = {
        "pozn": "Snímky pořadí PvPoke pro paměť pořadí (build_meta.py). Ukládá se jen"
                " den, kdy se pořadí změnilo; starší než okno se mažou kromě posledního.",
        "okno_dni": PAMET_DNI, "max_rank": PAMET_MAX_RANK,
    }
    HISTORIE.write_text(json.dumps(historie, ensure_ascii=False, separators=(",", ":"),
                                   sort_keys=True) + "\n", encoding="utf-8")
    nejlepsi = nejlepsi_poradi(historie, date.today(), aktualni_poradi(
        leagues, poradi_vse, shadow_leagues, poradi_vse_shadow))
    snimky = sorted(historie.get("snimky", {}))
    pamet = {
        "dni": PAMET_DNI,
        "od": max(snimky[0], (date.today() - timedelta(days=PAMET_DNI)).isoformat()) if snimky else None,
        "snimku": len(snimky),
        "ligy": {l: t for l, t in nejlepsi.items() if not l.startswith("shadow:")},
        "shadow": {l.split(":", 1)[1]: t for l, t in nejlepsi.items() if l.startswith("shadow:")},
    }

    out = {
        "_meta": {
            "zdroj": "https://github.com/pvpoke/pvpoke (src/data/rankings/all/overall)",
            "stazeno": date.today().isoformat(),
            "top": top,
            "min_skore": MIN_SCORE,
            "schema": "liga -> klíč druhu -> [pořadí, skóre, jméno v PvPoke, [doporučený moveset], [útoky, které simulace používá]]",
            "shadow": "shadow varianty jsou v `shadow` a `poradiVseShadow` pod stejným klíčem druhu",
            "pozn": "Regeneruj přes: python tools/build_meta.py --refresh",
        },
        "leagues": leagues,
        "shadow": shadow_leagues,
        "poradiVse": poradi_vse,
        "poradiVseShadow": poradi_vse_shadow,
        "poradiDrive": drive,
        "poradiPamet": pamet,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    with_moves = {k: sum(1 for v in t.values() if len(v) > 3 and v[3]) for k, t in leagues.items()}
    print({k: len(v) for k, v in leagues.items()}, "s movesetem:", with_moves,
          "->", OUT, OUT.stat().st_size, "B")
    print("shadow varianty:", {k: len(v) for k, v in shadow_leagues.items()})
    print("kompletni poradi:", {k: len(v) for k, v in poradi_vse.items()},
          "+ shadow", {k: len(v) for k, v in poradi_vse_shadow.items()})
    if nesparovane:
        print()
        print(f"NESPAROVANO s pokedexem ({len(nesparovane)}) — tyhle druhy nedostanou rank:")
        for radek in nesparovane[:20]:
            print("   " + radek)
        if len(nesparovane) > 20:
            print(f"   ... a dalsich {len(nesparovane) - 20}")
        print("   (nova generace? spust nejdriv build_pokedex.py --refresh)")


if __name__ == "__main__":
    main()
