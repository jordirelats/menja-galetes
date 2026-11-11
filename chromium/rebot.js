"use strict";
/*
 * Menja galetes (Chromium) · salta un rebot. Una regla hi envia els enllaços que passen per un
 * comptador (l.facebook.com/l.php?u=…, google.com/url?q=…), amb l'adreça original després del #.
 * Aquí se'n treu el destí i s'hi va directament: el comptador no arriba a saber res.
 * (Al Firefox no cal: el fons hi redirigeix directament.)
 */
const original = location.hash.slice(1);
const r = MG.destiRebot(original);
if (r) {
  try { chrome.runtime.sendMessage({ tipus: "rebot", nom: r.nom }).catch(() => {}); } catch (e) { /* res */ }
  location.replace(MG.netejaUrl(r.desti) || r.desti);
} else {
  document.getElementById("missatge").textContent = "No he pogut saltar el comptador d'aquest enllaç.";
}
