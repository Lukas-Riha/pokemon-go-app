"""Vloží data/reference.json a data/pokedex.json do webové appky (mezi značky).

Appka musí zůstat jeden samostatný HTML soubor (otevíratelný přes file://),
takže se data nenačítají fetchem, ale zapékají se sem tímhle skriptem.

Spusť po každé změně dat:
    python tools/sync_reference.py
"""
import json
import datetime
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "reference.json"
DEX = ROOT / "data" / "pokedex.json"
APP = ROOT / "web-app" / "pokemon_tracker_app.html"

reference_all = json.loads(REF.read_text(encoding="utf-8"))
# Co appka nečte, se do ní nebalí. `gymDefenders` i `pvp` byly mrtvé:
# gymRoleFor si obránce počítá sám z výdrže přes všech 1110 druhů a ruční
# osmičku ignoruje (byla v ní i Dialga, kterou do gymu dát nejde); `pvp`
# lišty plnily jen příznak, který nikdo nečetl. V reference.json zůstávají
# jako lidská reference — do appky ale nemají co přinést, jen by stárly.
reference = {k: reference_all[k] for k in ("raidAttackers", "megaEvolutions",
                                          "tradeEvolutions", "typeChart", "weather")}

dex_all = json.loads(DEX.read_text(encoding="utf-8"))
# "evoluce" = celý evoluční graf; appka z něj skládá řadu oběma směry
# (detail kusu ukazuje, z čeho vznikl i čím se může stát).
pokedex = {k: dex_all[k] for k in ("cpm", "powerup", "species", "mega",
                                  "evoluce", "evoPozadavky", "buddyKm")}

MOVES = ROOT / "data" / "moves.json"
moves_all = json.loads(MOVES.read_text(encoding="utf-8"))
moves = {k: moves_all[k] for k in ("fastNames", "fast", "chargedNames", "charged",
                                   "pvpFast", "pvpCharged", "learn")}

EVENTS = ROOT / "data" / "events.json"
events_all = json.loads(EVENTS.read_text(encoding="utf-8"))
# „ligy" = rotace GO Battle League (co běží teď a co bude dál). Je to jediný
# strojově čitelný zdroj o tom, které ligy se zrovna hrají.
events = {k: events_all.get(k, []) for k in ("events", "raids", "ligy")}

SPRITES = ROOT / "data" / "sprites.json"
sprites_all = json.loads(SPRITES.read_text(encoding="utf-8")) if SPRITES.exists() else {"sprites": {}}
sprites = sprites_all.get("sprites", {})

# Symboly typů (MIT sada, viz tools/build_typ_ikony.py). Kreslí se jako
# inline SVG, takže appka nic nestahuje.
TYPE_ICONS_P = ROOT / "data" / "type_icons.json"
type_icons_all = json.loads(TYPE_ICONS_P.read_text(encoding="utf-8"))
type_icons = {k: type_icons_all[k] for k in ("viewBox", "ikony")}

META = ROOT / "data" / "meta.json"
meta_all = json.loads(META.read_text(encoding="utf-8"))
meta = {"leagues": meta_all["leagues"],
        # shadow varianty mají vlastní tabulku: bijí se jinak (+20 % útok,
        # −17 % obrana) a mívají jinou sestavu, takže je nelze slučovat
        # pod klíč běžného druhu
        "shadow": meta_all.get("shadow") or {},
        # kompletní pořadí pro prohlídku druhu (bez ořezu na metu)
        "poradiVse": meta_all.get("poradiVse") or {},
        "poradiVseShadow": meta_all.get("poradiVseShadow") or {}}

# stáří dat se ukazuje přímo v appce, ať je poznat, kdy je obnovit
data_info = {
    "pokedex": dex_all["_meta"].get("stazeno", ""),
    "meta": meta_all["_meta"].get("stazeno", ""),
    "metaTop": meta_all["_meta"].get("top", 0),
    "reference": reference_all["_meta"].get("aktualizovano", ""),
    "moves": moves_all["_meta"].get("stazeno", ""),
    "events": events_all["_meta"].get("stazeno", ""),
}

# Razítko sestavení. Bez něj se u sdíleného souboru nepozná, jestli má druhý
# člověk poslední verzi, nebo si otevírá starou kopii.
build = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

BLOCKS = [
    ("// === REFERENCE DATA START", "// === REFERENCE DATA END ===", "REFERENCE", reference),
    ("// === POKEDEX START", "// === POKEDEX END ===", "POKEDEX", pokedex),
    ("// === META START", "// === META END ===", "META", meta),
    ("// === MOVES START", "// === MOVES END ===", "MOVES", moves),
    ("// === EVENTS START", "// === EVENTS END ===", "EVENTS", events),
    ("// === SPRITES START", "// === SPRITES END ===", "SPRITES", sprites),
    ("// === TYPE ICONS START", "// === TYPE ICONS END ===", "TYPE_ICONS", type_icons),
    ("// === DATA INFO START", "// === DATA INFO END ===", "DATA_INFO", data_info),
    ("// === BUILD START", "// === BUILD END ===", "BUILD", build),
]

# Vzhledová vrstva. Drží ji někdo jiný a má vlastní soubory, aby se
# nemuselo sahat do hlavního HTML — dva lidi v jednom souboru o dvaadvaceti
# tisících řádcích se nutně přepisují. Vkládá se doslova, bez JSON obalu:
# CSS na konec <style> (tam přebije výchozí vzhled bez !important) a JS až
# za engine (takže `window.__pgo` už existuje).
# Vzhledová vrstva se zapéká JEN do testovací verze. Do produkce se nic
# nepřeklápí, dokud se to neodladí — proto `--test`:
#
#   python tools/sync_reference.py          → produkce, sloty prázdné
#   python tools/sync_reference.py --test   → pokemon_tracker_TEST.html i se vzhledem
#
# Engine je v obou stejný, je jen jeden. Testovací verze proto nemůže být
# pozadu: vyrábí se z téhož souboru.
TEST_BUILD = "--test" in sys.argv
TEST_APP = ROOT / "web-app" / "pokemon_tracker_TEST.html"
ATLAS = ROOT / "web-app" / "atlas"
ART = ATLAS / "atlas-art.json"
RAW_BLOCKS = [
    ("/* === ATLAS CSS START === */", "/* === ATLAS CSS END === */", ATLAS / "atlas.css"),
    ("// === ATLAS JS START ===", "// === ATLAS JS END ===", ATLAS / "atlas.js"),
]

lines = APP.read_text(encoding="utf-8").split("\n")
for start_mark, end_mark, var_name, payload in BLOCKS:
    start = next(i for i, l in enumerate(lines) if start_mark in l)
    end = next(i for i, l in enumerate(lines) if end_mark in l)
    body = "  var " + var_name + " = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"
    lines = lines[:start] + [lines[start], body, lines[end]] + lines[end + 1:]

atlas_stav = []
for start_mark, end_mark, cesta in RAW_BLOCKS:
    start = next((i for i, l in enumerate(lines) if start_mark in l), None)
    end = next((i for i, l in enumerate(lines) if end_mark in l), None)
    if start is None or end is None:
        atlas_stav.append(cesta.name + ": v appce chybí značka, přeskočeno")
        continue
    if not TEST_BUILD:
        # Produkce: slot se vyprázdní. Kdyby v něm z minulého --test běhu něco
        # zbylo, odejde to na Pages, aniž by o tom kdokoli věděl.
        lines = lines[:start] + [lines[start], lines[end]] + lines[end + 1:]
        continue
    if not cesta.exists():
        atlas_stav.append(cesta.name + ": soubor není, slot zůstal prázdný")
        lines = lines[:start] + [lines[start], lines[end]] + lines[end + 1:]
        continue
    telo = cesta.read_text(encoding="utf-8").rstrip("\n").split("\n")
    # Obrázky do JS slotu před vrstvu. Do produkce nejdou nikdy — třicet
    # megabajtů by z appky udělalo něco, co se v mobilu neotevře. V testu
    # se přidají na `--s-obrazky`; bez nich je build rychlý a appka funguje,
    # jen bez artu u vybraného kusu.
    if cesta.name == "atlas.js" and ART.exists() and "--s-obrazky" in sys.argv:
        telo = ["window.ATLAS_ART = "
                + ART.read_text(encoding="utf-8").strip() + ";"] + telo
        atlas_stav.append("obrázky %.1f MB" % (ART.stat().st_size / 1048576))
    lines = lines[:start] + [lines[start]] + telo + [lines[end]] + lines[end + 1:]
    atlas_stav.append("%s: %d řádků" % (cesta.name, len(telo)))

if TEST_BUILD:
    # Pojistka: do testovací verze se sáhne jen tehdy, když už je výstupem
    # téhle roury. Dokud tam někdo drží ručně upravovanou kopii, přepsat ji
    # by znamenalo zahodit cizí práci. (Stalo se — proto ta pojistka.)
    if TEST_APP.exists() and "ATLAS JS START" not in TEST_APP.read_text(
            encoding="utf-8", errors="replace"):
        raise SystemExit(
            "STOP: %s je rucne upravovana kopie, ne vystup buildu.\n"
            "       Nejdriv presun vzhled do web-app/atlas/ (viz\n"
            "       docs/ATLAS_KONTRAKT.md), pak ten soubor smaz a spust znovu."
            % TEST_APP)
    # Produkční soubor se nechává být — testovací verze je jeho kopie
    # se vzhledovou vrstvou navíc.
    from atlas_test_hooks import prepare_atlas_test
    from atlas_import_hooks import prepare_atlas_import
    TEST_APP.write_text(prepare_atlas_import(prepare_atlas_test("\n".join(lines))), encoding="utf-8")
else:
    APP.write_text("\n".join(lines), encoding="utf-8")

print("verze:     " + build)
print("reference: raid={} gym={} mega={}".format(
    len(reference["raidAttackers"]), len(reference_all["gymDefenders"]),
    len(reference["megaEvolutions"])))
print("pokedex:   druhů={} mega={} cpm={} evolucí={} podmínek={}".format(
    len(pokedex["species"]), len(pokedex["mega"]), len(pokedex["cpm"]),
    len(pokedex["evoluce"]), len(pokedex["evoPozadavky"])))
print("meta:      " + ", ".join(k + "=" + str(len(v)) for k, v in meta["leagues"].items()))
print("  z toho shadow: " + ", ".join(
    k + "=" + str(len(v)) for k, v in (meta["shadow"] or {}).items()))
print("moves:     rychlé={} nabité={} druhů={}".format(
    len(moves["fastNames"]), len(moves["chargedNames"]), len(moves["learn"])))
print("obrazky:   {} forem s vlastnim obrazkem".format(len(sprites)))
print("ikony typu: {}".format(len(type_icons["ikony"])))
print("eventy:    {} akcí, {} raid bossů".format(len(events["events"]), len(events["raids"])))
print("vzhled:    " + (", ".join(atlas_stav) if atlas_stav
                       else ("nic" if TEST_BUILD else "do produkce se nezapéká")))
print("cíl:       " + str(TEST_APP if TEST_BUILD else APP))
print("velikost appky:", (TEST_APP if TEST_BUILD else APP).stat().st_size, "B")
