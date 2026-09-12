# -*- coding: utf-8 -*-
"""Kapesní stránka „Strop CP před evolucí" — jeden soubor do telefonu.

Proč zvlášť a ne celá appka: v telefonu je roster k ničemu. Tenhle výpočet
stojí jen na druhu, IV a capu ligy, takže nepotřebuje ani import, ani
synchronizaci — a tím odpadá jediný důvod, proč by appka v mobilu byla
problém. Celá appka má navíc tabulku 1810 px širokou; na 375 px stránka
přetéká, na 412 px se roster scrolluje vodorovně. Na stání u gymu to není.

Bere se TÝŽ pokédex jako appka, jen ořezaný na to, co je potřeba:
jméno, base staty, evoluční graf a tabulka CPM. Vyjde z toho ~80 kB dat,
takže se to dá otevřít i bez internetu.

Spuštění:  python tools/build_mobil.py
"""
import io
import json
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
SABLONA = KOREN / "tools" / "mobil_sablona.html"
CIL = KOREN / "web-app" / "pokemon_strop_mobil.html"


def main():
    dex = json.loads((KOREN / "data" / "pokedex.json").read_text(encoding="utf-8"))
    sp = dex["species"]

    # [jméno, útok, obrana, HP] — nic víc výpočet nepotřebuje.
    mini = {}
    for k, v in sp.items():
        if not v[1]:
            continue
        mini[k] = [v[1], v[3], v[4], v[5]]

    data = {
        "s": mini,
        # Evoluční graf: z čeho na co. Bez něj by se nedal poskládat řetěz
        # a nešlo by říct, kolik CP smí mít mezistupeň.
        "evo": {k: [x for x in v if x in mini]
                for k, v in (dex.get("evoluce") or {}).items() if k in mini},
        "cpm": dex["cpm"],
    }
    balik = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    html = SABLONA.read_text(encoding="utf-8")
    assert html.count("/*DATA*/") == 1, "šablona nemá právě jedno místo na data"
    html = html.replace("/*DATA*/", balik)
    CIL.write_text(html, encoding="utf-8")

    print("druhů:    %d" % len(mini))
    print("evolucí:  %d" % len(data["evo"]))
    print("velikost: %d kB -> %s" % (len(html.encode("utf-8")) / 1024, CIL.name))


if __name__ == "__main__":
    main()
