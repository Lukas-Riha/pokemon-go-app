# -*- coding: utf-8 -*-
"""Denní propis akcí z LeekDucku do obou prostředí.

Rozpis akcí se mění každý týden, ale data jsou zapečená v sestavení appky.
Appka si proto vedle sebe hledá `events.json` a co najde, přebije zapečenou
kopii (viz `udalostiZeptejSe` v enginu). Tenhle skript ten soubor vyrobí
a položí ho tam, kde ho appka hledá:

* ``web-app/events.json``  — vedle TEST sestavení (lokální prostředí),
* ``publish/events.json``  — vedle produkční appky na GitHub Pages.

**Appka samotná se neposílá.** Do `publish/` se sahá jen na `events.json`,
takže rozpracovaná verze nemůže omylem odejít do produkce. Zámek
`PRODUKCE_ZAMCENA.txt` se proto nekontroluje — ten hlídá nasazení appky,
ne obnovu dat, o kterou si uživatel výslovně řekl.

Pojistky, než se cokoli pošle:

* stažení musí projít a JSON musí jít přečíst,
* akcí musí být aspoň tolik, kolik jich bylo (nový soubor nesmí být
  podezřele chudší — to by znamenalo, že se zdroj rozbil),
* každá akce musí mít jméno; akce bez termínu se do souboru nedostanou
  už při sestavení.

Když cokoli z toho neplatí, původní `data/events.json` se vrátí ze zálohy
a nic se nepublikuje.

Spuštění:   python tools/akce_denne.py
Bez pushe:  python tools/akce_denne.py --nahlas   (jen vyrobí a ukáže rozdíl)
"""
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "events.json"
WEB = ROOT / "web-app" / "events.json"
PUBLISH = ROOT / "publish" / "events.json"
LOG = ROOT / "zalohy" / "akce.txt"

# O kolik smí nový soubor zhubnout, než to budeme brát jako rozbitý zdroj.
# Akce přirozeně odcházejí, ale propad na polovinu znamená chybu, ne týden.
MIN_PODIL = 0.6


def zprava(text):
    print(text)
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write("%s  %s\n" % (datetime.now().strftime("%Y-%m-%d %H:%M"), text))
    except Exception:
        pass


def nacti(cesta):
    try:
        return json.loads(cesta.read_text(encoding="utf-8"))
    except Exception:
        return None


def spust(prikaz):
    hotovo = subprocess.run(prikaz, cwd=str(ROOT), capture_output=True, text=True,
                            encoding="utf-8", errors="replace")
    return hotovo.returncode, (hotovo.stdout or "") + (hotovo.stderr or "")


def main():
    jen_nahlas = "--nahlas" in sys.argv
    zaloha = DATA.with_suffix(".json.pred")
    stary = nacti(DATA)
    # Když po předchozím běhu zůstal cílový soubor rozbitý (proces skončil
    # v půlce), vrátí se ze zálohy ještě předtím, než se cokoli dělá. Jinak
    # by se za chvíli zálohou stal ten rozbitý soubor a původní data by
    # zmizela úplně.
    if not stary and nacti(zaloha):
        shutil.copy2(zaloha, DATA)
        stary = nacti(DATA)
        zprava("POZOR: data/events.json byl rozbity, vracen ze zalohy")
    stary = stary or {}
    pocet_pred = len(stary.get("events") or [])
    # Záloha se dělá jen z čitelného souboru — prázdná záloha nezachrání nic.
    if stary:
        shutil.copy2(DATA, zaloha)
    elif zaloha.exists():
        zaloha.unlink()

    kod, vystup = spust([sys.executable, "tools/build_events.py", "--refresh"])
    if kod != 0:
        if zaloha.exists():
            shutil.copy2(zaloha, DATA)
        zprava("CHYBA: stazeni akci spadlo, data vracena ze zalohy")
        print(vystup[-1500:])
        return 1

    novy = nacti(DATA)
    akce = (novy or {}).get("events") or []
    if not novy or not akce:
        if zaloha.exists():
            shutil.copy2(zaloha, DATA)
        zprava("CHYBA: novy soubor je prazdny nebo necitelny, data vracena")
        return 1
    if any(not (e and e[0]) for e in akce):
        if zaloha.exists():
            shutil.copy2(zaloha, DATA)
        zprava("CHYBA: akce bez jmena v novem souboru, data vracena")
        return 1
    if pocet_pred and len(akce) < pocet_pred * MIN_PODIL:
        if zaloha.exists():
            shutil.copy2(zaloha, DATA)
        zprava("CHYBA: akci je najednou %d misto %d, vypada to na rozbity zdroj"
               % (len(akce), pocet_pred))
        return 1

    stejne = (zaloha.exists()
              and zaloha.read_text(encoding="utf-8") == DATA.read_text(encoding="utf-8"))
    if zaloha.exists():
        zaloha.unlink()
    if stejne:
        zprava("beze zmeny (%d akci), neposilam nic" % len(akce))
        return 0

    # Obě prostředí dostanou tentýž soubor.
    WEB.write_text(DATA.read_text(encoding="utf-8"), encoding="utf-8")
    PUBLISH.parent.mkdir(parents=True, exist_ok=True)
    PUBLISH.write_text(DATA.read_text(encoding="utf-8"), encoding="utf-8")
    zprava("akci: %d (bylo %d) -> web-app/ i publish/" % (len(akce), pocet_pred))

    if jen_nahlas:
        print("--nahlas: nic se neposila")
        return 0

    # Do gh-pages jde JEN tenhle soubor. `git subtree push` potrebuje, aby
    # obsah publish/ byl zacommitovany, takze se commituje — ale nic jineho
    # nez events.json se nestaguje a na vetev origin se nic netlaci.
    kod, vystup = spust(["git", "add", "publish/events.json"])
    if kod != 0:
        zprava("CHYBA: git add spadl"); print(vystup[-800:]); return 1
    kod, _ = spust(["git", "diff", "--cached", "--quiet"])
    if kod == 0:
        zprava("publish/events.json se nezmenil, neposilam")
        return 0
    kod, vystup = spust(["git", "commit", "-q", "-m",
                         "akce " + datetime.now().strftime("%Y-%m-%d")])
    if kod != 0:
        zprava("CHYBA: git commit spadl"); print(vystup[-800:]); return 1
    kod, vystup = spust(["git", "subtree", "push", "--prefix", "publish",
                         "origin", "gh-pages"])
    if kod != 0:
        zprava("CHYBA: git subtree push spadl"); print(vystup[-1200:]); return 1
    zprava("odeslano na gh-pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
