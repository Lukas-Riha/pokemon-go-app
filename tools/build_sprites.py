# -*- coding: utf-8 -*-
"""Mapování klíč druhu → číslo obrázku v PokeAPI.

Proč to existuje: appka brala obrázek podle čísla v pokédexu, jenže to je
číslo ZÁKLADNÍ formy. Zygarde 10 % tak ukazoval padesátiprocentní formu,
Oricorio Pom-Pom červeného Baile a Wormadam Trash zelenou Plant formu.
PokeAPI má pro formy vlastní čísla (10000+), jen se musí spárovat podle jména.

Páruje se přes normalizované jméno, takže nová generace se doplní sama —
stačí skript pustit znovu. Co se nespáruje, se vypíše a v appce prostě
zůstane obrázek základní formy (což je pořád lepší než křížek).

Spuštění:  python tools/build_sprites.py [--refresh]
"""
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "sprites.json"
API = "https://pokeapi.co/api/v2/pokemon?limit=100000"

# Jak se naše přípony jmenují u PokeAPI. Zbytek se páruje doslova.
PREKLAD = {
    "alola": "alola", "galar": "galar", "hisui": "hisui", "paldea": "paldea",
    "tenpercent": "10", "fiftypercent": "50", "complete": "complete",
    "completetenpercent": "10", "completefiftypercent": "50",
    "pompom": "pompom", "pau": "pau", "sensu": "sensu", "baile": "baile",
    "crownedsword": "crowned", "crownedshield": "crowned",
    "icerider": "ice", "shadowrider": "shadow",
    "dawnwings": "dawn", "duskmane": "dusk", "ultra": "ultra",
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def fetch(refresh):
    cesta = RAW / "pokeapi_pokemon.json"
    if refresh or not cesta.exists():
        print("stahuji seznam z PokeAPI …")
        req = urllib.request.Request(API, headers={"User-Agent": "pokemon-go-planner (local build)"})
        with urllib.request.urlopen(req, timeout=120) as r:
            cesta.write_bytes(r.read())
    return json.loads(cesta.read_text(encoding="utf-8"))


def main():
    refresh = "--refresh" in sys.argv
    api = fetch(refresh)
    dex = json.loads((ROOT / "data" / "pokedex.json").read_text(encoding="utf-8"))["species"]

    # PokeAPI jméno -> id  (jméno je typu "zygarde-10", "oricorio-pom-pom")
    podle_jmena = {}
    for r in api.get("results", []):
        m = re.search(r"/pokemon/(\d+)/?$", r["url"])
        if not m:
            continue
        podle_jmena[norm(r["name"])] = int(m.group(1))

    sprites = {}
    nesparovane = []
    for key, e in dex.items():
        if "-" not in key:
            continue                      # základní forma: číslo z pokédexu stačí
        base, _, suffix = key.partition("-")
        kandidati = []
        prelozene = PREKLAD.get(suffix)
        if prelozene:
            kandidati.append(base + prelozene)
        kandidati.append(base + suffix)
        # PokeAPI má u některých forem jméno bez přípony (Frillish, Squawkabilly)
        nasel = None
        for k in kandidati:
            if k in podle_jmena:
                nasel = podle_jmena[k]
                break
        if nasel and nasel != e[0]:
            sprites[key] = nasel
        elif not nasel:
            nesparovane.append(key)

    out = {
        "_meta": {
            "zdroj": API,
            "stazeno": date.today().isoformat(),
            "pozn": "klíč druhu -> číslo obrázku v PokeAPI (jen tam, kde se liší od pokédexu)",
        },
        "sprites": sprites,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("spárováno %d forem s vlastním obrázkem -> %s (%d B)"
          % (len(sprites), OUT.name, OUT.stat().st_size))
    if nesparovane:
        print("bez vlastního obrázku (zůstane základní forma): %d" % len(nesparovane))
        print("   " + ", ".join(sorted(nesparovane)[:12]))


if __name__ == "__main__":
    main()
