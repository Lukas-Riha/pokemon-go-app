# -*- coding: utf-8 -*-
"""Zjistí souřadnice, na které se má klepat, pro KONKRÉTNÍ telefon.

Proč to existuje: souřadnice klepnutí se nedají napsat obecně. Každý telefon
má jiné rozlišení, jinou výřezovou lištu, jinak velké tlačítko Calcy a jinak
vysokou spodní navigaci. Napsat "klepni na 600,1800" a doufat je recept na to,
že skript bude klikat vedle a nikdo si toho hodinu nevšimne.

Jak to funguje:
  1. Stáhne z telefonu snímek obrazovky (přes adb).
  2. Vyrobí jednosouborovou stránku, kde je ten snímek vidět.
  3. Ty do něj naklikáš tři místa, která skript potřebuje znát.
  4. Stránka ti nabídne ke stažení kalibrace.json.

Spuštění:
    python tools/adb/kalibrace.py

Předpoklad: v telefonu je zapnuté ladění přes USB a `adb devices` ho vidí.
"""
import base64
import json
import subprocess
import sys
import webbrowser
from pathlib import Path

try:  # konzole na Windows jede v cp1250 a na šipce ve výpisu spadne
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ZDE = Path(__file__).resolve().parent
SNIMEK = ZDE / "obrazovka.png"
STRANKA = ZDE / "kalibrace.html"

# Co všechno musí skript vědět, aby uměl projít box. Pořadí je zároveň pořadí,
# v jakém se to bude klikat na stránce.
BODY = [
    ("calcy", "Tlačítko Calcy IV",
     "Ta plovoucí bublina Calcy, kterou spouštíš scan. Klepni doprostřed ní."),
    ("swipe_z", "Swipe — odkud",
     "Někam doprostřed obrázku pokémona, vpravo. Odtud potáhne prst."),
    ("swipe_do", "Swipe — kam",
     "Stejná výška, ale u levého okraje. Sem prst dotáhne — tím se přepne"
     " na dalšího pokémona."),
]


def adb(*args, binarne=False):
    """Zavolá adb a vrátí výstup. Když adb není, řekne to česky a skončí."""
    try:
        r = subprocess.run(["adb"] + list(args), capture_output=True, check=False)
    except FileNotFoundError:
        print("adb není v PATH.")
        print("Stáhni 'SDK Platform-Tools for Windows' od Googlu, rozbal a přidej")
        print("tu složku do PATH (nebo skript spouštěj z ní).")
        sys.exit(1)
    if r.returncode != 0:
        print("adb selhalo:", (r.stderr or b"").decode("utf-8", "replace")[:400])
        sys.exit(1)
    return r.stdout if binarne else r.stdout.decode("utf-8", "replace")


def zarizeni():
    vypis = adb("devices").strip().splitlines()[1:]
    pripojena = [r.split("\t")[0] for r in vypis if r.strip().endswith("device")]
    cekaji = [r for r in vypis if "unauthorized" in r]
    if cekaji:
        print("Telefon je připojený, ale nepotvrzený.")
        print("Podívej se na displej — má tam být dotaz 'Povolit ladění USB?'.")
        sys.exit(1)
    if not pripojena:
        print("Žádný telefon. Zkontroluj kabel a zapnuté ladění přes USB.")
        sys.exit(1)
    return pripojena[0]


def main():
    jmeno = zarizeni()
    model = adb("shell", "getprop", "ro.product.model").strip()
    velikost = adb("shell", "wm", "size").strip()
    print("telefon: %s (%s)" % (model or jmeno, velikost))

    print("stahuji snímek obrazovky …")
    data = adb("exec-out", "screencap", "-p", binarne=True)
    if not data.startswith(b"\x89PNG"):
        print("Snímek se nepovedl — obrazovka je možná zamčená.")
        sys.exit(1)
    SNIMEK.write_bytes(data)
    print("uloženo:", SNIMEK, "(%d kB)" % (len(data) // 1024))

    b64 = base64.b64encode(data).decode("ascii")
    STRANKA.write_text(sablona(b64, model, velikost), encoding="utf-8")
    print("otevírám", STRANKA)
    webbrowser.open(STRANKA.as_uri())
    print()
    print("Naklikej v prohlížeči ty tři body, stáhni kalibrace.json")
    print("a ulož ho sem:", ZDE / "kalibrace.json")


def sablona(b64, model, velikost):
    body_js = json.dumps(BODY, ensure_ascii=False)
    return """<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8">
<title>Kalibrace klepání</title><style>
body{margin:0;background:#14151a;color:#e8e8ea;font:15px/1.5 system-ui,sans-serif}
.wrap{display:flex;gap:20px;padding:16px;align-items:flex-start}
.obr{position:relative;flex:0 0 auto}
img{display:block;max-height:88vh;width:auto;border:1px solid #33343c;border-radius:8px;cursor:crosshair}
.znacka{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #ffb020;
  border-radius:50%;background:rgba(255,176,32,.25);pointer-events:none;
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff}
.panel{flex:1;max-width:460px}
h1{font-size:18px;margin:0 0 4px}
.krok{padding:10px 12px;border:1px solid #33343c;border-radius:8px;margin:0 0 8px;background:#1c1d24}
.krok.ted{border-color:#ffb020;background:#241f14}
.krok.hotovo{opacity:.6}
.krok b{display:block}
.krok small{color:#9a9aa4}
.souradnice{font-family:ui-monospace,monospace;color:#7ac36a}
button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #4a4b55;
  background:#2a2b33;color:#e8e8ea;cursor:pointer}
button.hlavni{background:#2a78d6;border-color:#2a78d6;color:#fff}
button:disabled{opacity:.4;cursor:default}
.pozn{color:#9a9aa4;font-size:13px}
</style></head><body>
<div class="wrap">
  <div class="obr"><img id="snimek" src="data:image/png;base64,__B64__" alt=""></div>
  <div class="panel">
    <h1>Kalibrace klepání</h1>
    <p class="pozn">__MODEL__ · __VELIKOST__<br>
      Klikej do snímku vlevo. Souřadnice se přepočítají na skutečné pixely
      telefonu, takže nevadí, že je obrázek zmenšený.</p>
    <div id="kroky"></div>
    <p>
      <button id="znovu">Začít znovu</button>
      <button id="ulozit" class="hlavni" disabled>Stáhnout kalibrace.json</button>
    </p>
    <p class="pozn">Soubor ulož vedle skriptu, do složky <code>tools/adb/</code>.</p>
  </div>
</div>
<script>
var BODY = __BODY__;
var img = document.getElementById("snimek");
var obr = img.parentNode;
var kroky = document.getElementById("kroky");
var hodnoty = {};
var i = 0;

function vykreslit() {
  kroky.innerHTML = "";
  BODY.forEach(function (b, n) {
    var d = document.createElement("div");
    d.className = "krok" + (n === i ? " ted" : (hodnoty[b[0]] ? " hotovo" : ""));
    d.innerHTML = "<b>" + (n + 1) + ". " + b[1] + "</b><small>" + b[2] + "</small>"
      + (hodnoty[b[0]] ? '<div class="souradnice">' + hodnoty[b[0]][0] + ", "
          + hodnoty[b[0]][1] + "</div>" : "");
    kroky.appendChild(d);
  });
  document.getElementById("ulozit").disabled = Object.keys(hodnoty).length !== BODY.length;
}

img.addEventListener("click", function (e) {
  if (i >= BODY.length) return;
  var r = img.getBoundingClientRect();
  // Obrázek je zmenšený, aby se vešel na obrazovku — souřadnice se proto musí
  // přepočítat zpátky na skutečné rozlišení telefonu, jinak by skript klepal
  // do levého horního rohu.
  var x = Math.round((e.clientX - r.left) / r.width * img.naturalWidth);
  var y = Math.round((e.clientY - r.top) / r.height * img.naturalHeight);
  hodnoty[BODY[i][0]] = [x, y];

  var z = document.createElement("div");
  z.className = "znacka";
  z.style.left = (e.clientX - r.left) + "px";
  z.style.top = (e.clientY - r.top) + "px";
  z.textContent = i + 1;
  obr.appendChild(z);

  i++;
  vykreslit();
});

document.getElementById("znovu").addEventListener("click", function () {
  hodnoty = {}; i = 0;
  Array.prototype.forEach.call(obr.querySelectorAll(".znacka"), function (z) { z.remove(); });
  vykreslit();
});

document.getElementById("ulozit").addEventListener("click", function () {
  var out = { model: "__MODEL__", rozliseni: [img.naturalWidth, img.naturalHeight], body: hodnoty };
  var b = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "kalibrace.json";
  document.body.appendChild(a); a.click(); a.remove();
});

vykreslit();
</script></body></html>
""".replace("__B64__", b64).replace("__BODY__", body_js) \
   .replace("__MODEL__", model or "?").replace("__VELIKOST__", velikost or "?")


if __name__ == "__main__":
    main()
