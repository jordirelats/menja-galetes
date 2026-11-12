/* Menja galetes · la benvinguda del Chromium.
 *
 * S'obre en instal·lar-la si falta el permís «Permet els scripts d'usuari». Cada segon pregunta al fons
 * si ja el té (el fons ho prova registrant el codi de pàgina), i quan el té passa a la vista «Fet».
 */
"use strict";

const $ = (s) => document.querySelector(s);
let cada = null;

async function mira() {
  let r = null;
  try { r = await browser.runtime.sendMessage({ tipus: "permis" }); } catch (e) { /* el fons es desperta */ }
  if (r && r.scriptsUsuari === true) {
    clearInterval(cada);
    document.body.classList.replace("espera", "fet");
  }
}

$("#detalls").addEventListener("click", () => {
  browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
});

$("#recarrega").addEventListener("click", async () => {
  const b = $("#recarrega");
  b.disabled = true;
  let r = null;
  try { r = await browser.runtime.sendMessage({ tipus: "recarregaPestanyes" }); } catch (e) { /* res */ }
  const n = r ? r.recarregades : 0;
  $("#text-pestanyes").textContent = n === 1 ? "He tornat a carregar 1 pestanya: ja va disfressada."
    : n ? `He tornat a carregar ${n} pestanyes: ja van disfressades.`
      : "No hi havia cap pestanya per tornar a carregar.";
  b.textContent = "Fet";
});

$("#tanca").addEventListener("click", async () => {
  const t = await browser.tabs.getCurrent();
  if (t) browser.tabs.remove(t.id);
});

cada = setInterval(mira, 1000);
mira();
