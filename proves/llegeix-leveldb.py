#!/usr/bin/env python3
"""Llegeix el registre (*.log) d'una base LevelDB del Vivaldi o del Chrome, sense obrir el navegador.

    python3 proves/llegeix-leveldb.py <fitxer .log> [tros de clau] [--historial]

Sense --historial, diu l'últim valor de cada clau. Amb --historial, totes les escriptures en ordre (el número
de seqüència, la clau i la mida, o DEL si s'ha esborrat).

Serveix per veure, a l'ordinador d'algú, què hi ha desat l'extensió sense tocar-li el navegador:
- ~/.config/vivaldi/Default/Local Extension Settings/<id>/000003.log: el chrome.storage.local
  (config, realAuto, errorScripts, recarregadaPer…).
- ~/.config/vivaldi/Default/Extension Scripts/*.log: el codi de pàgina registrat (<id>.dynamic_scripts).
  El 24/11/2026 va servir per veure que, després de les actualitzacions de la botiga, no s'havia registrat.
Només llegeix el .log (el que s'ha escrit des de l'última compactació), no els .ldb.
"""
import struct
import sys

BLOC = 32768


def registres(dades):
    """Les escriptures (write batches) del registre, refetes a partir dels fragments de cada bloc."""
    i, tros = 0, b""
    while i < len(dades):
        queda = BLOC - (i % BLOC)
        if queda < 7:
            i += queda
            continue
        _crc, mida, tipus = struct.unpack("<IHB", dades[i:i + 7])
        if tipus == 0 and mida == 0:
            i += queda
            continue
        frag = dades[i + 7:i + 7 + mida]
        i += 7 + mida
        if tipus == 1:
            yield frag
        elif tipus == 2:
            tros = frag
        elif tipus == 3:
            tros += frag
        elif tipus == 4:
            yield tros + frag
            tros = b""


def varint(b, p):
    r = s = 0
    while True:
        c = b[p]
        p += 1
        r |= (c & 0x7F) << s
        s += 7
        if not c & 0x80:
            return r, p


def escriptures(dades):
    """(seqüència, clau, valor o None si és un esborrat)."""
    for r in registres(dades):
        seq, quantes = struct.unpack("<QI", r[:12])
        p = 12
        for n in range(quantes):
            tipus = r[p]
            p += 1
            mida, p = varint(r, p)
            clau = r[p:p + mida].decode("utf8", "replace")
            p += mida
            valor = None
            if tipus == 1:
                mida, p = varint(r, p)
                valor = r[p:p + mida]
                p += mida
            yield seq + n, clau, valor


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    historial = "--historial" in sys.argv
    filtre = args[1] if len(args) > 1 else ""
    ultims = {}
    for seq, clau, valor in escriptures(open(args[0], "rb").read()):
        if filtre not in clau:
            continue
        if historial:
            print(seq, clau, "DEL" if valor is None else f"{len(valor)} bytes")
        ultims[clau] = valor
    if not historial:
        for clau, valor in sorted(ultims.items()):
            print(clau, "=", "DEL" if valor is None else valor.decode("utf8", "replace")[:2000])


if __name__ == "__main__":
    main()
