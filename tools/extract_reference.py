"""Jednorázová extrakce: vytáhne referenční data z build_xlsx.py do data/reference.json.

Po prvním běhu už není potřeba — zdrojem pravdy se stává data/reference.json.
Ponecháno v repu kvůli reprodukovatelnosti (jak vznikl JSON z původních skriptů).
"""
import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "xlsx-reference" / "build_xlsx.py"
OUT = ROOT / "data" / "reference.json"

src = SRC.read_text(encoding="utf-8")


def grab(name):
    """Vytáhne literál seznamu `name = [...]` a bezpečně ho vyhodnotí."""
    m = re.search(rf"^{name}\s*=\s*(\[)", src, re.M)
    if not m:
        raise SystemExit(f"nenalezeno: {name}")
    start = m.start(1)
    depth = 0
    for i in range(start, len(src)):
        if src[i] == "[":
            depth += 1
        elif src[i] == "]":
            depth -= 1
            if depth == 0:
                return ast.literal_eval(src[start:i + 1])
    raise SystemExit(f"neuzavřený literál: {name}")


def objects(rows, keys):
    return [dict(zip(keys, r)) for r in rows]


raid = objects(grab("raid_rows"), ["type", "rank", "pokemon", "form", "fastMove", "chargedMove", "priority"])
gym = objects(grab("def_rows"), ["rank", "pokemon", "types", "trait", "note"])
pvp_keys = ["rank", "pokemon", "types", "cpLimit", "fastMove", "charged1", "charged2", "role", "note"]
pvp = {
    "great": objects(grab("great_rows"), pvp_keys),
    "ultra": objects(grab("ultra_rows"), pvp_keys),
    "master": objects(grab("master_rows"), pvp_keys),
}

data = {
    "_meta": {
        "popis": "Jediný zdroj pravdy pro referenční data. Čte ho build_xlsx.py, build_tracker.py i webová appka (přes tools/sync_reference.py).",
        "aktualizovano": "2026-08",
        "overovat_proti": ["https://pvpoke.com", "https://pokemongohub.net"],
        "poznamka": "Meta se mění s balance patchi — jde o dlouhodobě stabilní jádro, ne zmrazený tier list.",
    },
    "raidAttackers": raid,
    "gymDefenders": gym,
    "pvp": pvp,
}

OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"raid={len(raid)} gym={len(gym)} gl={len(pvp['great'])} ul={len(pvp['ultra'])} ml={len(pvp['master'])} -> {OUT}")
