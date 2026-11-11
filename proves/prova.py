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
      "www.paypal.com": true, "web.gencat.cat": true, "www.diari-exemple.cat": false, "www.lavanguardia.com": false,
      "www.bankofamerica.com": true, "www.irs.gov": true, "www.gov.uk": true, "www.impots.gouv.fr": true, "www.sparkasse.de": true,
      "www.e-tax.nta.go.jp": true, "ajuntament.barcelona.cat": true, "www.canada.ca": true, "govee.com": false, "www.booking.com": false};
    for (const [h, esperat] of Object.entries(casos)) console.log(h, MG.esSempreReal(h) === esperat ? "OK" : "FALLA");"""
    codi += """
    ;const xarxes = {"www.instagram.com": true, "web.whatsapp.com": true, "www.tiktok.com": true, "www.roblox.com": true,
      "tinder.com": true, "www.lavanguardia.com": false};
    for (const [h, esperat] of Object.entries(xarxes)) console.log("xarxa:" + h, MG.esIdentitatReal(h) === esperat ? "OK" : "FALLA");
    for (const h of ["www.facebook.com", "www.instagram.com"]) console.log("no-protegit:" + h, MG.esProtegitFrau(h) ? "FALLA" : "OK");
    const iguals = {
      "lloc:a.github.io": [MG.lloc("a.github.io"), "a.github.io"],
      "lloc:www.servicos.gov.br": [MG.lloc("www.servicos.gov.br"), "servicos.gov.br"],
      "lloc:x.y.blogspot.com": [MG.lloc("x.y.blogspot.com"), "y.blogspot.com"],
      "lloc:www.bbc.co.uk": [MG.lloc("www.bbc.co.uk"), "bbc.co.uk"],
      "netejaUrl:codificació": [MG.netejaUrl("https://x.test/p?q=a%20b+c&utm_source=x&fbclid=1&n=%C3%A0#h"), "https://x.test/p?q=a%20b+c&n=%C3%A0#h"],
      "netejaUrl:sense res a treure": [MG.netejaUrl("https://x.test/p?id=5"), null],
      "seguiment:UID": [MG.esSeguiment("UID", "diari.test"), false],
      "seguiment:datr a instagram": [MG.esSeguiment("datr", "www.instagram.com"), false],
      "seguiment:datr a un diari": [MG.esSeguiment("datr", "diari.test"), true],
      "seguiment:bcookie a linkedin": [MG.esSeguiment("bcookie", "www.linkedin.com"), false],
      "seguiment:_ga a instagram": [MG.esSeguiment("_ga", "www.instagram.com"), true],
    };
    for (const [nom, [es, esperat]] of Object.entries(iguals))
      console.log("unitat:" + nom, es === esperat ? "OK" : "FALLA(" + JSON.stringify(es) + ")");"""
    sortida = subprocess.run(["node", "-e", codi], capture_output=True, text=True).stdout.split("\n")
    for l in filter(None, sortida):
        host, r = l.rsplit(" ", 1)
        comprova(f"peces comunes: {host}", r == "OK", "" if r == "OK" else r)


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
        'user_pref("network.stricttransportsecurity.preloadlist", false);',   # que www.instagram.com vagi per http al servidor local
        'user_pref("browser.ipProtection.enabled", false);',
        'user_pref("intl.locale.requested", "ca");',
        'user_pref("intl.accept_languages", "ca,es,en");',
        # Noms de prova que van al servidor local (no surt res a internet)
        'user_pref("network.dns.localDomains", "diari.test,www.bancprova.test,www.prova.gob.es,botiga.test,'
        'h.online-metrix.net,empresa.test,www.instagram.com,revista.test,amagat.test,bucle.test,static.hotjar.com,us1.list-manage.com,l.facebook.com,vell.test");',
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
        comprova("WebRTC: la IP del candidat és la falsa, i de ningú", "83.45.10.20" not in str(info.get("rtc"))
                 and " 100." in str(info.get("rtc")), info.get("rtc"))
        comprova("WebGL: gràfica de la disfressa", "or similar" in str(info.get("webgl")) and "ANGLE" in str(info.get("webgl"))
                 or "Apple" in str(info.get("webgl")) or "sense" in str(info.get("webgl")), info.get("webgl"))

        # La mateixa disfressa en tornar-hi
        m.ves(f"{WEB}/primera")
        info2 = info_pagina(m)
        comprova("en tornar-hi, la mateixa disfressa", info2.get("userAgent") == info.get("userAgent")
                 and info2.get("screen") == info.get("screen"))
        comprova("en tornar-hi, el mateix _ga fals", ("_ga=" + ga[0]["value"]) in info2.get("cookie", "") if ga else False)

        # ---- 2b. Els identificadors dels enllaços ----
        m.ves(f"{WEB}/simple?fbclid=IwAR0abc&utm_source=newsletter&gclid=Cj0K&id=5")
        time.sleep(0.5)
        net = m.js("return location.href;")
        comprova("enllaç: fbclid, gclid i utm_ fora; id=5 es queda", net == f"{WEB}/simple?id=5", net)
        m.ves(f"{WEB}/primera")                      # la finestreta (prova 5) mira aquesta pestanya

        # ---- 3. Capçaleres ----
        print("\n3. Les capçaleres")
        m.pestanya_nova()
        m.ves(f"{WEB}/eco")
        eco = json.loads(m.js("return document.body.textContent;"))
        comprova("User-Agent de la capçalera = el de la pàgina", eco.get("User-Agent") == info.get("userAgent"),
                 eco.get("User-Agent"))
        comprova("Accept-Language en castellà", eco.get("Accept-Language", "").startswith("es"), eco.get("Accept-Language"))
        xff = eco.get("X-Forwarded-For", "0.0.0.0").split(".")
        comprova("X-Forwarded-For: una IP de ningú (100.64.0.0/10)", xff[0] == "100" and 64 <= int(xff[1]) <= 127,
                 eco.get("X-Forwarded-For"))
        m.ves(f"{WEB}/sw-prova")
        swi = {}
        for _ in range(20):
            time.sleep(0.3)
            swi = info_pagina(m)
            if swi.get("sw") or swi.get("error"):
                break
        comprova("les peticions del service worker porten la mateixa disfressa", swi.get("sw") == info.get("userAgent"),
                 swi.get("sw") or swi.get("error"))

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
        comprova("la finestreta ensenya la IP de debò", "192.0.2.1" in text)
        comprova("i la ubicació que diu la IP (Espanya, a prop de Barcelona)", "Espanya, a prop de Barcelona" in text)
        comprova("i els codis de l'empremta (fals i de debò)", text.count("·") >= 2 and "Empremta: el codi" in text)
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

        # ---- 7b. L'hora del Japó, els marcs i els treballadors ----
        print("\n7b. L'hora del Japó, els marcs amagats i els treballadors")
        m.ves(f"{WEB}/pais?posa=JP")
        print("   ", missatge(m, uuid, {"tipus": "comprovaPais"}))
        m.ves(f"{WEB}/zona")
        z = info_pagina(m)
        print("   ", json.dumps(z, ensure_ascii=False))
        comprova("getTimezoneOffset del Japó (-540)", z.get("offset") == -540, z.get("offset"))
        comprova("new Date(…10:30).getHours() torna 10", z.get("hores") == 10, z.get("hores"))
        comprova("i en UTC són la 1", z.get("utc") == 1, z.get("utc"))
        comprova("Date.parse sense zona, com a hora del Japó", z.get("parse") is True)
        comprova("el text de la data diu GMT+0900", "GMT+0900" in str(z.get("text")), z.get("text"))
        comprova("Intl: Asia/Tokyo", z.get("intl") == "Asia/Tokyo", z.get("intl"))
        comprova("Intl: idioma japonès", str(z.get("locale")).startswith("ja"), z.get("locale"))
        comprova("toLocaleTimeString, a l'hora del Japó", z.get("local") == "10:30:00", z.get("local"))
        comprova("Temporal: Asia/Tokyo", z.get("temporal") in ("Asia/Tokyo", "sense Temporal"), z.get("temporal"))
        comprova("Date() com a funció, GMT+0900", z.get("dateFn") is True)
        comprova("instanceof Date continua anant bé", z.get("instanceof") is True)
        comprova("setHours a l'hora del Japó", z.get("setHours") is True)

        m.ves(f"{WEB}/marcs")
        mc = info_pagina(m)
        print("   ", json.dumps(mc, ensure_ascii=False)[:400])
        comprova("marc nou: el mateix navegador falsejat", mc.get("marc") == mc.get("top") and "Linux" not in str(mc.get("marc")))
        comprova("window[0]: plataforma falsa", mc.get("index") in ("Win32", "MacIntel"), mc.get("index"))
        comprova("marc nou: zona del Japó", mc.get("zonaMarc") == "Asia/Tokyo", mc.get("zonaMarc"))
        comprova("marc posat amb innerHTML, també", mc.get("innerHTML") == mc.get("top"))
        comprova("galeta posada des d'un marc, menjada", "GA1.1.444444444" not in str(mc.get("cookieMarc")), mc.get("cookieMarc"))

        m.ves(f"{WEB}/treballadors")
        tr = {}
        for _ in range(20):
            time.sleep(0.3)
            tr = info_pagina(m)
            if tr.get("fitxer") and tr.get("blob") and tr.get("compartit"):
                break
        print("   ", json.dumps(tr, ensure_ascii=False)[:600])
        for qui in ("fitxer", "blob", "compartit"):
            t = tr.get(qui) or {}
            comprova(f"treballador ({qui}): navegador falsejat", isinstance(t, dict) and t.get("ua") == tr.get("top"), t.get("ua") if isinstance(t, dict) else t)
            comprova(f"treballador ({qui}): zona i idioma del Japó", isinstance(t, dict) and t.get("zona") == "Asia/Tokyo"
                     and t.get("offset") == -540 and str(t.get("idioma")).startswith("ja"))

        # ---- 8. Webs de confiança ----
        print("\n8. Web de confiança")
        print("   ", missatge(m, uuid, {"tipus": "confia", "lloc": "localhost", "si": True, "tabId": -1}))
        time.sleep(0.5)
        m.ves(f"{WEB}/primera")
        info4 = info_pagina(m)
        comprova("al web de confiança, sense disfressa", "Linux" in info4.get("userAgent", ""), info4.get("userAgent"))
        gs = galetes(m)
        ga = [g for g in gs if g["name"] == "_ga" and g["host"] == "localhost"]
        comprova("però la _ga (de Google), menjada igualment", ga and ga[0]["value"] != "GA1.1.111111111.1700000000",
                 ga and ga[0]["value"])
        ses = [g for g in gs if g["name"] == "sessio" and g["host"] == "localhost"]
        comprova("i la sessió del web de confiança, tal qual", ses and ses[0]["value"] == "abc123")

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

        # ---- 10. Bancs, governs i sistemes contra el frau de tot el món ----
        print("\n10. Bancs i governs de tot el món")
        def simple(url, recarrega=False):
            m.ves(url)
            inf = {}
            for _ in range(25):
                time.sleep(0.3)
                inf = info_pagina(m)
                if not recarrega or inf.get("carrega", 0) >= 2:
                    break
            return inf
        a = simple("http://diari.test:8765/simple?marc=localhost")
        time.sleep(1)
        comprova("un diari qualsevol: disfressat", "Linux" not in a.get("userAgent", "Linux"), a.get("userAgent"))
        gs = galetes(m)
        ide = [g for g in gs if g["name"] == "IDE" and g["host"] == "localhost" and "diari.test" in (g["partition"] or "")]
        comprova("un web de confiança dins d'un altre: les seves galetes, menjades", ide and ide[0]["value"] != "AHWqTUmREALREAL123",
                 ide and f"{ide[0]['value']} · {ide[0]['partition']}")
        b = simple("http://www.bancprova.test:8765/simple?marc=1")
        time.sleep(1)
        comprova("un banc pel nom: navegador de debò", "Linux" in b.get("userAgent", ""), b.get("userAgent"))
        comprova("la galeta de sessió del banc, tal qual", "sessio=banc123" in b.get("cookie", ""), b.get("cookie"))
        comprova("la _ga (de Google) al banc, menjada", "GA1.1.111111111" not in b.get("cookie", "x"), b.get("cookie"))
        gs = galetes(m)
        ide = [g for g in gs if g["name"] == "IDE" and "bancprova" in (g["partition"] or "")]
        comprova("les galetes de tercers al banc, menjades", ide and ide[0]["value"] != "AHWqTUmREALREAL123",
                 ide and f"{ide[0]['value']} · {ide[0]['partition']}")
        c = simple("http://www.prova.gob.es:8765/simple")
        comprova("un govern (.gob.es): navegador de debò", "Linux" in c.get("userAgent", ""), c.get("userAgent"))
        simple("http://botiga.test:8765/antifrau")
        time.sleep(1.5)                       # la pàgina es torna a carregar sola
        e = info_pagina(m)
        comprova("una botiga amb sistema contra el frau: navegador de debò", "Linux" in e.get("userAgent", ""), e.get("userAgent"))
        x = simple("http://www.instagram.com:8765/simple?marc=1")
        time.sleep(1)
        comprova("una xarxa social: navegador de debò", "Linux" in x.get("userAgent", ""), x.get("userAgent"))
        comprova("la sessió de la xarxa, tal qual", "sessio=banc123" in x.get("cookie", ""), x.get("cookie"))
        comprova("la _ga a la xarxa, menjada", "GA1.1.111111111" not in x.get("cookie", "x"), x.get("cookie"))
        gs = galetes(m)
        ide = [g for g in gs if g["name"] == "IDE" and "instagram" in (g["partition"] or "")]
        comprova("les galetes de tercers a la xarxa, menjades", ide and ide[0]["value"] != "AHWqTUmREALREAL123",
                 ide and f"{ide[0]['value']} · {ide[0]['partition']}")
        m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
        m.js_async("const f = arguments[arguments.length-1]; (window.wrappedJSObject||window).browser.storage.local.set({provaOrganitzacio: {'empresa.test': 'Banco de Prova S.A.'}}).then(() => f('ok'))")
        g = simple("http://empresa.test:8765/simple")
        comprova("certificat d'un banc: navegador de debò ja a la primera", "Linux" in g.get("userAgent", "") and g.get("carrega") == 1,
                 f"{g.get('userAgent')} · càrregues: {g.get('carrega')}")

        # ---- 11. Les correccions de la revisió del 10/11/2026 ----
        print("\n11. Les correccions de la revisió")
        m.ves("http://revista.test:8765/marc-entrada")
        time.sleep(4)
        r = info_pagina(m)
        comprova("marc d'un altre web amb contrasenya i sense «referrer»: cap bucle de recàrregues", r.get("carrega", 99) <= 2,
                 f"càrregues: {r.get('carrega')}")
        m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
        ra = json.loads(m.js_async("const f = arguments[arguments.length-1]; (window.wrappedJSObject||window).browser.storage.local"
                                   ".get('realAuto').then(s => f(JSON.stringify(s.realAuto || [])))"))
        comprova("i a la llista automàtica no hi ha cap «atzar:»", not any("atzar" in x for x in ra), ", ".join(ra))
        simple("http://diari.test:8765/simple?plataforma=1")
        m.js("location.href = 'http://amagat.test:8765/res'; return 1;")
        time.sleep(4.5)                                # retardMenjar és 2 s a les proves
        gs = galetes(m)
        ses = [g for g in gs if g["name"] == "sessio" and "diari.test" in g["host"]]
        comprova("una baixada (resposta 204) no fa menjar les galetes del web obert", ses and ses[0]["value"] == "banc123",
                 ses and ses[0]["value"])
        uid = [g for g in gs if g["name"] == "UID" and "diari.test" in g["host"]]
        comprova("UID (un nom genèric) no es toca", uid and uid[0]["value"] == "uid-real-1", uid and uid[0]["value"])
        simple("http://www.instagram.com:8765/simple?plataforma=1")
        gs = galetes(m)
        datr = [g for g in gs if g["name"] == "datr" and "instagram" in g["host"]]
        comprova("datr (contra els comptes falsos) a la mateixa xarxa, tal qual", datr and datr[0]["value"] == "DATRREAL123",
                 datr and datr[0]["value"])

        # ---- 12. L'hàmster ----
        print("\n12. «Menja-te-les totes ara»: l'hàmster")
        simple("http://diari.test:8765/simple")
        m.js("document.body.dataset.abans = '1'; return 1;")
        diari = m.ordre("WebDriver:GetWindowHandle")
        diari = diari["value"] if isinstance(diari, dict) else diari
        m.pestanya_nova()
        m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
        resp = m.js_async("""
          const f = arguments[arguments.length - 1];
          const b = (window.wrappedJSObject || window).browser;
          b.tabs.query({}).then(ts => {
            const t = ts.find(t => (t.url || "").includes("diari.test"));
            return b.runtime.sendMessage({tipus: "menjaAra", lloc: "diari.test", tabId: t.id});
          }).then(r => f(JSON.stringify(r)), e => f("error " + e));""")
        m.tanca()
        m.canvia(diari)
        vist = False
        for _ in range(30):
            if m.js("return !!document.getElementById('menja-galetes-monstre');"):
                vist = True
                break
            time.sleep(0.1)
        comprova("surt l'hàmster", vist, resp)
        time.sleep(1.6)
        (CAPTURES / "monstre.png").write_bytes(base64.b64decode(m.captura()))
        time.sleep(3.2)
        (CAPTURES / "monstre-bombolla.png").write_bytes(base64.b64decode(m.captura()))
        recarregada = False
        for _ in range(40):
            time.sleep(0.25)
            try:
                if m.js("return document.body && !document.body.dataset.abans && !document.getElementById('menja-galetes-monstre');"):
                    recarregada = True
                    break
            except Exception:
                pass
        comprova("quan marxa, la pàgina es torna a carregar (i l'hàmster ja no hi és)", recarregada)

        # ---- 13. Un web que la disfressa fa tornar boig ----
        print("\n13. Un web que es torna a carregar sense parar")
        m.ves("http://bucle.test:8765/bucle")
        b = {}
        for _ in range(30):
            time.sleep(0.4)
            b = info_pagina(m)
            if "Linux" in b.get("userAgent", ""):
                break
        time.sleep(1.5)
        b2 = info_pagina(m)
        comprova("el web que es tornava a carregar sense parar, ara sense disfressa", "Linux" in b2.get("userAgent", ""),
                 f"{b2.get('userAgent')} · càrregues {b2.get('carrega')}")
        comprova("i ja no es torna a carregar", b2.get("carrega", 99) < 15 and b2.get("carrega") == info_pagina(m).get("carrega"),
                 f"càrregues {b2.get('carrega')}")

        # ---- 14. Les idees de l'11/11/2026 ----
        print("\n14. Gravadors, espies, rebots, GPC, galetes velles i el resum")
        principal = m.ordre("WebDriver:GetWindowHandle")
        principal = principal["value"] if isinstance(principal, dict) else principal

        def en_una_altra(codi):
            """Fa una cosa des d'una pàgina de l'extensió, en una pestanya a part, i hi torna."""
            m.pestanya_nova()
            m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
            r = m.js_async("const f = arguments[arguments.length - 1]; const b = (window.wrappedJSObject || window).browser;"
                           "Promise.resolve().then(() => " + codi + ").then((r) => f(JSON.stringify(r === undefined ? null : r)),"
                           " (e) => f(JSON.stringify('error ' + e)));")
            m.tanca()
            m.canvia(principal)
            return json.loads(r)

        g = simple("http://diari.test:8765/gpc")
        comprova("GPC: la pàgina veu navigator.globalPrivacyControl", g.get("gpc") is True, g)
        m.ves("http://diari.test:8765/eco")
        eco14 = json.loads(m.js("return document.body.textContent;"))
        comprova("GPC: el web rep Sec-GPC: 1", eco14.get("Sec-GPC") == "1", eco14.get("Sec-GPC"))
        gr = simple("http://diari.test:8765/gravador")
        for _ in range(10):
            if gr.get("control") is not None:
                break
            time.sleep(0.3)
            gr = info_pagina(m)
        comprova("el gravador de sessió (Hotjar) no s'ha carregat, i l'script normal sí", gr.get("gravador") is False and gr.get("control") is True, gr)
        m.ves("http://diari.test:8765/correu")
        cor = info_pagina(m)
        comprova("l'espia del correu (Mailchimp) no s'ha carregat, i la imatge normal sí", cor.get("espia") == "error" and cor.get("normal") == "load", cor)
        m.pestanya_nova()
        m.ordre("WebDriver:SetWindowRect", {"width": 440, "height": 2400})
        m.ves(f"moz-extension://{uuid}/finestreta/finestreta.html?web=http://diari.test:8765/correu")
        time.sleep(1.2)
        (CAPTURES / "finestreta-noves.png").write_bytes(base64.b64decode(m.captura_element("body")))
        text14 = m.js("return document.body.innerText;")
        m.ordre("WebDriver:SetWindowRect", {"width": 700, "height": 2600})
        m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
        time.sleep(0.8)
        (CAPTURES / "opcions-noves.png").write_bytes(base64.b64decode(m.captura_element("main")))
        m.ordre("WebDriver:SetWindowRect", {"width": 1280, "height": 900})
        m.tanca()
        m.canvia(principal)
        comprova("la finestreta diu que el web et volia gravar (Hotjar)", "Aquest web et volia gravar" in text14 and "Hotjar" in text14)
        comprova("i quants espies de correu s'ha menjat", "de correu menjat" in text14 and "Mailchimp" in text14)
        comprova("i el resum de la setmana", "aquesta setmana" in text14.lower() and "m'he menjat" in text14.lower())
        m.ves("http://l.facebook.com:8765/l.php?u=http%3A%2F%2Fdiari.test%3A8765%2Fsimple%3Fid%3D7%26utm_source%3Dfb&h=AT0x")
        time.sleep(1)
        url14 = m.js("return location.href;")
        comprova("rebot de Facebook: directament al web, sense el comptador ni utm_", url14 == "http://diari.test:8765/simple?id=7", url14)
        simple("http://diari.test:8765/simple")
        v14 = en_una_altra('b.cookies.set({url: "http://vell.test:8765/", name: "antiga", value: "1", expirationDate: Date.now() / 1000 + 86400 * 365})'
                           '.then(() => b.storage.local.get("protegides"))'
                           '.then((s) => b.storage.local.set({protegides: [...(s.protegides || []), "vell.test|antiga", "diari.test|sessio"]}))'
                           '.then(() => b.runtime.sendMessage({tipus: "menjaVelles", ara: Date.now() + 40 * 864e5}))')
        gs = galetes(m)
        comprova("galetes velles: les d'un web on no vas fa 40 dies, menjades", not any(x["name"] == "antiga" for x in gs), v14)
        comprova("però les d'un web obert es queden", any(x["name"] == "sessio" and "diari.test" in x["host"] for x in gs))
        time.sleep(2)
        rs = en_una_altra('b.storage.local.get("resum").then((s) => s.resum)') or {}
        comprova("el resum compta galetes, gravadors, espies i rebots",
                 rs.get("galetes", 0) > 0 and rs.get("gravadors", 0) >= 1 and rs.get("espies", 0) >= 1 and rs.get("rebots", 0) >= 1
                 and rs.get("empreses", {}).get("Google", 0) > 0, rs)
        en_una_altra('b.runtime.sendMessage({tipus: "senseDisfressa", lloc: "diari.test", minuts: 1})')
        t14 = simple("http://diari.test:8765/simple")
        comprova("«Compara-la sense disfressa»: el web va sense disfressa una estona", "Linux" in t14.get("userAgent", ""), t14.get("userAgent"))
        if not all(ok for _, ok, _ in resultats):
            # Si alguna falla: els errors de l'extensió que ha vist el Firefox.
            m.context("chrome")
            errs = m.js("""return Services.console.getMessageArray().map((x) => x.message || String(x))
              .filter((t) => /moz-extension|menja/i.test(t)).slice(-12);""")
            print("\nErrors de l'extensió:\n  " + "\n  ".join(e[:300] for e in errs or ["cap"]))
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
