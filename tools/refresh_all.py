# -*- coding: utf-8 -*-
"""Obnovení všech herních dat jedním příkazem — po nové generaci pokémonů.

    python tools/refresh_all.py            (stáhne, ověří, zapeče, otestuje)
    python tools/refresh_all.py --offline  (jen přepočítá z toho, co je v raw/)

Pořadí je záměrné a nedá se prohodit:
  1) pokédex  — ostatní kroky se proti němu ověřují (klíče druhů)
  2) ligy     — klíče z PvPoke se párují proti pokédexu; bez kroku 1 by nová
                generace spadla do „nesparováno". Stahují se i seznamy útoků
                po druzích, které pak potřebuje krok 3.
  3) útoky    — potřebují druhy z pokédexu a doplňují si učení z PvPoke
                (pogoapi má u části druhů neúplný seznam)
  4) eventy   — nezávislé, ale ať je všechno z jednoho dne
  5) audit    — integrita dat; když neprojde, dál se nepokračuje
  6) sync     — zapeče data do appky (jeden soubor pro file://)
  7) testy    — 971 testů appky + audit výpočtů přes celý pokédex

Když kterýkoli krok spadne, skript skončí a řekne u kterého — do appky se
nezapeče nic rozbitého.
"""
import subprocess
import sys
import time
from pathlib import Path

# Konzole na Windows jede v cp1250 a české výpisy dílčích skriptů ji shodí.
# Tenhle skript je jen dirigent — ať nespadne na tom, co má jen vypsat.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OFFLINE = "--offline" in sys.argv
PRESKOCIT_TESTY = "--bez-testu" in sys.argv

KROKY = [
    ("pokédex (druhy, staty, evoluce, CPM, ceny)", [sys.executable, "tools/build_pokedex.py"], True),
    ("ligy z PvPoke", [sys.executable, "tools/build_meta.py"], True),
    ("útoky (síla, energie, kdo se co učí)", [sys.executable, "tools/build_moves.py"], True),
    ("obrázky forem z PokeAPI", [sys.executable, "tools/build_sprites.py"], True),
    ("ikony typů (MIT sada)", [sys.executable, "tools/build_typ_ikony.py"], True),
    ("eventy a raid bossové", [sys.executable, "tools/build_events.py"], True),
    ("AUDIT integrity dat", [sys.executable, "tools/audit_data.py"], False),
    ("zapečení do appky", [sys.executable, "tools/sync_reference.py"], False),
]
TESTY = [
    ("testy appky", ["node", "tests/web_app.test.mjs"]),
    ("audit výpočtů přes celý pokédex", ["node", "tests/audit_app.test.mjs"]),
]


def spust(nazev, prikaz, tichy=True):
    print("\n" + "=" * 70)
    print(nazev)
    print("=" * 70)
    t = time.time()
    r = subprocess.run(prikaz, cwd=ROOT, capture_output=tichy, text=True,
                       encoding="utf-8", errors="replace")
    if tichy:
        vystup = ((r.stdout or "") + (r.stderr or "")).strip().splitlines()
        for radek in vystup[-12:]:
            print("   " + radek)
    if r.returncode != 0:
        print("\nSPADLO na kroku: %s" % nazev)
        if tichy and r.stdout:
            print(r.stdout[-3000:])
        if tichy and r.stderr:
            print(r.stderr[-3000:])
        sys.exit(1)
    print("   hotovo za %.1f s" % (time.time() - t))


def main():
    print("obnovení herních dat%s" % (" (offline — jen přepočet)" if OFFLINE else ""))
    for nazev, prikaz, stahuje in KROKY:
        p = list(prikaz)
        if stahuje and not OFFLINE:
            p.append("--refresh")
        spust(nazev, p)

    if PRESKOCIT_TESTY:
        print("\ntesty přeskočeny (--bez-testu)")
    else:
        for nazev, prikaz in TESTY:
            spust(nazev, prikaz, tichy=False)

    print("\n" + "=" * 70)
    print("VŠE HOTOVO — data obnovená, ověřená a zapečená do appky.")
    print("Rozeslat kolegyni:  powershell -ExecutionPolicy Bypass -File tools\\deploy.ps1")
    print("=" * 70)


if __name__ == "__main__":
    main()
