# -*- coding: utf-8 -*-
"""Okno na skenování boxu — připojení, kalibrace i běh na tlačítka.

Proč to existuje: všechno se dalo jen z příkazové řádky, což je na věc,
která se dělá každý druhý den, otrava. Tohle je tenká slupka nad
`skenovat.py` — sama nic nepočítá, jen mu podává argumenty a ukazuje
výstup. Když se změní logika skenování, mění se tam, ne tady.

Přípona .pyw: Windows to pustí bez černého okna konzole.

Spuštění: dvojklik na `Skenovat box.bat`, nebo
    python tools/adb/ovladac.pyw
"""
import json
import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont
from tkinter import messagebox, ttk

ZDE = Path(__file__).resolve().parent
KOREN = ZDE.parent.parent
KALIBRACE = ZDE / "kalibrace.json"
SKENOVAT = ZDE / "skenovat.py"
STOP = ZDE / "STOP"
SNIMEK = ZDE / ".snimek.png"          # dočasný, přepisuje se

# Šířka pruhu u svislých okrajů, kam si Android bere gesto ZPĚT. Tah, který
# v něm začne, zavře detail místo přepnutí na dalšího pokémona.
def pruh_gesta(sirka):
    return max(60, int(sirka * 0.07))


# Bez tohohle si KAŽDÉ volání adb otevře vlastní okno konzole. Pod pythonw
# (okno bez konzole) to znamená, že při každém tahu problikne černé okno,
# ukradne fokus a na počítači se u toho nedá dělat nic jiného. Na jiných
# systémech než Windows ten příznak neexistuje, proto getattr.
BEZ_OKNA = getattr(subprocess, "CREATE_NO_WINDOW", 0)

_SKEN_MODUL = None


def _skenovat():
    """Modul skenovat.py — kvůli výpočtu pásem tahu.

    Načítá se, aby okno ukazovalo přesně ta čísla, se kterými se pak běží.
    Kdyby si popisek počítal vlastní rozsahy, rozešly by se s realitou při
    první změně konstant.
    """
    global _SKEN_MODUL
    if _SKEN_MODUL is None:
        import importlib.util
        spec = importlib.util.spec_from_file_location("skenovat", str(SKENOVAT))
        _SKEN_MODUL = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_SKEN_MODUL)
    return _SKEN_MODUL


def najdi_adb():
    """Cesta k adb: nejdřív PATH, pak obvyklá místa."""
    import shutil, os
    z_path = shutil.which("adb")
    if z_path:
        return z_path
    dom = os.path.expanduser("~")
    for c in (os.path.join(dom, "platform-tools", "adb.exe"),
              os.path.join(dom, "AppData", "Local", "Android", "Sdk",
                           "platform-tools", "adb.exe"),
              r"C:\Android\platform-tools\adb.exe"):
        if os.path.exists(c):
            return c
    return "adb"

def adb(*args, binarne=False):
    """Zavolá adb. Vrací text, nebo bajty při binarne=True."""
    try:
        r = subprocess.run([najdi_adb()] + list(args), capture_output=True,
                           check=False, creationflags=BEZ_OKNA)
    except FileNotFoundError:
        raise RuntimeError("adb není v PATH — stáhni Google SDK Platform-Tools.")
    if r.returncode != 0:
        raise RuntimeError((r.stderr or b"").decode("utf-8", "replace")[:300]
                           or "adb selhalo")
    return r.stdout if binarne else r.stdout.decode("utf-8", "replace")


class Ovladac(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Skenování boxu — Pokémon GO")
        self.minsize(760, 560)
        self.beh = None                 # běžící subprocess
        self.fronta = queue.Queue()     # řádky výstupu z vlákna
        self._postav()
        self._stav_zarizeni()
        self._nacti_kalibraci()
        self.after(120, self._prelej_frontu)
        self.protocol("WM_DELETE_WINDOW", self._zavrit)

    # ---------------------------------------------------------------- UI
    def _postav(self):
        tucne = tkfont.Font(weight="bold", size=10)
        obal = ttk.Frame(self, padding=12)
        obal.pack(fill="both", expand=True)

        # --- 1. telefon ---
        r1 = ttk.LabelFrame(obal, text=" 1. Telefon ", padding=10)
        r1.pack(fill="x")
        self.lbl_zarizeni = ttk.Label(r1, text="zjišťuji…", font=tucne)
        self.lbl_zarizeni.grid(row=0, column=0, columnspan=3, sticky="w")
        ttk.Label(r1, text="Bezdrátově — IP:PORT z Bezdrátového ladění:") \
            .grid(row=1, column=0, sticky="w", pady=(8, 0))
        self.pole_ip = ttk.Entry(r1, width=24)
        self.pole_ip.grid(row=1, column=1, sticky="w", padx=6, pady=(8, 0))
        ttk.Button(r1, text="Připojit", command=self._pripojit) \
            .grid(row=1, column=2, sticky="w", pady=(8, 0))
        ttk.Button(r1, text="Zkontrolovat znovu", command=self._stav_zarizeni) \
            .grid(row=0, column=3, sticky="e", padx=(12, 0))
        r1.columnconfigure(3, weight=1)

        # --- 2. kalibrace ---
        r2 = ttk.LabelFrame(obal, text=" 2. Kalibrace (jednou pro tenhle telefon) ",
                            padding=10)
        r2.pack(fill="x", pady=(10, 0))
        self.lbl_kalibrace = ttk.Label(r2, text="—")
        self.lbl_kalibrace.pack(anchor="w")
        ttk.Label(r2, wraplength=700, foreground="#666",
                  text="Časování ani rychlost tažení kalibraci nemění — dělá se"
                       " jednou. Znovu jen když se změní rozlišení nebo velikost"
                       " písma, nebo když tažení nefunguje.") \
            .pack(anchor="w", pady=(4, 6))
        ttk.Button(r2, text="Kalibrovat…", command=self._kalibrovat).pack(anchor="w")

        # --- 3. běh ---
        r3 = ttk.LabelFrame(obal, text=" 3. Skenování ", padding=10)
        r3.pack(fill="x", pady=(10, 0))
        rada = ttk.Frame(r3)
        rada.pack(fill="x")
        ttk.Label(rada, text="Čekání:", width=14).pack(side="left")
        self.tempo = tk.DoubleVar(value=1.0)
        ttk.Scale(rada, from_=0.5, to=2.0, variable=self.tempo, length=200,
                  command=lambda _v: self._popis_tempa()).pack(side="left", padx=8)
        self.lbl_tempo = ttk.Label(rada, text="", width=44)
        self.lbl_tempo.pack(side="left")

        # Doba tahu: dvě pásma, u každého vlastní min a max. Dvouúchytový
        # posuvník tkinter nemá, takže jsou to dva — hlídají se navzájem,
        # aby min nikdy nepřerostl max.
        vych = _skenovat()
        tah = ttk.LabelFrame(r3, text=" Doba tažení ", padding=8)
        tah.pack(fill="x", pady=(10, 0))
        self.tah = {}
        for radek, (klic, popis, mez, zaklad) in enumerate((
                ("rychly", "Cvrnknutí", (30, 700),
                 (vych.SWIPE_RYCHLY_MIN, vych.SWIPE_RYCHLY_MAX)),
                ("pomaly", "Přetažení", (100, 1800),
                 (vych.SWIPE_POMALY_MIN, vych.SWIPE_POMALY_MAX)))):
            ttk.Label(tah, text=popis + ":", width=11).grid(row=radek, column=0,
                                                            sticky="w", pady=2)
            lo = tk.DoubleVar(value=zaklad[0])
            hi = tk.DoubleVar(value=zaklad[1])
            self.tah[klic] = (lo, hi)
            ttk.Scale(tah, from_=mez[0], to=mez[1], variable=lo, length=150,
                      command=lambda _v, k=klic: self._srovnej_pasmo(k, "lo"))                 .grid(row=radek, column=1, padx=(4, 4))
            ttk.Scale(tah, from_=mez[0], to=mez[1], variable=hi, length=150,
                      command=lambda _v, k=klic: self._srovnej_pasmo(k, "hi"))                 .grid(row=radek, column=2, padx=(0, 8))
            lbl = ttk.Label(tah, text="", width=16)
            lbl.grid(row=radek, column=3, sticky="w")
            self.tah[klic] = (lo, hi, lbl)

        ttk.Label(tah, text="Podíl přetažení:", width=15).grid(row=2, column=0,
                                                               sticky="w", pady=(6, 0))
        self.podil = tk.DoubleVar(value=vych.P_POMALY_SWIPE)
        ttk.Scale(tah, from_=0.0, to=0.6, variable=self.podil, length=150,
                  command=lambda _v: self._popis_tempa())             .grid(row=2, column=1, padx=(4, 4), pady=(6, 0))
        self.lbl_podil = ttk.Label(tah, text="", width=30)
        self.lbl_podil.grid(row=2, column=2, columnspan=2, sticky="w", pady=(6, 0))
        self._popis_tempa()

        tl = ttk.Frame(r3)
        tl.pack(fill="x", pady=(10, 0))
        self.btn_zkouska = ttk.Button(tl, text="Zkouška — 5 kusů",
                                      command=lambda: self._spustit(zkouska=True))
        self.btn_zkouska.pack(side="left")
        self.btn_box = ttk.Button(tl, text="Celý box",
                                  command=lambda: self._spustit(zkouska=False))
        self.btn_box.pack(side="left", padx=6)
        self.btn_stop = ttk.Button(tl, text="Zastavit", command=self._zastavit,
                                   state="disabled")
        self.btn_stop.pack(side="left")
        ttk.Label(tl, foreground="#666",
                  text="Před během: Calcy zapnuté s automatickým skenováním,"
                       " box na prvním pokémonovi.").pack(side="left", padx=(12, 0))

        # --- výpis ---
        r4 = ttk.LabelFrame(obal, text=" Průběh ", padding=6)
        r4.pack(fill="both", expand=True, pady=(10, 0))
        self.log = tk.Text(r4, height=14, wrap="none", state="disabled",
                           font=("Consolas", 9))
        posuv = ttk.Scrollbar(r4, command=self.log.yview)
        self.log.configure(yscrollcommand=posuv.set)
        posuv.pack(side="right", fill="y")
        self.log.pack(side="left", fill="both", expand=True)
        self.log.tag_configure("chyba", foreground="#c0392b")
        self.log.tag_configure("dobre", foreground="#1e8449")

    def _popis_tempa(self):
        t = round(self.tempo.get(), 2)
        if t < 0.85:
            popis = "svižnější — hlídej Calcy historii"
        elif t > 1.15:
            popis = "opatrnější — když Calcy nestíhá"
        else:
            popis = "výchozí"
        self.lbl_tempo.config(text="%.2f×  (%s)" % (t, popis))

        for klic in ("rychly", "pomaly"):
            lo, hi, lbl = self.tah[klic]
            lbl.config(text="%d–%d ms" % (round(lo.get()), round(hi.get())))
        p = self.podil.get()
        self.lbl_podil.config(
            text="%d %% tahů je pomalé přetažení, zbytek cvrnknutí"
                 % round(p * 100))

    def _srovnej_pasmo(self, klic, ktery):
        """Min nesmí přerůst max — posunutý úchyt si toho druhého odtlačí."""
        lo, hi, _lbl = self.tah[klic]
        if lo.get() > hi.get():
            if ktery == "lo":
                hi.set(lo.get())
            else:
                lo.set(hi.get())
        self._popis_tempa()

    def _pis(self, text, tag=None):
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n", tag or ())
        self.log.see("end")
        self.log.configure(state="disabled")

    # ------------------------------------------------------------ telefon
    def _stav_zarizeni(self):
        try:
            vypis = adb("devices")
        except RuntimeError as e:
            self.lbl_zarizeni.config(text="✗ " + str(e), foreground="#c0392b")
            return False
        radky = [r for r in vypis.splitlines()[1:] if r.strip()]
        pripojene = [r for r in radky if r.strip().endswith("device")]
        if pripojene:
            self.lbl_zarizeni.config(
                text="✓ připojeno: " + pripojene[0].split()[0], foreground="#1e8449")
            return True
        if radky:
            self.lbl_zarizeni.config(
                text="✗ zařízení je vidět, ale není potvrzené (" + radky[0].strip()
                     + ") — potvrď dotaz na displeji", foreground="#c0392b")
        else:
            self.lbl_zarizeni.config(
                text="✗ žádné zařízení — zapni Bezdrátové ladění a připoj se",
                foreground="#c0392b")
        return False

    def _pripojit(self):
        cil = self.pole_ip.get().strip()
        if not cil:
            messagebox.showinfo("Připojení",
                                "Vyplň IP:PORT z obrazovky Bezdrátové ladění"
                                " v telefonu.\n\nPárování (jednou) se dělá"
                                " příkazem adb pair — viz SCENAR.md.")
            return
        try:
            self._pis(adb("connect", cil).strip())
        except RuntimeError as e:
            self._pis(str(e), "chyba")
        self._stav_zarizeni()

    # ---------------------------------------------------------- kalibrace
    def _nacti_kalibraci(self):
        if not KALIBRACE.exists():
            self.lbl_kalibrace.config(text="✗ zatím není — klikni na Kalibrovat",
                                      foreground="#c0392b")
            return None
        try:
            k = json.loads(KALIBRACE.read_text(encoding="utf-8"))
            b = k["body"]
            self.lbl_kalibrace.config(
                text="✓ %s %s · tah %s → %s"
                     % (k.get("model", "?"),
                        "x".join(str(x) for x in k.get("rozliseni", [])),
                        b["swipe_z"], b["swipe_do"]),
                foreground="#1e8449")
            return k
        except Exception as e:
            self.lbl_kalibrace.config(text="✗ soubor je poškozený: %s" % e,
                                      foreground="#c0392b")
            return None

    def _kalibrovat(self):
        if not self._stav_zarizeni():
            messagebox.showwarning("Kalibrace", "Nejdřív připoj telefon.")
            return
        try:
            data = adb("exec-out", "screencap", "-p", binarne=True)
            model = adb("shell", "getprop", "ro.product.model").strip()
            v = adb("shell", "wm", "size").strip().split(":")[-1].strip()
            sirka, vyska = [int(x) for x in v.split("x")]
        except Exception as e:
            messagebox.showerror("Kalibrace", str(e))
            return
        SNIMEK.write_bytes(data)
        OknoKalibrace(self, SNIMEK, model, (sirka, vyska))

    # ---------------------------------------------------------------- běh
    def _spustit(self, zkouska):
        if self.beh:
            return
        if not self._nacti_kalibraci():
            messagebox.showwarning("Skenování", "Nejdřív kalibrace.")
            return
        if not self._stav_zarizeni():
            messagebox.showwarning("Skenování", "Nejdřív připoj telefon.")
            return
        if STOP.exists():
            STOP.unlink()

        prikaz = [sys.executable, "-u", str(SKENOVAT),
                  "--tempo", "%.2f" % self.tempo.get(),
                  "--podil-pomalych", "%.2f" % self.podil.get()]
        for klic, prep in (("rychly", "--tah-rychly"), ("pomaly", "--tah-pomaly")):
            lo, hi, _l = self.tah[klic]
            prikaz += [prep, str(round(lo.get())), str(round(hi.get()))]
        if zkouska:
            prikaz += ["--pocet", "5", "--bez-detekce"]
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")
        self._pis("> " + " ".join(prikaz[1:]) + "\n")

        self.beh = subprocess.Popen(
            prikaz, cwd=str(KOREN), stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, encoding="utf-8", errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        threading.Thread(target=self._cist_vystup, daemon=True).start()
        self._prepni_tlacitka(bezi=True)

    def _cist_vystup(self):
        for radek in self.beh.stdout:
            self.fronta.put(radek.rstrip("\n"))
        self.fronta.put(None)          # značka konce

    def _prelej_frontu(self):
        """Výstup z vlákna do okna. Do widgetů smí sahat jen hlavní vlákno."""
        try:
            while True:
                radek = self.fronta.get_nowait()
                if radek is None:
                    self.beh = None
                    self._prepni_tlacitka(bezi=False)
                    self._pis("\n— konec —", "dobre")
                    # `ADB_ENABLED` je stav zařízení, který si aplikace může přečíst.
                    # Nechávat ladění zapnuté mezi běhy je stopa, kterou nic
                    # nevynahradí — a vypnout ho stojí dvě klepnutí.
                    self._pis("Hotovo? V Calcy exportuj historii do CSV a v appce"
                              " dej Sloučit s rosterem.", "dobre")
                    self._pis("A vypni v telefonu Bezdrátové ladění — mezi běhy ho"
                              " nepotřebuješ a je to zbytečná stopa.", "chyba")
                    continue
                tag = "chyba" if radek.startswith(("POZOR", "DOŠEL LIMIT")) else None
                self._pis(radek, tag)
        except queue.Empty:
            pass
        self.after(120, self._prelej_frontu)

    def _zastavit(self):
        if not self.beh:
            return
        # Skript sám hlídá soubor STOP a dojede rozdělaný krok. To je lepší
        # než ho zabít uprostřed tahu, kdy by prst zůstal „přilepený".
        STOP.touch()
        self._pis("… zastavuji po dokončení kroku", "chyba")

    def _prepni_tlacitka(self, bezi):
        for b in (self.btn_zkouska, self.btn_box):
            b.config(state="disabled" if bezi else "normal")
        self.btn_stop.config(state="normal" if bezi else "disabled")

    def _zavrit(self):
        if self.beh:
            if not messagebox.askyesno("Zavřít", "Skenování běží. Opravdu zavřít?"):
                return
            STOP.touch()
            try:
                self.beh.terminate()
            except Exception:
                pass
        self.destroy()


class OknoKalibrace(tk.Toplevel):
    """Snímek obrazovky, do kterého se naklikají dva body tažení."""

    def __init__(self, rodic, cesta_png, model, rozliseni):
        super().__init__(rodic)
        self.title("Kalibrace — klikni odkud a kam táhnout")
        self.rodic = rodic
        self.model = model
        self.rozliseni = rozliseni
        self.body = []

        self.obr = tk.PhotoImage(file=str(cesta_png))
        # PhotoImage umí zmenšovat jen celočíselně; 2652 px na výšku se musí
        # vejít do okna, takže se hledá nejmenší dělitel, který stačí.
        self.delitel = 1
        while self.obr.height() // self.delitel > 760:
            self.delitel += 1
        if self.delitel > 1:
            self.obr = self.obr.subsample(self.delitel, self.delitel)

        ttk.Label(self, padding=8, wraplength=self.obr.width() + 40, justify="left",
                  text="Klikni dvakrát: ① odkud táhnout (vpravo od středu obrázku"
                       " pokémona), ② kam (stejná výška, vlevo od středu).\n"
                       "Drž se dál od svislých okrajů — tam si Android bere gesto"
                       " ZPĚT a místo přepnutí by se zavřel detail.").pack()
        self.platno = tk.Canvas(self, width=self.obr.width(),
                                height=self.obr.height(), cursor="crosshair")
        self.platno.pack(padx=8)
        self.platno.create_image(0, 0, anchor="nw", image=self.obr)
        self.platno.bind("<Button-1>", self._klik)

        self.stav = ttk.Label(self, padding=8, text="① odkud táhnout")
        self.stav.pack()
        spodek = ttk.Frame(self, padding=(8, 0, 8, 8))
        spodek.pack(fill="x")
        self.btn_ulozit = ttk.Button(spodek, text="Uložit", state="disabled",
                                     command=self._ulozit)
        self.btn_ulozit.pack(side="left")
        ttk.Button(spodek, text="Znovu", command=self._reset).pack(side="left", padx=6)
        ttk.Button(spodek, text="Zavřít", command=self.destroy).pack(side="left")

    def _klik(self, ev):
        if len(self.body) >= 2:
            return
        skutecne = [ev.x * self.delitel, ev.y * self.delitel]
        self.body.append(skutecne)
        barva = "#1e8449" if len(self.body) == 1 else "#2471a3"
        self.platno.create_oval(ev.x - 7, ev.y - 7, ev.x + 7, ev.y + 7,
                                outline=barva, width=3)
        self.platno.create_text(ev.x, ev.y - 16, text="①②"[len(self.body) - 1],
                                fill=barva, font=("Segoe UI", 12, "bold"))
        if len(self.body) == 1:
            self.stav.config(text="② kam táhnout (stejná výška)")
            return

        self.platno.create_line(self.body[0][0] // self.delitel,
                                self.body[0][1] // self.delitel,
                                ev.x, ev.y, fill="#2471a3", width=2, arrow="last")
        self._zkontroluj()

    def _zkontroluj(self):
        sirka = min(self.rozliseni)
        prah = pruh_gesta(sirka)
        potize = []
        for jmeno, bod in (("① odkud", self.body[0]), ("② kam", self.body[1])):
            okraj = min(bod[0], sirka - bod[0])
            if okraj < prah:
                potize.append("%s je jen %d px od kraje (pruh gesta ZPĚT má %d px)"
                              % (jmeno, okraj, prah))
        rozdil = abs(self.body[0][1] - self.body[1][1])
        if rozdil > sirka * 0.05:
            potize.append("body nejsou ve stejné výšce (rozdíl %d px) — šikmý tah"
                          " hra občas vyhodnotí jinak" % rozdil)
        if abs(self.body[0][0] - self.body[1][0]) < sirka * 0.3:
            potize.append("tah je moc krátký — box se nemusí přepnout")

        if potize:
            self.stav.config(text="⚠ " + " · ".join(potize), foreground="#c0392b")
        else:
            self.stav.config(text="✓ vypadá to dobře — můžeš uložit",
                             foreground="#1e8449")
        # Uložit jde i s výhradou: hranice jsou odhad, na některých telefonech
        # může fungovat i něco mimo ně. Varování stačí.
        self.btn_ulozit.config(state="normal")

    def _reset(self):
        self.body = []
        self.platno.delete("all")
        self.platno.create_image(0, 0, anchor="nw", image=self.obr)
        self.stav.config(text="① odkud táhnout", foreground="")
        self.btn_ulozit.config(state="disabled")

    def _ulozit(self):
        data = {"model": self.model, "rozliseni": list(self.rozliseni),
                "body": {"swipe_z": self.body[0], "swipe_do": self.body[1]}}
        KALIBRACE.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                             encoding="utf-8")
        self.rodic._nacti_kalibraci()
        self.rodic._pis("kalibrace uložena: %s → %s" % (self.body[0], self.body[1]),
                        "dobre")
        self.destroy()


if __name__ == "__main__":
    Ovladac().mainloop()
