#!/usr/bin/env python3
"""Proves de Menja galetes al Firefox d'Android, en un mòbil virtual (l'emulador d'Android) d'aquest ordinador.

    python3 proves/prova-android.py

Cal:
- l'SDK d'Android a ~/Android/Sdk, amb l'emulador i la imatge android-35/default/x86_64;
- el mòbil virtual «menja-galetes» (~/.android/avd), de 1080×2340 a 480 ppp: 360×780 px CSS, com un Samsung Galaxy;
- el Firefox per a Android oficial a construit/android/ (fenix-<versió>.multi.android-x86_64.apk, de Mozilla).

Si el mòbil virtual no és engegat, l'engega sense finestra i, en acabar, l'apaga. A cada passada s'esborren
les galetes i les dades dels webs del Firefox, però no el perfil: la primera vegada que s'obre, el Firefox
demana acceptar les seves condicions d'ús, i això ho ha de decidir qui fa les proves (al mòbil virtual de l'autor
es van acceptar el 13/11/2026, amb l'enviament de dades a Mozilla apagat). Si el Firefox es torna a instal·lar de
nou, cal tornar-ho a fer. El Firefox es controla amb Marionette, com a prova.py: un fitxer de configuració
de GeckoView (/data/local/tmp/org.mozilla.firefox-geckoview-config.yaml, que el Firefox només llegeix perquè
«am set-debug-app» el marca) l'obre amb --marionette. «adb reverse» porta el servidor de proves (8775) al mòbil,
i «adb forward», el port de Marionette a l'ordinador. L'extensió s'hi instal·la com a temporal.
"""
import base64
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from marionette import Marionette  # noqa: E402
import servidor  # noqa: E402
import prova  # noqa: E402
from prova import comprova, galetes, info_pagina, missatge, posa_config  # noqa: E402

EXT = AQUI.parent / "extensio"
CAPTURES = AQUI / "captures"
SDK = Path.home() / "Android" / "Sdk"
AVD = "menja-galetes"
PORT_EMU = 5584
DISP = f"emulator-{PORT_EMU}"
PAQUET = "org.mozilla.firefox"
PORT_M = 28291
WEB = "http://localhost:8775"
ADB = shutil.which("adb") or str(SDK / "platform-tools" / "adb")
DOMINIS = ("diari.test,www.bancprova.test,www.prova.gob.es,botiga.test,h.online-metrix.net,empresa.test,"
           "www.instagram.com,revista.test,amagat.test,bucle.test,static.hotjar.com,us1.list-manage.com,"
           "l.facebook.com,vell.test,premsa.test")


def adb(*args, check=True, timeout=120):
    # El mòbil virtual, quan va carregat, de vegades respon «Broken pipe»: es torna a provar.
    for _ in range(3):
        r = subprocess.run([ADB, "-s", DISP, *args], capture_output=True, text=True, timeout=timeout)
        if not r.returncode:
            break
        time.sleep(2)
    if check and r.returncode:
        raise RuntimeError(f"adb {' '.join(args)}: {r.stderr.strip() or r.stdout.strip()}")
    return r.stdout.strip()


def engega_mobil():
    """Engega el mòbil virtual si no ho és. Torna el procés de l'emulador (o None si ja era engegat)."""
    if f"{DISP}\tdevice" in subprocess.run([ADB, "devices"], capture_output=True, text=True).stdout:
        return None
    print("Engego el mòbil virtual…")
    log = open(AQUI.parent / "construit" / "android" / "emulador.log", "w")
    env = dict(os.environ, ANDROID_SDK_ROOT=str(SDK), ANDROID_HOME=str(SDK))
    emu = subprocess.Popen([str(SDK / "emulator" / "emulator"), "-avd", AVD, "-no-window", "-no-audio", "-no-boot-anim",
                            "-no-snapshot", "-gpu", "swiftshader_indirect", "-port", str(PORT_EMU)],
                           env=env, stdout=log, stderr=subprocess.STDOUT)
    limit = time.time() + 240
    while time.time() < limit:
        if adb("shell", "getprop", "sys.boot_completed", check=False, timeout=10) == "1":
            return emu
        time.sleep(2)
    emu.kill()
    raise RuntimeError("el mòbil virtual no s'ha engegat")


def prepara_firefox():
    apks = sorted((AQUI.parent / "construit" / "android").glob("fenix-*.multi.android-x86_64.apk"))
    if not apks:
        raise RuntimeError("falta el Firefox per a Android a construit/android/")
    versio = re.search(r"fenix-([\d.]+)\.multi", apks[-1].name).group(1)
    if f"versionName={versio}" not in adb("shell", "dumpsys", "package", PAQUET, check=False):
        print(f"Instal·lo el Firefox {versio} al mòbil…")
        adb("install", "-r", str(apks[-1]), timeout=300)
    adb("shell", "am", "force-stop", PAQUET)
    config = "\n".join([
        "args:", "  - --marionette", "  - --remote-allow-system-access",
        "prefs:",
        "  marionette.port: 2828",
        "  network.dns.disableIPv6: true",
        "  network.stricttransportsecurity.preloadlist: false",
        '  intl.accept_languages: "ca,es,en"',
        f'  network.dns.localDomains: "{DOMINIS}"',
        "env:", '  MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1"', ""])
    fitxer = AQUI.parent / "construit" / "android" / "geckoview-config.yaml"
    fitxer.write_text(config)
    adb("push", str(fitxer), f"/data/local/tmp/{PAQUET}-geckoview-config.yaml")
    adb("shell", "am", "set-debug-app", "--persistent", PAQUET)
    adb("forward", f"tcp:{PORT_M}", "tcp:2828")
    adb("reverse", "tcp:8775", "tcp:8775")
    # La pantalla encesa i desbloquejada, perquè el Firefox pinti les pàgines.
    adb("shell", "input", "keyevent", "KEYCODE_WAKEUP", check=False)
    adb("shell", "wm", "dismiss-keyguard", check=False)
    adb("shell", "svc", "power", "stayon", "true", check=False)
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", f"{WEB}/simple", PAQUET)
    return versio


def neteja(m):
    """Galetes i dades dels webs fora, i una sola pestanya (la de davant)."""
    m.context("chrome")
    m.js_async("""const fet = arguments[arguments.length - 1];
      const C = Ci.nsIClearDataService;
      Services.clearData.deleteData(C.CLEAR_COOKIES | C.CLEAR_DOM_STORAGES | C.CLEAR_ALL_CACHES, { onDataDeleted: () => fet(1) });""")
    m.context("content")
    tria_davant(m)


def tria_davant(m):
    """Es queda només amb la pestanya de davant, l'única que té mida (les del darrere fan 0 d'ample)."""
    davant = None
    limit = time.time() + 20
    while davant is None and time.time() < limit:
        for h in m.handles():
            m.canvia(h)
            try:
                if m.js("return innerWidth;"):
                    davant = h
                    break
            except Exception:
                pass
        else:
            time.sleep(0.5)
    if davant is None:
        raise RuntimeError("cap pestanya no es veu (innerWidth 0): potser el Firefox ensenya la benvinguda i cal acceptar-ne les condicions")
    for h in m.handles():
        if h != davant:
            m.canvia(h)
            m.tanca()
    m.canvia(davant)


def connecta(segons=90):
    """Marionette, quan el Firefox ja és a punt (en engegar-se per primer cop, tanca les primeres connexions)."""
    limit = time.time() + segons
    while True:
        try:
            m = Marionette(PORT_M, espera=10)
            m.js("return 1;")
            return m
        except Exception:
            if time.time() > limit:
                raise
            time.sleep(1)


def toca_text(text, segons=8):
    """Toca el botó del Firefox que diu `text` (per exemple, l'«OK» de l'avís «… was added»)."""
    limit = time.time() + segons
    while time.time() < limit:
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", check=False, timeout=30)
        xml = adb("shell", "cat", "/sdcard/ui.xml", check=False)
        for node in re.findall(r"<node [^>]*>", xml):
            if f'text="{text}"' in node and PAQUET in node:
                x1, y1, x2, y2 = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node).groups())
                adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
                return True
        time.sleep(1)
    return False


def xpi():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for arrel, _, fitxers in os.walk(EXT):
            for f in fitxers:
                cami = Path(arrel) / f
                z.write(cami, cami.relative_to(EXT).as_posix())
    return base64.b64encode(buf.getvalue()).decode()


def desa(nom, png):
    (CAPTURES / nom).write_bytes(base64.b64decode(png))


def espera_pagina(m, url_conte, segons=10):
    limit = time.time() + segons
    while time.time() < limit:
        try:
            if url_conte in m.js("return location.href;") and m.js("return document.readyState;") == "complete":
                return True
        except Exception:
            pass
        time.sleep(0.25)
    return False


def main():
    CAPTURES.mkdir(exist_ok=True)
    srv = servidor.engega()
    emu = engega_mobil()
    m = None
    try:
        versio = prepara_firefox()
        m = connecta()
        print(f"Firefox {versio} per a Android, al mòbil virtual")
        espera_pagina(m, "/simple")
        neteja(m)

        # El que diu el Firefox de debò, abans d'instal·lar-hi res
        m.ves(f"{WEB}/primera")
        real = info_pagina(m)
        real["dpr"] = m.js("return devicePixelRatio;")
        real["toc"] = m.js("return navigator.maxTouchPoints;")
        print("   De debò:", json.dumps({k: real.get(k) for k in ("userAgent", "platform", "screen", "dpr", "toc", "nuclis", "webgl")},
                                       ensure_ascii=False))
        m.context("chrome")
        m.js("Services.cookies.removeAll(); return 1;")
        m.context("content")

        r = m.ordre("Addon:Install", {"addon": xpi(), "temporary": True})
        m.context("chrome")
        uuid = m.js(f"return WebExtensionPolicy.getByID('{prova.ID}').mozExtensionHostname;")
        m.context("content")
        print("Extensió instal·lada:", r, uuid)
        # L'emmagatzematge de l'extensió es queda d'una passada a l'altra (el perfil no s'esborra): es buida i
        # l'extensió es torna a engegar, com si fos nova.
        m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
        m.js_async("""const fet = arguments[arguments.length - 1];
          const b = (window.wrappedJSObject || window).browser;
          b.storage.local.clear().then(() => { fet(1); b.runtime.reload(); });""")
        time.sleep(3)
        print("   L'avís «Menja galetes was added», tancat:", toca_text("OK"))
        # En tornar-se a engegar, la pestanya de les opcions es tanca.
        tria_davant(m)
        m.ves(f"{WEB}/simple")
        posa_config(m, uuid, {"urlPais": f"{WEB}/pais", "retardMenjar": 2})
        time.sleep(0.5)
        print("País:", missatge(m, uuid, {"tipus": "comprovaPais"}))
        time.sleep(0.5)

        # ---- 1. La primera galeta ----
        print("\n1. La primera galeta, al mòbil")
        m.ves(f"{WEB}/primera")
        info = info_pagina(m)
        time.sleep(1)
        gs = galetes(m)
        ga = [g for g in gs if g["name"] == "_ga" and g["host"] == "localhost"]
        comprova("_ga (per capçalera) no és la de debò", ga and ga[0]["value"] != "GA1.1.111111111.1700000000", ga and ga[0]["value"])
        fbp = [g for g in gs if g["name"] == "_fbp"]
        comprova("_fbp (per JavaScript) no és la de debò", fbp and fbp[0]["value"] != "fb.1.1700000000000.222222222",
                 fbp and fbp[0]["value"])
        ses = [g for g in gs if g["name"] == "sessio"]
        comprova("sessio (de funcionament) es queda igual", ses and ses[0]["value"] == "abc123")
        ide = [g for g in gs if g["name"] == "IDE"]
        comprova("IDE (de tercers) no és la de debò", ide and ide[0]["value"] != "AHWqTUmREALREAL123", ide and ide[0]["value"])
        comprova("document.cookie del web porta la falsa", "GA1.1.111111111" not in info.get("cookie", "x"), info.get("cookie"))

        # ---- 2. La disfressa: un altre mòbil Android ----
        print("\n2. La disfressa: un altre mòbil Android")
        print("   ", json.dumps(info, ensure_ascii=False)[:600])
        ua = info.get("userAgent", "")
        mo = re.fullmatch(rf"Mozilla/5\.0 \(Android (\d+); Mobile; rv:{versio.split('.')[0]}\.0\) Gecko/{versio.split('.')[0]}\.0 "
                          rf"Firefox/{versio.split('.')[0]}\.0", ua)
        comprova("userAgent: un Firefox d'Android (no un Windows)", mo and 12 <= int(mo.group(1)) <= 16, ua)
        comprova("platform i oscpu: Linux armv81, com qualsevol Firefox d'Android",
                 info.get("platform") == "Linux armv81" and info.get("oscpu") == "Linux armv81", [info.get("platform"), info.get("oscpu")])
        comprova("la pantalla, la de debò", info.get("screen") == real.get("screen"), [info.get("screen"), real.get("screen")])
        comprova("la densitat i els dits (tàctil), els de debò",
                 m.js("return devicePixelRatio;") == real["dpr"] and m.js("return navigator.maxTouchPoints;") == real["toc"])
        comprova("idioma i zona de la disfressa (castellà, Europe/Madrid)",
                 (info.get("languages") or [""])[0].startswith("es") and info.get("zona") == "Europe/Madrid",
                 [info.get("languages"), info.get("zona")])
        comprova("nuclis d'un mòbil (6 o 8)", info.get("nuclis") in (6, 8), info.get("nuclis"))
        comprova("WebGL: una gràfica de mòbil (Adreno o Mali)", re.search(r"^(Adreno \(TM\) \d+|Mali-[GT]\d+), or similar$", str(info.get("webgl"))),
                 info.get("webgl"))
        comprova("canvas: el mateix soroll dues vegades, i diferent del de debò",
                 info.get("canvas1") == info.get("canvas2") and info.get("canvas1") != real.get("canvas1"),
                 [info.get("canvas1"), info.get("canvas2"), real.get("canvas1")])
        comprova("WebRTC: la IP és la falsa, i de ningú", "83.45.10.20" not in str(info.get("rtc")) and " 100." in str(info.get("rtc")),
                 info.get("rtc"))
        m.ves(f"{WEB}/eco")
        eco = json.loads(m.js("return document.body.innerText;"))
        comprova("la capçalera User-Agent diu el mateix que la pàgina", eco.get("User-Agent") == ua, eco.get("User-Agent"))
        m.ves(f"{WEB}/primera")
        info2 = info_pagina(m)
        comprova("en tornar-hi, la mateixa disfressa", info2.get("userAgent") == ua)

        # ---- 3. Bancs ----
        print("\n3. Un banc: el mòbil de debò")
        m.ves("http://www.bancprova.test:8775/simple")
        b = info_pagina(m)
        comprova("al banc, el navegador de debò", b.get("userAgent") == real.get("userAgent"), b.get("userAgent"))

        # ---- 4. La finestreta ----
        print("\n4. La finestreta, a pantalla completa")
        # La finestreta busca la pestanya del web per l'adreça (?web=). Al Firefox d'Android, les pestanyes que
        # obre Marionette queden al darrere (sense mida): el web va en una d'aquestes, i la finestreta, al davant.
        davant = m.ordre("WebDriver:GetWindowHandle")
        davant = davant["value"] if isinstance(davant, dict) else davant
        darrere = m.pestanya_nova()
        m.ves(f"{WEB}/primera")
        info_pagina(m)
        m.canvia(davant)
        m.ves(f"moz-extension://{uuid}/finestreta/finestreta.html?web={WEB}/primera")
        time.sleep(1.5)
        fin = json.loads(m.js("""return JSON.stringify({
          mobil: document.documentElement.classList.contains('mobil'),
          ample: Math.round(document.body.getBoundingClientRect().width), finestra: innerWidth, pantalla: screen.width,
          horitzontal: document.documentElement.scrollWidth > innerWidth + 1,
          peu: getComputedStyle(document.querySelector('.peu')).position,
          text: document.body.innerText });"""))
        text = fin["text"]
        comprova("la finestreta sap que és al mòbil", fin["mobil"])
        comprova("fa l'ample de la pantalla (no la dibuixa com un web d'ordinador encongit)", fin["finestra"] == fin["pantalla"],
                 [fin["finestra"], fin["pantalla"]])
        comprova("ocupa tota l'amplada, sense desplaçar-se de costat", fin["ample"] == fin["finestra"] and not fin["horitzontal"],
                 [fin["ample"], fin["finestra"]])
        comprova("els botons de baix, sempre a la vista", fin["peu"] == "sticky", fin["peu"])
        comprova("«Primera galeta: menjada»", "Primera galeta: menjada" in text)
        comprova("es pensa que ets «Un Android de…»", re.search(r"Un Android de \w", text))
        comprova("i explica la disfressa del mòbil", "un altre mòbil Android" in text)
        comprova("la pantalla: «la teva»", "la teva" in text)
        comprova("la veritat: Firefox · Android i la versió de debò", re.search(r"Firefox · Android \d+", text))
        desa("android-finestreta.png", m.captura())
        m.js("document.querySelector('.disf-cap').scrollIntoView(); return 1;")
        time.sleep(0.4)
        desa("android-disfressa.png", m.captura())
        m.canvia(darrere)
        m.tanca()
        m.canvia(davant)

        # ---- 5. Les opcions ----
        print("\n5. Les opcions")
        m.ves(f"moz-extension://{uuid}/opcions/opcions.html")
        time.sleep(1.2)
        op = json.loads(m.js("""return JSON.stringify({
          mobil: document.documentElement.classList.contains('mobil'),
          fila: new Set([...document.querySelectorAll('.personatge')].map((e) => Math.round(e.getBoundingClientRect().top))).size,
          n: document.querySelectorAll('.personatge').length,
          horitzontal: document.documentElement.scrollWidth > innerWidth + 1, finestra: innerWidth, pantalla: screen.width,
          text: document.body.innerText });"""))
        comprova("les opcions saben que són al mòbil", op["mobil"])
        comprova("i fan l'ample de la pantalla", op["finestra"] == op["pantalla"], [op["finestra"], op["pantalla"]])
        comprova("els tres personatges, en una fila", op["n"] == 3 and op["fila"] == 1, op)
        comprova("sense desplaçar-se de costat", not op["horitzontal"])
        comprova("«Què falseja» explica el mòbil", "Al mòbil: un altre mòbil Android" in op["text"] and "La pantalla es queda la de debò" in op["text"])
        m.js("document.getElementById('personatges').scrollIntoView(); scrollBy(0, -60); return 1;")
        time.sleep(0.4)
        desa("android-opcions.png", m.captura())

        # ---- 6. El mico ----
        print("\n6. El mico, al mòbil")
        m.ves("http://diari.test:8775/simple")
        espera_pagina(m, "diari.test")
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
        for _ in range(40):
            if m.js("return !!document.getElementById('menja-galetes-monstre');"):
                vist = True
                break
            time.sleep(0.1)
        comprova("surt el mico", vist, resp)
        # Captures de la pantalla del mòbil (adb), no de Marionette: les de Marionette aturen l'animació.
        inici = time.time()
        for i, quan in enumerate((1.0, 2.4, 4.9, 6.6)):   # segons des que surt (l'escena en dura 7,7)
            time.sleep(max(0, inici + quan - time.time()))
            try:
                png = subprocess.run([ADB, "-s", DISP, "exec-out", "screencap", "-p"], capture_output=True, timeout=40).stdout
                (CAPTURES / f"android-mico-{i}.png").write_bytes(png)
            except subprocess.TimeoutExpired:
                print(f"   (la captura {i} del mico ha trigat massa)")
        recarregada = False
        for _ in range(60):
            time.sleep(0.25)
            try:
                if m.js("return document.body && !document.body.dataset.abans && !document.getElementById('menja-galetes-monstre');"):
                    recarregada = True
                    break
            except Exception:
                pass
        comprova("quan marxa, la pàgina es torna a carregar", recarregada)
    except Exception as e:
        comprova("la prova ha arribat al final", False, f"{type(e).__name__}: {e}")
    finally:
        try:
            m.ordre("Addon:Uninstall", {"id": prova.ID})
        except Exception:
            pass
        adb("shell", "am", "force-stop", PAQUET, check=False)
        adb("forward", "--remove", f"tcp:{PORT_M}", check=False)
        adb("reverse", "--remove", "tcp:8775", check=False)
        if emu:
            adb("emu", "kill", check=False)
            emu.wait(timeout=60)
        srv.shutdown()

    bons = sum(1 for _, ok, _ in prova.resultats if ok)
    print(f"\n{bons} de {len(prova.resultats)} proves bé")
    return 0 if bons == len(prova.resultats) else 1


if __name__ == "__main__":
    sys.exit(main())
