"""Doplní do data/reference.json data, která v původních skriptech nebyla:
mega-schopné druhy, primal formy a normalizovaná jména pro matchování."""
import json
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "reference.json"
data = json.loads(OUT.read_text(encoding="utf-8"))

# Které druhy mají ve hře mega formu, se BERE Z HERNÍCH DAT (pokédex, sekce
# "mega", postavená z game masteru). Dřív to tu byl ručně psaný seznam a
# stárl: Niantic mega formy přidává průběžně a nikdo to nehlídal. Appka si
# navíc prioritu megy počítá sama ze statů mega formy, takže ruční seznam
# priorit zmizel úplně — tady zbývá jen jméno a druh evoluce.
_dex = json.loads((Path(__file__).resolve().parent.parent / "data" / "pokedex.json")
                  .read_text(encoding="utf-8"))
_MEGA_Z_HRY = {}
for _klic, _formy in _dex.get("mega", {}).items():
    _jmeno = (_dex["species"].get(_klic) or [None, _klic])[1]
    # schema_mega: [jméno, atk, def, sta, [typy], mega_energie, Mega|Primal]
    _MEGA_Z_HRY[_jmeno] = _formy[0][6] if _formy and len(_formy[0]) > 6 else "Mega"

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

# raidPriority appka nepoužívá — počítá si ji z žebříčku mega forem. Zůstává
# jen jako záchrana pro formu, které žebříček nepřiřadí ani jeden použitelný
# útok, a tam je jediná poctivá odpověď "Neznámá".
data["megaEvolutions"] = [
    {"pokemon": p, "kind": k, "raidPriority": "Neznámá"}
    for p, k in sorted(_MEGA_Z_HRY.items())
]

# Ruční seznam raidových útočníků má u každého záznamu textovou "form".
# Stálo v ní "Mewtwo (Mega Y)" a "Machamp (Mega/Shadow)" — jenže ani jeden
# z těch dvou druhů ve hře mega formu nemá (Mega Mewtwo je jen v hlavní sérii).
# Appka tím uživateli tvrdila, že nejlepší Psychic útočník je mega, kterou
# si nikdy nenasadí. Nároky na formu se proto srovnají proti herním datům.
_MEGA_SLOVA = re.compile(r"\b(Mega(\s+[XY])?|Primal)\b\s*/?\s*", re.I)
for row in data.get("raidAttackers", []):
    forma = str(row.get("form") or "")
    if not _MEGA_SLOVA.search(forma):
        continue
    if row.get("pokemon") in _MEGA_Z_HRY:
        continue
    zbytek = _MEGA_SLOVA.sub("", forma).strip(" /")
    row["form"] = zbytek or "Běžná"


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
