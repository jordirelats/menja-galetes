#!/usr/bin/env python3
"""Prova l'extensió en un Firefox a part (perfil nou, sense finestra) amb el servidor local.

    python3 proves/prova.py            # fa les proves i desa captures a proves/captures/

No toca el teu perfil: el Firefox s'obre amb --no-remote i un perfil temporal.
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from marionette import Marionette  # noqa: E402
import servidor  # noqa: E402

EXT = AQUI.parent / "extensio"
CAPTURES = AQUI / "captures"
ID = "menja-galetes@jordirelats"
PORT_M = 28290
WEB = "http://localhost:8765"

resultats = []


def comprova(nom, ok, detall=""):
    resultats.append((nom, bool(ok), detall))
    print(("  OK   " if ok else "  FALLA") + f"  {nom}" + (f"  ·  {detall}" if detall else ""))


def galetes(m):
    m.context("chrome")
    r = m.js("""
      const out = [];
      for (const c of Services.cookies.cookies) out.push({host: c.host, name: c.name, value: c.value,
        session: c.isSession, partition: c.originAttributes.partitionKey});
      return out;""")
    m.context("content")
    return r


def info_pagina(m):
    for _ in range(40):
        t = m.js("const e = document.getElementById('info'); return e ? e.textContent : null;")
        if t and t != "...":
            return json.loads(t)
        time.sleep(0.25)
    return {}


def missatge(m, uuid, msg):
    """Envia un missatge al fons des d'una pàgina de l'extensió."""
    m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
    return m.js_async("""
      const fet = arguments[arguments.length - 1];
      (window.wrappedJSObject || window).browser.runtime.sendMessage(arguments[0]).then(r => fet(JSON.stringify(r || null)), e => fet('error ' + e));
    """, msg)


def posa_config(m, uuid, canvis):
    m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
    return m.js_async("""
      const fet = arguments[arguments.length - 1];
      const b = (window.wrappedJSObject || window).browser;
      b.storage.local.get('config').then(s => {
        const c = Object.assign(s.config || {}, arguments[0]);
        return b.storage.local.set({config: c});
      }).then(() => fet('ok'), e => fet('error ' + e));
    """, canvis)


def prova_llista_fixa():
    """Els bancs, els pagaments i l'Administració: sempre amb la identitat real."""
    codi = (EXT / "lib" / "comu.js").read_text() + """
    ;const casos = {"sede.agenciatributaria.gob.es": true, "www.caixabank.es": true, "checkout.stripe.com": true,
      "www.paypal.com": true, "web.gencat.cat": true, "www.diari-exemple.cat": false, "www.lavanguardia.com": false};
    for (const [h, esperat] of Object.entries(casos)) console.log(h, MG.esSempreReal(MG.lloc(h)) === esperat ? "OK" : "FALLA");"""
    sortida = subprocess.run(["node", "-e", codi], capture_output=True, text=True).stdout.split("\n")
    for l in filter(None, sortida):
        host, r = l.rsplit(" ", 1)
        comprova(f"llista fixa: {host}", r == "OK")


def main():
    CAPTURES.mkdir(exist_ok=True)
    print("0. La llista fixa")
    prova_llista_fixa()
    srv = servidor.engega()
    perfil = Path(tempfile.mkdtemp(prefix="menja-galetes-perfil-"))
    (perfil / "user.js").write_text("\n".join([
        f'user_pref("marionette.port", {PORT_M});',
        'user_pref("browser.shell.checkDefaultBrowser", false);',
        'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
        'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
        'user_pref("browser.startup.homepage_override.mstone", "ignore");',
        'user_pref("browser.aboutwelcome.enabled", false);',
        'user_pref("network.dns.disableIPv6", true);',
        'user_pref("browser.ipProtection.enabled", false);',
        'user_pref("intl.locale.requested", "ca");',
        'user_pref("intl.accept_languages", "ca,es,en");',
    ]))
    env = dict(os.environ, MOZ_HEADLESS="1")
    ff = subprocess.Popen(["firefox", "--headless", "--marionette", "-remote-allow-system-access", "--no-remote", "--profile", str(perfil)],
                          env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        m = Marionette(PORT_M)
        m.ordre("WebDriver:SetWindowRect", {"width": 1280, "height": 900})
        m.ordre("Addon:Install", {"path": str(EXT), "temporary": True})
        m.context("chrome")
        uuid = m.js(f"return WebExtensionPolicy.getByID('{ID}').mozExtensionHostname;")
        m.context("content")
        print("Extensió instal·lada:", uuid)
        time.sleep(2)

        posa_config(m, uuid, {"urlPais": f"{WEB}/pais", "retardMenjar": 2})
        time.sleep(0.5)
        print("País:", missatge(m, uuid, {"tipus": "comprovaPais"}))

        # ---- 1. La primera galeta ----
        print("\n1. La primera galeta")
        principal = m.handles()[0]
        m.canvia(principal)
        m.ves(f"{WEB}/primera")
        info = info_pagina(m)
        time.sleep(1)
        gs = galetes(m)
        ga = [g for g in gs if g["name"] == "_ga" and g["host"] == "localhost"]
        comprova("_ga (per capçalera) no és la de debò", ga and ga[0]["value"] != "GA1.1.111111111.1700000000",
                 ga and ga[0]["value"])
        comprova("_ga és de sessió (sense caducitat)", ga and ga[0]["session"])
        fbp = [g for g in gs if g["name"] == "_fbp"]
        comprova("_fbp (per JavaScript) no és la de debò", fbp and fbp[0]["value"] != "fb.1.1700000000000.222222222",
                 fbp and fbp[0]["value"])
        comprova("_fbp és de sessió", fbp and fbp[0]["session"])
        ses = [g for g in gs if g["name"] == "sessio"]
        comprova("sessio (de funcionament) es queda igual", ses and ses[0]["value"] == "abc123")
        comprova("sessio passa a ser de sessió", ses and ses[0]["session"])
        pref = [g for g in gs if g["name"] == "preferencia"]
        comprova("preferencia (JS, de funcionament) es queda", pref and pref[0]["value"] == "fosc")
        ide = [g for g in gs if g["name"] == "IDE"]
        comprova("IDE (de tercers) no és la de debò", ide and ide[0]["value"] != "AHWqTUmREALREAL123",
                 ide and f"{ide[0]['value']} · partició {ide[0]['partition']}")
        ga3 = [g for g in gs if g["name"] == "_ga" and g["host"] != "localhost"]
        comprova("_ga del marc de tercers no és la de debò", ga3 and ga3[0]["value"] != "GA1.1.333333333.1700000000",
                 ga3 and ga3[0]["value"])
        comprova("document.cookie del web porta la falsa", "GA1.1.111111111" not in info.get("cookie", "x"),
                 info.get("cookie"))

        # ---- 2. La disfressa ----
        print("\n2. La disfressa (el que veu la pàgina)")
        print("   ", json.dumps(info, ensure_ascii=False)[:600])
        comprova("userAgent no diu Linux", "Linux" not in info.get("userAgent", "Linux"), info.get("userAgent"))
        comprova("platform és Win32 o MacIntel", info.get("platform") in ("Win32", "MacIntel"), info.get("platform"))
        comprova("idioma de la disfressa (castellà)", (info.get("languages") or [""])[0].startswith("es"),
                 info.get("languages"))
        comprova("Intl.locale també", str(info.get("locale", "")).startswith("es"), info.get("locale"))
        comprova("zona horària d'Espanya", info.get("zona") == "Europe/Madrid", info.get("zona"))
        comprova("nuclis falsos", info.get("nuclis") in (4, 8, 12, 16), info.get("nuclis"))
        comprova("canvas: el mateix soroll dues vegades", info.get("canvas1") == info.get("canvas2"))
        comprova("WebRTC: la IP del candidat és la falsa", "83.45.10.20" not in str(info.get("rtc")), info.get("rtc"))
        comprova("WebGL: gràfica de la disfressa", "or similar" in str(info.get("webgl")) and "ANGLE" in str(info.get("webgl"))
                 or "Apple" in str(info.get("webgl")) or "sense" in str(info.get("webgl")), info.get("webgl"))

        # La mateixa disfressa en tornar-hi
        m.ves(f"{WEB}/primera")
        info2 = info_pagina(m)
        comprova("en tornar-hi, la mateixa disfressa", info2.get("userAgent") == info.get("userAgent")
                 and info2.get("screen") == info.get("screen"))
        comprova("en tornar-hi, el mateix _ga fals", ("_ga=" + ga[0]["value"]) in info2.get("cookie", "") if ga else False)

        # ---- 3. Capçaleres ----
        print("\n3. Les capçaleres")
        m.pestanya_nova()
        m.ves(f"{WEB}/eco")
        eco = json.loads(m.js("return document.body.textContent;"))
        comprova("User-Agent de la capçalera = el de la pàgina", eco.get("User-Agent") == info.get("userAgent"),
                 eco.get("User-Agent"))
        comprova("Accept-Language en castellà", eco.get("Accept-Language", "").startswith("es"), eco.get("Accept-Language"))
        comprova("X-Forwarded-For amb una IP falsa", bool(eco.get("X-Forwarded-For")), eco.get("X-Forwarded-For"))

        # ---- 4. L'avís de galetes ----
        print("\n4. L'avís de galetes")
        m.ves(f"{WEB}/avis")
        estat = None
        for _ in range(20):
            time.sleep(0.3)
            estat = m.js("return document.getElementById('estat').textContent;")
            if estat != "sense resposta":
                break
        comprova("ha acceptat l'avís per tu", estat == "acceptat", estat)

        # ---- 5. La finestreta ----
        print("\n5. La finestreta")
        m.ves(f"moz-extension://{uuid}/finestreta/finestreta.html?web={WEB}/primera")
        time.sleep(1.2)
        png = m.captura_element("body")
        (CAPTURES / "finestreta.png").write_bytes(base64.b64decode(png))
        text = m.js("return document.body.innerText;")
        comprova("la finestreta diu «Primera galeta: menjada»", "Primera galeta: menjada" in text)
        m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
        time.sleep(0.8)
        png = m.captura_element("main")
        (CAPTURES / "opcions.png").write_bytes(base64.b64decode(png))

        # ---- 6. En tancar la pestanya ----
        print("\n6. En tancar la pestanya, se les menja")
        m.tanca()                                      # la pestanya de l'eco / finestreta
        m.canvia(principal)
        m.ves("about:blank")                           # deixem el web: ja no és obert enlloc
        time.sleep(4)
        gs = galetes(m)
        queden = [f"{g['host']}:{g['name']}" for g in gs if "localhost" in g["host"] or "localhost" in (g["partition"] or "")]
        comprova("no queda cap galeta de localhost", not queden, ", ".join(queden))

        # ---- 7. Canvi de país ----
        print("\n7. Si la IP canvia de país")
        m.ves(f"{WEB}/pais?posa=DE")
        print("   ", missatge(m, uuid, {"tipus": "comprovaPais"}))
        m.ves(f"{WEB}/primera")
        info3 = info_pagina(m)
        comprova("la disfressa ara és d'Alemanya", (info3.get("languages") or [""])[0].startswith("de"), info3.get("languages"))
        comprova("i la zona horària, Europe/Berlin", info3.get("zona") == "Europe/Berlin", info3.get("zona"))

        # ---- 8. Webs de confiança ----
        print("\n8. Web de confiança")
        print("   ", missatge(m, uuid, {"tipus": "confia", "lloc": "localhost", "si": True, "tabId": -1}))
        time.sleep(0.5)
        m.ves(f"{WEB}/primera")
        info4 = info_pagina(m)
        comprova("al web de confiança, sense disfressa", "Linux" in info4.get("userAgent", ""), info4.get("userAgent"))
        gs = galetes(m)
        ga = [g for g in gs if g["name"] == "_ga" and g["host"] == "localhost"]
        comprova("i la _ga hi queda tal qual", ga and ga[0]["value"] == "GA1.1.111111111.1700000000")

        # ---- 9. Pàgines amb contrasenya ----
        print("\n9. Una pàgina amb contrasenya va sense disfressa")
        m.ves("http://127.0.0.1:8765/entrada")
        info5 = {}
        for _ in range(30):
            time.sleep(0.3)
            info5 = info_pagina(m)
            if info5.get("carrega", 0) >= 2:
                break
        comprova("s'ha tornat a carregar sola", info5.get("carrega", 0) >= 2, f"càrregues: {info5.get('carrega')}")
        comprova("i ara amb el navegador de debò", "Linux" in info5.get("userAgent", ""), info5.get("userAgent"))
    finally:
        try:
            ff.terminate()
            ff.wait(10)
        except Exception:
            ff.kill()
        srv.shutdown()
        shutil.rmtree(perfil, ignore_errors=True)

    bons = sum(1 for _, ok, _ in resultats if ok)
    print(f"\n{bons} de {len(resultats)} proves bé")
    return 0 if bons == len(resultats) else 1


if __name__ == "__main__":
    sys.exit(main())
