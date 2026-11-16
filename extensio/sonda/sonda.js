"use strict";
/* Menja galetes · la sonda del país.
 *
 * El fons la carrega en un marc amb sandbox (principal nul) per saber de quin país surt la connexió. La VPN del
 * Firefox (IP Protection) fa passar per la VPN el trànsit dels webs i el dels marcs amb sandbox, però no el de
 * les extensions: si el fons ho demanés directament, veuria la IP de debò, mentre que els webs veuen la de la
 * VPN, i la disfressa seria d'un altre país. L'adreça arriba després del «#»; el text torna al fons amb
 * postMessage.
 */
(async () => {
  let text = null;
  try {
    const url = decodeURIComponent(location.hash.slice(1));
    if (/^https?:\/\//.test(url)) {
      const r = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      if (r.ok) text = await r.text();
    }
  } catch (e) { /* res */ }
  parent.postMessage({ menjaGaletesSonda: true, text }, "*");
})();
