# -*- coding: utf-8 -*-
"""Rozebere stránku akce na LeekDucku na časová okna.

Proč vlastní parser a ne ScrapedDuck: jejich JSON u běžné akce veze jenom
``"hasSpawns": true`` — příznak, že se něco spawnuje, **bez seznamu**. Konkrétní
jména dává jen u Spotlight Hour a Community Day. Kdo chce vědět, co se v úterý
mezi desátou a osmou objevuje v divočině a co je zrovna v pětikilometrových
vejcích, musí na stránku akce.

Ta je naštěstí poskládaná strojově čitelně::

    <h2 id="spawns" class="event-section-header spawns">Spawns</h2>
      <h2 id="...">September 8 at 10:00 a.m. – September 11 at 10:00 a.m.</h2>
      <ul class="pkmn-list-flex">
        <li class="pkmn-list-item">
          <div class="pkmn-list-img normal"><img …></div>
          <img class="shiny-icon" …>
          <div class="pkmn-name">Pidgey</div>
        </li>
      </ul>

Nadpis uvnitř sekce otevírá **okno** — buď časové („September 8 at 10:00 a.m.
– September 11 at 10:00 a.m.“), nebo obecné („Throughout the Event“). Co se
z nadpisu nepodaří přečíst jako datum, se **nedomýšlí**: okno dostane rozsah
celé akce a původní text nadpisu se zachová, ať je vidět, o čem to bylo.

Je to scraping cizí stránky, takže je to křehké — když si LeekDuck předělá
šablonu, parser přestane vidět a vrátí prázdno. To je schválně: appka pak
ukáže akci bez rozpisu jako dřív, nikdy si nic nevymyslí.
"""
import re
from datetime import datetime
from html.parser import HTMLParser

# Sekce, které o pokémonech něco říkají. Klíč = třída v `event-section-header`,
# hodnota = jak se to jmenuje v datech appky.
SEKCE = {
    "spawns": "spawn",
    "eggs": "vejce",
    "raids": "raid",
    "research": "vyzkum",
    "bonuses": "bonus",
    "shiny": "shiny",
    # „Features" nese debuty druhů, nové úrovně mega a spotlighty uvnitř akce;
    # „Moves" útoky, které jde získat jen po tu dobu. Obojí je rozhodnutí
    # (evolvovat teď, nebo ne), takže na osu patří.
    "features": "novinky",
    "moves": "utoky",
}

# Sekce, které se schválně nečtou: `go-pass` a `sales` jsou nákupy, ne
# rozhodnutí o pokémonech. Kdo je chce, má v rozpisu odkaz na stránku akce.
NECTENE = ("go-pass", "sales")

MESICE = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
}

# „September 8 at 10:00 a.m.“ / „September 8“ / „8“
_KUS = re.compile(
    r"(?:(?P<mesic>[A-Za-z]+)\s+)?(?P<den>\d{1,2})"
    r"(?:\s*(?:at|,)?\s*(?P<hod>\d{1,2})(?::(?P<min>\d{2}))?\s*(?P<ampm>[ap])\.?\s*m\.?)?",
    re.I,
)
# pomlčka, kterou LeekDuck odděluje začátek a konec (různé druhy)
_POMLCKA = re.compile(r"\s*[–—−-]\s*|\s+to\s+", re.I)


def _cas(kus, rok, vychozi_mesic):
    """Jeden konec rozsahu na (datetime, má hodinu). Vrací None, není-li datum."""
    m = _KUS.search(kus or "")
    if not m:
        return None
    mesic = m.group("mesic")
    if mesic:
        mesic = MESICE.get(mesic.lower())
        if not mesic:
            return None
    else:
        mesic = vychozi_mesic
    den = int(m.group("den"))
    hod = int(m.group("hod") or 0)
    minuta = int(m.group("min") or 0)
    ampm = (m.group("ampm") or "").lower()
    if ampm == "p" and hod < 12:
        hod += 12
    if ampm == "a" and hod == 12:
        hod = 0
    try:
        return datetime(rok, mesic, den, hod, minuta), bool(m.group("ampm"))
    except ValueError:
        return None


def rozsah(popis, zacatek, konec):
    """Text nadpisu → (od, do) v ISO, nebo None, když to datum není.

    `zacatek`/`konec` je rozsah celé akce; bere se z něj rok a výchozí měsíc,
    protože LeekDuck rok v nadpisu neuvádí.
    """
    t = (popis or "").strip()
    if not t or not re.search(r"\d", t):
        return None
    try:
        zac = datetime.fromisoformat(zacatek[:16])
        kon = datetime.fromisoformat(konec[:16])
    except (ValueError, TypeError):
        return None

    casti = _POMLCKA.split(t, maxsplit=1)
    # První část MUSÍ nést název měsíce. Bez toho by „Tier 2 Bonus – Starting
    # at Rank 15" prošlo jako 2. až 15. den měsíce akce.
    if not re.search(r"\b(" + "|".join(MESICE) + r")\b", casti[0], re.I):
        return None
    prvni = _cas(casti[0], zac.year, zac.month)
    if prvni is None:
        return None
    od, od_hodina = prvni
    druhy = _cas(casti[1], zac.year, od.month) if len(casti) > 1 else None
    do, do_hodina = druhy if druhy else (None, False)

    # Akce přes Silvestra: „December 30 – January 2“ končí až příští rok.
    if do is not None and do < od:
        try:
            do = do.replace(year=do.year + 1)
        except ValueError:
            pass
    # Bez druhého konce platí okno do konce akce — ten čas je známý.
    if do is None:
        do, do_hodina = kon, True
    # Začátek nesmí být dřív, než akce vůbec běží. Konec se NEOŘEZÁVÁ: raidová
    # rotace „September 8–15“ opravdu běží o den dýl než akce, na kterou je
    # navěšená, a useknout ji by byla lež v opačném směru.
    # Ořez posouvá hodnotu, ale nesmí z nadpisu udělat přesnější údaj, než
    # jaký byl: „September 8–15" zůstává dny, i když se začátek srovná na
    # start akce.
    if od < zac:
        od = zac
    if do < od:
        return None
    # Nadpis, který hodinu neuvádí, ji nedostane ani v datech. „00:00“ je
    # domýšlení, které na časové ose vypadá jako fakt.
    presne = od_hodina or do_hodina
    if presne:
        return [od.isoformat(timespec="minutes"), do.isoformat(timespec="minutes")]
    return [od.date().isoformat(), do.date().isoformat()]


class _Parser(HTMLParser):
    """Projde stránku a posbírá (sekce, nadpis) → seznam položek."""

    def __init__(self, zacatek, konec, vychozi=None):
        HTMLParser.__init__(self)
        self.zacatek = zacatek
        self.konec = konec
        # Sekce pro seznam v úvodu stránky, kde žádné sekce nejsou.
        self.vychozi = vychozi
        self.sekce = None          # aktuální sekce (spawn / vejce / …)
        # Nadpisy uvnitř sekce jsou dvojího druhu a nesmí se přepisovat
        # navzájem: „September 8 … – September 11 …" určuje ČAS, „In 5 km
        # Eggs" je POPISEK seznamu. U vajec a výzkumu jdou za sebou (čas,
        # popisek, seznam, čas, popisek, seznam) — kdyby si sáhly na totéž
        # pole, druhé okno přepíše první a obě sady se slijí do jedné.
        self.cas = ""              # nadpis, ze kterého jde přečíst datum
        self.label = ""            # nadpis, ze kterého datum přečíst nejde
        self.bloky = []            # [{sekce, cas, label, polozky: [...]}]
        self._h = None             # sbírám text nadpisu
        self._h_sekce = None       # třída sekce z právě otevřeného <h2>
        self._jmeno = None         # sbírám .pkmn-name
        self._bonus = None         # sbírám .bonus-text
        self._kus = None           # rozpracovaná položka
        self._hloubka_kus = 0
        # Výzkum má vlastní strukturu: `ul.event-field-research-list`, v ní
        # `li` s úkolem a odměnou. Jméno druhu je v `.reward-label`.
        self._vyzkum = False
        self._seznam = None        # kolik <li> má právě otevřený seznam
        # Sekce, ve kterých stránka MÁ nějaký seznam. Sekce složená jen
        # z textu („As the Seasons change, you may find…") není porucha
        # parseru, takže se do hlídače nepočítá.
        self.sekce_se_seznamem = set()

    # --- pomocné ---------------------------------------------------------
    def _blok(self):
        p = self.bloky[-1] if self.bloky else None
        if not p or p["sekce"] != self.sekce or p["cas"] != self.cas \
                or p["label"] != self.label:
            self.bloky.append({"sekce": self.sekce, "cas": self.cas,
                               "label": self.label, "polozky": []})
        return self.bloky[-1]

    # --- HTMLParser ------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        tridy = (a.get("class") or "").split()

        if tag in ("h1", "h2", "h3", "h4"):
            self._h = []
            self._h_sekce = None
            if "event-section-header" in tridy:
                for t in tridy:
                    if t in SEKCE:
                        self._h_sekce = SEKCE[t]
                        break
                # Sekce, o kterou nestojíme (features, sales, go-pass…) —
                # obsah se přeskočí, ať se nesmíchá s tím předchozím.
                if self._h_sekce is None:
                    self._h_sekce = "?"
            return

        # Úvod stránky. U jednoduchých akcí (Max Monday, Raid Hour, Spotlight
        # Hour) je to jediné místo, kde vypsaný pokémon je — sekce tam žádné
        # nejsou. Kam ten seznam patří, říká volající podle typu akce.
        if "event-description" in tridy and self.sekce is None and self.vychozi:
            self.sekce = self.vychozi
            self.cas = ""
            self.label = ""

        if self.sekce is None:
            return

        # Hlídač tichých výpadků. Prázdný `<ul>` posílá LeekDuck i tehdy, když
        # obsah ještě není známý, takže se počítají až POLOŽKY v něm — sekce
        # se seznamem plným řádků, ze kterého nic nevypadlo, je porucha.
        if tag == "ul" and ("event-field-research-list" in tridy
                            or "pkmn-list-flex" in tridy):
            self._seznam = 0
        if tag == "li" and self._seznam is not None:
            self._seznam += 1
        if "bonus-item" in tridy and self.sekce:
            self.sekce_se_seznamem.add(self.sekce)
        if tag == "ul" and "event-field-research-list" in tridy:
            self._vyzkum = True
        if "pkmn-list-item" in tridy:
            self._kus = {"jmeno": "", "shiny": 0}
            self._hloubka_kus = 1
            return
        # Odměna za úkol: `li` v seznamu výzkumu je taky jeden druh.
        if tag == "li" and self._vyzkum and self._kus is None:
            self._kus = {"jmeno": "", "shiny": 0}
            self._hloubka_kus = 1
            return
        if self._kus is not None and tag == "li":
            self._hloubka_kus += 1
        if self._kus is not None and ("pkmn-name" in tridy or "reward-label" in tridy):
            self._jmeno = []
            # `.pkmn-name` je div, `.reward-label` span — konec se pozná podle
            # značky, ve které sběr začal.
            self._jmeno_tag = "span" if "reward-label" in tridy else "div"
        if self._kus is not None and "shiny-icon" in tridy:
            self._kus["shiny"] = 1
        if "bonus-text" in tridy:
            self._bonus = []

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4") and self._h is not None:
            text = re.sub(r"\s+", " ", "".join(self._h)).strip()
            if self._h_sekce is not None:
                self.sekce = None if self._h_sekce == "?" else self._h_sekce
                self.cas = ""
                self.label = ""
            elif self.sekce is not None:
                if rozsah(text, self.zacatek, self.konec) is not None:
                    # Nové časové okno — popisek k němu teprve přijde.
                    self.cas = text
                    self.label = ""
                else:
                    self.label = text
            self._h = None
            self._h_sekce = None
            return

        if tag == "ul":
            if self._seznam and self.sekce:
                self.sekce_se_seznamem.add(self.sekce)
            self._seznam = None
            self._vyzkum = False
        if self._jmeno is not None and tag == (getattr(self, "_jmeno_tag", "div")):
            self._kus["jmeno"] = re.sub(r"\s+", " ", "".join(self._jmeno)).strip()
            self._jmeno = None
            return
        if self._bonus is not None and tag == "div":
            text = re.sub(r"\s+", " ", "".join(self._bonus)).strip()
            if text and self.sekce:
                self._blok()["polozky"].append({"jmeno": text, "shiny": 0, "text": 1})
            self._bonus = None
            return
        if self._kus is not None and tag == "li":
            self._hloubka_kus -= 1
            if self._hloubka_kus <= 0:
                if self._kus["jmeno"]:
                    self._blok()["polozky"].append(self._kus)
                self._kus = None

    def handle_data(self, data):
        if self._h is not None:
            self._h.append(data)
        if self._jmeno is not None:
            self._jmeno.append(data)
        if self._bonus is not None:
            self._bonus.append(data)


def okna(html, zacatek, konec, vychozi_sekce=None, prazdne=None):
    """HTML stránky akce → seznam oken pro appku.

    ``vychozi_sekce`` je sekce pro seznam v úvodu stránky u akcí, které žádné
    sekce nemají (Max Monday, Raid Hour). Bez ní se takový seznam přeskočí.

    Do ``prazdne`` (seznam) se zapíšou sekce, které stránka má, ale nic z nich
    nevypadlo — tedy místa, kde se změnila struktura a parser oslepl.

    Výstup: ``[[od, do, {"spawn": [[jméno, shiny], …], …}], …]``

    ``shiny`` je 0/1; hodnota **-1** znamená, že to není pokémon, ale
    mezinadpis toho seznamu („In 5 km Eggs", „Mega Raids", „Shiny Debut").
    Okna jsou seřazená podle začátku; okno bez vlastního času dostane rozsah
    celé akce.
    """
    p = _Parser(zacatek, konec, vychozi_sekce)
    try:
        p.feed(html or "")
    except Exception:          # rozbitá stránka nesmí shodit celý build
        return []
    # Sekce, kterou stránka má, ale nic z ní nevypadlo. Znamená to, že
    # LeekDuck změnil strukturu — a bez tohohle by to nikdo nepoznal, jen
    # by v kalendáři tiše chyběl kus akce.
    if prazdne is not None:
        naplnene = set(b["sekce"] for b in p.bloky if b["polozky"] and b["sekce"])
        prazdne[:] = sorted(p.sekce_se_seznamem - naplnene)

    # Klíč okna je jeho ČAS, ne nadpis: „Spawns“ a „Eggs“ mají u téže akce
    # stejné nadpisy s daty a patří do jednoho okna na časové ose.
    poradi, podle_klice = [], {}
    for b in p.bloky:
        if not b["polozky"] or not b["sekce"]:
            continue
        r = rozsah(b["cas"], zacatek, konec) if b["cas"] else None
        # Okno bez vlastního času platí po celou akci. Nic se nedomýšlí —
        # rozsah je ten, který u akce stejně platí.
        klic = tuple(r) if r else ("cela",)
        if klic not in podle_klice:
            podle_klice[klic] = {
                "od": r[0] if r else (zacatek or "")[:16],
                "do": r[1] if r else (konec or "")[:16],
                "sekce": {},
            }
            poradi.append(klic)
        cil = podle_klice[klic]["sekce"].setdefault(b["sekce"], [])
        # Popisek („In 5 km Eggs", „Mega Raids", „Shiny Debut") nese
        # informaci, kterou samotná sekce nemá — jde do seznamu jako
        # mezinadpis, poznaný podle shiny = -1.
        if b["label"]:
            cil.append([b["label"], -1])
        videl = set(x[0].lower() for x in cil if x[1] != -1)
        for kus in b["polozky"]:
            if kus["jmeno"].lower() in videl:
                continue
            videl.add(kus["jmeno"].lower())
            cil.append([kus["jmeno"], kus["shiny"]])

    out = []
    for klic in poradi:
        o = podle_klice[klic]
        if not o["sekce"]:
            continue
        out.append([o["od"], o["do"], o["sekce"]])
    out.sort(key=lambda x: (x[0], x[1]))
    return out
