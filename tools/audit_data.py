# -*- coding: utf-8 -*-
"""Kontrola integrity dat. Pustit po každém obnovení zdrojů.

Smysl: až přibude nová generace pokémonů, tenhle skript řekne, co se rozbilo,
místo aby appka tiše počítala nesmysly. Každá kontrola je invariant, který
musí platit vždycky — ne jen dnes.

Spuštění:  python tools/audit_data.py
Návratový kód 1 = něco neplatí.
"""
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
chyby = []
varovani = []


def nacti(jmeno):
    return json.load(io.open(ROOT / "data" / jmeno, encoding="utf-8"))


def chyba(kde, text):
    chyby.append("%-22s %s" % (kde, text))


def varuj(kde, text):
    varovani.append("%-22s %s" % (kde, text))


dex = nacti("pokedex.json")
moves = nacti("moves.json")
meta = nacti("meta.json")
ref = nacti("reference.json")

species = dex["species"]
cpm = {float(k): v for k, v in dex["cpm"].items()}
powerup = dex["powerup"]
mega = dex["mega"]
chart = ref["typeChart"]
typy = set(chart)

# ---------------------------------------- staty proti druhému zdroji
# pokedex.json je z pogoapi, PvPoke gamemaster je nezávislý mirror téhož
# game masteru. Když se rozejdou, jeden z nich je rozbitý — a appka počítá
# ze statů úplně všechno (CP, stat product, DPS). Tahle kontrola je pojistka
# proti tichému špatnému obnovení dat.
#
# POZOR na názvy forem: PvPoke píše meowth_galarian, pogoapi meowth-galar.
# Bez převodu vyjde přes čtyřicet „neshod", které žádné nejsou — jen se
# porovnávají dva různé druhy.
FORMY = (("-alolan", "-alola"), ("-galarian", "-galar"),
         ("-hisuian", "-hisui"), ("-paldean", "-paldea"))
try:
    gm = json.load(io.open(ROOT / "data" / "raw" / "pvpoke_gamemaster.json",
                           encoding="utf-8"))
except Exception as e:  # zdroj nemusí být stažený, to není chyba dat
    gm = None
    varuj("staty", "PvPoke gamemaster není k dispozici (%s) — křížová"
                   " kontrola statů se přeskočila" % e)

if gm:
    gm_staty = {}
    for e in gm.get("pokemon", []):
        st = e.get("baseStats") or {}
        if not st:
            continue
        k = (e.get("speciesId") or "").replace("_", "-")
        for od, na in FORMY:
            k = k.replace(od, na)
        if k.endswith("-shadow"):
            continue        # shadow je týž druh, jen s multiplikátorem
        gm_staty[k] = (st.get("atk"), st.get("def"), st.get("hp"))

    porovnano = 0
    for klic, v in species.items():
        g = gm_staty.get(klic)
        if not g:
            continue        # formu zná jen jeden zdroj — to samo o sobě chyba není
        porovnano += 1
        if (v[3], v[4], v[5]) != g:
            chyba("staty", "%s: pogoapi %s/%s/%s vs PvPoke %s/%s/%s"
                  % (klic, v[3], v[4], v[5], g[0], g[1], g[2]))
    if porovnano < 800:
        varuj("staty", "porovnalo se jen %d druhů — mapování forem se nejspíš"
                       " rozešlo se zdrojem" % porovnano)

# ------------------------------------------------ mega: ohodnocení nesmí chybět
# Priorita megy řídí od zavedení rozpočtu i to, jestli si appka nechá
# nevyvinutý kus kvůli mega formě. Dřív tu byla dopočítaná záchrana
# („útok >= 280 -> Vysoká"), jenže ta se proti ohodnocenému seznamu rozchází
# u 26 ze 47 meg — udělala by Vysokou z Mega Absola i Sharpeda. Hádat se to
# tedy přestalo; zato musí sedět seznam.
ohodnocene = set()
for e in ref.get("megaEvolutions", []):
    ohodnocene.add(str(e.get("pokemon", "")).lower().replace(" ", "").replace("'", ""))
for klic in mega:
    zaklad = klic.split("-")[0]
    if zaklad not in ohodnocene and klic not in ohodnocene:
        varuj("mega", "%s má mega formu, ale není v ohodnoceném seznamu"
                      " (reference.json) — appka u něj prioritu neodhaduje"
                      " a nic kvůli ní nedrží" % klic)

# ---------------------------------------------------------------- typová tabulka
if len(typy) != 18:
    chyba("typeChart", "má %d typů, čekáno 18" % len(typy))
for a in chart:
    chybi = typy - set(chart[a])
    if chybi:
        chyba("typeChart", "%s nemá hodnotu proti %s" % (a, ", ".join(sorted(chybi))))
    for d, v in chart[a].items():
        if v not in (0.390625, 0.3906, 0.625, 1.0, 1.6):
            chyba("typeChart", "%s->%s má nečekaný násobek %r" % (a, d, v))

# ---------------------------------------------------------------- druhy
bez_typu = 0
vetvene = []   # druhy s víc než jednou možnou evolucí (Eevee, Ralts, Tyrogue…)
for k, e in species.items():
    if len(e) != 10:
        chyba("species", "%s má %d polí, čekáno 10" % (k, len(e)))
        continue
    _id, jmeno, ts, atk, dfn, sta, evolvuje, final, vzacnost, candy = e
    if not jmeno:
        chyba("species", "%s nemá jméno" % k)
    if not ts:
        bez_typu += 1
    for t in ts:
        if t not in typy:
            chyba("species", "%s má neznámý typ %r" % (k, t))
    for nazev, v in (("útok", atk), ("obrana", dfn), ("HP", sta)):
        if not isinstance(v, int) or v <= 0 or v > 600:
            chyba("species", "%s má nesmyslný %s: %r" % (k, nazev, v))
    if evolvuje not in (0, 1):
        chyba("species", "%s má evolvuje=%r" % (k, evolvuje))
    if final and final not in species:
        chyba("species", "%s ukazuje na neexistující finální evoluci %r" % (k, final))
    if evolvuje == 1 and not final:
        vetvene.append(k)
    if evolvuje == 0 and final and final != k:
        varuj("species", "%s se nevyvíjí, ale ukazuje na %s" % (k, final))
    if vzacnost not in ("", "L", "M", "U"):
        chyba("species", "%s má neznámou vzácnost %r" % (k, vzacnost))
    if candy and (not isinstance(candy, int) or candy < 0):
        chyba("species", "%s má nesmyslnou cenu evoluce %r" % (k, candy))
if bez_typu:
    chyba("species", "%d druhů nemá ani jeden typ" % bez_typu)

# evoluční řetězce nesmí cyklit
for k, e in species.items():
    videno, kur = set(), k
    while kur and species.get(kur) and species[kur][7]:
        if kur in videno:
            chyba("species", "evoluční cyklus u %s" % k)
            break
        videno.add(kur)
        dalsi = species[kur][7]
        if dalsi == kur:
            break
        kur = dalsi

# ---------------------------------------------------------------- CPM a ceny
urovne = sorted(cpm)
if urovne[0] != 1.0:
    chyba("cpm", "nezačíná na L1, ale na L%s" % urovne[0])
if urovne[-1] < 50:
    chyba("cpm", "končí na L%s — hra jde do L50" % urovne[-1])
for a, b in zip(urovne, urovne[1:]):
    if round(b - a, 3) != 0.5:
        chyba("cpm", "díra mezi L%s a L%s" % (a, b))
    if cpm[b] <= cpm[a]:
        chyba("cpm", "CPM neroste mezi L%s a L%s" % (a, b))
if abs(cpm.get(40.0, 0) - 0.79030001) > 1e-6:
    chyba("cpm", "L40 = %r, čekáno 0.79030001" % cpm.get(40.0))
if abs(cpm.get(50.0, 0) - 0.8403) > 5e-5:
    chyba("cpm", "L50 = %r, čekáno 0.8403" % cpm.get(50.0))

pu_urovne = sorted(r[0] for r in powerup)
for u in pu_urovne:
    if u not in cpm:
        chyba("powerup", "cena z L%s, ale ten level v CPM není" % u)
for a, b in zip(pu_urovne, pu_urovne[1:]):
    if round(b - a, 3) != 0.5:
        chyba("powerup", "díra v cenách mezi L%s a L%s" % (a, b))
for u, prach, bonbon, xl in powerup:
    if prach <= 0 or bonbon < 0 or xl < 0:
        chyba("powerup", "nesmyslná cena na L%s: %r" % (u, (prach, bonbon, xl)))
    if u >= 40 and xl == 0 and bonbon == 0:
        varuj("powerup", "L%s nestojí ani bonbón" % u)
# nad L40 se platí XL bonbóny, ne obyčejné — kdyby to zdroj otočil, je to vidět
nad40 = [r for r in powerup if r[0] >= 40]
if nad40 and any(r[2] > 0 for r in nad40):
    varuj("powerup", "nad L40 se objevily obyčejné bonbóny — zkontroluj zdroj")

# ---------------------------------------------------------------- mega
for k, formy in mega.items():
    if k not in species:
        chyba("mega", "mega forma pro neznámý druh %r" % k)
    for m in formy:
        if len(m) != 7:
            chyba("mega", "%s: záznam má %d polí, čekáno 7" % (k, len(m)))
            continue
        for t in m[4]:
            if t not in typy:
                chyba("mega", "%s: neznámý typ %r" % (k, t))
        if m[6] not in ("Mega", "Primal"):
            chyba("mega", "%s: neznámý druh evoluce %r" % (k, m[6]))
        if not (m[1] > 0 and m[2] > 0 and m[3] > 0):
            chyba("mega", "%s: nesmyslné staty %r" % (k, m[1:4]))

# ---------------------------------------------------------------- útoky
fastN, fast = moves["fastNames"], moves["fast"]
chN, ch = moves["chargedNames"], moves["charged"]
if len(fastN) != len(fast):
    chyba("moves", "rychlých jmen %d, hodnot %d" % (len(fastN), len(fast)))
if len(chN) != len(ch):
    chyba("moves", "nabitých jmen %d, hodnot %d" % (len(chN), len(ch)))
# Doba 0 ms není chyba, ale smluvená značka: takový útok zná jen PvPoke a herní
# data k němu dobu trvání nemají. Musí ale mít PvP hodnoty — jinak by byl
# k ničemu v raidu i v lize a v nabídce by jen zavazel.
pvpF, pvpC = moves.get("pvpFast") or [], moves.get("pvpCharged") or []
jen_pvp_f = jen_pvp_c = 0
for i, m in enumerate(fast):
    if m[0] not in typy:
        chyba("moves", "rychlý %s má neznámý typ %r" % (fastN[i], m[0]))
    if m[3] <= 0:
        jen_pvp_f += 1
        pv = pvpF[i] if i < len(pvpF) else None
        if not pv or pv[0] <= 0 or pv[1] <= 0:
            chyba("moves", "rychlý %s nemá raidovou dobu ANI použitelné PvP hodnoty (%r)"
                  % (fastN[i], pv))
    elif m[2] < 0:
        chyba("moves", "rychlý %s bere energii místo aby ji dával" % fastN[i])
for i, m in enumerate(ch):
    if m[0] not in typy:
        chyba("moves", "nabitý %s má neznámý typ %r" % (chN[i], m[0]))
    if m[3] <= 0:
        jen_pvp_c += 1
        pv = pvpC[i] if i < len(pvpC) else None
        if not pv or pv[0] <= 0 or pv[1] <= 0:
            chyba("moves", "nabitý %s nemá raidovou dobu ANI použitelné PvP hodnoty (%r)"
                  % (chN[i], pv))
    elif m[2] <= 0:
        varuj("moves", "nabitý %s nestojí energii (%r)" % (chN[i], m[2]))

# Jméno útoku je klíč, přes který se páruje sken z Calcy. Dva stejné názvy
# znamenají, že jeden z nich je nedosažitelný — přesně tak se sem omylem
# dostal druhý „Air Slash" s nulovou dobou a přebil ten pravý.
for jmena, kde in ((fastN, "rychlé"), (chN, "nabité")):
    videl = {}
    for n in jmena:
        k = str(n).strip().lower()
        videl[k] = videl.get(k, 0) + 1
    for k, kolik in videl.items():
        if kolik > 1:
            chyba("moves", "%s útoky mají %dx stejný název %r" % (kde, kolik, k))

if jen_pvp_f or jen_pvp_c:
    varuj("moves", "jen s PvP hodnotami: %d rychlých, %d nabitých "
          "(herní data k nim nemají dobu trvání, do raidů se nepočítají)"
          % (jen_pvp_f, jen_pvp_c))

# Útok, který je v herním learnsetu, musí jít v appce vybrat. Tohle je jediná
# kontrola, která sáhne do syrových dat — a je tu proto, že přesně tady vznikla
# tichá ztráta: pogoapi vedl Psywave, Metal Sound a Sand Attack mezi NABITÝMI
# útoky, i když energii dávají, takže je appka neznala jako rychlé. Lapras je
# v learnsetu měl, v nabídce ne, a ručně se zadat nedaly. 66 druhů.
RAW = ROOT / "data" / "raw"
syrove = RAW / "current_pokemon_moves.json"
if syrove.exists():
    fastSet = {n.strip().lower() for n in fastN}
    chSet = {n.strip().lower() for n in chN}
    ztracene = {}
    for zaznam in json.loads(syrove.read_text(encoding="utf-8")):
        for pole, kde in (("fast_moves", fastSet), ("elite_fast_moves", fastSet),
                          ("charged_moves", chSet), ("elite_charged_moves", chSet)):
            for jm in zaznam.get(pole) or []:
                if str(jm).strip().lower() not in kde:
                    ztracene.setdefault(str(jm), set()).add(zaznam.get("pokemon_name", "?"))
    for jm in sorted(ztracene):
        druhu = ztracene[jm]
        # Když ten útok v datech JE, jen v druhém seznamu, je to špatné zařazení
        # a je to chyba. Když není nikde, je to jen díra ve zdroji.
        opacny = jm.strip().lower() in (chSet | fastSet)
        (chyba if opacny else varuj)(
            "moves",
            "%s zná %d druhů (%s), ale v appce %s"
            % (jm, len(druhu), ", ".join(sorted(druhu)[:3]),
               "je ve špatném seznamu" if opacny else "chybí"))

bez_learnsetu = []
for k in species:
    l = moves["learn"].get(k) or moves["learn"].get(k.split("-")[0])
    if not l:
        bez_learnsetu.append(k)
        continue
    for idx in l[0] + l[2]:
        if idx >= len(fast):
            chyba("learn", "%s ukazuje na rychlý útok #%d, existuje jich %d" % (k, idx, len(fast)))
    for idx in l[1] + l[3]:
        if idx >= len(ch):
            chyba("learn", "%s ukazuje na nabitý útok #%d, existuje jich %d" % (k, idx, len(ch)))
    if not (l[0] + l[2]) or not (l[1] + l[3]):
        varuj("learn", "%s nemá rychlý nebo nabitý útok" % k)
for k in moves["learn"]:
    if k not in species and k.split("-")[0] not in species:
        varuj("learn", "sada útoků pro neznámý druh %r" % k)

# PvP hodnoty musí být na stejných indexech jako běžné
for jmeno, pole, zaklad in (("pvpFast", moves.get("pvpFast"), fast),
                            ("pvpCharged", moves.get("pvpCharged"), ch)):
    if pole is None:
        varuj("moves", "%s v datech chybí" % jmeno)
        continue
    if len(pole) != len(zaklad):
        chyba("moves", "%s má %d položek, ale útoků je %d" % (jmeno, len(pole), len(zaklad)))

# jména útoků z PvPoke se porovnávají po znormalizování na malá písmena
znameUtoky = set(str(n).lower().replace("_", " ") for n in fastN + chN)

# ---------------------------------------------------------------- ligy
for liga, tabulka in meta["leagues"].items():
    if not tabulka:
        chyba("meta", "liga %s je prázdná" % liga)
    nezname = [k for k in tabulka if k not in species and k.split("-")[0] not in species]
    if nezname:
        varuj("meta", "%s: %d druhů žebříčku není v pokédexu (%s%s)"
              % (liga, len(nezname), ", ".join(sorted(nezname)[:6]),
                 " …" if len(nezname) > 6 else ""))
    # schéma: klíč druhu -> [pořadí, skóre, jméno v PvPoke, doporučený moveset, útoky]
    #
    # Díry v pořadí se počítají přes OBĚ tabulky. Shadow varianty mají od
    # rozdělení žebříčků vlastní mapu, takže v běžné chybějí jejich místa —
    # a to je správně. Díra, kterou nevyplňuje ani shadow, je ale pořád
    # příznak, že se některý záznam nespároval s pokédexem.
    poradi = sorted([v[0] for v in tabulka.values()]
                    + [v[0] for v in (meta.get("shadow") or {}).get(liga, {}).values()])
    if poradi and poradi[0] != 1:
        varuj("meta", "%s: žebříček nezačíná na #1 (nejlepší je #%s)" % (liga, poradi[0]))
    if len(set(poradi)) != len(poradi):
        varuj("meta", "%s: dvě položky mají stejné pořadí" % liga)
    for a, b in zip(poradi, poradi[1:]):
        if b - a > 1:
            varuj("meta", "%s: díra v pořadí mezi #%s a #%s" % (liga, a, b))
            break
    for k, v in tabulka.items():
        if len(v) < 3:
            chyba("meta", "%s: %s má jen %d polí" % (liga, k, len(v)))
            continue
        if not isinstance(v[0], int) or v[0] < 1:
            chyba("meta", "%s: %s má nesmyslné pořadí %r" % (liga, k, v[0]))
        if not (0 <= v[1] <= 100):
            chyba("meta", "%s: %s má skóre mimo 0-100: %r" % (liga, k, v[1]))
        # doporučené útoky musí existovat v datech útoků
        for jm in (v[3] if len(v) > 3 else []):
            klic = str(jm).lower().replace("_", " ")
            if klic not in znameUtoky:
                varuj("meta", "%s: %s doporučuje útok %r, který v datech není" % (liga, k, jm))

# Little Cup nesmí obsahovat finální evoluce — jinak by se do něj cpaly
# pokémoni, kteří tam hrát nemůžou
lc_final = [k for k in meta["leagues"].get("little", {})
            if k in species and species[k][6] == 0 and species[k][7] in ("", k)]
if len(lc_final) > len(meta["leagues"].get("little", {})) * 0.2:
    varuj("meta", "Little Cup má %d nevyvíjejících se druhů — zkontroluj pravidla" % len(lc_final))

# ---------------------------------------------------------------- ruční seznam
for zaznam in ref.get("raidAttackers", []):
    if zaznam.get("type") not in typy:
        chyba("reference", "raid útočník %s má neznámý typ %r"
              % (zaznam.get("pokemon"), zaznam.get("type")))

# ---------------------------------------------------------------- pokrytí typů
# na každý typ musí existovat aspoň jeden útok, jinak by se nedal counterovat
utocne = set(m[0] for m in fast) | set(m[0] for m in ch)
chybi_utoky = typy - utocne
if chybi_utoky:
    chyba("moves", "na typy %s neexistuje žádný útok" % ", ".join(sorted(chybi_utoky)))

# ---------------------------------------------------------------- výstup
print("audit dat — %d druhů, %d mega, %d rychlých + %d nabitých útoků, %d úrovní CPM"
      % (len(species), len(mega), len(fast), len(ch), len(cpm)))
print("bez sady útoků: %d druhů" % len(bez_learnsetu))
print("větvené evoluce (víc možných forem): %d — %s"
      % (len(vetvene), ", ".join(sorted(vetvene)[:10])))
if bez_learnsetu[:8]:
    print("   napr.: " + ", ".join(bez_learnsetu[:8]))

if varovani:
    print("\nVAROVANI (%d):" % len(varovani))
    for v in varovani[:40]:
        print("  " + v)
    if len(varovani) > 40:
        print("  ... a dalsich %d" % (len(varovani) - 40))

if chyby:
    print("\nCHYBY (%d):" % len(chyby))
    for c in chyby[:60]:
        print("  " + c)
    if len(chyby) > 60:
        print("  ... a dalsich %d" % (len(chyby) - 60))
    sys.exit(1)

print("\nvse v poradku")
