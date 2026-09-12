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
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from leekduck_okna import okna as rozebrat_okna   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
STRANKY = RAW / "leekduck"
OUT = ROOT / "data" / "events.json"
BASE = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/"
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


def stranka(odkaz, refresh):
    """HTML stránky akce. Stahuje se jednou a pak se čte z disku.

    Stránek je přes čtyřicet a mění se řádově jednou za týden, takže je
    zbytečné je tahat při každém buildu. `--refresh` je stáhne znovu.
    """
    if not odkaz or "leekduck.com" not in odkaz:
        return ""
    STRANKY.mkdir(parents=True, exist_ok=True)
    jmeno = odkaz.rstrip("/").rsplit("/", 1)[-1]
    jmeno = "".join(c if (c.isalnum() or c in "-_") else "_" for c in jmeno)[:120]
    cesta = STRANKY / (jmeno + ".html")
    if cesta.exists() and not refresh:
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
    return html


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
        okna = rozebrat_okna(stranka(e.get("link") or "", refresh), zac, kon,
                             UVODNI_SEKCE.get(e.get("eventType") or ""), prazdne)
        # Sekce, kterou stránka má, ale parser z ní nic nevytáhl. Znamená to,
        # že si LeekDuck přepsal šablonu — bez téhle hlášky by kus akce
        # v kalendáři tiše chyběl a nikdo by si toho nevšiml.
        if prazdne:
            slepe.append((zkratit(e.get("name"), 40), ", ".join(prazdne)))
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
        ])
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
                            " [[druh, shiny 0/1], …], [okno, …]]",
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
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("eventů=%d (z toho %d s rozpisem oken) bossů=%d lig=%d -> %s (%d B)"
          % (len(eventy), s_okny, len(bossove), len(ligy), OUT, OUT.stat().st_size))
    if slepe:
        print("POZOR: sekce, kterou stránka má, ale parser z ní nic nevytáhl —"
              " LeekDuck nejspíš změnil šablonu:")
        for jmeno, sekce in slepe:
            print("  %-42s %s" % (jmeno, sekce))


if __name__ == "__main__":
    main()
