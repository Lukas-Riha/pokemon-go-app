"""Paměť pořadí: historie snímků PvPoke a nejlepší pořadí za 30 dní.

O nechat/pustit v appce rozhoduje nejlepší pořadí druhu za posledních 30 dní.
Když se tahle část rozbije, appka začne tiše vyhazovat kusy po každém
týdenním přepočtu PvPoke — nebo naopak držet druhy, které meta opustila
před půl rokem. Proto se testují čisté funkce na vymyšlených snímcích,
ne na tom, jak se PvPoke zrovna hýbe.

Spuštění:  python tests/poradi_pamet.test.py
"""
import importlib.util
import io
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

passed = 0
failures = []


def check(nazev, ok, detail=""):
    global passed
    if ok:
        passed += 1
        print("  ok   " + nazev)
    else:
        failures.append(nazev + (" -> " + str(detail) if detail else ""))
        print("  FAIL " + nazev + (" -> " + str(detail) if detail else ""))


spec = importlib.util.spec_from_file_location("build_meta", ROOT / "tools" / "build_meta.py")
bm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bm)

DNES = date(2026, 9, 30)

print("\n1) snimek: meta + dlouhy ocas do limitu, shadow zvlast")
sn = bm.snimek_poradi(
    {"great": {"azumarill": [5, 90.0], "medicham": [40, 85.0]}},
    {"great": {"linoone": [203, 80.0], "furret": [150, 82.0]}},
    {"great": {"azumarill": [9, 88.0]}},
    {"great": {"sableye": [260, 70.0]}})
check("meta poradi je ve snimku", sn.get("great", {}).get("azumarill") == 5, sn)
check("ocas do #200 taky", sn["great"].get("furret") == 150, sn)
check("za #200 uz ne", "linoone" not in sn["great"], sn)
check("shadow ma vlastni ligu s predponou", sn.get("shadow:great", {}).get("azumarill") == 9, sn)
check("shadow za #200 vynechany a prazdna liga se neuklada", "sableye" not in sn.get("shadow:great", {}), sn)

print("\n2) pridani snimku: stejny obsah nepridava novy den")
h = {"snimky": {}}
check("prvni snimek se prida", bm.pridej_snimek(h, "2026-09-01", {"great": {"a": 1}}))
check("tentyz obsah o den pozdeji se neprida",
      not bm.pridej_snimek(h, "2026-09-02", {"great": {"a": 1}}), sorted(h["snimky"]))
check("zmeneny obsah se prida", bm.pridej_snimek(h, "2026-09-03", {"great": {"a": 4}}))
check("tentyz den se prepise novym obsahem",
      bm.pridej_snimek(h, "2026-09-03", {"great": {"a": 5}}) and h["snimky"]["2026-09-03"]["great"]["a"] == 5,
      h["snimky"])

print("\n3) nejlepsi poradi za okno")
h = {"snimky": {
    "2026-08-01": {"great": {"stary": 3}},           # dlouho pred oknem
    "2026-08-25": {"great": {"pred": 8, "b": 30}},   # posledni PRED oknem (okno od 31. 8.)
    "2026-09-10": {"great": {"a": 10, "b": 40, "pred": 20}},
    "2026-09-20": {"great": {"a": 25, "b": 45}},
}}
ted = {"great": {"a": 30, "b": 20, "pred": 60, "stary": 90}}
nej = bm.nejlepsi_poradi(h, DNES, ted)
g = nej.get("great", {})
check("druh, ktery spadl, si pamatuje nejlepsi misto z okna", g.get("a") == [10, "2026-09-10"], g)
check("druh, ktery je dnes lip nez kdykoli v okne, v pameti neni", "b" not in g, g)
check("snimek tesne pred oknem plati jeste na zacatku okna",
      g.get("pred") == [8, "2026-08-31"], g)
check("snimek davno pred oknem (a pred dalsim snimkem) se nebere", "stary" not in g, g)
nej2 = bm.nejlepsi_poradi({"snimky": {"2026-09-15": {"great": {"zmizel": 12}}}}, DNES, {"great": {}})
check("druh, ktery dnes v datech vubec neni, se bere jako propadly",
      nej2.get("great", {}).get("zmizel") == [12, "2026-09-15"], nej2)
nej3 = bm.nejlepsi_poradi({"snimky": {"2026-09-12": {"great": {"x": 7}}, "2026-09-25": {"great": {"x": 7}}}},
                          DNES, {"great": {"x": 30}})
check("pri shode poradi se nechava pozdejsi datum",
      nej3.get("great", {}).get("x") == [7, "2026-09-25"], nej3)
nej4 = bm.nejlepsi_poradi({"snimky": {"2026-09-12": {"shadow:great": {"x": 4}}}},
                          DNES, {"shadow:great": {"x": 9}})
check("shadow pamet zustava pod shadow klicem", nej4.get("shadow:great", {}).get("x") == [4, "2026-09-12"], nej4)

print("\n4) orez historie")
h = {"snimky": {"2026-07-01": {}, "2026-08-01": {}, "2026-08-25": {}, "2026-09-10": {}}}
bm.orez_historii(h, DNES)
check("starsi snimky pryc, posledni pred oknem zustava",
      sorted(h["snimky"]) == ["2026-08-25", "2026-09-10"], sorted(h["snimky"]))

print("\n5) data v repu a v appce sedi")
HIST = ROOT / "data" / "poradi_historie.json"
META = ROOT / "data" / "meta.json"
check("data/poradi_historie.json existuje", HIST.exists())
if HIST.exists() and META.exists():
    hist = json.load(io.open(HIST, encoding="utf-8"))
    meta = json.load(io.open(META, encoding="utf-8"))
    pam = meta.get("poradiPamet") or {}
    check("meta.json nese poradiPamet", bool(pam) and pam.get("dni") == bm.PAMET_DNI, pam.get("dni"))
    check("pocet snimku v meta sedi s historii", pam.get("snimku") == len(hist.get("snimky", {})),
          "%s vs %s" % (pam.get("snimku"), len(hist.get("snimky", {}))))
    ted = bm.aktualni_poradi(meta["leagues"], meta.get("poradiVse"), meta.get("shadow"),
                             meta.get("poradiVseShadow"))
    spatne = []
    for sekce, predpona in (("ligy", ""), ("shadow", "shadow:")):
        for liga, tab in (pam.get(sekce) or {}).items():
            for k, (rank, datum) in tab.items():
                dnes_rank = ted.get(predpona + liga, {}).get(k)
                if dnes_rank is not None and rank >= dnes_rank:
                    spatne.append((sekce, liga, k, rank, dnes_rank))
    check("v pameti je jen to, co bylo LEPSI nez dnes", not spatne, spatne[:5])
    html = (ROOT / "web-app" / "pokemon_tracker_app.html").read_text(encoding="utf-8")
    check("appka ma pamet zapecenou", '"poradiPamet":' in html)

print("\n%d kontrol proslo, %d selhalo" % (passed, len(failures)))
if failures:
    for f in failures:
        print("  x " + f)
    sys.exit(1)
