# -*- coding: utf-8 -*-
"""Snimky k novinkam do WebP.

`tools/novinky_snimky.mjs` poridi PNG ve dvojnasobnem rozliseni. Do appky
se ale zapekaji jako data: URI, takze na velikosti zalezi — PNG ze
snimku obrazovky je zbytecne velky. Tenhle skript z nich udela WebP;
`sync_reference.py` uz jen prilozi hotovy soubor a nepotrebuje Pillow.

Spousti se rucne po porizeni snimku:
    python tools/novinky_obrazky.py
"""
import pathlib
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover - jen hlaska pro cloveka
    sys.exit("Chybi Pillow: pip install pillow")

SLOZKA = pathlib.Path(__file__).resolve().parent.parent / "data" / "novinky_obrazky"
# Okno s novinkami je siroke nejvys 760 px a obrazek se do nej vejde na
# ~700 px. 1000 px je tedy porad s rezervou nad tim, co je videt — a kazdy
# kilobajt navic nese CELA appka, protoze se snimky zapekaji do souboru.
MAX_SIRKA = 1000
KVALITA = 74


def main():
    pngs = sorted(SLOZKA.glob("*.png"))
    if not pngs:
        sys.exit("V %s zadne PNG nejsou — nejdriv spust tools/novinky_snimky.mjs" % SLOZKA)
    celkem = 0
    for png in pngs:
        obr = Image.open(png).convert("RGB")
        if obr.width > MAX_SIRKA:
            vyska = round(obr.height * MAX_SIRKA / obr.width)
            obr = obr.resize((MAX_SIRKA, vyska), Image.LANCZOS)
        cil = png.with_suffix(".webp")
        obr.save(cil, "WEBP", quality=KVALITA, method=6)
        celkem += cil.stat().st_size
        print("%-18s %4dx%-4d %5d kB -> %4d kB" % (
            cil.name, obr.width, obr.height,
            png.stat().st_size // 1024, cil.stat().st_size // 1024))
    print("celkem ve WebP: %d kB (v appce jako base64 zhruba %d kB)"
          % (celkem // 1024, celkem * 4 // 3 // 1024))


if __name__ == "__main__":
    main()
