# -*- coding: utf-8 -*-
"""POKUS: karty jako záložky v přilepeném menu nahoře.

Místo dlouhé stránky, kde se roluje přes všechno, je nahoře lišta se
záložkami. Vidět je vždycky jen jedna karta a lišta se při rolování drží
nahoře, takže se dá přepnout kdykoli.

Dvě karty nemají v appce id (Souhrn s dlaždicemi a referenční žebříčky),
takže se dřív do menu nedostaly a zůstávaly viset nad ním — proto to menu
vypadalo, že je "pod sekcí". Souhrn jezdí s Rosterem (dlaždice slouží jako
filtr tabulky, takže patří k sobě), žebříčky mají vlastní záložku.
"""

NAZEV = "záložky nahoře, vidět jen jedna karta"

CSS = """
  /* ---------- POKUS: záložkové menu ---------- */
  .zal-lista { position: sticky; top: 0; z-index: 60; display: flex; gap: 2px;
    flex-wrap: wrap; padding: 8px 0 0; margin: 0 0 14px;
    background: var(--page); border-bottom: 1px solid var(--grid); }
  .zal-btn { border: 1px solid transparent; border-bottom: 0; background: none;
    cursor: pointer; padding: 8px 13px; border-radius: 8px 8px 0 0; font-size: 13px;
    font-weight: 600; color: var(--text-secondary); white-space: nowrap;
    position: relative; top: 1px; }
  .zal-btn:hover { background: var(--surface-1); color: var(--text-primary); }
  .zal-btn.aktivni { background: var(--surface-1); color: var(--text-primary);
    border-color: var(--grid); box-shadow: inset 0 2px 0 var(--series-1); }
  .zal-btn .zal-pocet { display: inline-block; margin-left: 6px; font-size: 11px;
    font-weight: 700; color: var(--text-muted); }

  /* Karta pod záložkou už není rozbalovací — je buď vidět celá, nebo vůbec. */
  body.zalozky .card.zal-skryta { display: none; }
  body.zalozky .card.zal-viditelna > summary { display: none; }
  body.zalozky .card.zal-viditelna { display: block; }

  /* Nadpis a odstavec nad menu zabíraly půl obrazovky a po prvním přečtení
     nemají co říct — v režimu záložek se scvrknou na jeden řádek. */
  body.zalozky > .app > h1 { font-size: 15px; margin: 0 0 2px; }
  body.zalozky > .app > .subtitle { display: none; }

  @media (max-width: 700px) {
    .zal-lista { overflow-x: auto; flex-wrap: nowrap; }
    .zal-btn { padding: 8px 10px; font-size: 12.5px; }
  }
"""

JS = """
  // ---------- POKUS: záložkové menu ----------
  // Karty se nezobrazují pod sebou, ale přepínají se záložkami nahoře.
  // Nic se nepřepisuje ani nepřesouvá v DOMu — jen se skrývá, takže všechny
  // render funkce fungují dál a o menu nemusí vědět.
  (function zalozky() {
    // Pořadí záložek je dané TÍMHLE seznamem, ne pořadím v HTML.
    var PORADI = [
      ["roster", "Roster"],
      ["planCard", "Kam dát prach"],
      ["dustCard", "Rozpočet"],
      ["friendCard", "Kamarád"],
      ["cheatCard", "Tahák"],
      ["eventsCard", "Události"],
      ["coverCard", "Pokrytí"],
      ["gymCard", "Gym"],
      ["typesCard", "Typy"],
      ["refCard", "Žebříčky"],
      ["docsCard", "Odkud se to bere"],
      ["settings-card", "Nastavení"]
    ];
    // Prvky, které jezdí s jinou záložkou.
    //  * Dlaždice Souhrnu fungují jako filtr tabulky, takže patří k Rosteru —
    //    na vlastní záložce by to nedávalo smysl.
    //  * Patička s tabulkou „Odkud se co bere" není karta, takže se dřív vezla
    //    pod KAŽDOU záložkou. Patří k dokumentaci, kde je to samé podrobněji.
    var SPOLU = { "souhrn": "roster", "patickaZdroje": "docsCard" };

    var POPISKY = {};
    PORADI.forEach(function (p) { POPISKY[p[0]] = p[1]; });

    // Dvě karty v appce nemají id. Doplní se, jinak by zůstaly viset nad menu.
    (function doplnitId() {
      var vsechny = document.querySelectorAll(".app > .card");
      Array.prototype.forEach.call(vsechny, function (el) {
        if (el.id) return;
        if (el.classList.contains("ref-toggle")) el.id = "refCard";
        else if (el.querySelector("#tiles")) el.id = "souhrn";
      });
      // Patička není karta — dostane vlastní značku, ať se dá schovat taky.
      var paticka = document.querySelector(".app > footer");
      if (paticka) { paticka.id = "patickaZdroje"; paticka.classList.add("card"); }
    })();

    function najdiKarty() {
      var podleKlice = {};
      Array.prototype.forEach.call(document.querySelectorAll(".card"), function (el) {
        var klic = el.id;
        if (!klic && el.classList.contains("roster")) klic = "roster";
        if (!klic && el.classList.contains("settings-card")) klic = "settings-card";
        if (!klic) return;
        if (!podleKlice[klic]) podleKlice[klic] = el;
      });
      var out = PORADI.filter(function (p) { return podleKlice[p[0]]; })
        .map(function (p) { return { klic: p[0], el: podleKlice[p[0]], popis: p[1], spolu: [] }; });
      // přivěsit karty, které jezdí s jinou záložkou
      Object.keys(SPOLU).forEach(function (k) {
        var el = podleKlice[k];
        if (!el) return;
        var cil = out.filter(function (x) { return x.klic === SPOLU[k]; })[0];
        if (cil) cil.spolu.push(el);
      });
      return out;
    }

    var karty = najdiKarty();
    if (karty.length < 3) return;   // něco se změnilo, radši nic nedělat

    // Menu patří nad VŠECHNY karty, ne před tu první ze seznamu — jinak nad ním
    // zůstane viset cokoli, co je v HTML dřív.
    var lista = document.createElement("nav");
    lista.className = "zal-lista";
    var app = document.querySelector(".app") || document.body;
    var prvniKarta = app.querySelector(".card");
    if (prvniKarta) app.insertBefore(lista, prvniKarta);
    else app.appendChild(lista);

    var aktivni = null;

    function prepni(klic, tiche) {
      aktivni = klic;
      karty.forEach(function (k) {
        var je = k.klic === klic;
        [k.el].concat(k.spolu).forEach(function (el) {
          el.classList.toggle("zal-viditelna", je);
          el.classList.toggle("zal-skryta", !je);
          if (je && el.tagName === "DETAILS") el.open = true;
        });
      });
      Array.prototype.forEach.call(lista.children, function (b) {
        b.classList.toggle("aktivni", b.dataset.klic === klic);
      });
      try { window.localStorage.setItem("pgo_zalozka", klic); } catch (e) { /* nevadí */ }
      if (!tiche) window.scrollTo({ top: 0, behavior: "smooth" });
    }

    karty.forEach(function (k) {
      var b = document.createElement("button");
      b.className = "zal-btn";
      b.dataset.klic = k.klic;
      b.textContent = k.popis;
      b.addEventListener("click", function () { prepni(k.klic); });
      lista.appendChild(b);
    });

    document.body.classList.add("zalozky");
    var ulozena = null;
    try { ulozena = window.localStorage.getItem("pgo_zalozka"); } catch (e) { /* nevadí */ }
    var start = karty.some(function (k) { return k.klic === ulozena; }) ? ulozena : karty[0].klic;
    prepni(start, true);

    // počty do záložek — ať je vidět, kde něco je, bez přepínání
    function doplnitPocty() {
      var m = {
        roster: document.querySelectorAll("#tbody tr").length,
        dustCard: document.querySelectorAll("#dustBody .plan-row").length,
        coverCard: document.querySelectorAll(".cover-row").length
      };
      Array.prototype.forEach.call(lista.children, function (b) {
        var n = m[b.dataset.klic];
        var stary = b.querySelector(".zal-pocet");
        if (stary) stary.remove();
        if (!n) return;
        var s = document.createElement("span");
        s.className = "zal-pocet";
        s.textContent = n;
        b.appendChild(s);
      });
    }
    doplnitPocty();
    window.setInterval(doplnitPocty, 3000);

    // přepínání z klávesnice: Alt + šipka
    document.addEventListener("keydown", function (e) {
      if (!e.altKey) return;
      var i = karty.findIndex(function (k) { return k.klic === aktivni; });
      if (i < 0) return;
      if (e.key === "ArrowRight") { e.preventDefault(); prepni(karty[(i + 1) % karty.length].klic); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prepni(karty[(i - 1 + karty.length) % karty.length].klic); }
    });
  })();
"""


def uprav(html):
    kotva_css = "  /* ---------- režim čištění boxu ---------- */"
    if kotva_css not in html:
        raise RuntimeError("nenašel jsem kotvu pro CSS")
    html = html.replace(kotva_css, CSS + "\n" + kotva_css, 1)

    # menu se staví až úplně na konci skriptu, aby existovaly všechny karty
    kon = html.rfind("</script>")
    if kon < 0:
        raise RuntimeError("nenašel jsem konec skriptu")
    return html[:kon] + JS + "\n" + html[kon:]
