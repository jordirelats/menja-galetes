#!/usr/bin/env python3
"""Puja una versió nova de Menja galetes a la botiga de Chrome i l'envia a revisió, sense obrir la consola.

    python3 eines/publica-chrome.py estat                 → l'estat de l'element (el publicat i el que s'envia)
    python3 eines/publica-chrome.py puja <paquet.zip>     → puja el paquet (queda com a esborrany)
    python3 eines/publica-chrome.py publica               → envia a revisió l'últim paquet pujat
    python3 eines/publica-chrome.py <paquet.zip>          → les dues coses

Fa servir l'API de la Chrome Web Store (v2) amb un compte de servei de Google Cloud: el projecte
«Menja galetes publica», el compte publica-menja-galetes@… afegit a la consola de la botiga (Configuració →
Compte de servei) i la seva clau JSON a ~/.config/menja-galetes/google.json, que només pot llegir l'usuari i
no va mai a git. No cal instal·lar res: el JWT es signa amb l'openssl del sistema.

La botiga publica la versió sola quan l'aprova (amb la visibilitat de sempre). Només s'hi pot pujar una versió
més alta que l'última, i mentre una espera la revisió no se n'hi pot enviar cap altra.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CLAU = os.path.expanduser("~/.config/menja-galetes/google.json")
EDITOR = "2c3e093f-b90a-47a1-86bc-c987ea2fbaa0"
ELEMENT = "fdedejjenjichjnbipfgcgpmjebgghmc"
ABAST = "https://www.googleapis.com/auth/chromewebstore"
API = f"https://chromewebstore.googleapis.com/v2/publishers/{EDITOR}/items/{ELEMENT}"
API_PUJA = f"https://chromewebstore.googleapis.com/upload/v2/publishers/{EDITOR}/items/{ELEMENT}:upload"


def b64(dades):
    return base64.urlsafe_b64encode(dades).rstrip(b"=").decode()


def signa(text, clau_pem):
    """RS256 amb l'openssl. La clau li arriba per una canonada (/dev/fd), mai a un fitxer."""
    r, w = os.pipe()
    os.write(w, clau_pem.encode())
    os.close(w)
    try:
        sortida = subprocess.run(["openssl", "dgst", "-sha256", "-sign", f"/dev/fd/{r}"], input=text.encode(),
                                 capture_output=True, pass_fds=(r,), check=True)
    finally:
        os.close(r)
    return sortida.stdout


def testimoni():
    if not os.path.exists(CLAU):
        sys.exit(f"No hi ha la clau del compte de servei ({CLAU}).")
    if os.stat(CLAU).st_mode & 0o077:
        sys.exit(f"{CLAU} el poden llegir altres usuaris: chmod 600 {CLAU}")
    c = json.load(open(CLAU))
    ara = int(time.time())
    cap = b64(json.dumps({"alg": "RS256", "typ": "JWT", "kid": c["private_key_id"]}).encode())
    cos = b64(json.dumps({"iss": c["client_email"], "scope": ABAST, "aud": c["token_uri"], "iat": ara, "exp": ara + 600}).encode())
    jwt = f"{cap}.{cos}." + b64(signa(f"{cap}.{cos}", c["private_key"]))
    dades = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request(c["token_uri"], data=dades)))["access_token"]


def crida(metode, url, token, cos=None, tipus=None):
    req = urllib.request.Request(url, data=cos, method=metode, headers={"Authorization": f"Bearer {token}"})
    if tipus:
        req.add_header("Content-Type", tipus)
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        sys.exit(f"{metode} {url} → {e.code}\n{e.read().decode(errors='replace')}")


def estat(token):
    return crida("GET", f"{API}:fetchStatus", token)


def puja(token, paquet):
    print(f"Pujant {paquet}…")
    r = crida("POST", API_PUJA, token, open(paquet, "rb").read(), "application/zip")
    for _ in range(60):
        if r.get("uploadState") != "IN_PROGRESS":
            break
        time.sleep(5)
        r = estat(token)
        r = {"uploadState": r.get("lastAsyncUploadState", "IN_PROGRESS"), **r}
    print(json.dumps(r, indent=2, ensure_ascii=False))
    if r.get("uploadState") not in ("SUCCEEDED", "SUCCESS"):
        sys.exit("La pujada no ha acabat bé.")


def publica(token):
    r = crida("POST", f"{API}:publish", token, b"{}", "application/json")
    print(json.dumps(r, indent=2, ensure_ascii=False))


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    token = testimoni()
    if args[0] == "estat":
        r = estat(token)
        r.pop("publicKey", None)
        print(json.dumps(r, indent=2, ensure_ascii=False))
    elif args[0] == "puja" and len(args) == 2:
        puja(token, args[1])
    elif args[0] == "publica":
        publica(token)
    elif args[0].endswith(".zip"):
        puja(token, args[0])
        publica(token)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
