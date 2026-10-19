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
from datetime import datetime, timedelta
from html import unescape
from urllib.parse import unquote
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

# Sekce, které se schválně nečtou: `sales` jsou nákupy, ne rozhodnutí
# o pokémonech. Kdo je chce, má v rozpisu odkaz na stránku akce.
# (`go-pass` se do oken nečte taky, ale bezplatnou větev z něj bere
# `go_pass()` — proto už mezi nečtenými není.)
NECTENE = ("go-pass", "sales")

# Jak se sekce stránky jmenují v datech appky — i ty, které se do oken
# nečtou. Slouží provenance: bez téhle mapy nejde poznat, že stránka sekci
# MÁ a jen z ní nic nevypadlo.
SEKCE_VSE = dict(SEKCE, **{"go-pass": "gopass", "sales": "sales"})

# Stavy sekce. Jména jsou česká, význam je z A-024:
#   nacteno     = available   — sekce je a něco z ní vypadlo
#   neni        = absent      — stránka takovou sekci vůbec nemá
#   neumime     = unsupported — sekce je, ale parser z ní nic nedostal
#                               (prázdný seznam ve zdroji, nebo přepsaná
#                               šablona — zvenčí se to nerozezná)
#   chyba       = error       — rozbor stránky spadl
#   mimo        =             — sekci schválně nečteme (nákupy). Není to
#                               výpadek, takže se o ní v appce mlčí.
STAVY = ("nacteno", "neni", "neumime", "chyba", "mimo")

# Sekce, které se nečtou z rozhodnutí, ne z neschopnosti.
MIMO_ZAJEM = ("sales",)

# Nadpis sekce: `<h2 id="spawns" class="event-section-header spawns">Spawns</h2>`
_HLAVICKA = re.compile(
    r"<h([1-6])[^>]*class=\"([^\"]*event-section-header[^\"]*)\"[^>]*>(.*?)</h\1>",
    re.I | re.S,
)

# Poslední rozbor spadl? `okna()` výjimku polyká, aby nespadl celý build —
# provenance to ale musí umět říct nahlas.
POSLEDNI_CHYBA = ""


# První odstavec sekce. U sekce, ze které nic nevypadlo, to bývá rovnou
# odpověď („Specific tasks and encounters have not yet been announced.").
_ODSTAVEC = re.compile(r"<p[^>]*>(.*?)</p>", re.I | re.S)


def nalezene_sekce(html):
    """Které sekce stránka má → ``{klíč v datech: (nadpis, věta ze zdroje)}``.

    Věta je první odstavec té sekce. U sekce, která nic nevypsala, to je
    jediné, co o ní zdroj říká — a je to víc než mlčení.
    """
    html = html or ""
    nalezy = list(_HLAVICKA.finditer(html))
    out = {}
    for i, m in enumerate(nalezy):
        klic = None
        for t in m.group(2).split():
            if t in SEKCE_VSE:
                klic = SEKCE_VSE[t]
                break
        if not klic or klic in out:
            continue
        konec = nalezy[i + 1].start() if i + 1 < len(nalezy) else len(html)
        telo = html[m.end():konec]
        veta = ""
        for kus in _ODSTAVEC.findall(telo):
            kus = _cisty_text(kus)
            # Krátké útržky („Rank 1") nejsou vysvětlení, jen popisek.
            if len(kus) >= 40:
                veta = kus[:260]
                break
        out[klic] = (_cisty_text(m.group(3)), veta)
    return out


def provenance(html, odkaz="", ziskano="", data=None):
    """Stav každé sekce stránky — co se povedlo přečíst a co ne.

    ``data`` je mapa ``{klíč sekce: počet položek}`` nebo rovnou to, co
    z té sekce vypadlo; počítá se jen pravdivost. Sekce, kterou stránka
    nemá, dostane ``neni`` a v appce se o ní mlčí. Sekce, která na stránce
    JE a nic z ní nevypadlo, dostane ``neumime`` — tam appka musí říct
    „Podrobnosti nejsou dostupné" a ukázat zdroj, ne předstírat, že akce
    nic takového nemá.
    """
    data = data or {}
    sekce = {}
    nalezene = nalezene_sekce(html)
    for klic, (nadpis, veta) in nalezene.items():
        if klic in MIMO_ZAJEM:
            stav = "mimo"
        elif data.get(klic):
            stav = "nacteno"
        elif POSLEDNI_CHYBA:
            stav = "chyba"
        else:
            stav = "neumime"
        zaznam = {"stav": stav, "nadpis": nadpis}
        # Věta ze zdroje jen tam, kde appka nic nevypsala — u načtené
        # sekce by jen opakovala, co už je vidět v seznamu.
        if veta and stav in ("neumime", "chyba"):
            zaznam["veta"] = veta
        sekce[klic] = zaznam
    # Sekce, kterou stránka nemá, se nevypisuje vůbec — „neni" je výchozí
    # stav a prázdný záznam by jen nafukoval data, která veze celá appka.
    out = {"sekce": sekce}
    if odkaz:
        out["odkaz"] = odkaz
    if ziskano:
        out["ziskano"] = ziskano
    if POSLEDNI_CHYBA:
        out["chyba"] = POSLEDNI_CHYBA
    return out

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
        self._odstavec = None
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
    # Popisek skupiny, po kterém se spawny rozdeluji. Kadidlo neni volna
    # priroda: ty druhy bez nej nepotkas.
    _KADIDLO = re.compile(r"incense", re.I)

    def _sekce_bloku(self):
        """Sekce, do ktere polozka patri — s ohledem na popisek skupiny."""
        if self.sekce == "spawn" and self._KADIDLO.search(self.label or ""):
            return "kadidlo"
        return self.sekce

    def _blok(self):
        sekce = self._sekce_bloku()
        p = self.bloky[-1] if self.bloky else None
        if not p or p["sekce"] != sekce or p["cas"] != self.cas \
                or p["label"] != self.label:
            self.bloky.append({"sekce": sekce, "cas": self.cas,
                               "label": self.label, "polozky": []})
        return self.bloky[-1]

    # --- HTMLParser ------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        tridy = (a.get("class") or "").split()

        # Konec článku: dál už je autor a patička webu, ne obsah akce.
        if tag == "footer" or "author-box" in tridy or "site-footer" in tridy:
            self.sekce = None
            self.cas = ""
            self.label = ""
            return

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
        # Věty ve Spawns nesou podmínku („Daily Adventure Incense is
        # excluded"), bez které seznam druhů lže. Jinde se odstavce neberou:
        # u bonusů a výzkumu je text už v položkách.
        if tag == "p" and self.sekce == "spawn":
            self._odstavec = []

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4") and self._h is not None:
            text = re.sub(r"\s+", " ", "".join(self._h)).strip()
            if self._h_sekce is not None:
                self.sekce = None if self._h_sekce == "?" else self._h_sekce
                self.cas = ""
                self.label = ""
            elif self.sekce is not None:
                if rozsah(text, self.zacatek, self.konec) is not None:
                    # Nové časové okno. Popisek skupiny ("Incense Encounters")
                    # se NEMAŽE: ve zdroji stojí NAD okny a platí pro ně pro
                    # všechna. Když se mazal, přišla appka o to, že ty druhy
                    # chodí jen na kadidlo.
                    self.cas = text
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
        if self._odstavec is not None and tag == "p":
            text = re.sub(r"\s+", " ", "".join(self._odstavec)).strip()
            self._odstavec = None
            # Krátké zbytky („a", „:") nejsou věta a do rozpisu nepatří.
            if len(text) > 12 and self.sekce:
                self._blok()["polozky"].append({"jmeno": text, "shiny": 0, "text": 1})
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
        if self._odstavec is not None:
            self._odstavec.append(data)
        if self._jmeno is not None:
            self._jmeno.append(data)
        if self._bonus is not None:
            self._bonus.append(data)


# Bonus s hvězdičkou běží jinak dlouho než samotná akce. Vysvětlivka stojí
# pod seznamem bonusů: „* While most bonuses are only active during the three
# hours of the event (2:00 p.m. to 5:00 p.m. local time), these bonuses will be
# active from 2:00 p.m. to 9:00 p.m. local time."
_VYSVETLIVKA = re.compile(
    r"bonuses\s+will\s+be\s+active\s+from\s+(.{1,30}?)\s+to\s+(.{1,30}?)"
    r"\s*(?:local\s+time|\.|$)", re.I | re.S)
_HODINA = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?", re.I)


def _denni_cas(text):
    """„9:00 p.m." → (21, 0). Vrací None, když to čas není."""
    m = _HODINA.search(text or "")
    if not m:
        return None
    hod = int(m.group(1))
    minuta = int(m.group(2) or 0)
    if hod > 23 or minuta > 59:
        return None
    ampm = m.group(3).lower()
    if ampm == "p" and hod < 12:
        hod += 12
    if ampm == "a" and hod == 12:
        hod = 0
    return hod, minuta


def prodlouzene_bonusy(html):
    """Do kdy platí bonusy s hvězdičkou: „HH:MM", nebo None.

    Čte se jen vysvětlivka pod seznamem — žádné domýšlení. Když ji stránka
    nemá nebo se z ní čas nepodaří přečíst, vrátí se None a okno se nepřidá.
    """
    text = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    m = _VYSVETLIVKA.search(text)
    if not m:
        return None
    konec = _denni_cas(m.group(2))
    return "%02d:%02d" % konec if konec else None


def _doplnit_prodlouzeni(out, html, zacatek):
    """Přidá okno pro bonusy, které běží i po konci akce.

    Hvězdička se z textu bonusu umaže — bez vysvětlivky nic neznamená a
    v appce by vypadala jako překlep. Informaci nese to druhé okno.
    """
    # Nejdřív vysvětlivka: bez ní hvězdička znamená podmínku, ne jiný čas
    # („*For these bonuses to apply…“), a sahat se na ni nesmí.
    do_kdy = prodlouzene_bonusy(html)
    if not do_kdy or not out:
        return
    oznacene = []
    for _od, _do, sekce in out:
        for polozka in sekce.get("bonus") or []:
            if polozka[1] != -1 and polozka[0].endswith("*"):
                oznacene.append(polozka)
    if not oznacene:
        return
    hvezdicka = []
    for polozka in oznacene:
        polozka[0] = polozka[0].rstrip("*").rstrip()
        hvezdicka.append(list(polozka))
    # Hlavní okno je to, ve kterém bonusy stojí; prodloužení začíná tam,
    # kde končí ono, a končí časem z vysvětlivky.
    hlavni = [o for o in out if (o[2].get("bonus"))]
    od = max(o[1] for o in hlavni) if hlavni else out[0][1]
    den = (od or zacatek or "")[:10]
    if not den:
        return
    konec = den + "T" + do_kdy
    # Vysvětlivka může mluvit o čase PŘED koncem akce (jiná akce, jiné
    # pravidlo) — pak se nepřidává nic, dvě okna přes sebe by jen mátla.
    if konec <= od:
        return
    out.append([od, konec, {"bonus": hvezdicka}])


# ---------------------------------------------------------------- GO Pass
# Sekce `go-pass` je z větší části obchod (Deluxe za 4,99 USD), ale veze
# i bezplatnou větev, milníkové bonusy a termín vyzvednutí odměn, který je
# jiný než konec akce. Bere se jen tohle — katalog ne.
_GP_SEKCE = re.compile(r'id="go-pass"(.*?)(?:<h2[^>]*class="[^"]*event-section-header'
                       r'|<section class="author-box"|<footer)', re.I | re.S)
_GP_ZDARMA = re.compile(r"is a free progression track"
                        r"|(?:receive|get) the free pass"
                        r"|the free pass includes", re.I)
_GP_NAZEV = re.compile(r"<h2[^>]*>\s*(GO Pass[^<]{0,60}?)\s*</h2>", re.I)
# Věta končí tečkou uvnitř „p.m.", takže se nečte „až k tečce", ale pevné
# okno za spouštěcím slovem — datum si v něm najde `_cas` sám.
_GP_VYZVEDNOUT = re.compile(r"Claim all unlocked[^.]{0,120}?expire on\s+(.{5,60})"
                            r"|Claim all unlocked rewards by\s+(.{5,60})",
                            re.I | re.S)
_GP_DO_KDY = re.compile(r"rank up until\s+(.{5,60})", re.I | re.S)
# Druhá šablona: bezplatná dráha je věta a za ní obyčejný seznam.
# Deluxe seznam se nesmí chytit — proto se bere jen `<ul>` hned za tou
# větou a jen do nejbližšího `</ul>`.
_GP_ZDARMA_SEZNAM = re.compile(
    r"free pass includes[^<]{0,40}</p>\s*<ul[^>]*>(.*?)</ul>", re.I | re.S)
_GP_POLOZKA = re.compile(r"<li[^>]*>(.*?)</li>", re.I | re.S)
_GP_TIER = re.compile(r"<h3[^>]*>(.*?)</h3>(.*?)(?=<h3|<h2|$)", re.I | re.S)
_GP_RANK = re.compile(r"Rank\s+(\d+)", re.I)
_GP_TEXT = re.compile(r'class="bonus-text"[^>]*>(.*?)</div>', re.I | re.S)


def _cisty_text(html):
    """Text bez značek, s normálními mezerami.

    Entity se rozbalují DŘÍV než se srovnávají mezery — jinak projde
    `&nbsp;` jako pevná mezera a zůstane v textu („Explore 1 km").
    """
    text = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    return re.sub(r"\s+", " ", text.replace(" ", " ")).strip()


def _gp_termin(text, rok):
    """„Wednesday, October 21, 2026, at 8:00 p.m." → ISO. None, když to datum není.

    Rok uprostřed věty rozbíjel čtení času (`_cas` čeká hodinu hned za dnem),
    takže se nejdřív vystřihne.
    """
    if not text:
        return None
    bez_roku = re.sub(r",\s*(20\d\d)\s*,", ",", text)
    bez_roku = re.sub(r",\s*at\s+", " at ", bez_roku, flags=re.I)
    m = re.search(r"(20\d\d)", text)
    vysledek = _cas(bez_roku, int(m.group(1)) if m else rok, 1)
    if not vysledek:
        return None
    return vysledek[0].strftime("%Y-%m-%dT%H:%M")


def go_pass(html, rok=None):
    """Bezplatná část GO Passu, nebo None, když ji stránka nemá.

    Vrací ``{"nazev", "zdarma", "sbirat_do", "vyzvednout_do", "bonusy"}``;
    ``bonusy`` je ``[{"rank": 10, "text": "…"}, …]``. Co se nepodaří přečíst,
    chybí — nic se nedomýšlí.
    """
    m = _GP_SEKCE.search(html or "")
    if not m:
        return None
    blok = m.group(1)
    text = _cisty_text(blok)
    rok = rok or 0
    out = {}
    nazev = _GP_NAZEV.search(blok)
    if nazev:
        out["nazev"] = _cisty_text(nazev.group(1))
    out["zdarma"] = bool(_GP_ZDARMA.search(text))
    do_kdy = _GP_DO_KDY.search(text)
    if do_kdy:
        t = _gp_termin(do_kdy.group(1), rok)
        if t:
            out["sbirat_do"] = t
    vyzvednout = _GP_VYZVEDNOUT.search(text)
    if vyzvednout:
        # Dvě znění téže věty, každé ve své skupině.
        t = _gp_termin(vyzvednout.group(1) or vyzvednout.group(2), rok)
        if t:
            out["vyzvednout_do"] = t
    bonusy = []
    for nadpis, telo in _GP_TIER.findall(blok):
        jm = _cisty_text(nadpis)
        # Deluxe je placená větev — ta do rozpisu nepatří. Bezplatné
        # milníky se poznají podle toho, že o Deluxe nemluví.
        if re.search(r"deluxe", jm, re.I):
            continue
        rank = _GP_RANK.search(jm)
        if not rank:
            continue
        for b in _GP_TEXT.findall(telo):
            popis = _cisty_text(b)
            if popis:
                bonusy.append({"rank": int(rank.group(1)), "text": popis})
    if not bonusy:
        # Druhá šablona: co bezplatná dráha obsahuje, stojí v seznamu
        # za větou. Rank u toho není — hra ho rozdává postupně a zdroj
        # ho tady neuvádí, takže si ho appka nevymýšlí.
        seznam = _GP_ZDARMA_SEZNAM.search(blok)
        if seznam:
            for kus in _GP_POLOZKA.findall(seznam.group(1)):
                popis = _cisty_text(kus)
                if popis:
                    bonusy.append({"text": popis})
    if bonusy:
        out["bonusy"] = bonusy
    # Prázdná skořápka nikomu nepomůže: buď se něco přečetlo, nebo nic.
    if not (out.get("bonusy") or out.get("vyzvednout_do") or out.get("zdarma")):
        return None
    return out


# --------------------------------------------------------------- výzkum
# Vazba úkol → možné odměny. Seznam `event-field-research-list` má u každé
# položky úkol a vedle něj odměny; nadpis nad seznamem říká, o jaký výzkum
# jde (a jestli je placený).
# Nadpis musí být ten NEJBLIŽŠÍ nad seznamem — bez téhle podmínky se
# lepil první nadpis stránky („Features").
_VYZ_SEZNAM = re.compile(
    r'<h2[^>]*>(?P<nadpis>(?:(?!</h2>).)*?)</h2>(?P<mezi>(?:(?!<h2).)*?)'
    r'<ul class="event-field-research-list">(?P<telo>.*?)</ul>', re.I | re.S)
_VYZ_POLOZKA = re.compile(r"<li>(.*?)</li>", re.I | re.S)
_VYZ_UKOL = re.compile(r'class="task"[^>]*>(.*?)</span>', re.I | re.S)
_VYZ_ODMENA = re.compile(r'<div class="reward\s*"[^>]*>(.*?)(?=<div class="reward\s*"|$)',
                         re.I | re.S)
_VYZ_JMENO = re.compile(r'class="reward-label"[^>]*>\s*<span>(.*?)</span>', re.I | re.S)
_VYZ_CP = re.compile(r'class="(max|min)-cp"[^>]*>.*?</div>\s*([\d\s,]+)', re.I | re.S)


class _SRParser(HTMLParser):
    """Časovaný / speciální výzkum: kroky, úkoly a odměny v předmětech.

    Drží si hloubku zanoření u každého bloku, který sbírá — `step-item`
    i `task-reward` jsou divy s dalšími divy uvnitř a podle značek by se
    jejich konec jinak neuhlídal.
    """

    def __init__(self):
        HTMLParser.__init__(self)
        self.skupiny = []
        self.skupina = None
        self.hloubka = 0
        self.sber = None          # co se zrovna sbírá do textu
        self.text = []
        self.krok = 0
        self.ukol = None
        self.odmeny_kroku = []
        self.konec = False        # narazili jsme na další sekci stránky
        self._obrazek = ""
        self._bloky = []          # [(hloubka, co), …] – step-item, task-reward…
        self._shiny = False

    # --- pomocné -------------------------------------------------------
    def _zavri_ukol(self):
        if self.ukol and self.ukol.get("odmeny"):
            self.skupina["ukoly"].append(self.ukol)
        self.ukol = None

    def _nova_skupina(self, nadpis):
        self._zavri_ukol()
        self.skupina = {"nadpis": nadpis, "podnadpis": "", "ukoly": [],
                        "odmeny_kroku": [], "placene": False}
        self.skupiny.append(self.skupina)
        self.krok = 0

    # --- HTMLParser ----------------------------------------------------
    def handle_starttag(self, tag, attrs):
        if self.konec:
            return
        a = dict(attrs)
        tridy = (a.get("class") or "").split()
        if tag in ("h1", "h2", "h3") and "event-section-header" in tridy:
            # Research skončil, dál je jiná sekce stránky.
            self._zavri_ukol()
            self.konec = "research" not in tridy and bool(self.skupiny)
            return
        if tag in ("h1", "h2", "h3") and "special-research-header" in tridy:
            self.sber = "nadpis"
            self.text = []
            return
        if tag == "p" and "special-research-subtitle" in tridy:
            self.sber = "podnadpis"
            self.text = []
            return
        if tag == "img":
            if "shiny-icon" in (a.get("class") or ""):
                self._shiny = True
            if "reward-image" in (a.get("class") or ""):
                # Jméno předmětu bývá JEN tady: u odměny za krok stojí
                # v popisku pouhé „×1" a co to je, řekne soubor obrázku.
                self._obrazek = _jmeno_z_obrazku(a.get("src") or "")
        if tag == "div":
            self.hloubka += 1
            if "step-item" in tridy:
                self._zavri_ukol()
                self.krok += 1
                self._bloky.append((self.hloubka, "krok"))
            elif "task-reward" in tridy:
                self._zavri_ukol()
                self.ukol = {"ukol": "", "krok": self.krok, "odmeny": []}
                self._bloky.append((self.hloubka, "ukol"))
            elif "page-reward-wrapper" in tridy:
                self._zavri_ukol()
                self._bloky.append((self.hloubka, "krokodmena"))
            elif "reward-label" in tridy:
                self.sber = "odmena"
                self.text = []
                self._shiny = False
            return
        if tag == "span":
            if "task-text" in tridy:
                self.sber = "ukol"
                self.text = []
            elif "reward-label" in tridy:
                self.sber = "odmena"
                self.text = []
                self._shiny = False

    def handle_endtag(self, tag):
        if self.konec:
            return
        if tag in ("h1", "h2", "h3") and self.sber == "nadpis":
            self._nova_skupina(_cisty_text("".join(self.text)))
            self.sber = None
            return
        if tag == "p" and self.sber == "podnadpis":
            if self.skupina is not None:
                self.skupina["podnadpis"] = _cisty_text("".join(self.text))
            self.sber = None
            return
        if tag == "span" and self.sber in ("ukol", "odmena"):
            hodnota = _cisty_text("".join(self.text))
            if self.sber == "ukol" and self.ukol is not None:
                self.ukol["ukol"] = hodnota
            elif self.sber == "odmena" and hodnota:
                kam = self.ukol["odmeny"] if self.ukol is not None else (
                    self.skupina["odmeny_kroku"] if self.skupina else None)
                if kam is not None:
                    kam.append(_odmena(hodnota, self._shiny, self.krok, self._obrazek))
            self.sber = None
            return
        if tag == "div":
            if self.sber == "odmena":
                hodnota = _cisty_text("".join(self.text))
                if hodnota:
                    kam = self.ukol["odmeny"] if self.ukol is not None else (
                        self.skupina["odmeny_kroku"] if self.skupina else None)
                    if kam is not None:
                        kam.append(_odmena(hodnota, self._shiny, self.krok, self._obrazek))
                self.sber = None
            while self._bloky and self._bloky[-1][0] >= self.hloubka:
                _, co = self._bloky.pop()
                if co == "ukol":
                    self._zavri_ukol()
            self.hloubka -= 1

    def handle_data(self, data):
        if self.sber:
            self.text.append(data)


# „Incubator ×1", „2026 XP", „1,000 Stardust" → jméno a počet zvlášť.
_POCET_ZA = re.compile(r"^(?P<jmeno>.+?)\s*[x\u00d7]\s*(?P<pocet>[\d,\.]+)$", re.I)
_POCET_PRED = re.compile(r"^(?P<pocet>[\d,\.]+)\s+(?P<jmeno>.+)$")


# Jen počet, bez jména: „×1", „x 5 000".
_JEN_POCET = re.compile(r"^[x\u00d7]\s*[\d,\.]+$", re.I)


def _jmeno_z_obrazku(src):
    """`.../items/Super Incubator.png` → `Super Incubator`."""
    jmeno = unquote(str(src or "").rstrip("/").rsplit("/", 1)[-1])
    jmeno = re.sub(r"\.(png|jpg|jpeg|webp|svg)$", "", jmeno, flags=re.I)
    jmeno = jmeno.replace("_", " ").strip()
    return "XP" if jmeno.lower() == "xp" else jmeno


def _odmena(text, shiny, krok, obrazek=""):
    """Jedna odměna. Počet se odděluje od jména, ať jde sečíst i vypsat."""
    if obrazek and _JEN_POCET.match(text):
        text = obrazek + " " + text
    jmeno, pocet = text, None
    m = _POCET_ZA.match(text) or _POCET_PRED.match(text)
    if m:
        cislo = re.sub(r"[^\d]", "", m.group("pocet"))
        if cislo:
            jmeno, pocet = m.group("jmeno").strip(), int(cislo)
    z = {"jmeno": jmeno, "shiny": 1 if shiny else 0}
    if pocet:
        z["pocet"] = pocet
    if krok:
        z["krok"] = krok
    return z


# Placené větve se poznají podle nadpisu i podtitulku: „Premium Timed
# Research", „Paid Timed Research". Cenu ani katalog appka nebere.
_PLACENE = re.compile(r"\b(paid|premium|ticket(ed)?)\b", re.I)


def vyzkum_kroky(html):
    """Časovaný a speciální výzkum ze šablony `special-research-list`.

    Vrací stejný tvar jako `vyzkum()` a navíc `typ`, `krok` u úkolu
    a `odmeny_kroku` (co padne za dokončení kroku).
    """
    p = _SRParser()
    try:
        p.feed(html or "")
    except Exception:          # rozbitá stránka nesmí shodit build
        return []
    p._zavri_ukol()
    out = []
    for sk in p.skupiny:
        if not sk["ukoly"] and not sk["odmeny_kroku"]:
            continue
        cely = sk["nadpis"] + " " + sk["podnadpis"]
        sk["placene"] = bool(_PLACENE.search(cely))
        sk["typ"] = "special" if re.search(r"special research", cely, re.I) else "timed"
        if not sk["podnadpis"]:
            sk.pop("podnadpis")
        if not sk["odmeny_kroku"]:
            sk.pop("odmeny_kroku")
        out.append(sk)
    return out


def vyzkum(html):
    """Úkoly a jejich možné odměny. Prázdný seznam, když je stránka nemá.

    Vrací ``[{"nadpis", "placene", "ukoly": [{"ukol", "odmeny": [{"jmeno",
    "shiny", "cp"}]}]}]``. Odměny jsou MOŽNÉ, ne garantované — tak je
    zdroj označuje a appka to nesmí slíbit jinak.
    """
    out = []
    for m in _VYZ_SEZNAM.finditer(html or ""):
        # Mezi nadpisem a seznamem nesmí být jiný seznam ani jiná sekce,
        # jinak by se nadpis přilepil k cizímu výzkumu.
        if "event-field-research-list" in m.group("mezi"):
            continue
        nadpis = _cisty_text(m.group("nadpis"))
        ukoly = []
        for kus in _VYZ_POLOZKA.findall(m.group("telo")):
            u = _VYZ_UKOL.search(kus)
            if not u:
                continue
            ukol = _cisty_text(u.group(1))
            odmeny = []
            for blok in _VYZ_ODMENA.findall(kus):
                jm = _VYZ_JMENO.search(blok)
                if not jm:
                    continue
                jmeno = _cisty_text(jm.group(1))
                if not jmeno:
                    continue
                cp = {}
                for kam, hodnota in _VYZ_CP.findall(blok):
                    cislo = re.sub(r"[^\d]", "", hodnota)
                    if cislo:
                        cp[kam] = int(cislo)
                z = {"jmeno": jmeno, "shiny": 1 if "shiny-icon" in blok else 0}
                if cp.get("min") and cp.get("max"):
                    z["cp"] = [cp["min"], cp["max"]]
                odmeny.append(z)
            if ukol and odmeny:
                ukoly.append({"ukol": ukol, "odmeny": odmeny})
        if ukoly:
            out.append({"nadpis": nadpis, "typ": "field",
                        "placene": bool(_PLACENE.search(nadpis)),
                        "ukoly": ukoly})
    # Druhá šablona (časovaný a speciální výzkum) je na stránkách častější
    # než ta první — bez ní appka u většiny akcí tvrdila, že výzkum nemá.
    return out + vyzkum_kroky(html)


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
    global POSLEDNI_CHYBA
    POSLEDNI_CHYBA = ""
    p = _Parser(zacatek, konec, vychozi_sekce)
    try:
        p.feed(html or "")
    except Exception as chyba:   # rozbitá stránka nesmí shodit celý build
        # Spolknutá výjimka je v pořádku (akce zůstane bez rozpisu), ale
        # nesmí se ztratit: provenance z ní udělá stav „chyba".
        POSLEDNI_CHYBA = type(chyba).__name__
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
    # Bonusy s hvězdičkou běží dýl než akce — dostanou vlastní okno.
    _doplnit_prodlouzeni(out, html, zacatek)
    out.sort(key=lambda x: (x[0], x[1]))
    return out
