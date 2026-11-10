"""Servidor de proves local (http://localhost:8765 i, com a «tercer», http://127.0.0.1:8765).

/primera  posa _ga per capçalera i _fbp per JavaScript, com un web de debò, i
          apunta a #info el que la pàgina veu del navegador.
/tercer   un marc d'un altre lloc que posa galetes de tercers (IDE i pref).
/avis     un avís de galetes com el d'OneTrust.
/entrada  una pàgina d'entrada amb contrasenya.
/eco      torna les capçaleres que ha rebut.
/pais     com cloudflare.com/cdn-cgi/trace: «loc=ES». /pais?posa=DE el canvia.
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
        elif u.path == "/avis":
            self._envia(AVIS)
        elif u.path == "/eco":
            self._envia(json.dumps(dict(self.headers.items())), "text/plain; charset=utf-8")
        elif u.path == "/pais":
            if "posa" in q:
                ESTAT["pais"] = q["posa"][0]
            self._envia(f"fl=000\nip=192.0.2.1\nloc={ESTAT['pais']}\n", "text/plain")
        else:
            self.send_error(404)


def engega(port=8765):
    srv = ThreadingHTTPServer(("127.0.0.1", port), Gestor)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
