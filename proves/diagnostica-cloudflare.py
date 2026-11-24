#!/usr/bin/env python3
"""Mira si un web amb la verificació de Cloudflare («Just a moment…») deixa passar el Firefox, sense Menja galetes i amb.

    python3 proves/diagnostica-cloudflare.py <adreça> [segons] [sense|amb|totes]

Obre un Firefox a part, amb un perfil temporal, dins d'un Xvfb: té finestra, però no es veu. No fa servir
Marionette, perquè encén `navigator.webdriver` i Cloudflare ja no deixa passar ni el Firefox sense l'extensió.
L'extensió (la carpeta `extensio/`, tal com és ara) s'instal·la pel servidor de depuració del Firefox, com fa
`web-ext run`, que no deixa cap rastre a la pàgina.

Al cap dels segons que diguis (per defecte, 40), llegeix l'historial i les galetes del perfil i fa una captura.
Diu si ha passat (si l'adreça neta acaba amb el títol del web, i no amb el de la verificació) i quantes vegades
s'ha tornat a carregar la verificació. Les captures van a `proves/captures/cloudflare-<sense|amb>.png`.
Les galetes de sessió no surten a la llista, perquè el Firefox no les desa al disc.

Per buscar què falla: `--apaga=navegador,empremta…` apaga parts de la disfressa, `--confianca=web.org` posa
el web a la llista de confiança, i `--ext=<carpeta>` prova una còpia de l'extensió retocada a mà.
El 24/11/2026 va servir per trobar que els treballadors de blob revocats no funcionaven (fwupd.org).
"""
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ARREL = Path(__file__).resolve().parent.parent
EXT = ARREL / "extensio"
CAPTURES = ARREL / "proves" / "captures"
PORT_DEP = 6011
PANTALLA = ":97"


class Depurador:
    """Client mínim del protocol de depuració remota del Firefox: paquets «<llargada>:<json>»."""

    def __init__(self, port, espera=30):
        fi = time.time() + espera
        while True:
            try:
                self.s = socket.create_connection(("127.0.0.1", port), timeout=10)
                break
            except OSError:
                if time.time() > fi:
                    raise
                time.sleep(0.5)
        self.buf = b""
        self.llegeix()   # la salutació del servidor

    def llegeix(self):
        while b":" not in self.buf:
            self.buf += self.s.recv(65536)
        cap, resta = self.buf.split(b":", 1)
        n = int(cap)
        while len(resta) < n:
            resta += self.s.recv(65536)
        self.buf = resta[n:]
        return json.loads(resta[:n])

    def envia(self, paquet):
        dades = json.dumps(paquet).encode()
        self.s.sendall(str(len(dades)).encode() + b":" + dades)
        while True:
            r = self.llegeix()
            # Els avisos (tabListChanged…) porten «type»; les respostes, no.
            if r.get("from") == paquet["to"] and ("type" not in r or "error" in r):
                return r


def llegeix_perfil(perfil, host):
    """Còpia de l'historial i les galetes (amb el WAL), perquè el Firefox encara els té oberts."""
    tmp = Path(tempfile.mkdtemp(prefix="menja-galetes-cf-bd-"))
    for nom in ["places.sqlite", "places.sqlite-wal", "cookies.sqlite", "cookies.sqlite-wal"]:
        if (perfil / nom).exists():
            shutil.copy(perfil / nom, tmp / nom)
    visites, galetes = [], []
    try:
        if (tmp / "places.sqlite").exists():
            visites = sqlite3.connect(tmp / "places.sqlite").execute(
                "select v.visit_date, p.url, p.title from moz_historyvisits v join moz_places p on p.id = v.place_id"
                " where p.url like ? order by v.visit_date", (f"%{host}%",)).fetchall()
        if (tmp / "cookies.sqlite").exists():
            galetes = sqlite3.connect(tmp / "cookies.sqlite").execute(
                "select host, name, substr(value, 1, 12) from moz_cookies where host like ? or host like '%cloudflare%'",
                (f"%{host.split('.', 1)[-1] if host.count('.') > 1 else host}%",)).fetchall()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return visites, galetes


def passada(url, segons, amb_extensio):
    host = url.split("/")[2]
    perfil = Path(tempfile.mkdtemp(prefix="menja-galetes-cf-"))
    (perfil / "user.js").write_text("\n".join([
        'user_pref("browser.shell.checkDefaultBrowser", false);',
        'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
        'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
        'user_pref("browser.startup.homepage_override.mstone", "ignore");',
        'user_pref("browser.aboutwelcome.enabled", false);',
        'user_pref("browser.ipProtection.enabled", false);',
        'user_pref("intl.locale.requested", "ca");',
        'user_pref("intl.accept_languages", "ca,es,en");',
        'user_pref("devtools.debugger.remote-enabled", true);',
        'user_pref("devtools.chrome.enabled", true);',
        'user_pref("devtools.debugger.prompt-connection", false);',
        'user_pref("places.history.enabled", true);',
    ]))
    env = dict(os.environ, DISPLAY=PANTALLA, MOZ_ENABLE_WAYLAND="0")
    for v in ("WAYLAND_DISPLAY", "MOZ_HEADLESS"):
        env.pop(v, None)
    ordre = ["firefox", "--no-remote", "--profile", str(perfil), "-start-debugger-server", str(PORT_DEP)]
    nom = "amb" if amb_extensio else "sense"
    print(f"\n=== {'AMB' if amb_extensio else 'SENSE'} Menja galetes ===", flush=True)
    ff = subprocess.Popen(ordre + ["about:blank"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        dep = Depurador(PORT_DEP)
        arrel = dep.envia({"to": "root", "type": "getRoot"})
        if amb_extensio:
            r = dep.envia({"to": arrel["addonsActor"], "type": "installTemporaryAddon", "addonPath": str(EXT)})
            print("  Extensió:", r.get("addon", {}).get("id") or r)
            time.sleep(5)   # que miri el país i registri el codi de pàgina
        pestanyes = []
        for _ in range(20):   # la llista surt buida fins que la finestra està a punt
            pestanyes = dep.envia({"to": "root", "type": "listTabs"}).get("tabs") or []
            if pestanyes:
                break
            time.sleep(0.5)
        triada = next((t for t in pestanyes if t.get("selected")), pestanyes[0])
        objectiu = dep.envia({"to": triada["actor"], "type": "getTarget"})["frame"]["actor"]
        dep.envia({"to": objectiu, "type": "navigateTo", "url": url})
        inici = time.time()
        time.sleep(segons)
        CAPTURES.mkdir(exist_ok=True)
        subprocess.run(["import", "-display", PANTALLA, "-window", "root", str(CAPTURES / f"cloudflare-{nom}.png")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        visites, galetes = llegeix_perfil(perfil, host)
        reintents = sum(1 for _, u, _ in visites if "__cf_chl_rt_tk" in u)
        titol = visites[-1][2] if visites else None
        # Ha passat si l'adreça neta (sense __cf_chl) té el títol del web, i no el de la verificació.
        # (cf_clearance no n'és prova: Cloudflare la pot donar i després no acceptar-la.)
        netes = [t for _, u, t in visites if "__cf_chl" not in u]
        passa = bool(netes) and not any(p in (netes[-1] or "").lower() for p in ("moment", "instant", "momento"))
        for d, u, t in visites:
            print(f"  {round(d / 1e6 - inici):4d} s  {(t or '')[:30]:30s} {u[:110]}")
        print(f"  RESULTAT: {'HA PASSAT' if passa else 'ENCALLAT'} al cap de {segons} s."
              f" Reintents de la verificació: {reintents}. Darrer títol: {titol!r}")
        print("  Galetes:", [f"{h} {n}={v}" for h, n, v in galetes])
        return passa
    finally:
        ff.terminate()
        try:
            ff.wait(10)
        except subprocess.TimeoutExpired:
            ff.kill()
        shutil.rmtree(perfil, ignore_errors=True)


def variant(apagats, confianca):
    """Una còpia de l'extensió amb algunes falsificacions apagades o algun web de confiança, per buscar què falla."""
    global EXT
    if not apagats and not confianca:
        return None
    copia = Path(tempfile.mkdtemp(prefix="menja-galetes-cf-ext-"))
    shutil.copytree(ARREL / "extensio", copia / "extensio")
    comu = copia / "extensio" / "lib" / "comu.js"
    text = comu.read_text()
    for clau in apagats:
        nou = text.replace(f"{clau}: true,", f"{clau}: false,", 1)
        if nou == text:
            raise SystemExit(f"no hi ha «{clau}» a PER_DEFECTE.falseja")
        text = nou
    for web in confianca:
        text = text.replace('  confianca: [\n', f'  confianca: [\n    "{web}",\n', 1)
    comu.write_text(text)
    EXT = copia / "extensio"
    return copia


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opcions = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    url = args[0]
    segons = int(args[1]) if len(args) > 1 else 40
    quines = args[2] if len(args) > 2 else "totes"
    # --apaga=navegador,empremta…  --confianca=web.org
    copia = variant([c for c in opcions.get("apaga", "").split(",") if c],
                    [c for c in opcions.get("confianca", "").split(",") if c])
    if "ext" in opcions:   # --ext=<carpeta>: una còpia de l'extensió retocada a mà
        global EXT
        EXT = Path(opcions["ext"]).resolve()
    if copia or "ext" in opcions:
        print("Variant:", opcions)
    xvfb = subprocess.Popen(["Xvfb", PANTALLA, "-screen", "0", "1280x900x24", "-nolisten", "tcp"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        if quines in ("sense", "totes"):
            passada(url, segons, False)
        if quines in ("amb", "totes"):
            passada(url, segons, True)
    finally:
        xvfb.terminate()
        if copia:
            shutil.rmtree(copia, ignore_errors=True)


if __name__ == "__main__":
    main()
