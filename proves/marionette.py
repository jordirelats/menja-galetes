"""Client mínim del protocol Marionette del Firefox (sense instal·lar res).

El Firefox l'obre amb --marionette; cada missatge és «llargada:json».
"""
import json
import socket
import time

ELEMENT = "element-6066-11e4-a52e-4f735466cecf"


class ErrorMarionette(Exception):
    pass


class Marionette:
    def __init__(self, port, espera=30):
        limit = time.time() + espera
        while True:
            try:
                self.s = socket.create_connection(("127.0.0.1", port), timeout=60)
                break
            except OSError:
                if time.time() > limit:
                    raise
                time.sleep(0.3)
        self.id = 0
        self._llegeix()  # salutació
        self.ordre("WebDriver:NewSession", {"capabilities": {}})

    def _llegeix(self):
        cap = b""
        while not cap.endswith(b":"):
            b = self.s.recv(1)
            if not b:
                raise ErrorMarionette("connexió tancada")
            cap += b
        n = int(cap[:-1])
        dades = b""
        while len(dades) < n:
            dades += self.s.recv(n - len(dades))
        return json.loads(dades)

    def ordre(self, nom, params=None):
        self.id += 1
        msg = json.dumps([0, self.id, nom, params or {}]).encode()
        self.s.sendall(str(len(msg)).encode() + b":" + msg)
        while True:
            r = self._llegeix()
            if r[0] == 1 and r[1] == self.id:
                if r[2]:
                    raise ErrorMarionette(f"{nom}: {r[2].get('error')}: {r[2].get('message')}")
                v = r[3]
                return v.get("value", v) if isinstance(v, dict) else v

    # Dreceres
    def context(self, quin):
        self.ordre("Marionette:SetContext", {"value": quin})

    def ves(self, url):
        self.ordre("WebDriver:Navigate", {"url": url})

    def js(self, codi, *args):
        return self.ordre("WebDriver:ExecuteScript", {"script": codi, "args": list(args)})

    def js_async(self, codi, *args):
        return self.ordre("WebDriver:ExecuteAsyncScript", {"script": codi, "args": list(args)})

    def pestanya_nova(self):
        r = self.ordre("WebDriver:NewWindow", {"type": "tab"})
        h = r["handle"] if isinstance(r, dict) else r
        self.ordre("WebDriver:SwitchToWindow", {"handle": h})
        return h

    def canvia(self, handle):
        self.ordre("WebDriver:SwitchToWindow", {"handle": handle})

    def tanca(self):
        return self.ordre("WebDriver:CloseWindow")

    def handles(self):
        return self.ordre("WebDriver:GetWindowHandles")

    def captura_element(self, selector):
        el = self.ordre("WebDriver:FindElement", {"using": "css selector", "value": selector})
        ref = el[ELEMENT] if ELEMENT in el else list(el.values())[0]
        return self.ordre("WebDriver:TakeScreenshot", {"id": ref, "full": False})
