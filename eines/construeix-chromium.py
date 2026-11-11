#!/usr/bin/env python3
"""Munta la versió per al Vivaldi, el Chrome i el Brave a construit/menja-galetes-chromium/.

Agafa el que és propi del Chromium de chromium/ i el que és comú de extensio/ (lib/comu.js,
la finestreta, les opcions, els estils i les icones). Torna-ho a executar després de cada canvi.
"""
import shutil
from pathlib import Path

ARREL = Path(__file__).resolve().parent.parent
DESTI = ARREL / "construit" / "menja-galetes-chromium"

if DESTI.exists():
    shutil.rmtree(DESTI)
DESTI.mkdir(parents=True)
for nom in ("manifest.json", "fons.js", "pagina.js", "contingut.js", "rebot.html", "rebot.js"):
    shutil.copy2(ARREL / "chromium" / nom, DESTI / nom)
(DESTI / "lib").mkdir()
for nom in ("comu.js", "navegador.js", "monstre.js"):
    shutil.copy2(ARREL / "extensio" / "lib" / nom, DESTI / "lib" / nom)
shutil.copy2(ARREL / "extensio" / "comu.css", DESTI / "comu.css")
for carpeta in ("finestreta", "opcions", "icones"):
    shutil.copytree(ARREL / "extensio" / carpeta, DESTI / carpeta)
print(DESTI)
