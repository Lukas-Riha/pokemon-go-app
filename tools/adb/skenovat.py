# -*- coding: utf-8 -*-
"""Projde box v Pokémon GO a nechá Calcy naskenovat každý kus.

Co to dělá v jednom kole:
    1. klepne na plovoucí tlačítko Calcy (spustí scan)
    2. počká, až Calcy dočte obrazovku
    3. POMALU potáhne prstem na dalšího pokémona
    4. počká, až doběhne animace

Proč pomalu: Calcy čte obrazovku, ne paměť hry. Rychlé swipnutí mu podsune
rozmazaný nebo poloviční snímek a scan buď selže, nebo — což je horší — přečte
špatná čísla. Rychlost tady není k ničemu; smysl je, že u toho nemusíš sedět.

Prodlevy jsou schválně náhodné v rozsahu. Dokonale pravidelný rytmus je jediná
věc, která z tohohle dělá zjevně strojovou činnost, a nic tím nezískáš.

Spuštění:
    python tools/adb/skenovat.py --pocet 80
    python tools/adb/skenovat.py --pocet 80 --sucho    (jen vypíše, co by dělal)

Zastavení: Ctrl+C, nebo vytvoř vedle skriptu soubor STOP.
"""
import argparse
import json
import math
import random
import subprocess
import sys
import time
from pathlib import Path

try:  # konzole na Windows jede v cp1250 a na šipce ve výpisu spadne
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ZDE = Path(__file__).resolve().parent
KALIBRACE = ZDE / "kalibrace.json"
STOP = ZDE / "STOP"
_rozmer = None

# Časování. Spodní hranice jsou odhad, ne měření — po prvním ostrém běhu
# se podle úspěšnosti upraví (viz --cekani-scan).
#
# POZOR na tvar náhody. `random.uniform` v úzkém pásmu je pořád strojový:
# rovnoměrné rozdělení nemá to, co má člověk — dlouhý ocas. Skutečné tempo
# je většinou svižné, občas se člověk zakouká, občas se vrátí zpátky mrknout.
# Proto lognormální základ (pravostranně zešikmený) plus občasné delší pauzy.
SCAN_MIN, SCAN_MAX = 1.8, 2.6      # než si Calcy načte novou obrazovku
PO_SWIPU_MIN, PO_SWIPU_MAX = 0.5, 0.9   # než doběhne animace přechodu

# Rychlost tažení. Původně to bylo 550–850 ms pokaždé — pomalé A monotónní
# zároveň. Skutečný prst dělá většinou krátké cvrnknutí a jen občas pomalé
# vědomé přetažení, takže rozdělení je DVOUVRCHOLOVÉ, ne jedno úzké pásmo.
SWIPE_RYCHLY_MIN, SWIPE_RYCHLY_MAX = 90, 220     # cvrnknutí (většina)
SWIPE_POMALY_MIN, SWIPE_POMALY_MAX = 420, 900    # vědomé přetažení
P_POMALY_SWIPE = 0.2

P_ZAKOUKANI = 0.05                 # jak často delší pauza
ZAKOUKANI_MIN, ZAKOUKANI_MAX = 3.0, 12.0
P_NAVRAT = 0.07                    # jak často se vrátit o kus zpět a zase vpřed

# Kolik pixelů vzorkovat při porovnání dvou snímků a jak moc se smí lišit,
# aby to pořád byla „táž obrazovka".
VZORKU = 4000
SHODA_PRAH = 0.995


TEMPO = 1.0        # přenásobí všechna čekání; nastavuje se přes --tempo
# Obě pásma doby tahu se dají přepsat z příkazové řádky (a tím i z okna).
# Drží se v proměnných, ne v konstantách, aby okno mohlo poslat vlastní
# hodnoty a nemuselo si nic dopočítávat samo.
TAH = {"rychly": [SWIPE_RYCHLY_MIN, SWIPE_RYCHLY_MAX],
       "pomaly": [SWIPE_POMALY_MIN, SWIPE_POMALY_MAX],
       "podil": P_POMALY_SWIPE}


def lidske_cekani(zaklad_min, zaklad_max):
    """Čekání s pravostranným ocasem místo rovnoměrného pásma."""
    stred = (zaklad_min + zaklad_max) / 2 * TEMPO
    t = random.lognormvariate(math.log(stred), 0.22)
    return max(zaklad_min * 0.8 * TEMPO, min(t, zaklad_max * 2.5 * TEMPO))


def rozsahy_swipu():
    """Obě pásma doby tahu. Vrací ((r_min, r_max), (p_min, p_max))."""
    return (tuple(TAH["rychly"]), tuple(TAH["pomaly"]))


def doba_swipu():
    """Jak dlouho tah trvá. Většinou cvrnknutí, občas pomalé přetažení."""
    rychly, pomaly = rozsahy_swipu()
    pasmo = pomaly if random.random() < TAH["podil"] else rychly
    return random.randint(pasmo[0], pasmo[1])


# Bez tohohle si KAŽDÉ volání adb otevře vlastní okno konzole. Pod pythonw
# (okno bez konzole) to znamená, že při každém tahu problikne černé okno,
# ukradne fokus a na počítači se u toho nedá dělat nic jiného. Na jiných
# systémech než Windows ten příznak neexistuje, proto getattr.
BEZ_OKNA = getattr(subprocess, "CREATE_NO_WINDOW", 0)

def najdi_adb():
    """Cesta k adb: nejdřív PATH, pak obvyklá místa."""
    import shutil, os
    z_path = shutil.which("adb")
    if z_path:
        return z_path
    dom = os.path.expanduser("~")
    for c in (os.path.join(dom, "platform-tools", "adb.exe"),
              os.path.join(dom, "AppData", "Local", "Android", "Sdk",
                           "platform-tools", "adb.exe"),
              r"C:\Android\platform-tools\adb.exe"):
        if os.path.exists(c):
            return c
    return "adb"

def adb(*args):
    try:
        r = subprocess.run([najdi_adb()] + list(args), capture_output=True,
                           check=False, creationflags=BEZ_OKNA)
    except FileNotFoundError:
        sys.exit("adb není v PATH — stáhni Google SDK Platform-Tools.")
    if r.returncode != 0:
        sys.exit("adb selhalo: " + (r.stderr or b"").decode("utf-8", "replace")[:300])
    return r.stdout.decode("utf-8", "replace")


# Z obrazovky se přenáší jen vodorovný pruh, ne celý snímek. Celý framebuffer
# je při 1200x2652 asi 12,7 MB a tahal by se DVAKRÁT na každý kus — po kabelu
# to jde, ale přes Wi-Fi by to běh málem zdvojnásobilo. Pruh pokrývá CP nahoře
# i obrázek a jméno pod ním, což je přesně to, co se mezi kusy mění.
PRUH_OD, PRUH_DO = 0.03, 0.46


def snimek():
    """Vzorek pruhu obrazovky, nebo None, když to nejde.

    `adb exec-out screencap` (bez -p) dává surové RGBA s krátkou hlavičkou,
    takže se to dá číst bez knihovny na obrázky. Ořez dělá `dd` přímo
    v telefonu: surová data jsou po řádcích, takže vodorovný pruh je souvislý
    úsek bajtů.

    Hlavička má 16 B (Android 13+) nebo 12 B (starší). `dd bs=16 skip=1`
    počítá s tou delší; u kratší se všechno posune o jeden pixel, což pro
    POROVNÁNÍ dvou snímků nevadí — posunou se stejně oba.
    """
    global _rozmer
    if _rozmer is None:
        try:
            v = adb("shell", "wm", "size").strip().split(":")[-1].strip()
            _rozmer = tuple(int(x) for x in v.split("x"))
        except Exception:
            return None
    w, h = _rozmer
    radek = w * 4
    od, poc = int(h * PRUH_OD), int(h * (PRUH_DO - PRUH_OD))
    prikaz = ("screencap | dd bs=16 skip=1 2>/dev/null | "
              "dd bs=%d skip=%d count=%d 2>/dev/null" % (radek, od, poc))
    try:
        r = subprocess.run([najdi_adb(), "exec-out", prikaz],
                           capture_output=True, check=False,
                           creationflags=BEZ_OKNA)
    except FileNotFoundError:
        return None
    d = r.stdout
    if len(d) < radek:
        return None
    krok = max(4, (len(d) // 4 // VZORKU)) * 4
    return d[::krok]


def stejna_obrazovka(a, b):
    """Liší se dva snímky? Na konci seznamu se swipe neprojeví vůbec."""
    if a is None or b is None or len(a) != len(b):
        return False
    shodnych = sum(1 for x, y in zip(a, b) if x == y)
    return shodnych / max(1, len(a)) >= SHODA_PRAH


def nacti_kalibraci():
    if not KALIBRACE.exists():
        sys.exit("Chybí %s — nejdřív spusť: python tools/adb/kalibrace.py" % KALIBRACE.name)
    k = json.loads(KALIBRACE.read_text(encoding="utf-8"))
    body = k.get("body") or {}
    # `calcy` je nepovinný: když má Calcy zapnuté automatické skenování,
    # klepat se na bublinu nemusí vůbec a skript jen posouvá box.
    for klic in ("swipe_z", "swipe_do"):
        if klic not in body:
            sys.exit("V kalibraci chybí bod %r — spusť kalibraci znovu." % klic)
    return k


def hlida_rozliseni(k):
    """Kalibrace platí jen pro rozlišení, na kterém vznikla.

    Otočení telefonu nebo změna velikosti písma posune všechno a skript by
    klepal vedle — bez tohohle by to hodinu klikal do prázdna a nikdo by si
    nevšiml, dokud by nebyl export prázdný.
    """
    try:
        vypis = adb("shell", "wm", "size")
        cast = vypis.strip().split(":")[-1].strip()
        sirka, vyska = [int(x) for x in cast.split("x")]
    except Exception:
        return
    mel = k.get("rozliseni")
    if mel and sorted(mel) != sorted([sirka, vyska]):
        sys.exit("Telefon hlásí %dx%d, ale kalibrace je pro %s. Spusť kalibraci znovu."
                 % (sirka, vyska, "x".join(str(x) for x in mel)))


def hlida_okraje(k, z, do):
    """Swipe od samého kraje spolkne systémové gesto ZPĚT, ne hra.

    Android ma u obou svislých okrajů pruh široký asi 20 dp (na hustých
    displejích řádově 60 px) vyhrazený gestu zpět. Když tah začne v něm,
    místo přepnutí na dalšího pokémona se zavře detail — a ve vypisu to
    vypadá, jako by se neposouval box.
    """
    r = k.get("rozliseni") or []
    if len(r) != 2:
        return
    sirka = min(r)
    prah = max(60, int(sirka * 0.07))
    for jmeno, bod in (("swipe_z", z), ("swipe_do", do)):
        okraj = min(bod[0], sirka - bod[0])
        if okraj < prah:
            print("POZOR: %s má x=%d, tedy jen %d px od kraje (%d px je pruh"
                  " pro systémové gesto ZPĚT)." % (jmeno, bod[0], okraj, prah))
            print("       Když se box neposouvá a zavírá se detail, je to tohle"
                  " — spusť kalibraci znovu a dej ten bod dál od kraje.\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pocet", type=int, default=400,
                    help="strop kroků (pojistka; konec boxu se pozná sám)")
    ap.add_argument("--cekani-scan", type=float, default=None,
                    help="pevné čekání na Calcy v sekundách (jinak náhodné 2,6–3,6)")
    ap.add_argument("--sucho", action="store_true", help="nic neklepne, jen vypíše")
    ap.add_argument("--tempo", type=float, default=1.0,
                    help="přenásobí čekání: 0.7 = svižnější, 1.5 = opatrnější."
                         " Když Calcy začne vynechávat, jdi nahoru.")
    ap.add_argument("--tah-rychly", type=int, nargs=2, metavar=("MIN", "MAX"),
                    help="pásmo cvrnknutí v ms (výchozí %d %d)"
                         % (SWIPE_RYCHLY_MIN, SWIPE_RYCHLY_MAX))
    ap.add_argument("--tah-pomaly", type=int, nargs=2, metavar=("MIN", "MAX"),
                    help="pásmo pomalého přetažení v ms (výchozí %d %d)"
                         % (SWIPE_POMALY_MIN, SWIPE_POMALY_MAX))
    ap.add_argument("--podil-pomalych", type=float,
                    help="jak často pomalé přetažení, 0–1 (výchozí %.2f)"
                         % P_POMALY_SWIPE)
    ap.add_argument("--klepat", action="store_true",
                    help="klepat na bublinu Calcy (jen když Calcy NEMÁ zapnuté"
                         " automatické skenování)")
    ap.add_argument("--bez-detekce", action="store_true",
                    help="nezjišťovat konec boxu podle obrazovky (jede se na --pocet)")
    a = ap.parse_args()

    global TEMPO
    if not (0.2 <= a.tempo <= 5):
        sys.exit("--tempo musí být mezi 0.2 a 5.")
    TEMPO = a.tempo
    for prep, klic in (("tah_rychly", "rychly"), ("tah_pomaly", "pomaly")):
        hodnota = getattr(a, prep)
        if hodnota is None:
            continue
        lo, hi = hodnota
        if not (20 <= lo <= hi <= 3000):
            sys.exit("--%s: musí platit 20 ≤ MIN ≤ MAX ≤ 3000 ms."
                     % prep.replace("_", "-"))
        TAH[klic] = [lo, hi]
    if a.podil_pomalych is not None:
        if not (0 <= a.podil_pomalych <= 1):
            sys.exit("--podil-pomalych musí být mezi 0 a 1.")
        TAH["podil"] = a.podil_pomalych

    k = nacti_kalibraci()
    if not a.sucho:
        hlida_rozliseni(k)
    b = k["body"]
    z, do = b["swipe_z"], b["swipe_do"]
    calcy = b.get("calcy")
    if a.klepat and not calcy:
        sys.exit("--klepat potřebuje v kalibraci bod `calcy` — spusť kalibraci znovu.")

    if STOP.exists():
        STOP.unlink()

    print("kalibrace: %s, %s" % (k.get("model", "?"),
                                 "x".join(str(x) for x in k.get("rozliseni", []))))
    print("swipe: %s → %s" % (z, do))
    print("Calcy: %s" % ("klepe se na bublinu " + str(calcy) if a.klepat
                         else "skenuje si samo, jen se čeká"))
    hlida_okraje(k, z, do)
    _r, _p = rozsahy_swipu()
    print("tah: cvrnknutí %d–%d ms · přetažení %d–%d ms · pomalých %d %%"
          % (_r[0], _r[1], _p[0], _p[1], round(TAH["podil"] * 100)))
    print("strop kroků: %d%s   tempo: %.2f%s"
          % (a.pocet, "  (NASUCHO)" if a.sucho else "", TEMPO,
             "" if TEMPO == 1 else (" (svižněji)" if TEMPO < 1 else " (opatrněji)")))
    print("konec boxu: %s" % ("podle obrazovky" if not a.bez_detekce
                              else "NEHLÍDÁ SE, jede se na strop"))
    print("zastavíš Ctrl+C nebo vytvořením souboru STOP\n")

    zacatek = time.time()
    # Pokrytí se sleduje POZICÍ, ne počtem kroků. Kdyby se počítaly kroky,
    # každý návrat zpátky by ukrojil jeden kus z konce boxu a nikdo by si
    # toho nevšiml — export by prostě byl o pár kusů kratší.
    pozice, hotovo, kroku = 0, set(), 0
    couval = False
    minule = None
    konec_potvrzen = 0

    def swipe(smer):
        """smer +1 = na dalšího, -1 = na předchozího."""
        trvani = doba_swipu()
        # Rychlost tažení je vidět ve výpisu schválně: podle ní se pozná,
        # jestli je rozptyl opravdu dvouvrcholový, nebo se sesypal do pásma.
        print("      %s %d ms" % ("swipe" if smer > 0 else "swipe zpět", trvani),
              flush=True)
        odkud, kam = (z, do) if smer > 0 else (do, z)
        if not a.sucho:
            adb("shell", "input", "swipe", str(odkud[0]), str(odkud[1]),
                str(kam[0]), str(kam[1]), str(trvani))
            time.sleep(lidske_cekani(PO_SWIPU_MIN, PO_SWIPU_MAX))
        return trvani

    while kroku < a.pocet:
        if STOP.exists():
            print("\nnašel jsem STOP — končím, naskenováno %d kusů" % len(hotovo))
            break
        kroku += 1

        if pozice not in hotovo:
            cekani = a.cekani_scan if a.cekani_scan else lidske_cekani(SCAN_MIN, SCAN_MAX)
            print("[%3d] pozice %d — %s (%.1fs)"
                  % (len(hotovo) + 1, pozice,
                     "klepnutí + scan" if a.klepat else "čekám na scan", cekani),
                  flush=True)
            if not a.sucho:
                if a.klepat:
                    adb("shell", "input", "tap", str(calcy[0]), str(calcy[1]))
                time.sleep(cekani)
            hotovo.add(pozice)
        else:
            print("      pozice %d — už naskenováno, jen procházím" % pozice, flush=True)

        # --- lidské nepravidelnosti ---------------------------------------
        # Nesmí stát pokrytí: pauza je jen čas navíc, návrat jen kroky navíc.
        # Ani jedno neposune `pozice` tak, aby se něco přeskočilo.
        if random.random() < P_ZAKOUKANI:
            pauza = random.uniform(ZAKOUKANI_MIN, ZAKOUKANI_MAX)
            print("      (zakoukání %.1fs)" % pauza, flush=True)
            if not a.sucho:
                time.sleep(pauza)

        # Dva návraty za sebou už není ohlédnutí, ale couvání — a hlavně
        # se tím zbytečně natahuje běh. Po návratu se vždycky jede vpřed.
        if random.random() < P_NAVRAT and pozice > 0 and not couval:
            print("      (zpět a zase vpřed)", flush=True)
            swipe(-1)
            pozice -= 1
            couval = True
            if not a.sucho:
                time.sleep(lidske_cekani(PO_SWIPU_MIN, PO_SWIPU_MAX))
            continue          # příští kolo se posune vpřed normálně

        pred = snimek() if (not a.sucho and not a.bez_detekce) else None
        swipe(+1)
        po = snimek() if (not a.sucho and not a.bez_detekce) else None

        if stejna_obrazovka(pred, po):
            # Na konci boxu se swipe neprojeví vůbec. Dva stejní pokémoni
            # za sebou se pořád liší v CP a v pruzích, takže tak podobní
            # nebudou — ale pro jistotu se to potvrzuje dvakrát: ťukat dál,
            # když už není kam, je nejjasnější strojový podpis.
            konec_potvrzen += 1
            if konec_potvrzen >= 2:
                print("\nobrazovka se po swipu nemění — jsem na konci boxu")
                break
            print("      (obrazovka beze změny — ověřuji)", flush=True)
            continue

        konec_potvrzen = 0
        couval = False
        pozice += 1
        if a.sucho:
            time.sleep(0.05)

    if kroku >= a.pocet:
        print("\nDOŠEL LIMIT --pocet (%d) — konec boxu se nenašel." % a.pocet)
        print("Zvyš --pocet, jinak ti zbytek boxu zůstane nenaskenovaný.")

    minut = (time.time() - zacatek) / 60
    print("\nhotovo za %.1f min" % minut)
    print("Teď v Calcy: Menu → History → export do CSV, a ten nahraj do appky.")


if __name__ == "__main__":
    main()
