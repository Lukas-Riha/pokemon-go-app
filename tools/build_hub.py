"""Stáhne žebříčky Pokémon GO Hubu (útočníci po typech, obránci gymů).

Proč to appka potřebuje: svoje vlastní pořadí si počítá sama a bude počítat
dál — rozhoduje podle něj rozpočet rolí v rosteru. Jenže **Vyhledávání není
o tvých kusech, je to obecná informace**, a tam má stát totéž, co říká Hub.
Do teď se to rozcházelo dvakrát: jiným číslem (appka bere jen druhy, které
mají rychlý i nabitý útok toho typu, Hub i míchané sestavy) a jinou známkou
(Hubovy hranice nejsou podílem na špičce, ale v absolutním eDPS).

Čte se:
  * `pokemon-list/best-per-type/<typ>` — útočníci jednoho typu
  * `best/gym-defenders` — obránci gymů

Tabulka v HTML má jen první stránku, ale **celý žebříček je ve stránce
jako JSON** (Next.js si jím stránkuje v prohlížeči). Čte se proto ten JSON,
ne tabulka — jinak by z každého typu bylo prvních padesát řádků.

Jména se tady rovnou překládají na klíče, které zná `data/pokedex.json`
(„Alolan Marowak" → `marowak-alola`, „Mega Charizard Y" → mega forma
Charizarda). Kdyby se to nechalo na appku, musela by tu logiku mít v sobě
a chyba by se projevila až u člověka.

Pořadí i známka jsou MODEL POKÉMON GO HUBU, ne appky — všude, kde se
ukazují, musí být napsané, odkud jsou.

Spuštění:
    python tools/build_hub.py              # použije cache v data/raw/
    python tools/build_hub.py --refresh    # stáhne znovu
"""
import json
import re
import sys
import time
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DEX = ROOT / "data" / "pokedex.json"
OUT = ROOT / "data" / "hub.json"

URL_TYP = "https://db.pokemongohub.net/pokemon-list/best-per-type/%s"
URL_GYM = "https://db.pokemongohub.net/best/gym-defenders"

TYPY = ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug",
        "Ghost", "Steel", "Fire", "Water", "Grass", "Electric", "Psychic",
        "Ice", "Dragon", "Dark", "Fairy"]

# Když se najde výrazně míň, stránka se přestavěla a je lepší skončit chybou
# než zapéct půlku dat.
MIN_TYPU = 15
MIN_RADKU_TYP = 50
MIN_GYM = 150

# Slova, která v názvu formy nic neurčují — klíče v pokédexu je nemají
# („Average size" → `average`, „Galarian Standard Mode" → `galarianstandard`,
# „Two-Segment Form" → `two`, „Hero of Many Battles" → `hero`).
VYPLN = {"forme", "form", "mode", "size", "breed", "segment", "style"}

# Hub pojmenovává též formu jinak než pokédex. Zkouší se to až jako
# druhá varianta — jinak by se ze „Crowned Sword Zacian" stal
# `zacian-crownedblade`.
NAHRADY = {"alolan": "alola", "galarian": "galar", "hisuian": "hisui",
           "paldean": "paldea", "armored": "a", "sword": "blade",
           "50": "fiftypercent", "10": "tenpercent"}

# Formy, které pokédex nerozlišuje, protože se výpočtem neliší.
KOSMETICKE = {"standard", "normal", "ordinary", "incarnate", "disguised",
              "overcast", "average", "female", "male"}

# Naopak formy, které se nikdy nesmí spolknout: když k nim appka klíč
# nemá (Hub přidal Mega Clefable dřív než herní data), patří ten řádek
# zahodit — ne ho připsat běžnému druhu.
TVRDE_FORMY = {"mega", "primal", "crowned", "dynamax", "gigantamax",
               "origin", "therian", "ultra"}


def nk(s):
    """Porovnávací klíč jména: bez diakritiky, mezer a interpunkce."""
    s = unicodedata.normalize("NFKD", str(s))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _stahni(url, cesta, refresh):
    if refresh or not cesta.exists():
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (pokemon-go-planner data refresh)"})
        html = urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")
        cesta.parent.mkdir(parents=True, exist_ok=True)
        cesta.write_text(html, encoding="utf-8")
        time.sleep(0.4)
        return html
    return cesta.read_text(encoding="utf-8")


# Záznamy jsou v JSONu uvnitř stránky, kde jsou uvozovky escapované.
POLE_JMENO = re.compile(r'\\"name\\":\\"(.*?)\\"')
POLE_TIER = re.compile(r'\\"tier\\":\\"([A-Z]{1,2})\\"')
POLE_REL = re.compile(r'\\"relativeScore\\":([0-9.]+)')
POLE_SCORE = re.compile(r'\\"score\\":([0-9.]+)')


def zaznamy(html, klic_poradi):
    """Rozseká JSON blob na záznamy a vytáhne z každého jen to podstatné."""
    out = []
    casti = html.split('\\"%s\\":' % klic_poradi)
    for cast in casti[1:]:
        m = re.match(r"(\d+)", cast)
        if not m:
            continue
        # Záznam končí tam, kde začíná další — delší kus by nabral cizí pole.
        telo = cast[:1200]
        jm = POLE_JMENO.search(telo)
        tier = POLE_TIER.search(telo)
        if not jm or not tier:
            continue
        rel = POLE_REL.search(telo)
        sc = POLE_SCORE.search(telo)
        out.append({
            "poradi": int(m.group(1)),
            "jmeno": jm.group(1),
            "znamka": tier.group(1),
            "podil": round(float(rel.group(1)), 1) if rel else None,
            "skore": float(sc.group(1)) if sc else None,
        })
    # Tentýž žebříček je ve stránce i v tabulce; duplicity podle pořadí pryč.
    videno = {}
    for z in out:
        videno.setdefault(z["poradi"], z)
    return [videno[k] for k in sorted(videno)]


class Prekladac(object):
    """Jméno od Hubu → klíč druhu v pokédexu (+ forma)."""

    def __init__(self, dex):
        self.sp = dex["species"]
        self.klice = set(self.sp)
        self.podle_jmena = {}
        for k, v in self.sp.items():
            # Holý klíč vyhrává: „Ninetales" je běžná, ne alolská.
            if "-" not in k:
                self.podle_jmena[nk(v[1])] = k
        for k, v in self.sp.items():
            self.podle_jmena.setdefault(nk(v[1]), k)
        self.megy = {}
        for k, lst in (dex.get("mega") or {}).items():
            for m in lst:
                self.megy[nk(m[0])] = (k, m[0])
        # Základy, které vůbec nějakou formu mají. U ostatních je forma
        # od Hubu jen kosmetika („Pyroar (Female)") a patří na holý klíč.
        self.ma_formy = set(k.split("-")[0] for k in self.klice if "-" in k)
        self.nenasel = {}

    def _slova(self, slova):
        kusy = []
        for cele in slova:
            for w in re.split(r"[^A-Za-z0-9]+", str(cele)):
                w = nk(w)
                if w and w not in VYPLN:
                    kusy.append(w)
        return kusy

    def _klic_formy(self, zaklad, slova):
        kusy = self._slova(slova)
        if not kusy:
            return zaklad
        for varianta in (kusy, [NAHRADY.get(w, w) for w in kusy]):
            # Od nejdelšího: „Hero of Many Battles" je v pokédexu `hero`.
            for n in range(len(varianta), 0, -1):
                k = zaklad + "-" + "".join(varianta[:n])
                if k in self.klice:
                    return k
        if any(w in TVRDE_FORMY for w in kusy):
            return None
        if zaklad not in self.ma_formy or all(w in KOSMETICKE for w in kusy):
            return zaklad
        return None

    def preloz(self, cele):
        """Vrátí (klíč, forma) nebo (None, None). Forma je "" / "Shadow" /
        jméno mega formy."""
        jm = cele.strip()
        shadow = False
        if re.search(r"\bShadow\b", jm):
            shadow = True
            jm = re.sub(r"\s*\bShadow\b\s*", " ", jm).strip()

        mg = self.megy.get(nk(jm))
        if mg:
            # Mega + shadow se v jednom kuse nepotkají; shadow se ignoruje.
            return mg[0], mg[1]

        # Závorka nese formu stejně jako předpona a může tam být obojí
        # najednou: „Paldean Tauros (Blaze Breed)" = `tauros-paldeablaze`.
        zavorka = []
        m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", jm)
        if m:
            jm = m.group(1).strip()
            zavorka = m.group(2).split()

        forma = "Shadow" if shadow else ""
        slova = jm.split()
        # Celé jméno bez formy („Dialga", „Metagross").
        zaklad = self.podle_jmena.get(nk(jm))
        if zaklad:
            k = self._klic_formy(zaklad, zavorka)
            if k:
                return k, forma

        # Forma stojí před jménem („Alolan Marowak") i za ním
        # („Aegislash Shield Forme"). Zkouší se obojí, od nejdelšího základu.
        for i in range(len(slova) - 1, 0, -1):
            zaklad = self.podle_jmena.get(nk(" ".join(slova[i:])))
            if zaklad:
                k = self._klic_formy(zaklad, slova[:i] + zavorka)
                if k:
                    return k, forma
        for i in range(1, len(slova)):
            zaklad = self.podle_jmena.get(nk(" ".join(slova[:i])))
            if zaklad:
                k = self._klic_formy(zaklad, slova[i:] + zavorka)
                if k:
                    return k, forma

        self.nenasel[cele] = self.nenasel.get(cele, 0) + 1
        return None, None


def main():
    refresh = "--refresh" in sys.argv
    dex = json.loads(DEX.read_text(encoding="utf-8"))
    prek = Prekladac(dex)

    typy = {}
    for nazev in TYPY:
        cesta = RAW / ("hub_typ_%s.html" % nazev.lower())
        try:
            html = _stahni(URL_TYP % nazev.lower(), cesta, refresh)
        except Exception as e:                                # noqa: BLE001
            print("  typ %s se nestáhl: %s" % (nazev, e))
            continue
        r = zaznamy(html, "order")
        if len(r) >= MIN_RADKU_TYP:
            typy[nazev] = r

    try:
        html = _stahni(URL_GYM, RAW / "hub_gym.html", refresh)
        gym = zaznamy(html, "ranking")
    except Exception as e:                                    # noqa: BLE001
        print("  gym se nestáhl: %s" % e)
        gym = []

    celkem = sum(len(v) for v in typy.values())
    if len(typy) < MIN_TYPU or len(gym) < MIN_GYM:
        print("CHYBA: typů %d, gym %d řádků (čekám aspoň %d / %d) — stránka se"
              " nejspíš přestavěla a parser je potřeba opravit."
              % (len(typy), len(gym), MIN_TYPU, MIN_GYM))
        return 1

    # Překlad jmen na klíče. Řádek, který se přeložit nedá, se zahazuje —
    # appka by s ním stejně neuměla nic udělat a tiše by lhal.
    def preved(seznam, s_podilem):
        ven = []
        for z in seznam:
            klic, forma = prek.preloz(z["jmeno"])
            if not klic:
                continue
            radek = [z["poradi"], klic, forma, z["znamka"]]
            radek.append(z["podil"] if s_podilem else z["skore"])
            ven.append(radek)
        return ven

    out_typy = {t: preved(v, True) for t, v in typy.items()}
    out_gym = preved(gym, False)

    out = {
        "_meta": {
            "zdroj_typy": URL_TYP % "<typ>",
            "zdroj_gym": URL_GYM,
            "staženo": date.today().isoformat(),
            "model": "Pořadí i známku (SS…F) počítá Pokémon GO Hub, ne appka.",
            "schema": "typ -> [[pořadí, klíč druhu, forma, známka, % špičky]]; "
                      "u gymu je poslední skóre (HP×Obrana), ne procento",
            "pozn": "Regeneruj přes: python tools/build_hub.py --refresh",
        },
        "typy": out_typy,
        "gym": out_gym,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n",
                   encoding="utf-8")

    prelozeno = sum(len(v) for v in out_typy.values()) + len(out_gym)
    print("typů: %d, řádků: %d (+ gym %d), přeloženo: %d"
          % (len(typy), celkem, len(gym), prelozeno))
    if prek.nenasel:
        poradi = sorted(prek.nenasel.items(), key=lambda x: -x[1])
        print("  nepřeložených jmen: %d (%d řádků)"
              % (len(poradi), sum(prek.nenasel.values())))
        print("  " + ", ".join("%s ×%d" % (j, n) for j, n in poradi[:15]))
    print("zapsáno: %s (%d B)" % (OUT, OUT.stat().st_size))
    return 0


if __name__ == "__main__":
    sys.exit(main())
