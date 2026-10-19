"""Kontrola parseru časových oken na uložených stránkách LeekDucku.

Okna jsou jediné místo, kde appka tvrdí „tohle platí od–do". Scraping cizí
stránky se umí rozbít tiše: šablona se změní, parser vrátí prázdno a akce
v kalendáři zůstane bez rozpisu, aniž by to kdokoli poznal.

Hlídá se hlavně to, co se nedá odvodit z jednoho pohledu:

* **Bonusy s hvězdičkou běží dýl než akce.** Community Day trvá tři hodiny,
  ale lákadla, výměny a sleva na prach platí do devíti večer. Appka z toho
  dělala jedno okno 14:00–17:00 a v šest večer tvrdila, že neplatí nic.
* **Hvězdička sama o sobě nic neznamená.** U jiných akcí je to podmínka
  („*For these bonuses to apply, Trainers must first collect all Max
  Particles"), ne jiný čas — tam se na ni sahat nesmí.

Spuštění:  python tests/okna.test.py
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

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


cesta = ROOT / "tools" / "leekduck_okna.py"
spec = importlib.util.spec_from_file_location("leekduck_okna", cesta)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

STRANKY = ROOT / "data" / "raw" / "leekduck"


def stranka(jmeno):
    p = STRANKY / (jmeno + ".html")
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


print("\n1) parser na ulozenych strankach porad vidi")
dok = stranka("october-communityday2026")
check("stranka Community Day je v repu", bool(dok), str(STRANKY))
okna_cd = mod.okna(dok, "2026-10-10T14:00", "2026-10-10T17:00") if dok else []
check("Community Day ma aspon dve okna", len(okna_cd) >= 2, len(okna_cd))

print("\n2) bonusy s hvezdickou bezi dyl nez akce")
check("vysvetlivka pod bonusy rika, do kdy to plati",
      mod.prodlouzene_bonusy(dok) == "21:00", mod.prodlouzene_bonusy(dok))
prodlouzene = [o for o in okna_cd if o[0] == "2026-10-10T17:00"]
check("po konci akce je okno s bonusy, ktere pokracuji",
      len(prodlouzene) == 1 and prodlouzene[0][1] == "2026-10-10T21:00",
      [[o[0], o[1]] for o in okna_cd])
if prodlouzene:
    jmena = [x[0] for x in (prodlouzene[0][2].get("bonus") or [])]
    check("...a jsou v nem jen ty oznacene (lakadla, vymeny, prach)",
          len(jmena) == 3 and all("*" not in j for j in jmena)
          and any("Lure" in j for j in jmena)
          and any("Trade" in j for j in jmena)
          and any("Stardust" in j for j in jmena), jmena)
    check("...a jine sekce nez bonusy v nem nejsou",
          list(prodlouzene[0][2]) == ["bonus"], list(prodlouzene[0][2]))
hlavni = [o for o in okna_cd if o[0] == "2026-10-10T14:00"]
if hlavni:
    jmena = [x[0] for x in (hlavni[0][2].get("bonus") or [])]
    check("v hlavnim okne uz hvezdicka neni (vysvetlivku nese druhe okno)",
          jmena and all(not j.endswith("*") for j in jmena), jmena)

print("\n3) kadidlo neni volna priroda")
# Buddy Trek ma ve zdroji dve skupiny: "Wild Encounters" a "Incense
# Encounters", kazda s vlastnimi druhy a obdobimi. Parser je slevalo do
# jednoho klice, takze appka u druhu, ktere prilaka jen kadidlo, tvrdila
# "Ve volne prirode".
dok3 = stranka("fall-marathon-buddy-trek-2026")
check("stranka Buddy Treku je v repu", bool(dok3), str(STRANKY))
okna_bt = mod.okna(dok3, "2026-10-13T10:00", "2026-10-19T20:00") if dok3 else []
sekce = {k for o in okna_bt for k in o[2]}
check("kadidlo ma vlastni sekci", "kadidlo" in sekce, sorted(sekce))

def jmena(klic):
    return [x[0] for o in okna_bt for x in (o[2].get(klic) or []) if x[1] != -1]

divocina = jmena("spawn")
kadidlo = jmena("kadidlo")
check("ve volne prirode jsou druhy ze seznamu Wild Encounters",
      "Ponyta" in divocina and "Skarmory" in divocina, divocina[:8])
check("...a ty z kadidla tam nejsou",
      "Galarian Ponyta" not in divocina and "Hisuian Growlithe" not in divocina,
      divocina[:8])
check("kadidlo veze obe obdobi",
      "Galarian Ponyta" in kadidlo and "Hisuian Growlithe" in kadidlo, kadidlo[:8])
# Obdobi se poznaji podle druhu, ne podle poctu oken: v tretim okne
# (pres celou akci) stoji jen podminka o Daily Adventure Incense.
def okno_s(jmeno):
    for o in okna_bt:
        if any(x[0] == jmeno for x in (o[2].get("kadidlo") or [])):
            return (o[0], o[1])
    return None

check("...a kazde obdobi ma vlastni cas",
      okno_s("Galarian Ponyta") == ("2026-10-13T10:00", "2026-10-16T10:00")
      and okno_s("Hisuian Growlithe") == ("2026-10-16T10:00", "2026-10-19T20:00"),
      [okno_s("Galarian Ponyta"), okno_s("Hisuian Growlithe")])

print("\n4) podminky u spawnu zustanou videt")
vety = [x[0] for o in okna_bt for k in ("spawn", "kadidlo")
        for x in (o[2].get(k) or []) if x[1] == 0 and len(x[0]) > 20]
check("vyjimka u kadidla je v datech",
      any("Daily Adventure Incense is excluded" in v for v in vety), vety[:3])
check("podminena veta u divociny taky",
      any("You might also encounter" in v for v in vety), vety[:3])
check("a nic z paticky webu se nepriplete",
      not any(("LeekDuck. I create" in v or "All rights reserved" in v) for v in vety),
      [v[:40] for v in vety])

print("\n5) GO Pass: bezplatna vetev ano, obchod ne")
# Sekce go-pass se driv preskakovala cela s poznamkou, ze jde o nakupy.
# Zdroj v ni ma ale i bezplatnou drahu, milnikove bonusy a termin
# vyzvednuti odmen, ktery je jiny nez konec akce.
gp = mod.go_pass(dok3, 2026) if dok3 else None
check("GO Pass se ze stranky precte", bool(gp), gp)
if gp:
    check("...vi, ze je bezplatny", gp.get("zdarma") is True, gp.get("zdarma"))
    check("...zna termin vyzvednuti odmen",
          gp.get("vyzvednout_do") == "2026-10-21T20:00", gp.get("vyzvednout_do"))
    check("...ktery je POZDEJI nez konec akce",
          (gp.get("vyzvednout_do") or "") > "2026-10-19T20:00",
          [gp.get("vyzvednout_do"), "2026-10-19T20:00"])
    check("...a do kdy se sbiraji body",
          gp.get("sbirat_do") == "2026-10-19T20:00", gp.get("sbirat_do"))
    ranky = sorted(b["rank"] for b in (gp.get("bonusy") or []))
    check("...milnikove bonusy maji rank i text", ranky == [10, 20]
          and all(len(b["text"]) > 20 for b in gp["bonusy"]), ranky)
    check("...a nic o cenach ani Deluxe se nenese",
          not any(("$" in b["text"] or "Deluxe" in b["text"])
                  for b in (gp.get("bonusy") or [])),
          [b["text"][:40] for b in (gp.get("bonusy") or [])])

# Druha stranka: tam je u GO Passu i placena vetev "Deluxe Rank 1-3".
dok5 = stranka("into-the-wild-2026")
if dok5:
    gp2 = mod.go_pass(dok5, 2026)
    check("placena vetev Deluxe se do bonusu nedostane",
          bool(gp2) and all(b["rank"] >= 10 for b in (gp2.get("bonusy") or []))
          and len(gp2.get("bonusy") or []) == 1,
          [(b["rank"], b["text"][:30]) for b in ((gp2 or {}).get("bonusy") or [])])

# Stranka bez GO Passu nesmi nic vymyslet. (`dok` je Community Day.)
check("akce bez GO Passu ho nema", mod.go_pass(dok, 2026) is None,
      mod.go_pass(dok, 2026))

print("\n6) vyzkum vi, za co ta odmena je")
# Zdroj ma u kazdeho ukolu vlastni seznam MOZNYCH odmen. Parser z toho
# delal plochy seznam jmen, takze se ztratilo oboji — za co se odmena
# dava i to, ze se z nich losuje jedna.
vyz = mod.vyzkum(dok3) if dok3 else []
# Stranka ma dve vetve: terenni vyzkum (odmenou je pokemon) a casovany
# maratonsky vyzkum (Explore 5/10/21/42 km za XP a vizor pro Pikachu).
check("vyzkum se precte jako skupiny", len(vyz) == 2
      and [sk.get("typ") for sk in vyz] == ["field", "timed"],
      [(sk["nadpis"], sk.get("typ")) for sk in vyz])
if vyz:
    sk = vyz[0]
    check("...nadpis je ten nejblizsi nad seznamem",
          sk["nadpis"] == "Field Research Task Rewards", sk["nadpis"])
    check("...a neni oznaceny jako placeny", sk["placene"] is False, sk["placene"])
    ukoly = {u["ukol"]: u for u in sk["ukoly"]}
    check("kazdy ukol ma svoje odmeny", len(ukoly) == 2
          and all(u["odmeny"] for u in ukoly.values()), sorted(ukoly))
    u = ukoly.get("Earn a Candy exploring with your buddy")
    check("...vazba sedi se zdrojem", bool(u)
          and [o["jmeno"] for o in u["odmeny"]] == ["Bramblin", "Electrike"],
          [o["jmeno"] for o in (u or {}).get("odmeny", [])])
    check("...odmena nese shiny i rozsah CP", bool(u)
          and u["odmeny"][1]["shiny"] == 1 and u["odmeny"][1]["cp"] == [380, 413],
          (u or {}).get("odmeny", [{}, {}])[1])

# Prazdny seznam na strance neznamena vymysleny obsah.
dok6 = stranka("into-the-wild-2026")
check("prazdny seznam ukolu nic nevymysli", mod.vyzkum(dok6) == [], mod.vyzkum(dok6))

print("\n7) hvezdicka bez vysvetlivky je podminka, ne cas")
dok2 = stranka("dynamax-uxie-mesprit-azelf-max-battle-day-2026")
check("stranka Max Battle Day je v repu", bool(dok2))
check("ta stranka zadne prodlouzeni nehlasi",
      mod.prodlouzene_bonusy(dok2) is None, mod.prodlouzene_bonusy(dok2))
okna_mbd = mod.okna(dok2, "2026-10-18T14:00", "2026-10-18T17:00") if dok2 else []
hvezdy = [x[0] for o in okna_mbd for x in (o[2].get("bonus") or [])
          if x[0].endswith("*")]
check("...takze hvezdicky u bonusu zustaly, jak byly", len(hvezdy) >= 1, hvezdy)
check("...a zadne okno navic nepribylo", len(okna_mbd) == 1,
      [[o[0], o[1]] for o in okna_mbd])

print("\n8) provenance: co stranka ma a co z toho appka precetla")
# Sekce, kterou stranka MA a parser z ni nic nedostal, se nesmi tvarit
# stejne jako sekce, ktera na strance vubec neni. Prvni pripad je slepota
# appky, druhy je fakt o akci — a dokud to vypadalo stejne, appka mlcky
# tvrdila, ze je zobrazeno vsechno.
dok7 = stranka("into-the-wild-2026")
check("stranka Into the Wild je v repu", bool(dok7))
if dok7:
    data7 = {}
    for o in mod.okna(dok7, "2026-10-10T10:00", "2026-10-13T20:00"):
        for k, v in (o[2] or {}).items():
            data7[k] = data7.get(k, 0) + len(v or [])
    pr7 = mod.provenance(dok7, "https://leekduck.com/events/into-the-wild-2026/",
                         "2026-10-18T20:00", data7)
    sek7 = pr7["sekce"]
    check("...spawny se precetly", sek7.get("spawn", {}).get("stav") == "nacteno",
          sek7.get("spawn"))
    check("...prazdny seznam vyzkumu je 'neumime', ne mlceni",
          sek7.get("vyzkum", {}).get("stav") == "neumime", sek7.get("vyzkum"))
    check("...sekci, kterou stranka nema, provenance nevymysli",
          "vejce" not in sek7 or sek7["vejce"]["stav"] != "neni", sorted(sek7))
    check("...nakupy nejsou vypadek, ale rozhodnuti je necist",
          sek7.get("sales", {}).get("stav") == "mimo", sek7.get("sales"))
    check("...a u provenance stoji odkaz i datum stazeni",
          pr7.get("odkaz", "").startswith("https://") and pr7.get("ziskano"),
          [pr7.get("odkaz"), pr7.get("ziskano")])

# U sekce, ze ktere nic nevypadlo, se bere veta ze zdroje. Halloween Part I
# ma v Research jedinou vetu: "Specific tasks and encounters have not yet
# been announced." To je odpoved, ne hlaseni o chybe.
dok8 = stranka("halloween-2026-part-1")
check("stranka Halloween Part I je v repu", bool(dok8))
if dok8:
    pr8 = mod.provenance(dok8, "", "", {"spawn": 3})
    vyz8 = pr8["sekce"].get("vyzkum", {})
    check("neprectena sekce nese vetu ze zdroje",
          vyz8.get("stav") == "neumime" and "not yet been announced" in vyz8.get("veta", ""),
          vyz8)
    check("...u prectene sekce se veta neopakuje",
          "veta" not in pr8["sekce"].get("spawn", {}), pr8["sekce"].get("spawn"))

# Rozbita stranka: parser spolkne vyjimku, provenance to ale rekne nahlas.
check("rozbor bez stranky nic nevymysli", mod.provenance("", "", "", {}) == {"sekce": {}},
      mod.provenance("", "", "", {}))

print("\n9) casovany vyzkum: druha sablona stranky")
# Parser umel jen `event-field-research-list` (terenni vyzkum, odmenou je
# pokemon). Jenze vetsina stranek s vyzkumem pouziva `special-research-list`
# s kroky a odmenami v predmetech — z tech appka necetla nic.
dok9 = stranka("sandile-hatch-day-2026")
check("stranka Sandile Hatch Day je v repu", bool(dok9))
if dok9:
    v9 = mod.vyzkum(dok9)
    check("...precetly se obe vetve vyzkumu", len(v9) == 2, len(v9))
    zdarma = [x for x in v9 if not x["placene"]]
    placene = [x for x in v9 if x["placene"]]
    check("...bezplatna a placena vetev se rozliseji",
          len(zdarma) == 1 and len(placene) == 1,
          [x["nadpis"] for x in v9])
    if zdarma:
        u = zdarma[0]["ukoly"][0]
        check("...ukol i s odmenou v predmetech",
              u["ukol"] == "Hatch an Egg" and u["odmeny"][0]["jmeno"] == "Incubator"
              and u["odmeny"][0]["pocet"] == 1, u)
        check("...typ vyzkumu je casovany", zdarma[0].get("typ") == "timed",
              zdarma[0].get("typ"))
        check("...a odmena za dokonceni kroku je zvlast",
              zdarma[0]["odmeny_kroku"][0]["jmeno"] == "XP"
              and zdarma[0]["odmeny_kroku"][0]["pocet"] == 2026,
              zdarma[0].get("odmeny_kroku"))
    if placene:
        jmena = [o["jmeno"] for u in placene[0]["ukoly"] for o in u["odmeny"]]
        check("...jmeno predmetu se bere i z obrazku, ne jen z popisku",
              all(j and not j.startswith("\u00d7") for j in jmena), jmena)

# Terenni vyzkum (prvni sablona) se tim nesmel rozbit.
dok10 = stranka("fall-marathon-buddy-trek-2026")
if dok10:
    v10 = mod.vyzkum(dok10)
    terenni = [x for x in v10 if x.get("typ") == "field"]
    check("terenni vyzkum se porad cte", len(terenni) >= 1
          and terenni[0]["ukoly"][0]["odmeny"][0]["jmeno"] == "Bramblin",
          [x.get("typ") for x in v10])

print("\n10) GO Pass: bezplatna draha i v druhe sablone")
# Prvni sablona ma `<h3>Rank 10</h3>` a `.bonus-text`. Halloween pouziva
# vetu „The free pass includes:" a za ni obycejny seznam — z toho appka
# necetla nic a tvarila se, ze GO Pass zadnou bezplatnou cast nema.
dok11 = stranka("halloween-2026-part-1")
if dok11:
    gp = mod.go_pass(dok11, 2026)
    check("bezplatna draha se precetla i z odstavce a seznamu",
          bool(gp) and gp.get("zdarma") is True and len(gp.get("bonusy") or []) == 5,
          gp)
    check("...a Deluxe seznam se do ni nepripletl",
          bool(gp) and not any("Deluxe" in b["text"] or "Patissier" in b["text"]
                               for b in (gp.get("bonusy") or [])),
          [b["text"] for b in (gp or {}).get("bonusy", [])])
    check("...termin vyzvednuti odmen se precetl",
          bool(gp) and gp.get("vyzvednout_do", "").startswith("2026-11-07"),
          (gp or {}).get("vyzvednout_do"))
dok12 = stranka("fall-marathon-buddy-trek-2026")
if dok12:
    gp2 = mod.go_pass(dok12, 2026)
    check("prvni sablona GO Passu zustala, jak byla",
          bool(gp2) and any(b.get("rank") == 10 for b in (gp2.get("bonusy") or [])),
          (gp2 or {}).get("bonusy"))

print("\n%d kontrol proslo, %d selhalo" % (passed, len(failures)))
if failures:
    for f in failures:
        print("  x " + f)
    sys.exit(1)
