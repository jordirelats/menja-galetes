#!/usr/bin/env python3
"""Envia una versió nova de Menja galetes a addons.mozilla.org, sense obrir la web.

    python3 eines/publica-mozilla.py configura                  → hi poses la clau de l'API (una sola vegada)
    python3 eines/publica-mozilla.py estat                      → les últimes versions i el seu estat
    python3 eines/publica-mozilla.py <paquet.zip> [notes.md]    → la puja i l'envia a revisió, amb les notes

Fa servir l'API v5 d'addons.mozilla.org amb una clau de l'API del compte de Mozilla d'en Jordi
(«Manage API Keys» al Developer Hub). La clau es desa a ~/.config/menja-galetes/mozilla.json, que només pot
llegir l'usuari i no va mai a git. El secret es demana sense que surti a la pantalla. No cal instal·lar res.

Les notes surten de publicacio/firefox-<versió>.md: la secció «## Release Notes» (les notes de la versió, en
anglès) i la secció «## Notes to Reviewer» (per als revisors). Al codi font es respon «no» (no hi ha cap procés
de construcció: el paquet és la carpeta extensio/ tal com és).
"""
import base64
import getpass
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

CLAU = Path.home() / ".config" / "menja-galetes" / "mozilla.json"
GUID = "menja-galetes@jordirelats"
API = "https://addons.mozilla.org/api/v5"
AQUI = Path(__file__).resolve().parent.parent


def b64(dades):
    return base64.urlsafe_b64encode(dades).rstrip(b"=").decode()


def jwt():
    if not CLAU.exists():
        sys.exit(f"No hi ha la clau de l'API ({CLAU}). Primer: python3 eines/publica-mozilla.py configura")
    if CLAU.stat().st_mode & 0o077:
        sys.exit(f"{CLAU} el poden llegir altres usuaris: chmod 600 {CLAU}")
    c = json.loads(CLAU.read_text())
    ara = int(time.time())
    cap = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    cos = b64(json.dumps({"iss": c["issuer"], "jti": secrets.token_hex(16), "iat": ara, "exp": ara + 60}).encode())
    firma = hmac.new(c["secret"].encode(), f"{cap}.{cos}".encode(), hashlib.sha256).digest()
    return f"{cap}.{cos}.{b64(firma)}"


def crida(metode, url, cos=None, tipus=None):
    req = urllib.request.Request(url if url.startswith("http") else API + url, data=cos, method=metode,
                                 headers={"Authorization": f"JWT {jwt()}"})
    if tipus:
        req.add_header("Content-Type", tipus)
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        sys.exit(f"{metode} {url} → {e.code}\n{e.read().decode(errors='replace')[:3000]}")


def configura():
    print("La clau és a https://addons.mozilla.org/en-US/developers/addon/api/key/")
    emissor = input("JWT issuer (user:…): ").strip()
    if emissor[:1].isdigit():
        emissor = "user:" + emissor   # si s'ha copiat sense el «user:» del davant
    secret = getpass.getpass("JWT secret (no surt a la pantalla): ").strip()
    if not emissor.startswith("user:") or len(secret) < 20:
        sys.exit("No sembla una clau de l'API de Mozilla. No he desat res.")
    CLAU.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(CLAU.parent, 0o700)
    fd = os.open(CLAU, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump({"issuer": emissor, "secret": secret}, f)
    os.chmod(CLAU, 0o600)
    perfil = crida("GET", "/accounts/profile/")
    print(f"Desada a {CLAU}. Funciona: és el compte «{perfil.get('name') or perfil.get('username')}».")


def estat():
    r = crida("GET", f"/addons/addon/{GUID}/versions/?filter=all_with_unlisted&page_size=5")
    for v in r["results"]:
        f = v.get("file") or {}
        print(f"{v['version']:8} {v['channel']:8} {f.get('status', '?'):10} {', '.join(v.get('compatibility', {}))}")


def seccio(text, titol):
    part = text.split(f"## {titol}\n", 1)
    return part[1].split("\n## ", 1)[0].strip() if len(part) == 2 else ""


def multipart(camps, fitxer):
    limit = "menja-galetes-" + secrets.token_hex(12)
    cos = b""
    for nom, valor in camps.items():
        cos += f"--{limit}\r\nContent-Disposition: form-data; name=\"{nom}\"\r\n\r\n{valor}\r\n".encode()
    cos += (f"--{limit}\r\nContent-Disposition: form-data; name=\"upload\"; filename=\"{fitxer.name}\"\r\n"
            "Content-Type: application/zip\r\n\r\n").encode() + fitxer.read_bytes() + f"\r\n--{limit}--\r\n".encode()
    return cos, f"multipart/form-data; boundary={limit}"


def envia(paquet, notes=None):
    paquet = Path(paquet)
    with zipfile.ZipFile(paquet) as z:
        versio = json.loads(z.read("manifest.json"))["version"]
    notes = Path(notes) if notes else AQUI / "publicacio" / f"firefox-{versio}.md"
    text = notes.read_text() if notes.exists() else ""
    rn, ap = seccio(text, "Release Notes"), seccio(text, "Notes to Reviewer")
    if not rn or not ap:
        sys.exit(f"Falten les notes de la {versio} ({notes}: «## Release Notes» i «## Notes to Reviewer»).")

    print(f"Pujant {paquet.name} ({versio})…")
    cos, tipus = multipart({"channel": "listed"}, paquet)
    up = crida("POST", "/addons/upload/", cos, tipus)
    for _ in range(60):
        if up.get("processed"):
            break
        time.sleep(5)
        up = crida("GET", f"/addons/upload/{up['uuid']}/")
    if not up.get("valid"):
        errors = [m.get("message") for m in (up.get("validation") or {}).get("messages", []) if m.get("type") == "error"]
        sys.exit(f"El validador de Mozilla no l'accepta: {errors or up}")
    avisos = [m.get("message") for m in (up.get("validation") or {}).get("messages", []) if m.get("type") == "warning"]
    print(f"Validada: {up['version']}, {len(avisos)} avisos" + (f" ({'; '.join(avisos)})" if avisos else ""))

    v = crida("POST", f"/addons/addon/{GUID}/versions/",
              json.dumps({"upload": up["uuid"], "release_notes": {"en-US": rn}, "approval_notes": ap}).encode(),
              "application/json")
    f = v.get("file") or {}
    print(f"Enviada: versió {v['version']} (id {v['id']}), estat {f.get('status')}, per a {', '.join(v.get('compatibility', {}))}")
    print(f"https://addons.mozilla.org/en-US/developers/addon/menja-galetes/versions/{v['id']}")


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "configura":
        configura()
    elif args[0] == "estat":
        estat()
    elif args[0].endswith(".zip"):
        envia(*args[:2])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
