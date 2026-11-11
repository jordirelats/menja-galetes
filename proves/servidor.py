"""Servidor de proves local (http://localhost:8765 i, com a «tercer», http://127.0.0.1:8765).

/primera  posa _ga per capçalera i _fbp per JavaScript, com un web de debò, i
          apunta a #info el que la pàgina veu del navegador.
/tercer   un marc d'un altre lloc que posa galetes de tercers (IDE i pref).
/avis     un avís de galetes com el d'OneTrust.
/entrada  una pàgina d'entrada amb contrasenya.
/eco      torna les capçaleres que ha rebut.
/zona     el que la pàgina veu de l'hora i l'idioma.
/marcs    marcs creats al moment, llegits abans que hi arribi l'extensió.
/treballadors  un treballador de fitxer, un de blob i un de compartit.
/antifrau una botiga que carrega un sistema contra el frau.
/simple   una pàgina que només diu el navegador i quantes vegades s'ha carregat.
/pais     com cloudflare.com/cdn-cgi/trace: «loc=ES». /pais?posa=DE el canvia.
/marc-entrada  un web amb un marc d'un altre web, sense «referrer», que té una contrasenya.
/res      una resposta 204 (com una baixada: la pestanya es queda on era).
/simple?plataforma=1  a més, datr (de Facebook) i UID (un nom genèric).
/bucle    com el Zoho Mail: si no veu el navegador de sempre (Linux), es torna a carregar.
/sw-prova un service worker que demana /eco i torna el User-Agent que hi ha arribat.
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ESTAT = {"pais": "ES"}

PRIMERA = """<!doctype html><html><head><meta charset="utf-8"><title>Primera</title></head><body>
<h1>Diari de prova</h1>
<iframe src="http://127.0.0.1:8765/tercer" width="300" height="60"></iframe>
<pre id="info">...</pre>
<script>
document.cookie = "_fbp=fb.1.1700000000000.222222222; max-age=7776000; path=/";
document.cookie = "preferencia=fosc; max-age=7776000; path=/";
function hashText(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0}return h}
function canvasHash(){const c=document.createElement('canvas');c.width=220;c.height=40;const x=c.getContext('2d');
  x.fillStyle='#f60';x.fillRect(10,5,100,20);x.fillStyle='#069';x.font='16px Arial';x.fillText('Galetes 123 <canvas>',4,30);
  return hashText(c.toDataURL())}
let gl = null; try { const c=document.createElement('canvas'); const g=c.getContext('webgl'); const e=g&&g.getExtension('WEBGL_debug_renderer_info');
  gl = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : (g ? 'sense extensió' : 'sense webgl'); } catch(e) { gl = 'error ' + e; }
let rtc = null; try { rtc = new RTCIceCandidate({candidate:"candidate:1 1 udp 2122260223 83.45.10.20 54400 typ srflx raddr 0.0.0.0 rport 0", sdpMid:"0"}).candidate } catch(e) { rtc = 'error ' + e }
const info = {
  userAgent: navigator.userAgent, platform: navigator.platform, oscpu: navigator.oscpu,
  languages: navigator.languages, language: navigator.language,
  screen: [screen.width, screen.height, screen.availWidth, screen.availHeight],
  nuclis: navigator.hardwareConcurrency, zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
  locale: Intl.DateTimeFormat().resolvedOptions().locale, offset: new Date().getTimezoneOffset(),
  cookie: document.cookie, canvas1: canvasHash(), canvas2: canvasHash(), webgl: gl, rtc: rtc,
};
document.getElementById('info').textContent = JSON.stringify(info);
</script></body></html>"""

TERCER = """<!doctype html><html><body>marc de tercers
<script>document.cookie = "_ga=GA1.1.333333333.1700000000; max-age=7776000; path=/";</script>
</body></html>"""

AVIS = """<!doctype html><html><head><meta charset="utf-8"><title>Avís</title></head><body>
<p id="estat">sense resposta</p>
<div id="onetrust-banner-sdk" style="position:fixed;bottom:0;left:0;right:0;background:#eee;padding:20px">
  Fem servir galetes (cookies) per millorar la teva experiència.
  <button id="onetrust-reject-all-handler" onclick="document.getElementById('estat').textContent='rebutjat';this.parentNode.remove()">Rebutjar-ho tot</button>
  <button id="onetrust-accept-btn-handler" onclick="document.getElementById('estat').textContent='acceptat';this.parentNode.remove()">Acceptar-ho tot</button>
</div></body></html>"""


ENTRADA = """<!doctype html><html><head><meta charset="utf-8"><title>Entrada</title></head><body>
<h1>Entra al teu compte</h1>
<form><input name="usuari"> <input type="password" name="contrasenya"> <button>Entra</button></form>
<pre id="info">...</pre>
<script>document.getElementById('info').textContent = JSON.stringify({userAgent: navigator.userAgent,
  carrega: (sessionStorage.n = (Number(sessionStorage.n) || 0) + 1)});</script>
</body></html>"""


INFO_TREBALLADOR = ("({ua: navigator.userAgent, nuclis: navigator.hardwareConcurrency, idioma: navigator.language, "
                    "zona: Intl.DateTimeFormat().resolvedOptions().timeZone, offset: new Date().getTimezoneOffset()})")

ZONA = """<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="info">...</pre><script>
const r = {};
r.offset = new Date(2024,0,15,10,30).getTimezoneOffset();
r.hores = new Date(2024,0,15,10,30).getHours();
r.utc = new Date(2024,0,15,10,30).getUTCHours();
r.parse = Date.parse("2024-01-15T10:30:00") === Date.UTC(2024,0,15,1,30);
r.text = String(new Date(Date.UTC(2024,0,15,1,30)));
r.intl = Intl.DateTimeFormat().resolvedOptions().timeZone;
r.locale = new Intl.NumberFormat().resolvedOptions().locale;
r.local = new Date(Date.UTC(2024,0,15,1,30)).toLocaleTimeString("en-US", {hour12: false});
r.temporal = typeof Temporal !== "undefined" ? Temporal.Now.timeZoneId() : "sense Temporal";
r.dateFn = Date().includes("GMT+0900");
r.instanceof = new Date() instanceof Date;
r.setHours = (() => { const x = new Date(2024,0,15,10,30); x.setHours(23); return x.getHours() === 23 && x.getDate() === 15; })();
document.getElementById('info').textContent = JSON.stringify(r);
</script></body></html>"""

MARCS = """<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="info">...</pre><script>
const r = {top: navigator.userAgent};
window.onerror = (m, f, l) => { r.error = m + " (línia " + l + ")"; document.getElementById('info').textContent = JSON.stringify(r); };
const f = document.createElement('iframe'); document.body.appendChild(f);
r.marc = f.contentWindow.navigator.userAgent;
r.index = window[0].navigator.platform;
r.zonaMarc = f.contentWindow.Intl.DateTimeFormat().resolvedOptions().timeZone;
const div = document.createElement('div'); div.innerHTML = '<iframe></iframe>'; document.body.appendChild(div);
r.innerHTML = window[1].navigator.userAgent;
r.mateix = f.contentWindow === window[0];
r.plataformaMarc = f.contentWindow.navigator.platform;
r.topPlataforma = navigator.platform;
const f3 = document.createElement('iframe'); document.body.append(f3);
r.cookieMarc = (f3.contentDocument.cookie = "_ga=GA1.1.444444444.1700000000; path=/", document.cookie);
document.getElementById('info').textContent = JSON.stringify(r);
</script></body></html>"""

TREBALLADORS = """<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="info">...</pre><script>
const r = {top: navigator.userAgent};
const codi = "postMessage(" + %s + ")";
new Worker('/w.js').onmessage = e => r.fitxer = e.data;
new Worker(URL.createObjectURL(new Blob([codi], {type: 'text/javascript'}))).onmessage = e => r.blob = e.data;
try { const s = new SharedWorker('/sh.js'); s.port.onmessage = e => r.compartit = e.data; s.port.start(); } catch (e) { r.compartit = 'error ' + e; }
setTimeout(() => document.getElementById('info').textContent = JSON.stringify(r), 2000);
</script></body></html>""" % json.dumps(INFO_TREBALLADOR)

SIMPLE = """<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="info">...</pre>%s<script>
document.getElementById('info').textContent = JSON.stringify({userAgent: navigator.userAgent, cookie: document.cookie,
  carrega: (sessionStorage.n = (Number(sessionStorage.n) || 0) + 1)});
</script></body></html>"""


BUCLE = """<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="info">...</pre><script>
const n = (sessionStorage.n = (Number(sessionStorage.n) || 0) + 1);
document.getElementById('info').textContent = JSON.stringify({userAgent: navigator.userAgent, carrega: n});
if (!/Linux/.test(navigator.userAgent) && n < 40) setTimeout(() => location.href = location.pathname, 250);
</script></body></html>"""

SW_PROVA = """<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="info">...</pre><script>
const posa = (r) => document.getElementById('info').textContent = JSON.stringify(r);
navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
  const canal = new MessageChannel();
  canal.port1.onmessage = (e) => posa({pagina: navigator.userAgent, sw: e.data});
  reg.active.postMessage('eco', [canal.port2]);
}).catch((e) => posa({error: String(e)}));
</script></body></html>"""

SW_JS = ("onmessage = (e) => fetch('/eco').then((r) => r.json())"
         ".then((j) => e.ports[0].postMessage(j['User-Agent'] || j['user-agent']));")


class Gestor(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _envia(self, cos, tipus="text/html; charset=utf-8", galetes=()):
        dades = cos.encode()
        self.send_response(200)
        self.send_header("Content-Type", tipus)
        self.send_header("Cache-Control", "no-store")
        for g in galetes:
            self.send_header("Set-Cookie", g)
        self.send_header("Content-Length", str(len(dades)))
        self.end_headers()
        self.wfile.write(dades)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/primera":
            self._envia(PRIMERA, galetes=[
                "_ga=GA1.1.111111111.1700000000; Max-Age=63072000; Path=/",
                "sessio=abc123; Max-Age=86400; Path=/",
            ])
        elif u.path == "/tercer":
            self._envia(TERCER, galetes=["IDE=AHWqTUmREALREAL123; Max-Age=33696000; Path=/",
                                         "pref=1; Max-Age=33696000; Path=/"])
        elif u.path == "/entrada":
            self._envia(ENTRADA)
        elif u.path == "/zona":
            self._envia(ZONA)
        elif u.path == "/marcs":
            self._envia(MARCS)
        elif u.path == "/treballadors":
            self._envia(TREBALLADORS)
        elif u.path == "/w.js":
            self._envia("postMessage(" + INFO_TREBALLADOR + ");", "text/javascript")
        elif u.path == "/sh.js":
            self._envia("onconnect = e => e.ports[0].postMessage(" + INFO_TREBALLADOR + ");", "text/javascript")
        elif u.path == "/antifrau":
            self._envia(SIMPLE % '<script src="http://h.online-metrix.net:8765/fp.js"></script>')
        elif u.path == "/fp.js":
            self._envia("window.__fp = 1;", "text/javascript")
        elif u.path == "/simple":
            origen = "localhost" if q.get("marc", [""])[0] == "localhost" else "diari.test"
            marc = f'<iframe src="http://{origen}:8765/tercer"></iframe>' if "marc" in q else ""
            extra = ["datr=DATRREAL123; Max-Age=63072000; Path=/", "UID=uid-real-1; Max-Age=63072000; Path=/"] \
                if "plataforma" in q else []
            self._envia(SIMPLE % marc, galetes=["_ga=GA1.1.111111111.1700000000; Max-Age=63072000; Path=/",
                                                "sessio=banc123; Max-Age=86400; Path=/", *extra])
        elif u.path == "/marc-entrada":
            self._envia(SIMPLE % '<iframe src="http://amagat.test:8765/entrada" referrerpolicy="no-referrer"></iframe>')
        elif u.path == "/bucle":
            self._envia(BUCLE)
        elif u.path == "/sw-prova":
            self._envia(SW_PROVA)
        elif u.path == "/sw.js":
            self._envia(SW_JS, "text/javascript")
        elif u.path == "/res":
            self.send_response(204)
            self.end_headers()
        elif u.path == "/avis":
            self._envia(AVIS)
        elif u.path == "/eco":
            self._envia(json.dumps(dict(self.headers.items())), "text/plain; charset=utf-8")
        elif u.path == "/pais":
            if "posa" in q:
                ESTAT["pais"] = q["posa"][0]
            self._envia(f"fl=000\nip=192.0.2.1\ncolo=BCN\nloc={ESTAT['pais']}\n", "text/plain")
        else:
            self.send_error(404)


def engega(port=8765):
    srv = ThreadingHTTPServer(("127.0.0.1", port), Gestor)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
