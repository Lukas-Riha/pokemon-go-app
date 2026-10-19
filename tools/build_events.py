"""Upeče do data/events.json aktuální eventy a raid bosse.

Proč ne z pokemongo.com: oficiální stránka s eventy je prázdná JS schránka
a obsah dá až po přihlášení k účtu Pokémon GO. Strojově se z ní nic vytáhnout
nedá.

Zdroj: ScrapedDuck — komunitní scraper LeekDuck, který publikuje výsledek jako
JSON přímo v repu (https://github.com/bigfoott/ScrapedDuck). Není to oficiální
zdroj Niantiku, takže se bere s rezervou; datum stažení se v appce ukazuje.

Data se do appky **zapékají**, protože běží offline z disku a nikam nechodí.
Tím pádem stárnou — po skončení eventu je potřeba spustit tohle znovu:

    python tools/build_events.py --refresh
    python tools/sync_reference.py
"""
import json
import os
import re
import sys
import urllib.request
from html import unescape
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from leekduck_okna import okna as rozebrat_okna   # noqa: E402
from leekduck_okna import go_pass as go_pass_akce   # noqa: E402
from leekduck_okna import vyzkum as vyzkum_akce   # noqa: E402
from leekduck_okna import provenance as provenance_akce   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
STRANKY = RAW / "leekduck"
OUT = ROOT / "data" / "events.json"
BASE = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/"


def uloz(cesta, text):
    """Napíše soubor atomicky: nejprve vedle, pak přemístí.

    Rozpis akcí je jediný zdroj pro kalendář a přepisuje ho i denní úloha
    bez dozoru. Zápis přímo do cílového souboru znamená, že přerušený běh
    (spánek, timeout úlohy, spadlé stahování) po sobě nechá prázdný soubor
    a data jsou nenávratně pryč — jednou už se to stalo. Takhle se cíl
    mění až v okamžiku, kdy je nový obsah celý na disku.
    """
    docasny = cesta.with_suffix(cesta.suffix + ".tmp")
    docasny.write_text(text, encoding="utf-8")
    os.replace(docasny, cesta)
FILES = {"events": "events.min.json", "raids": "raids.min.json"}
UA = {"User-Agent": "pokemon-go-planner (local build)"}

# typy eventů, které pro rozhodování o pokémonech nic neříkají
NUDNE = {"go-pass", "go-battle-league"}

# Jednoduché akce (Max Monday, Raid Hour, Spotlight Hour) nemají na stránce
# žádné sekce — vypsaného pokémona nesou rovnou v úvodu. Kam ten seznam patří,
# se pozná z typu akce, ne z obsahu stránky: u spotlightu je to divočina,
# u Max Monday a raid hodiny raid.
UVODNI_SEKCE = {
    "max-mondays": "raid",
    "max-battles": "raid",
    "raid-hour": "raid",
    "raid-day": "raid",
    "raid-battles": "raid",
    "pokemon-spotlight-hour": "spawn",
    "community-day": "spawn",
}

# Které ligy zrovna běží, se dá vyčíst z názvu GBL události. Rotace se pak dá
# promítnout do rozpočtu: držet šest kusů do Little Cupu, který zrovna neběží,
# je jiná investice než do Great, která běží pořád.
LIGY_V_NAZVU = [
    ("Little Cup", "LC"),
    ("Great League", "GL"),
    ("Ultra League", "UL"),
    ("Master League", "ML"),
]


def ligy_z_nazvu(nazev):
    """(otevřené ligy, omezené formáty) z názvu GBL události.

    Dřív stačilo, že se v názvu vyskytl text „Great League", a appka hlásila,
    že Great League běží. Jenže „Great League: Mega Edition" je formát, kde
    musíš postavit megu, a „Willpower Cup: Great League Edition" má vlastní
    seznam povolených druhů — otevřená meta v nich neplatí a pořadí z PvPoke
    o nich nic neříká.

    Název je výčet oddělený čárkami a slovem „and". Segment, který je PŘESNĚ
    jméno ligy, je otevřená liga. Cokoli dalšího je omezený formát a vrací se
    zvlášť i s ligou, ze které vychází (kvůli CP limitu).
    """
    t = (nazev or "").split("|")[0]
    segmenty = []
    for kus in t.replace(" and ", ",").split(","):
        kus = kus.strip(" .")
        if kus:
            segmenty.append(kus)
    otevrene, omezene = [], []
    for kus in segmenty:
        presna = [zk for jm, zk in LIGY_V_NAZVU if kus == jm]
        if presna:
            otevrene.append(presna[0])
            continue
        zaklad = [zk for jm, zk in LIGY_V_NAZVU if jm in kus]
        omezene.append([kus, zaklad[0] if zaklad else ""])
    # Pořadí podle LIGY_V_NAZVU, ať se výstup nemění podle formulace názvu.
    poradi = [zk for _, zk in LIGY_V_NAZVU]
    otevrene = sorted(set(otevrene), key=poradi.index)
    return otevrene, omezene


def fetch(refresh):
    RAW.mkdir(parents=True, exist_ok=True)
    out = {}
    for klic, jmeno in FILES.items():
        path = RAW / ("scrapedduck_" + jmeno)
        if refresh or not path.exists():
            print("stahuji %s …" % jmeno)
            req = urllib.request.Request(BASE + jmeno, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                path.write_bytes(r.read())
        out[klic] = json.loads(path.read_text(encoding="utf-8"))
    return out


# Štítky, které LeekDuck dává nad nadpis akce. Co neznáme, projde dál tak,
# jak to na stránce stojí — vymýšlet si k tomu překlad by lhalo.
STITKY_CZ = {
    "event": "Akce",
    "location-specific": "Jen v některých zemích",
    "community-day": "Community Day",
    "pokemon-spotlight-hour": "Spotlight Hour",
    "raid-battles": "Raidy",
    "raid-day": "Raid Day",
    "raid-hour": "Raid Hour",
    "research": "Výzkum",
    "timed-research": "Časový výzkum",
    "ticketed-event": "Za vstupenku",
    "live-event": "Živá akce",
    "go-battle-league": "GO Battle League",
    "season": "Sezóna",
    "max-battles": "Max souboje",
    "pokemon-go-fest": "GO Fest",
}


def utok_akce(html):
    """Exkluzivní útok akce: jméno, typ a podmínka, doslova ze zdroje.

    Stránka má sekci `featured-attack`; za nadpisem stojí odstavec
    s podmínkou („Evolve Zorua during the event…") a pod ním `h3`
    s názvem útoku a jeho typem („Sucker Punch (Dark-type)"). Když
    stránka sekci nemá, vrací se None — nic se nedomýšlí.
    """
    i = html.find('id="featured-attack"')
    if i < 0:
        return None
    kus = html[i:i + 4000]
    h3 = re.search(r"<h3[^>]*>(.*?)</h3>", kus, re.S)
    if not h3:
        return None
    nazev = re.sub(r"<[^>]+>", "", h3.group(1))
    nazev = unescape(nazev).strip()
    typ = ""
    m = re.match(r"^(.*?)\s*\((\w+)\s*-\s*type\)\s*$", nazev, re.I)
    if m:
        nazev, typ = m.group(1).strip(), m.group(2).capitalize()
    veta = ""
    pp = re.search(r"<p[^>]*>(.*?)</p>", kus, re.S)
    if pp:
        veta = unescape(re.sub(r"<[^>]+>", " ", pp.group(1)))
        veta = re.sub(r"\s+", " ", veta).strip()
    if not nazev:
        return None
    return {"jmeno": nazev, "typ": typ, "podminka": veta}


def stitky_akce(html):
    """Štítky a omezení ze stránky akce.

    Štítky jsou pilulky nad nadpisem (`Event`, `Location-specific`).
    Omezení je věta ze stránky („This event is available only in Indonesia.") —
    bere se doslova a česky se k ní jen dopíše, odkud je. Přeložit cizí větu
    za zdroj by znamenalo tvrdit něco, co tam nestojí.
    """
    if not html:
        return [], ""
    stitky = []
    # Za blokem štítků následuje podle šablony jednou <hr>, jindy <section>.
    # Spolehlivé je vzít kousek textu za „page-tags" a posbírat z něj pilulky.
    zacatek = html.find('class="page-tags"')
    blok = html[zacatek:zacatek + 800] if zacatek >= 0 else ""
    if blok:
        for kus in re.finditer(r'<div class="tag ([^"]+)"[^>]*>(.*?)</div>', blok, re.S):
            klic = kus.group(1).strip().split()[0]
            popis = re.sub(r"<[^>]+>", "", kus.group(2)).strip()
            if not popis:
                continue
            stitky.append([klic, STITKY_CZ.get(klic, popis)])
    omezeni = ""
    telo = re.search(r'<div class="event-description">(.*?)</div>', html, re.S)
    if telo:
        text = re.sub(r"<[^>]+>", " ", telo.group(1))
        text = re.sub(r"\s+", " ", text).replace("&nbsp;", " ")
        for veta in re.split(r"(?<=[.!])\s+", text):
            veta = veta.strip()
            # Dlouhý odstavec (rozpis vstupenek u placených akcí) není omezení,
            # jen v něm ta slova náhodou padnou. Bereme jen krátkou větu.
            if len(veta) > 180:
                continue
            if re.search(r"available only in|only available in|exclusive to", veta, re.I):
                omezeni = veta
                break
    return stitky, omezeni


# Kdy se která stránka akce naposledy stahovala. Plní `stranka()`.
ZISKANO = {}


# Jak dlouho stačí uložená stránka běžící akce.
STARI_HODIN = 24


def stranka(odkaz, refresh, bezi=True):
    """HTML stránky akce. Čte se z disku, dokud je kopie čerstvá.

    `--refresh` stáhne všechno znovu. Bez něj se znovu stahují jen
    stránky **běžících a budoucích** akcí starší než `STARI_HODIN` —
    LeekDuck doplňuje výzkum a bonusy až dodatečně a bez tohohle by
    appka četla pořád ten první, ještě prázdný otisk. Skončená akce se
    už nezmění, takže se netahá vůbec.
    """
    if not odkaz or "leekduck.com" not in odkaz:
        return ""
    STRANKY.mkdir(parents=True, exist_ok=True)
    jmeno = odkaz.rstrip("/").rsplit("/", 1)[-1]
    jmeno = "".join(c if (c.isalnum() or c in "-_") else "_" for c in jmeno)[:120]
    cesta = STRANKY / (jmeno + ".html")
    stara = False
    if cesta.exists() and bezi:
        vek = (datetime.now() - datetime.fromtimestamp(cesta.stat().st_mtime))
        stara = vek.total_seconds() > STARI_HODIN * 3600
    if cesta.exists() and not refresh and not stara:
        # Datum souboru = kdy se stránka naposledy stahovala. Appka to
        # ukazuje u zdroje, ať je poznat, jak čerstvý ten rozpis je.
        ZISKANO[odkaz] = datetime.fromtimestamp(cesta.stat().st_mtime).strftime("%Y-%m-%dT%H:%M")
        return cesta.read_text(encoding="utf-8", errors="replace")
    try:
        req = urllib.request.Request(odkaz, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            html = r.read().decode("utf-8", "replace")
    except Exception as e:
        # Nedostupná stránka nesmí shodit build — akce prostě zůstane
        # bez rozpisu, přesně jako dřív.
        print("  ! %s: %s" % (jmeno, e))
        return ""
    cesta.write_text(html, encoding="utf-8")
    ZISKANO[odkaz] = datetime.now().strftime("%Y-%m-%dT%H:%M")
    return html


_IKONA_DRUHU = re.compile(r"^pokemon[ _]icon[ _](\d{1,4})[ _]\d+$", re.I)
_PODLE_ID = None


def druh_podle_ikony(jmeno):
    """`pokemon icon 448 00` → `Lucario`. Jinak prázdno."""
    global _PODLE_ID
    m = _IKONA_DRUHU.match(str(jmeno or "").strip())
    if not m:
        return ""
    if _PODLE_ID is None:
        _PODLE_ID = {}
        try:
            dex = json.loads((ROOT / "data" / "pokedex.json").read_text(encoding="utf-8"))
            for zaznam in (dex.get("species") or {}).values():
                if zaznam and zaznam[0] not in _PODLE_ID:
                    _PODLE_ID[zaznam[0]] = zaznam[1]
        except Exception:
            _PODLE_ID = {}
    return _PODLE_ID.get(int(m.group(1)), "")


def zkratit(s, n=90):
    s = str(s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def spawny(e):
    """Druhy, které daná akce vypouští do divočiny.

    Spolehlivě to jde jen u Spotlight Hour a Community Day — tam ScrapedDuck
    veze konkrétní jména. U ostatních akcí je v datech jen příznak „něco se
    spawnuje" bez seznamu, takže se nevrací nic; radši nic než vymyšlený
    seznam, podle kterého by někdo běhal ven.
    """
    ed = e.get("extraData")
    if not isinstance(ed, dict):
        return []
    out, videl = [], set()
    for klic in ("spotlight", "communityday"):
        blok = ed.get(klic)
        if not isinstance(blok, dict):
            continue
        seznam = blok.get("list")
        if not isinstance(seznam, list) or not seznam:
            seznam = [blok] if blok.get("name") else []
        for m in seznam:
            jm = str((m or {}).get("name") or "").strip()
            if not jm or jm.lower() in videl:
                continue
            videl.add(jm.lower())
            out.append([jm, 1 if (m or {}).get("canBeShiny") else 0])
    return out


def main():
    raw = fetch("--refresh" in sys.argv)

    # GBL události se do seznamu akcí nedávají (byl by z toho šum), ale
    # rotace lig z nich vytáhnout jde a je to jediný zdroj, který o ní
    # něco ví.
    ligy = []
    for e in raw["events"]:
        if e.get("eventType") != "go-battle-league":
            continue
        otevrene, omezene = ligy_z_nazvu(e.get("name"))
        ligy.append([
            zkratit(e.get("name")),
            (e.get("start") or "")[:16],
            (e.get("end") or "")[:16],
            otevrene,
            e.get("link") or "",
            # omezené formáty: [název, liga, ze které vychází]
            omezene,
        ])
    ligy.sort(key=lambda x: x[1])

    # Stránky akcí se stahují jen tehdy, když se stahovala i jejich data.
    refresh = "--refresh" in sys.argv
    eventy = []
    s_okny = 0
    slepe = []
    for e in raw["events"]:
        if e.get("eventType") in NUDNE:
            continue
        zac = (e.get("start") or "")[:16]
        kon = (e.get("end") or "")[:16]
        prazdne = []
        # Skončená akce se nestahuje znovu — její stránka se už nezmění.
        bezi = not kon or kon[:10] >= date.today().isoformat()
        html = stranka(e.get("link") or "", refresh, bezi)
        okna = rozebrat_okna(html, zac, kon,
                             UVODNI_SEKCE.get(e.get("eventType") or ""), prazdne)
        stitky, omezeni = stitky_akce(html)
        utok = utok_akce(html)
        # GO Pass: jen bezplatná větev, milníkové bonusy a termín vyzvednutí
        # odměn — ten bývá jiný než konec akce. Ceny a Deluxe se neberou.
        gopass = go_pass_akce(html, int(zac[:4]) if zac[:4].isdigit() else None)
        # Výzkum s vazbou úkol → možné odměny. Plochý seznam v oknech
        # zůstává kvůli starším záznamům; tohle je ta úplnější podoba.
        vyzkumy = vyzkum_akce(html)
        # Sekce, kterou stránka má, ale parser z ní nic nevytáhl. Znamená to,
        # že si LeekDuck přepsal šablonu — bez téhle hlášky by kus akce
        # v kalendáři tiše chyběl a nikdo by si toho nevšiml.
        if prazdne:
            slepe.append((zkratit(e.get("name"), 40), ", ".join(prazdne)))
        # Stav každé sekce stránky. Bez tohohle vypadala sekce, ze které
        # parser nic nedostal, stejně jako akce, která nic takového nemá —
        # a appka tiše tvrdila, že je zobrazeno všechno.
        napocitano = {}
        for w in okna:
            for k, v in (w[2] or {}).items():
                napocitano[k] = napocitano.get(k, 0) + len(v or [])
        if gopass:
            napocitano["gopass"] = len(gopass.get("bonusy") or []) or 1
        if vyzkumy:
            napocitano["vyzkum"] = max(napocitano.get("vyzkum", 0), 1)
        if utok:
            napocitano["utoky"] = max(napocitano.get("utoky", 0), 1)
        # „pokemon icon 448 00" je soubor obrázku, ne jméno odměny —
        # číslo je pokédexové ID a to už appka zná.
        for sk in vyzkumy:
            for seznam in [sk.get("odmeny_kroku") or []] + [
                    u.get("odmeny") or [] for u in (sk.get("ukoly") or [])]:
                for o in seznam:
                    jm = druh_podle_ikony(o.get("jmeno") or "")
                    if jm:
                        o["jmeno"] = jm
        zdroj = provenance_akce(html, e.get("link") or "",
                                ZISKANO.get(e.get("link") or "", ""), napocitano)
        if okna:
            s_okny += 1
        eventy.append([
            zkratit(e.get("name")),
            e.get("eventType") or "",
            e.get("heading") or "",
            zac,
            kon,
            e.get("link") or "",
            spawny(e),
            okna,
            # Devátý sloupec: štítky ze stránky akce a věta o omezení.
            dict({"stitky": stitky, "omezeni": omezeni},
                 **({"utok": utok} if utok else {}),
                 **({"gopass": gopass} if gopass else {}),
                 **({"vyzkum": vyzkumy} if vyzkumy else {}),
                 **({"zdroj": zdroj} if zdroj.get("sekce") else {})),
        ])
    # Akce, ktere ze zdroje vypadly, ale skoncily nedavno: kalendar ma
    # umet i krok zpatky. Drzi se tri mesice — starsi uz nikdo nehleda
    # a soubor nese cela appka.
    ARCHIV_DNU = 90
    hranice = (date.today() - timedelta(days=ARCHIV_DNU)).isoformat()
    nove_klice = set((e[0], e[3]) for e in eventy)
    archiv = 0
    if OUT.exists():
        try:
            stare = json.loads(OUT.read_text(encoding="utf-8")).get("events") or []
        except Exception:
            stare = []
        for e in stare:
            if not isinstance(e, list) or len(e) < 5:
                continue
            if (e[0], e[3]) in nove_klice:
                continue
            konec = str(e[4] or "")[:10]
            if not konec or konec < hranice:
                continue
            # Deváté pole říká, že je to otisk z dřívějšího stažení — obsah
            # se od té doby nikde neověřoval.
            if len(e) < 9:
                e = e + [{}] * (9 - len(e))
            if isinstance(e[8], dict):
                e[8] = dict(e[8])
                e[8]["archiv"] = True
            eventy.append(e)
            archiv += 1
    if archiv:
        print("  z archivu doplněno akcí (už nejsou ve zdroji): %d" % archiv)
    # Zdroj obcas tutez akci uvede dvakrat: jednou s terminem a jednou bez
    # nej. Nedatovana kopie se na osu nenakresli a v detailu pise "Termin
    # nepotvrzen" — je to tataz akce, jen horsi. U skoncene akce prestane
    # zdroj termin uvadet, ale archiv ho z drivejsiho stazeni ma, takze
    # se cisti az po slouceni. Kdyz dvojice existuje,
    # nedatovana se zahazuje; kdyz je akce bez data jedina, zustava (radsi
    # akce bez terminu nez zadna).
    podle_jmena = {}
    for e in eventy:
        podle_jmena.setdefault(e[0], []).append(e)
    bez_data = 0
    ocistene = []
    for e in eventy:
        ma_dvojce_s_datem = any((x[3] or x[4]) for x in podle_jmena[e[0]])
        if (e[3] or e[4]) or not ma_dvojce_s_datem:
            ocistene.append(e)
        else:
            bez_data += 1
    if bez_data:
        print("  zahozeno nedatovanych duplicit: %d" % bez_data)
    eventy = ocistene

    # Druha podoba teze duplicity: stejny termin, stejny typ a jedno jmeno
    # je castí druheho („Super Mega Raid Day" proti „Chandelure Super Mega
    # Raid Day"). Zdroj akci nejdriv ohlasi obecne a pozdeji ji prejmenuje
    # podle druhu; archiv si tu starou podobu pamatuje, takze v kalendari
    # stala dvakrat pod sebou. Zustava ta konkretnejsi — a kdyby snad mela
    # min obsahu, rozhodne obsah, ne delka jmena.
    def bohatost(e):
        return (len(e[7] or []), len(e[6] or []), len(e[0] or ""))

    zahozeno_obecnych = 0
    podle_terminu = {}
    for e in eventy:
        podle_terminu.setdefault((e[1], e[3], e[4]), []).append(e)
    pryc = set()
    for skupina in podle_terminu.values():
        if len(skupina) < 2:
            continue
        for a in skupina:
            for b in skupina:
                if a is b or id(a) in pryc or id(b) in pryc:
                    continue
                ja, jb = (a[0] or "").strip(), (b[0] or "").strip()
                if not ja or not jb or ja == jb:
                    continue
                # „je castí" se bere na celá slova, ne na kus retezce
                if not (ja.endswith(jb) or ja.startswith(jb)):
                    continue
                horsi = a if bohatost(a) < bohatost(b) else b
                pryc.add(id(horsi))
                zahozeno_obecnych += 1
    if zahozeno_obecnych:
        eventy = [e for e in eventy if id(e) not in pryc]
        print("  zahozeno obecnych duplicit (tyz termin i typ): %d"
              % zahozeno_obecnych)

    eventy.sort(key=lambda x: x[3])

    # u bosse stačí jméno, úroveň, typy a CP při chycení — counter se pak
    # spočítá z typů proti rosteru, stejně jako v panelu na gymy
    bossove = []
    for b in raw["raids"]:
        cp = b.get("combatPower") or {}
        norm = cp.get("normal") or {}
        boost = cp.get("boosted") or {}
        bossove.append([
            b.get("name") or "",
            b.get("tier") or "",
            [t.get("name", "").capitalize() for t in (b.get("types") or [])],
            [norm.get("min"), norm.get("max")],
            [boost.get("min"), boost.get("max")],
            1 if b.get("canBeShiny") else 0,
        ])

    out = {
        "_meta": {
            "zdroj": "https://github.com/bigfoott/ScrapedDuck (komunitní scraper LeekDuck)",
            "pozn": "Oficiální pokemongo.com/events je JS schránka za přihlášením — strojově nečitelná."
                    " Regeneruj přes: python tools/build_events.py --refresh",
            "stazeno": date.today().isoformat(),
            "schema_event": "[název, typ, nadpis, začátek, konec, odkaz,"
                            " [[druh, shiny 0/1], …], [okno, …],"
                            " {stitky: [[klíč, popis]], omezeni: věta ze zdroje,"
                            " utok: {jmeno, typ, podminka},"
                            " gopass: {nazev, zdarma, sbirat_do,"
                            " vyzvednout_do, bonusy: [{rank, text}]},"
                            " vyzkum: [{nadpis, placene, ukoly:"
                            " [{ukol, odmeny: [{jmeno, shiny, cp}]}]}]}]",
            "schema_okno": "[od, do, {sekce: [[jméno, shiny 0/1], …]}] — sekce je"
                           " spawn/vejce/raid/vyzkum/bonus/shiny, shiny -1 značí"
                           " mezinadpis seznamu, a datum bez „T“ znamená, že"
                           " zdroj hodinu neuvedl",
            "pozn_spawny": "sedmý sloupec (druhy) je jen u Spotlight Hour a Community"
                           " Day — v JSONu zdroje jinde není. Osmý sloupec (okna) se"
                           " čte přímo ze stránky akce na LeekDucku, viz"
                           " tools/leekduck_okna.py",
            "schema_boss": "[jméno, úroveň, [typy], [CP min, max], [CP boost min, max], shiny 0/1]",
            "schema_liga": "[název, začátek, konec, [zkratky lig], odkaz]",
        },
        "events": eventy,
        "ligy": ligy,
        "raids": bossove,
    }
    uloz(OUT, json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("eventů=%d (z toho %d s rozpisem oken) bossů=%d lig=%d -> %s (%d B)"
          % (len(eventy), s_okny, len(bossove), len(ligy), OUT, OUT.stat().st_size))
    if slepe:
        print("POZOR: sekce, kterou stránka má, ale parser z ní nic nevytáhl —"
              " LeekDuck nejspíš změnil šablonu:")
        for jmeno, sekce in slepe:
            print("  %-42s %s" % (jmeno, sekce))
    # Přehled stavu sekcí. „neumime" nemusí být chyba — zdroj seznam často
    # neuvádí a napíše to větou — ale když to číslo skočí nahoru, je to
    # první známka, že se šablona LeekDucku změnila.
    stavy = {}
    for e in eventy:
        for v in ((e[8].get("zdroj") or {}).get("sekce") or {}).values():
            stavy[v["stav"]] = stavy.get(v["stav"], 0) + 1
    if stavy:
        print("sekce akcí: " + ", ".join("%s=%d" % (k, stavy[k]) for k in sorted(stavy)))


if __name__ == "__main__":
    main()
