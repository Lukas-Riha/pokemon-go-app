"""Doplní do data/reference.json data, která v původních skriptech nebyla:
mega-schopné druhy, primal formy a normalizovaná jména pro matchování."""
import json
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "reference.json"
data = json.loads(OUT.read_text(encoding="utf-8"))

# Dlouhodobě stabilní jádro Mega Evolucí dostupných v Pokémon GO.
# Nové mega formy Niantic přidává průběžně — při aktualizaci ověřit proti wiki.
MEGA = [
    "Venusaur", "Charizard", "Blastoise", "Beedrill", "Pidgeot", "Alakazam", "Slowbro",
    "Gengar", "Kangaskhan", "Pinsir", "Gyarados", "Aerodactyl", "Ampharos", "Steelix",
    "Scizor", "Heracross", "Houndoom", "Tyranitar", "Sceptile", "Blaziken", "Swampert",
    "Gardevoir", "Sableye", "Mawile", "Aggron", "Medicham", "Manectric", "Sharpedo",
    "Camerupt", "Altaria", "Banette", "Absol", "Glalie", "Salamence", "Metagross",
    "Latias", "Latios", "Rayquaza", "Lopunny", "Garchomp", "Lucario", "Abomasnow",
    "Gallade", "Audino", "Diancie",
]
PRIMAL = ["Kyogre", "Groudon"]

# Mega formy s vysokou hodnotou pro raidy (mega boost pomůže celé skupině).
MEGA_PRIORITY = {
    "Rayquaza": "Vysoká", "Metagross": "Vysoká", "Gengar": "Vysoká", "Lucario": "Vysoká",
    "Charizard": "Vysoká", "Blaziken": "Vysoká", "Garchomp": "Vysoká", "Gyarados": "Vysoká",
    "Salamence": "Vysoká", "Gardevoir": "Vysoká", "Sceptile": "Vysoká", "Alakazam": "Vysoká",
    "Venusaur": "Vysoká", "Tyranitar": "Střední", "Houndoom": "Střední", "Manectric": "Střední",
    "Pidgeot": "Střední", "Beedrill": "Střední", "Aerodactyl": "Střední", "Scizor": "Střední",
    "Diancie": "Střední", "Steelix": "Střední", "Ampharos": "Střední", "Swampert": "Střední",
    "Blastoise": "Nízká", "Abomasnow": "Nízká", "Glalie": "Nízká", "Pinsir": "Nízká",
}

# Druhy, které se po vytradování vyvinou zadarmo (0 bonbónů).
# Klíč je normalizované jméno, stejné jako v pokédexu.
# Plná typová tabulka: útočný typ -> obranný typ -> násobek poškození.
# Stahuje se z pogoapi (type_effectiveness) — obsahuje i odolnosti (0,625)
# a dvojité odolnosti (0,39), ne jen super efektivitu.
_te = json.loads((Path(__file__).resolve().parent.parent / "data" / "raw" / "type_effectiveness.json")
                 .read_text(encoding="utf-8"))
data["typeChart"] = {atk: {d: round(float(v), 4) for d, v in row.items()} for atk, row in _te.items()}

data["tradeEvolutions"] = [
    {"pokemon": "Kadabra", "evolvesTo": "Alakazam"},
    {"pokemon": "Machoke", "evolvesTo": "Machamp"},
    {"pokemon": "Graveler", "evolvesTo": "Golem"},
    {"pokemon": "Haunter", "evolvesTo": "Gengar"},
    {"pokemon": "Boldore", "evolvesTo": "Gigalith"},
    {"pokemon": "Gurdurr", "evolvesTo": "Conkeldurr"},
    {"pokemon": "Karrablast", "evolvesTo": "Escavalier"},
    {"pokemon": "Shelmet", "evolvesTo": "Accelgor"},
    {"pokemon": "Phantump", "evolvesTo": "Trevenant"},
    {"pokemon": "Pumpkaboo", "evolvesTo": "Gourgeist"},
]

data["megaEvolutions"] = [
    {"pokemon": p, "kind": "Mega", "raidPriority": MEGA_PRIORITY.get(p, "Nízká")} for p in MEGA
] + [
    {"pokemon": p, "kind": "Primal", "raidPriority": "Vysoká"} for p in PRIMAL
]


def match_names(label):
    """'Snorlax / Shadow Snorlax' -> ['snorlax']; 'Stunfisk (Galarian)' -> ['stunfisk']"""
    out = []
    for part in label.split("/"):
        part = re.sub(r"\(.*?\)", "", part).strip()
        part = re.sub(r"^(Shadow|Purified|Mega|Primal)\s+", "", part, flags=re.I).strip()
        if part and part.lower() not in out:
            out.append(part.lower())
    return out


def match_name(label):
    """Jméno druhu se zachovanou velikostí písmen (pro Excel COUNTIF/MATCH)."""
    part = label.split("/")[0]
    part = re.sub(r"\(.*?\)", "", part).strip()
    return re.sub(r"^(Shadow|Purified|Mega|Primal)\s+", "", part, flags=re.I).strip()


for row in data["gymDefenders"]:
    row["matchNames"] = match_names(row["pokemon"])
    row["matchName"] = match_name(row["pokemon"])
for row in data["raidAttackers"]:
    row["matchNames"] = match_names(row["pokemon"])
    row["matchName"] = match_name(row["pokemon"])
for league in data["pvp"].values():
    for row in league:
        row["matchNames"] = match_names(row["pokemon"])

data["_meta"]["obsahuje"] = {
    "typeChart": len(data["typeChart"]),
    "tradeEvolutions": len(data["tradeEvolutions"]),
    "raidAttackers": len(data["raidAttackers"]),
    "gymDefenders": len(data["gymDefenders"]),
    "megaEvolutions": len(data["megaEvolutions"]),
    "pvp": {k: len(v) for k, v in data["pvp"].items()},
}

OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(data["_meta"]["obsahuje"], ensure_ascii=False))
