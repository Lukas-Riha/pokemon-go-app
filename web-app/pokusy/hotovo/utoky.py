# -*- coding: utf-8 -*-
"""POKUS: doplňování útoků přímo v rosteru.

Dvě věci dohromady:

  1. Klik na buňku ve sloupci Útoky ji promění v malý editor se třemi poli.
     Ty tři syrové sloupce jsou v zobrazení „Rozhodnutí" schované a přepínat
     kvůli nim na „Vše" nikoho nenapadne.

  2. Každé pole má nabídku toho, co se ten druh OPRAVDU umí naučit
     (z learnsetu), takže se nemusí psát ručně a překlep se pozná hned.

Barvy polí:
  * nic nevyplněno   — bez barvy
  * všechny známé    — bez barvy (elitní útok má oranžový rámeček, protože
                       se běžným TM nenaučí)
  * část špatně      — ŽLUTÁ: stačí přeučit, něco použitelného tam je
  * všechno špatně   — ČERVENÁ: appka nemá s čím počítat

Řádky se rozlišují podle `data-row-id`, který do tabulky dává ostrá appka.
Dřív se hledalo podle jména pokémona a u tří Gyaradosů to spadlo vždycky na
prvního — editor ukazoval cizí útoky a zápis šel do špatného řádku.
"""

NAZEV = "doplňování útoků klikem v rosteru"

CSS = """
  /* ---------- POKUS: útoky ---------- */
  .col-move input.utok-nezna { border-color: var(--status-critical);
    background: color-mix(in srgb, var(--status-critical) 12%, transparent); }
  .col-move input.utok-preucit { border-color: var(--status-warning);
    background: color-mix(in srgb, var(--status-warning) 12%, transparent); }
  .col-move input.utok-elite { border-color: var(--status-warning); }

  /* Editor PLAVE nad tabulkou. Dokud byl vevnitř buňky, roztahoval sloupec
     Útoky do šířky i do výšky a celá tabulka poskakovala. Takhle se v buňce
     nezmění vůbec nic, jen se podbarví. */
  .utok-edit { position: fixed; z-index: 190; display: flex; flex-direction: column;
    gap: 4px; width: 196px; padding: 8px; border-radius: 8px;
    background: var(--surface-1); border: 1px solid var(--grid);
    box-shadow: 0 10px 30px rgba(0,0,0,.45); }
  .utok-edit-hlava { font-size: 11px; font-weight: 700; color: var(--text-secondary);
    display: flex; align-items: center; gap: 6px; }
  .utok-edit-zavrit { margin-left: auto; border: 0; background: none; cursor: pointer;
    color: var(--text-muted); font-size: 13px; line-height: 1; padding: 0 2px; }
  .utok-edit-zavrit:hover { color: var(--status-critical); }
  .utok-edit-napoveda { font-size: 10px; color: var(--text-muted); }
  td.utok-edit-otevreny { background: color-mix(in srgb, var(--series-1) 18%, transparent);
    box-shadow: inset 0 0 0 1px var(--series-1); }

  /* Buňka Útoky (i s textem „Sken je nedal") zarovnaná doleva jako ostatní. */
  td.utok-klik, td.utok-edit-otevreny { text-align: left; }

  /* Barevná značka má podklad, takže oko čte její OKRAJ; „Sken je nedal" je
     bezbarvé, takže se čte až text — a ten kvůli vnitřnímu odsazení začínal
     o 8 px dál. Vypadalo to odsazeně, i když obě značky sedí na stejné
     souřadnici. U bezbarvé se odsazení ruší, ať lícují texty i okraje. */
  td.utok-klik .badge.muted, td.utok-edit-otevreny .badge.muted {
    padding-left: 0; padding-right: 0; }
  td.utok-klik { cursor: pointer; }
  td.utok-klik:hover { background: color-mix(in srgb, var(--series-1) 10%, transparent); }

  /* pole = tlačítko s typovou barvou, ne holý <select> */
  .uv { position: relative; }
  .uv-pole { display: flex; align-items: center; gap: 6px; width: 100%;
    padding: 4px 6px; border-radius: 6px; cursor: pointer; text-align: left;
    border: 1px solid var(--input-border); background: var(--input-bg);
    color: var(--text-primary); font: inherit; font-size: 11.5px; }
  .uv-pole:hover { border-color: var(--series-1); }
  .uv-pole.otevreno { border-color: var(--series-1);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--series-1) 25%, transparent); }
  .uv-pole.prazdne { color: var(--text-muted); font-style: italic; }
  .uv-pole.utok-nezna { border-color: var(--status-critical);
    background: color-mix(in srgb, var(--status-critical) 12%, transparent); }
  .uv-pole.utok-preucit { border-color: var(--status-warning);
    background: color-mix(in srgb, var(--status-warning) 12%, transparent); }
  .uv-jmeno { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uv-sipka { flex: none; font-size: 9px; color: var(--text-muted); transition: transform .12s; }
  .uv-pole.otevreno .uv-sipka { transform: rotate(180deg); }

  .uv-tecka { flex: none; width: 9px; height: 9px; border-radius: 999px;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.25); }

  /* Ukotvený k OKNU, ne k buňce. Tabulka se roluje vodorovně a sloupec Útoky
     bývá až vpravo, takže seznam přilepený k buňce vytekl mimo obrazovku. */
  .uv-seznam { position: fixed; z-index: 200; width: max-content;
    min-width: 196px; max-width: min(340px, 92vw); max-height: 280px; overflow-y: auto;
    background: var(--surface-1); border: 1px solid var(--grid); border-radius: 8px;
    box-shadow: 0 8px 26px rgba(0,0,0,.45); padding: 4px; }
  /* Tři sloupce v pevném poměru: typ 40 %, název 40 %, síla 20 % vpravo.
     Flexbox to rovnal podle obsahu, takže se sloupce u každé položky lišily
     a seznam vypadal rozházeně. */
  /* 2fr : 2fr : 1fr je ten samý poměr 40/40/20, ale narozdíl od procent
     počítá s mezerami mezi sloupci — s procenty seznam přetékal o 9 px. */
  .uv-polozka { display: grid; grid-template-columns: 2fr 2fr 1fr;
    align-items: center; gap: 8px; width: 100%;
    padding: 5px 7px; border: 0; border-radius: 6px; background: none; cursor: pointer;
    color: var(--text-primary); font: inherit; font-size: 12px; text-align: left; }
  .uv-polozka:hover, .uv-polozka.zvyraznena {
    background: color-mix(in srgb, var(--series-1) 18%, transparent); }
  .uv-polozka.vybrana { box-shadow: inset 3px 0 0 var(--status-good); }
  .uv-polozka.vybrana .uv-nazev { font-weight: 700; }
  .uv-typ { justify-self: start; font-size: 9px; font-weight: 700; letter-spacing: .02em;
    padding: 2px 6px; border-radius: 999px; color: #fff; text-transform: uppercase;
    max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uv-nazev { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uv-meta { justify-self: end; text-align: right; font-size: 10.5px;
    color: var(--text-muted); white-space: nowrap; }
  /* Řádek „nevyplněno" je delší než kterýkoli název útoku, takže by sám
     roztahoval sloupec se jmény. Dostane celou šířku a do mřížky nemluví. */
  .uv-polozka.uv-prazdna { grid-template-columns: 1fr; color: var(--text-muted);
    font-style: italic; }
  .uv-polozka.uv-prazdna .uv-nazev { text-align: left; }

"""

JS = """
  // ---------- POKUS: útoky ----------
  (function utokyPokus() {
    var cache = {};
    var POLE = ["fastMove", "charged1", "charged2"];
    var DRUH = { fastMove: "fast", charged1: "charged", charged2: "charged" };
    var POPIS = { fastMove: "rychlý útok", charged1: "nabitý útok 1", charged2: "nabitý útok 2" };

    function barvaTypu(t) {
      var b = window.__pgo.typeColors ? window.__pgo.typeColors()[t] : null;
      return b || "var(--text-muted)";
    }

    function seznamProDruh(klicDruhu, druh) {
      var ck = klicDruhu + "|" + druh;
      if (cache[ck]) return cache[ck];
      var P = window.__pgo;
      var l = P.learnsetOf ? P.learnsetOf(klicDruhu) : null;
      if (!l) { cache[ck] = []; return cache[ck]; }
      var idx = druh === "fast" ? l.fast : l.charged;
      var elitni = druh === "fast" ? l.eliteFast : l.eliteCharged;
      var out = [];
      idx.forEach(function (i) {
        var m = druh === "fast" ? P.fastMoveAt(i) : P.chargedMoveAt(i);
        if (!m) return;
        out.push({ name: m.name, type: m.type, power: m.power, elite: elitni.indexOf(i) !== -1 });
      });
      out.sort(function (a, b) {
        if (a.elite !== b.elite) return a.elite ? 1 : -1;
        return (b.power || 0) - (a.power || 0);
      });
      cache[ck] = out;
      return out;
    }

    /** Doroluje položku do zorného pole, ale POUZE uvnitř daného boxu. */
    /** Postaví seznam pod pole a uřízne ho do okna.
     *
     *  Souřadnice jsou v okně (position: fixed), takže na vodorovném posunu
     *  tabulky nezáleží — jinak seznam u pravých sloupců vytekl ven. */
    function umistit(box, tlacitko) {
      var OKRAJ = 8;
      var r = tlacitko.getBoundingClientRect();
      var sirka = box.offsetWidth;
      var vyska = box.offsetHeight;

      var levy = r.left;
      if (levy + sirka > window.innerWidth - OKRAJ) levy = r.right - sirka;   // zarovnat doprava
      if (levy + sirka > window.innerWidth - OKRAJ) levy = window.innerWidth - sirka - OKRAJ;
      if (levy < OKRAJ) levy = OKRAJ;

      var horni = r.bottom + 3;
      if (horni + vyska > window.innerHeight - OKRAJ) {
        var nad = r.top - vyska - 3;
        horni = nad >= OKRAJ ? nad : Math.max(OKRAJ, window.innerHeight - vyska - OKRAJ);
      }
      box.style.left = Math.round(levy) + "px";
      box.style.top = Math.round(horni) + "px";

      // Druhý průchod: výška se může po umístění změnit (zalomení textu,
      // pruh rolování). Radši se změří znovu a případně doladí, než aby
      // seznam vykoukl z okna.
      var kontrola = box.getBoundingClientRect();
      if (kontrola.bottom > window.innerHeight - OKRAJ) {
        box.style.top = Math.round(Math.max(OKRAJ,
          window.innerHeight - kontrola.height - OKRAJ)) + "px";
      }
      if (kontrola.right > window.innerWidth - OKRAJ) {
        box.style.left = Math.round(Math.max(OKRAJ,
          window.innerWidth - kontrola.width - OKRAJ)) + "px";
      }
    }

    function doRohledu(box, prvek) {
      if (!box || !prvek) return;
      var nahore = prvek.offsetTop;
      var dole = nahore + prvek.offsetHeight;
      if (nahore < box.scrollTop) box.scrollTop = nahore;
      else if (dole > box.scrollTop + box.clientHeight) box.scrollTop = dole - box.clientHeight;
    }

    function najdiUtok(seznam, hodnota) {
      var v = (hodnota || "").trim().toLowerCase();
      if (!v) return undefined;
      var nalezen = null;
      seznam.forEach(function (m) { if (m.name.toLowerCase() === v) nalezen = m; });
      return nalezen;
    }

    /** Obarví VŠECHNA pole jednoho kusu najednou.
     *
     *  Barva nezávisí na jednom políčku, ale na tom, kolik jich sedí: když je
     *  aspoň jeden útok v pořádku, stačí zbytek přeučit (žlutá). Červená je až
     *  tehdy, když appka nemá s čím počítat vůbec. */
    function obarvit(pole, r, klicDruhu) {
      var stavy = {}, znamych = 0;
      POLE.forEach(function (klic) {
        var v = najdiUtok(seznamProDruh(klicDruhu, DRUH[klic]), r[klic]);
        stavy[klic] = v;
        if (v) znamych++;
      });
      POLE.forEach(function (klic) {
        var ovl = pole[klic];
        if (!ovl) return;
        var v = stavy[klic];
        ovl.classList.remove("utok-nezna", "utok-preucit");
        if (v === undefined) { ovl.title = "Vyber " + POPIS[klic]; return; }
        if (v) {
          ovl.title = v.type + (v.elite ? " · elitní útok, běžným TM se nenaučí" : "");
          return;
        }
        ovl.classList.add(znamych > 0 ? "utok-preucit" : "utok-nezna");
        ovl.title = znamych > 0
          ? "Tenhle útok " + (r.pokemon || "ten druh") + " neumí — stačí ho přeučit,"
            + " zbytek sestavy je v pořádku."
          : "Ani jeden útok " + (r.pokemon || "ten druh") + " neumí — appka nemá s čím počítat.";
      });
    }

    // ---------- vlastní rozbalovací seznam ----------
    // Nativní <select> ani datalist neumí typové barvy a datalist se navíc
    // druhým klikem na šipku nezavře. Tohle je proto vlastní ovládací prvek:
    // tlačítko + seznam, který se přepíná klikem, zavře Esc i klik vedle,
    // a jde v něm chodit šipkami.
    var otevrenySeznam = null;

    function zavritSeznam() {
      if (!otevrenySeznam) return;
      otevrenySeznam.seznam.remove();
      otevrenySeznam.tlacitko.classList.remove("otevreno");
      otevrenySeznam = null;
    }

    // Klik mimo: nejdřív se zavře rozbalený seznam, a když se kliklo úplně
    // mimo buňku s editorem, zavře se i ten. Dřív se zavíral jen seznam a
    // editor zůstal viset, dokud se neklikl jiný pokémon.
    document.addEventListener("mousedown", function (e) {
      if (otevrenySeznam && !otevrenySeznam.seznam.contains(e.target)
        && !otevrenySeznam.obal.contains(e.target)) zavritSeznam();
      if (otevrenaBunka && !otevrenaBunka.contains(e.target)
        && !(otevrenyPanel && otevrenyPanel.contains(e.target))
        && !(otevrenySeznam && otevrenySeznam.seznam.contains(e.target))) zavritEditor();
    }, true);

    // seznam visí v okně, ne v tabulce — při rolování by zůstal na místě
    window.addEventListener("scroll", function () { zavritSeznam(); zavritEditor(); }, true);

    function vyber(obal, r, klic, klicDruhu, pole, poZmene) {
      var seznam = seznamProDruh(klicDruhu, DRUH[klic]);
      var tlacitko = document.createElement("button");
      tlacitko.type = "button";
      tlacitko.className = "uv-pole";

      function vykreslitTlacitko() {
        var hodnota = r[klic] || "";
        var m = najdiUtok(seznam, hodnota);
        tlacitko.innerHTML = "";
        var tecka = document.createElement("span");
        tecka.className = "uv-tecka";
        tecka.style.background = m ? barvaTypu(m.type) : "transparent";
        if (!m) tecka.style.boxShadow = "inset 0 0 0 1px var(--grid)";
        tlacitko.appendChild(tecka);
        var jmeno = document.createElement("span");
        jmeno.className = "uv-jmeno";
        jmeno.textContent = hodnota || POPIS[klic];
        tlacitko.appendChild(jmeno);
        var sipka = document.createElement("span");
        sipka.className = "uv-sipka";
        sipka.textContent = "▼";
        tlacitko.appendChild(sipka);
        tlacitko.classList.toggle("prazdne", !hodnota);
      }
      vykreslitTlacitko();

      function otevrit() {
        var box = document.createElement("div");
        box.className = "uv-seznam";
        var polozky = [];

        function pridat(popisek, hodnota, m) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "uv-polozka" + (m ? "" : " uv-prazdna");
          var vybrano = (r[klic] || "") === hodnota;
          if (vybrano) b.classList.add("vybrana");

          if (m) {
            // tři buňky v pevném poměru: typ, název, síla
            var bunkaTyp = document.createElement("span");
            bunkaTyp.className = "uv-typ";
            bunkaTyp.style.background = barvaTypu(m.type);
            bunkaTyp.textContent = m.type + (m.elite ? " ★" : "");
            if (m.elite) bunkaTyp.title = "Elitní útok — jen za Elite TM";
            b.appendChild(bunkaTyp);
          }

          var jm = document.createElement("span");
          jm.className = "uv-nazev";
          jm.textContent = popisek;
          b.appendChild(jm);

          if (m) {
            // Ve třetím sloupci je JEN síla. Poměr 2:2:1 znamená, že cokoli
            // navíc tady roztáhne i oba širší sloupce — se slovem „elitní"
            // a fajfkou byl seznam o sto pixelů širší, než musel být.
            // Elitní útok se pozná podle hvězdičky v typové plaketce,
            // vybraný podle zvýrazněného okraje řádku.
            var meta = document.createElement("span");
            meta.className = "uv-meta";
            meta.textContent = m.power ? "síla " + m.power : "";
            b.appendChild(meta);
          }
          b.addEventListener("click", function () {
            r[klic] = hodnota;
            window.__pgo.zapamatovatUtoky(r);
            window.__pgo.persistNow();
            vykreslitTlacitko();
            zavritSeznam();
            if (poZmene) poZmene();
          });
          box.appendChild(b);
          polozky.push(b);
        }

        pridat("nevyplněno", "", null);
        seznam.forEach(function (m) { pridat(m.name, m.name, m); });
        // útok, který ten druh neumí (starý sken), se nesmí ztratit
        if (r[klic] && !najdiUtok(seznam, r[klic])) {
          pridat(r[klic] + " — tenhle druh ho neumí", r[klic], null);
        }

        document.body.appendChild(box);
        umistit(box, tlacitko);
        tlacitko.classList.add("otevreno");
        otevrenySeznam = { obal: obal, seznam: box, tlacitko: tlacitko, polozky: polozky, kurzor: -1 };
        // scrollIntoView umí odrolovat i celou STRÁNKU, když se to prohlížeči
        // hodí. Uvnitř seznamu si to proto spočítáme sami — nic mimo box se
        // pohnout nesmí.
        var vybrana = box.querySelector(".vybrana");
        if (vybrana) doRohledu(box, vybrana);
      }

      tlacitko.addEventListener("click", function (e) {
        e.stopPropagation();
        // druhý klik zavře — přesně to, co u nativního datalistu nešlo
        if (otevrenySeznam && otevrenySeznam.tlacitko === tlacitko) { zavritSeznam(); return; }
        zavritSeznam();
        otevrit();
      });

      tlacitko.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tlacitko.click(); return; }
        if (!otevrenySeznam || otevrenySeznam.tlacitko !== tlacitko) return;
        var st = otevrenySeznam;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          st.kurzor += (e.key === "ArrowDown" ? 1 : -1);
          if (st.kurzor < 0) st.kurzor = st.polozky.length - 1;
          if (st.kurzor >= st.polozky.length) st.kurzor = 0;
          st.polozky.forEach(function (x, i) { x.classList.toggle("zvyraznena", i === st.kurzor); });
          doRohledu(st.seznam, st.polozky[st.kurzor]);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (st.kurzor >= 0) st.polozky[st.kurzor].click();
        }
      });

      // Fokus po kliknutí necháváme na prohlížeči, ale bez rolování: prvek
      // je stejně vidět, protože se na něj právě kliklo.
      tlacitko.addEventListener("mousedown", function (e) {
        e.preventDefault();                  // zabrání skoku při přebírání fokusu
        try { tlacitko.focus({ preventScroll: true }); } catch (x) { tlacitko.focus(); }
      });

      obal.appendChild(tlacitko);
      pole[klic] = tlacitko;
      return tlacitko;
    }

    /** Řádek podle data-row-id, které do tabulky dává ostrá appka. */
    function radekZPrvku(el) {
      var tr = el && el.closest ? el.closest("tr") : null;
      var id = tr && tr.dataset ? tr.dataset.rowId : null;
      if (!id) return null;
      var nalezen = null;
      (window.__pgo.getRows() || []).forEach(function (x) {
        if (String(x.id) === String(id)) nalezen = x;
      });
      return nalezen;
    }

    // ---------- editor nad buňkou Útoky ----------
    var otevrenaBunka = null, otevrenyPanel = null;

    /** Zavře editor a vrátí buňce původní obsah.
     *
     *  Dřív se volalo překreslení CELÉ tabulky. To mělo dva zlé následky:
     *  stránka uskočila nahoru a hlavně se ta buňka smazala — takže když se
     *  vzápětí otevíral editor u jiného pokémona, stavěl se do prvku, který
     *  už v dokumentu nebyl. Nabídka pak zůstala viset a jinde nešla otevřít.
     *  Teď se vrátí uložený obsah a přepočítá se jen dopočítaná část. */
    /** Zavře editor. Buňka se nikdy neměnila, takže se jen odebere podbarvení
     *  a plovoucí panel; přepočítá se dopočítaná část, ať se hodnocení
     *  sestavy hned aktualizuje. */
    function zavritEditor() {
      if (!otevrenaBunka) return;
      zavritSeznam();
      var td = otevrenaBunka;
      otevrenaBunka = null;
      td.classList.remove("utok-edit-otevreny");
      if (otevrenyPanel) { otevrenyPanel.remove(); otevrenyPanel = null; }
      if (window.__pgo.prepocitat) window.__pgo.prepocitat();
    }

    function otevritEditor(td, r) {
      if (otevrenaBunka === td) return;
      zavritEditor();
      otevrenaBunka = td;
      td.classList.add("utok-edit-otevreny");
      var klicDruhu = window.__pgo.dexKeyOf(r.pokemon || "");
      var box = document.createElement("div");
      box.className = "utok-edit";
      var hlava = document.createElement("div");
      hlava.className = "utok-edit-hlava";
      hlava.appendChild(document.createTextNode(r.pokemon || "Útoky"));
      var zavrit = document.createElement("button");
      zavrit.type = "button";
      zavrit.className = "utok-edit-zavrit";
      zavrit.textContent = "✕";
      zavrit.title = "Zavřít";
      zavrit.addEventListener("click", zavritEditor);
      hlava.appendChild(zavrit);
      box.appendChild(hlava);
      var pole = {};
      POLE.forEach(function (klic) {
        var obal = document.createElement("div");
        obal.className = "uv";
        vyber(obal, r, klic, klicDruhu, pole, function () { obarvit(pole, r, klicDruhu); });
        box.appendChild(obal);
      });
      var napoveda = document.createElement("div");
      napoveda.className = "utok-edit-napoveda";
      napoveda.textContent = "Esc zavře · kliknutí vedle taky";
      box.appendChild(napoveda);
      document.body.appendChild(box);
      otevrenyPanel = box;
      umistit(box, td);
      obarvit(pole, r, klicDruhu);
      box.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        e.preventDefault();
        if (otevrenySeznam) zavritSeznam(); else zavritEditor();
      });
      // preventScroll: bez toho prohlížeč odroluje na fokusovaný prvek
      var prvni = box.querySelector(".uv-pole");
      if (prvni) { try { prvni.focus({ preventScroll: true }); } catch (e) { prvni.focus(); } }
    }

    function indexSloupceUtoky() {
      var h = document.querySelectorAll("#headerRow th");
      for (var i = 0; i < h.length; i++) {
        if (h[i].textContent.indexOf("Útoky") === 0) return i;
      }
      return -1;
    }

    var tbody = document.getElementById("tbody");
    if (!tbody) return;

    tbody.addEventListener("click", function (e) {
      var td = e.target.closest ? e.target.closest("td") : null;
      if (!td || td.classList.contains("utok-edit-otevreny")) return;
      var i = indexSloupceUtoky();
      if (i < 0 || td.parentNode.children[i] !== td) return;
      var r = radekZPrvku(td);
      if (!r) return;
      e.stopPropagation();
      otevritEditor(td, r);
    }, true);

    /** Buňka Útoky vypadá klikatelně, ať se na to přijde. */
    function oznacitBunky() {
      var i = indexSloupceUtoky();
      if (i < 0) return;
      Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (tr) {
        var td = tr.children[i];
        if (!td || td.classList.contains("utok-edit-otevreny")) return;
        if (!tr.dataset || !tr.dataset.rowId) return;
        td.classList.add("utok-klik");
        if (!td.title) td.title = "Klikni a doplň útoky";
      });
    }

    var planovano = null;
    function prekreslit() {
      if (planovano) return;
      planovano = window.setTimeout(function () { planovano = null; oznacitBunky(); }, 60);
    }
    prekreslit();
    new MutationObserver(prekreslit).observe(tbody, { childList: true, subtree: true });
  })();
"""


def uprav(html):
    kotva_css = "  /* ---------- režim čištění boxu ---------- */"
    if kotva_css not in html:
        raise RuntimeError("nenašel jsem kotvu pro CSS")
    html = html.replace(kotva_css, CSS + "\n" + kotva_css, 1)

    kotva_export = "    renderPrach: renderPrach,"
    if kotva_export not in html:
        raise RuntimeError("nenašel jsem místo pro export")
    html = html.replace(kotva_export, kotva_export + """
    learnsetOf: learnset,
    fastMoveAt: fastMove,
    chargedMoveAt: chargedMove,""", 1)

    kon = html.rfind("</script>")
    return html[:kon] + JS + "\n" + html[kon:]
