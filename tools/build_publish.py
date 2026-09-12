# -*- coding: utf-8 -*-
"""Složka `publish/` — to jediné, co jde na GitHub Pages.

Do repozitáře patří jen hotová appka, ne nástroje, data ani testy: co se
nezveřejní, to nemůže uniknout, a repo zůstane malé.

Co se sem sype:
    index.html            appka (kopie web-app/pokemon_tracker_app.html)
    strop.html            kapesní stránka se stropy CP
    sw.js                 service worker — po prvním otevření jede offline
    manifest.webmanifest  aby šla přidat na plochu jako appka
    ikona-192/512.png     ikona na ploše
    .nojekyll             ať Pages nesahá na obsah

Verze v service workeru se odvozuje z OBSAHU appky, ne z data: stejný
obsah = stejná verze = telefon nestahuje nic zbytečně, jiný obsah =
nová cache a aktualizace se chytne sama.

Spuštění:  python tools/build_publish.py
"""
import hashlib
import sys
import io
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "web-app" / "pokemon_tracker_app.html"
STROP = ROOT / "web-app" / "pokemon_strop_mobil.html"
OUT = ROOT / "publish"

NAZEV = "Pokémon GO plánovač"
KRATKY = "GO plánovač"
BARVA = "#0d0d0d"


def ikony_existuji():
    return all((OUT / ("ikona-%d.png" % v)).exists() for v in (192, 512))


def ikona(velikost):
    """Ikona na plochu: pokéball v barvách appky, kreslený, ne stahovaný."""
    from PIL import Image, ImageDraw
    obr = Image.new("RGBA", (velikost, velikost), (0, 0, 0, 0))
    d = ImageDraw.Draw(obr)
    s = velikost
    okraj = s * 0.06
    box = [okraj, okraj, s - okraj, s - okraj]
    # horní půlka červená, spodní světlá — a mezi nimi pruh a střed
    d.ellipse(box, fill=(214, 48, 49, 255))
    d.pieslice(box, 0, 180, fill=(236, 240, 241, 255))
    d.rectangle([okraj, s * 0.46, s - okraj, s * 0.54], fill=(20, 20, 20, 255))
    r = s * 0.15
    d.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r],
              fill=(20, 20, 20, 255))
    r2 = s * 0.105
    d.ellipse([s / 2 - r2, s / 2 - r2, s / 2 + r2, s / 2 + r2],
              fill=(236, 240, 241, 255))
    return obr


def main():
    if not APP.exists():
        raise SystemExit("appka neexistuje: %s" % APP)
    OUT.mkdir(exist_ok=True)

    html = APP.read_text(encoding="utf-8")
    # Verze = otisk obsahu. Service worker podle ní pozná, že se má
    # aktualizovat; při stejném obsahu se nedělá nic.
    verze = hashlib.sha256(html.encode("utf-8")).hexdigest()[:12]

    # Odkaz na manifest a ikonu se do appky vkládá až tady — v souboru
    # pro file:// by nedávaly smysl a zbytečně by hlásily 404.
    hlava = ('<link rel="manifest" href="manifest.webmanifest">'
             '<meta name="theme-color" content="%s">'
             '<link rel="apple-touch-icon" href="ikona-192.png">'
             '<script>if("serviceWorker" in navigator){'
             'window.addEventListener("load",function(){'
             'navigator.serviceWorker.register("sw.js");});}</script>' % BARVA)
    if "</head>" in html:
        html = html.replace("</head>", hlava + "</head>", 1)
    else:
        raise SystemExit("v appce není </head> — kam vložit manifest?")

    (OUT / "index.html").write_text(html, encoding="utf-8")
    if STROP.exists():
        shutil.copyfile(STROP, OUT / "strop.html")

    # Ikona na plochu je ozdoba, ne appka. Kreslí ji Pillow, a když ta
    # knihovna v tom Pythonu není, nasazení kvůli tomu padat NESMÍ — appka
    # by se kvůli obrázku vůbec nedostala do mobilu. Když ikony z minulého
    # buildu leží na disku, použijí se; jinak se manifest napíše bez nich.
    try:
        for v in (192, 512):
            ikona(v).save(OUT / ("ikona-%d.png" % v))
        ikony = True
    except ImportError:
        ikony = ikony_existuji()
        print("  POZOR: Pillow (PIL) chybi v " + sys.executable)
        print("  " + ("nechavam ikony z minuleho buildu"
                      if ikony else "nasazuji bez ikony na plose"))
        print("  spravit: " + sys.executable + " -m pip install Pillow")

    manifest = {
        "name": NAZEV,
        "short_name": KRATKY,
        "start_url": ".",
        "scope": ".",
        "display": "standalone",
        "orientation": "any",
        "background_color": BARVA,
        "theme_color": BARVA,
        "lang": "cs",
    }
    if ikony:
        manifest["icons"] = [
            {"src": "ikona-192.png", "sizes": "192x192", "type": "image/png",
             "purpose": "any"},
            {"src": "ikona-512.png", "sizes": "512x512", "type": "image/png",
             "purpose": "any maskable"},
        ]
    (OUT / "manifest.webmanifest").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # Service worker. Nejdřív se sáhne na síť, a když není, vezme se cache —
    # appka je jeden velký soubor, takže „stale-while-revalidate" by
    # znamenalo běhat na staré verzi ještě jedno spuštění.
    sw = '''/* Generováno tools/build_publish.py — needitovat ručně. */
var VERZE = "pgo-%s";
var SOUBORY = ["./", "index.html", "manifest.webmanifest",
  "ikona-192.png", "ikona-512.png", "strop.html"];

self.addEventListener("install", function (e) {
  // Nová verze se má chytnout hned, ne až po zavření všech oken.
  self.skipWaiting();
  e.waitUntil(caches.open(VERZE).then(function (c) {
    // Jeden chybějící soubor nesmí shodit celou instalaci.
    return Promise.all(SOUBORY.map(function (u) {
      return c.add(u)["catch"](function () { return null; });
    }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.map(function (n) {
      return n === VERZE ? null : caches["delete"](n);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  // Cizí původ se NEKEŠUJE. Bez tohohle by v cache skončily i odpovědi
  // z Microsoft Graphu, tedy roster stažený z OneDrivu — ten by pak ležel
  // v prohlížeči navíc a přežil by i odhlášení.
  var vlastni = e.request.url.indexOf(self.location.origin) === 0;
  e.respondWith(
    fetch(e.request).then(function (odp) {
      // Povedlo se stáhnout — ulož a vrať to čerstvé.
      if (vlastni) {
        var kopie = odp.clone();
        caches.open(VERZE).then(function (c) { c.put(e.request, kopie); });
      }
      return odp;
    })["catch"](function () {
      if (!vlastni) throw new Error("offline");
      return caches.match(e.request).then(function (z) {
        return z || caches.match("index.html");
      });
    })
  );
});
''' % verze
    (OUT / "sw.js").write_text(sw, encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")

    velikost = sum(p.stat().st_size for p in OUT.iterdir() if p.is_file())
    print("publish/: %d souborů, %d kB, verze %s"
          % (len(list(OUT.iterdir())), velikost // 1024, verze))


if __name__ == "__main__":
    main()
