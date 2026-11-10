#!/usr/bin/env python3
"""Fa els paquets per baixar: un ZIP per al Firefox i un per al Chromium (Chrome, Vivaldi, Brave, Edge).

Els deixa a construit/paquets/. Els fitxers van a l'arrel del ZIP: en descomprimir-lo (a Windows,
botó dret → «Extreu-ho tot») surt una carpeta amb el manifest.json a dins, que és la que es carrega.
El del Firefox es pot triar tal qual a about:debugging.
"""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ARREL = Path(__file__).resolve().parent.parent
SORTIDA = ARREL / "construit" / "paquets"


def comprimeix(carpeta: Path, desti: Path):
    with zipfile.ZipFile(desti, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(carpeta.rglob("*")):
            if f.is_file() and "__pycache__" not in f.parts:
                z.write(f, f.relative_to(carpeta).as_posix())


subprocess.run([sys.executable, str(ARREL / "eines" / "construeix-chromium.py")], check=True, stdout=subprocess.DEVNULL)
SORTIDA.mkdir(parents=True, exist_ok=True)
for vell in SORTIDA.glob("*.zip"):
    vell.unlink()
versio = json.loads((ARREL / "extensio" / "manifest.json").read_text())["version"]
versio_c = json.loads((ARREL / "chromium" / "manifest.json").read_text())["version"]
assert versio == versio_c, f"les versions no coincideixen: {versio} i {versio_c}"
paquets = [
    (ARREL / "extensio", SORTIDA / f"menja-galetes-firefox-{versio}.zip"),
    (ARREL / "construit" / "menja-galetes-chromium", SORTIDA / f"menja-galetes-chromium-{versio}.zip"),
]
for carpeta, desti in paquets:
    comprimeix(carpeta, desti)
    print(desti)
