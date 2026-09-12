# -*- coding: utf-8 -*-
"""Záloha + kompletní kontrola. Určeno k automatickému spouštění.

Co udělá, v tomhle pořadí:
  1) ZÁLOHA NEJDŘÍV. Zkopíruje data/*.json a hotovou appku do
     zalohy/RRRR-MM-DD_HHMM/. Zálohuje se dřív, než se cokoli kontroluje —
     kdyby audit spadl uprostřed, poslední funkční stav už je bezpečně stranou.
  2) Audit integrity dat (tools/audit_data.py).
  3) Testy appky a audit výpočtů přes celý pokédex (když je k dispozici node).
  4) Zapíše report.txt do složky se zálohou a shrnutí do zalohy/posledni.txt.
  5) Smaže nejstarší generace nad limit (výchozí 20).

Volitelně umí i OBNOVIT herní data (--obnovit). Pořadí je schválně tohle:
záloha → obnova → audit → testy. Když po obnově něco neprojde, data i appka
se vrátí ze zálohy, takže se nikdy nezůstane u rozbitého stavu.

Spuštění ručně:
    python tools/audit_zaloha.py
    python tools/audit_zaloha.py --generaci 30   (kolik generací držet)
    python tools/audit_zaloha.py --bez-testu     (jen data, bez prohlížeče)
    python tools/audit_zaloha.py --obnovit       (stáhne akce + ligy a zapeče)
    python tools/audit_zaloha.py --obnovit-vse   (k tomu i pokédex a útoky)
    python tools/audit_zaloha.py --obnovit --nasadit   (a když projde, nasadí)

Naplánovat na každý den: viz tools/naplanovat.ps1
Návratový kód 1 = něco neprošlo (záloha se ale i tak udělala).
"""
import datetime
import shutil
import subprocess
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ZALOHY = ROOT / "zalohy"
DRZET = 20
if "--generaci" in sys.argv:
    DRZET = int(sys.argv[sys.argv.index("--generaci") + 1])
BEZ_TESTU = "--bez-testu" in sys.argv
OBNOVIT_VSE = "--obnovit-vse" in sys.argv
OBNOVIT = OBNOVIT_VSE or "--obnovit" in sys.argv
NASADIT = "--nasadit" in sys.argv

report = []


def zapis(radek=""):
    print(radek)
    report.append(radek)


def spust(nazev, prikaz):
    """Vrátí (ok, výpis). Nic nevyhazuje — chceme dojet až do reportu."""
    t = time.time()
    try:
        r = subprocess.run(prikaz, cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=900)
    except FileNotFoundError:
        return None, "%s: nespustitelné (chybí %s)" % (nazev, prikaz[0])
    except subprocess.TimeoutExpired:
        return False, "%s: timeout" % nazev
    vystup = ((r.stdout or "") + (r.stderr or "")).strip()
    znacka = "OK  " if r.returncode == 0 else "CHYBA"
    zapis("%s %-42s %5.1f s" % (znacka, nazev, time.time() - t))
    return r.returncode == 0, vystup


def zmenene_soubory(zaloha):
    """Které zálohované soubory se od zálohy liší. Podle obsahu, ne podle času."""
    zmeny = []
    for kopie in sorted(zaloha.glob("*")):
        if kopie.name == "report.txt":
            continue
        original = (ROOT / "data" / kopie.name) if kopie.suffix == ".json" \
            else (ROOT / "web-app" / kopie.name)
        if not original.exists():
            continue
        if original.read_bytes() != kopie.read_bytes():
            zmeny.append(kopie.name)
    return zmeny


def vratit_ze_zalohy(zaloha):
    """Vrátí data i appku do stavu před obnovou."""
    vraceno = []
    for kopie in sorted(zaloha.glob("*")):
        if kopie.name == "report.txt":
            continue
        cil = (ROOT / "data" / kopie.name) if kopie.suffix == ".json" \
            else (ROOT / "web-app" / kopie.name)
        if cil.exists() and cil.read_bytes() != kopie.read_bytes():
            shutil.copy2(kopie, cil)
            vraceno.append(kopie.name)
    return vraceno


def main():
    razitko = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    cil = ZALOHY / razitko
    cil.mkdir(parents=True, exist_ok=True)

    zapis("=" * 64)
    zapis("KONTROLA A ZÁLOHA — " + datetime.datetime.now().strftime("%d.%m.%Y %H:%M"))
    zapis("=" * 64)

    # ---------- 1) záloha nejdřív ----------
    velikost = 0
    souboru = 0
    for zdroj in sorted((ROOT / "data").glob("*.json")):
        shutil.copy2(zdroj, cil / zdroj.name)
        velikost += zdroj.stat().st_size
        souboru += 1
    app = ROOT / "web-app" / "pokemon_tracker_app.html"
    if app.exists():
        shutil.copy2(app, cil / app.name)
        velikost += app.stat().st_size
        souboru += 1
    zapis("záloha: %d souborů, %.1f MB -> zalohy/%s" % (souboru, velikost / 1048576, razitko))
    zapis()

    # ---------- 1b) obnova herních dat ----------
    #
    # Až TEĎ, po záloze: kdyby se stáhlo něco rozbitého, poslední funkční stav
    # už leží stranou a dole se z něj dá vrátit.
    #
    # Akce a bossové stárnou po dnech, ligy po týdnech — ty se obnovují vždycky.
    # Pokédex a útoky se mění jen s novou generací, takže jen na --obnovit-vse.
    vsechno_ok = True
    detaily = []
    obnoveno = []
    if OBNOVIT:
        kroky = [("akce a raid bossové", [sys.executable, "tools/build_events.py", "--refresh"]),
                 ("ligové žebříčky z PvPoke", [sys.executable, "tools/build_meta.py", "--refresh"])]
        if OBNOVIT_VSE:
            kroky = [("pokédex", [sys.executable, "tools/build_pokedex.py", "--refresh"])] + kroky \
                + [("útoky", [sys.executable, "tools/build_moves.py"])]
        kroky.append(("zapečení dat do appky", [sys.executable, "tools/sync_reference.py"]))
        for nazev, prikaz in kroky:
            ok, vystup = spust(nazev, prikaz)
            detaily.append((nazev, vystup))
            if ok is False:
                # Stažení může selhat na síti. Zapečení ne — bez něj by v appce
                # byla data z půlky staré a z půlky nová.
                if nazev.startswith("zapečení"):
                    vsechno_ok = False
                zapis("   (pokračuju s tím, co je na disku)")
        # Appka se přepíše při každém zapečení (nese datum buildu), takže
        # o tom, jestli se opravdu něco změnilo, rozhodují datové soubory.
        obnoveno = [x for x in zmenene_soubory(cil) if x.endswith(".json")]
        zapis("obnova: změněna data %s" % (", ".join(obnoveno) if obnoveno else "— nic nového"))
        zapis()

    # ---------- 2) audit dat ----------
    ok, vystup = spust("audit integrity dat", [sys.executable, "tools/audit_data.py"])
    vsechno_ok = vsechno_ok and ok is not False
    detaily.append(("audit integrity dat", vystup))

    # ---------- 3) testy ----------
    if BEZ_TESTU:
        zapis("SKIP testy (--bez-testu)")
    else:
        for nazev, prikaz in (
            ("testy appky", ["node", "tests/web_app.test.mjs"]),
            ("audit výpočtů přes celý pokédex", ["node", "tests/audit_app.test.mjs"]),
        ):
            ok, vystup = spust(nazev, prikaz)
            if ok is None:
                zapis("SKIP %-42s (node není k dispozici)" % nazev)
            else:
                vsechno_ok = vsechno_ok and ok
            detaily.append((nazev, vystup))

    # ---------- 3b) když obnova něco rozbila, vrátit se ----------
    if OBNOVIT and not vsechno_ok:
        vraceno = vratit_ze_zalohy(cil)
        zapis()
        zapis("VRACÍM ZE ZÁLOHY (obnova neprošla kontrolou): %s"
              % (", ".join(vraceno) if vraceno else "nic k vrácení"))
        obnoveno = []

    # ---------- 3c) nasazení ----------
    if NASADIT and vsechno_ok and obnoveno:
        ok, vystup = spust("nasazení (deploy.ps1)",
                           ["powershell", "-ExecutionPolicy", "Bypass", "-File",
                            str(ROOT / "tools" / "deploy.ps1")])
        detaily.append(("nasazení", vystup))
        vsechno_ok = vsechno_ok and ok is not False
    elif NASADIT and vsechno_ok:
        zapis("nasazení: data se nezměnila, není co nasazovat")

    # ---------- 4) report ----------
    zapis()
    zapis("VÝSLEDEK: " + ("všechno v pořádku" if vsechno_ok else "NĚCO NEPROŠLO — viz níž"))

    plny = list(report)
    for nazev, vystup in detaily:
        plny.append("")
        plny.append("-" * 64)
        plny.append(nazev)
        plny.append("-" * 64)
        plny.append(vystup or "(bez výpisu)")
    (cil / "report.txt").write_text("\n".join(plny) + "\n", encoding="utf-8")

    souhrn = "%s  %s  (zalohy/%s)" % (
        datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "OK" if vsechno_ok else "CHYBA", razitko)
    posledni = ZALOHY / "posledni.txt"
    historie = posledni.read_text(encoding="utf-8").splitlines() if posledni.exists() else []
    historie.append(souhrn)
    posledni.write_text("\n".join(historie[-200:]) + "\n", encoding="utf-8")

    # ---------- 5) úklid starých generací ----------
    generace = sorted([d for d in ZALOHY.iterdir() if d.is_dir()], key=lambda d: d.name)
    smazano = 0
    while len(generace) > DRZET:
        shutil.rmtree(generace.pop(0), ignore_errors=True)
        smazano += 1
    zapis("generací: %d (držím %d, smazáno %d)" % (len(generace), DRZET, smazano))
    zapis("report: zalohy/%s/report.txt" % razitko)

    sys.exit(0 if vsechno_ok else 1)


if __name__ == "__main__":
    main()
