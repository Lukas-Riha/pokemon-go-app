/* Generováno tools/build_publish.py — needitovat ručně. */
var VERZE = "pgo-ce86a7135652";
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
