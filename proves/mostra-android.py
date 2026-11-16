#!/usr/bin/env python3
"""Deixa Menja galetes instal·lada al Firefox del mòbil virtual, amb un web obert, per mirar-la o fer-ne captures.

    python3 proves/mostra-android.py [segons]      (per defecte, 900)

Fa servir les mateixes peces que prova-android.py: engega el mòbil virtual si cal, obre el Firefox amb
Marionette, hi instal·la l'extensió (temporal) i obre el diari de proves. Després es queda esperant els
segons que diguis, perquè el servidor de proves continuï servint les pàgines. No apaga el mòbil virtual.
Les captures es fan apart, amb «adb exec-out screencap -p».
"""
import importlib.util
import sys
import time
from pathlib import Path

_spec = importlib.util.spec_from_file_location("prova_android", Path(__file__).with_name("prova-android.py"))
pa = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pa)


def main():
    segons = int(sys.argv[1]) if len(sys.argv) > 1 else 900
    srv = pa.servidor.engega()
    pa.engega_mobil()
    pa.prepara_firefox()
    m = pa.connecta()
    pa.espera_pagina(m, "/simple")
    pa.neteja(m)
    m.ordre("Addon:Install", {"addon": pa.xpi(), "temporary": True})
    time.sleep(3)
    print("L'avís «… was added», tancat:", pa.toca_text("OK"))
    pa.tria_davant(m)
    m.ves(f"{pa.WEB}/primera")
    pa.info_pagina(m)
    print(f"A punt. Esperant {segons} s…", flush=True)
    time.sleep(segons)
    srv.shutdown()


if __name__ == "__main__":
    main()
