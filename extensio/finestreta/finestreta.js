"use strict";
/* Menja galetes · la finestreta. Tot el que ve dels webs es posa com a text. */

const $ = (s) => document.querySelector(s);

// h("div.classe", fills…) → element. Els textos es posen com a text, mai com a HTML.
function h(etiqueta, ...fills) {
  const [nom, ...classes] = etiqueta.split(".");
  const el = document.createElement(nom);
  if (classes.length) el.className = classes.join(" ");
  for (const f of fills.flat()) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : String(f));
  }
  return el;
}

const escurça = (v, n = 18) => (v.length > n ? v.slice(0, n) + "…" : v);

// El navegador i el sistema de debò (els de la finestreta no van disfressats).
function navegadorReal() {
  if (/Firefox\//.test(navigator.userAgent)) return "Firefox";
  const marques = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const m = marques.map((b) => b.brand).find((b) => !/Chromium|Not/i.test(b));
  return m ? m.replace("Google ", "") : "Vivaldi";
}
// L'empremta, com la treuria un web: dibuixa una imatge i en fa un codi. El de debò surt de la
// imatge tal com la dibuixa el teu navegador; el fals, de la mateixa imatge amb el soroll que la
// disfressa hi posa en aquest web (el mateix MG.sorolla que fa servir el codi de pàgina).
function empremtes(d) {
  try {
    const c = document.createElement("canvas");
    c.width = 240; c.height = 60;
    const x = c.getContext("2d");
    x.textBaseline = "top";
    x.fillStyle = "#f60"; x.fillRect(100, 1, 62, 20);
    x.fillStyle = "#069"; x.font = "15px Arial"; x.fillText("Menja galetes, 123 <canvas> 😀", 2, 15);
    x.fillStyle = "rgba(102, 204, 0, 0.7)"; x.font = "18px Times"; x.fillText("Menja galetes, 123", 4, 36);
    const dades = x.getImageData(0, 0, c.width, c.height).data;
    const codi = (bytes) => {
      let h = 2166136261;
      for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619); }
      const t = (h >>> 0).toString(16).padStart(8, "0");
      return `${t.slice(0, 4)}·${t.slice(4)}`;
    };
    const real = codi(dades);
    const falses = new Uint8ClampedArray(dades);
    MG.sorolla(falses, falses.length, d.soroll + "|img");
    return { real, falsa: codi(falses) };
  } catch (e) {
    return null;
  }
}

// La targeta gràfica de debò, tal com la diu el navegador (escurçada).
function graficaReal() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    let r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
    r = String(r).replace(/^ANGLE \([^,]*,\s*/, "").replace(/\(R\)|\(TM\)/g, "").replace(/, or similar$/, "")
      .replace(/\s*\(0x[0-9A-Fa-f]+\).*$/, "").replace(/ Direct3D.*$/, "").replace(/,? ?Unspecified Version\)?$/, "").trim();
    return r ? (r.length > 22 ? r.slice(0, 21) + "…" : r) : "no la diu";
  } catch (e) {
    return "no la diu";
  }
}

function sistemaReal() {
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  return /linux/i.test(p) ? "Linux" : /win/i.test(p) ? "Windows" : /mac/i.test(p) ? "macOS" : p;
}

async function pestanyaActual() {
  const p = new URLSearchParams(location.search);
  if (p.get("web")) {
    // Per a les proves: la pestanya que té aquesta adreça.
    const t = (await browser.tabs.query({})).find((x) => (x.url || "").startsWith(p.get("web")));
    if (t) return t;
  }
  const [t] = await browser.tabs.query({ active: true, currentWindow: true });
  return t;
}

function botoInterruptor(el, on) {
  el.classList.toggle("on", !!on);
}

async function pinta() {
  const tab = await pestanyaActual();
  const lloc = MG.llocDeUrl(tab && tab.url || "");
  const e = await browser.runtime.sendMessage({ tipus: "estat", tabId: tab ? tab.id : -1, lloc });
  const cfg = e.cfg;
  botoInterruptor($("#actiu"), cfg.actiu);
  const cos = $("#cos");
  cos.textContent = "";

  if (!lloc) {
    cos.append(h("div.buit", "Aquí no hi ha cap web per menjar-se."));
    return;
  }
  let host = "";
  try { host = new URL(tab.url).hostname; } catch (e) { /* res */ }
  const usuari = (cfg.confianca || []).some((w) => MG.lloc(w) === lloc);
  const sempre = MG.esSempreReal(host);
  const xarxa = !sempre && MG.esXarxa(host);
  const auto = (cfg.realAuto || []).includes(lloc);
  const confiat = usuari || sempre || xarxa || auto;
  const etiq = !cfg.actiu ? h("span.etiq.apagat", "Apagat") : confiat ? h("span.etiq.conf", "De confiança") : h("span.etiq.disf", "Disfressat");
  cos.append(h("div.web", "🌐", h("span.domini", lloc), etiq));

  if (!cfg.actiu) {
    cos.append(h("div.buit", "Menja galetes dorm. Encén-lo amb l'interruptor de dalt."));
    return;
  }
  if (e.scriptsUsuari === false) {
    cos.append(h("div.nota-ip", "Per poder-te disfressar, cal un permís: a la pàgina d'extensions (vivaldi://extensions), " +
      "obre els detalls de Menja galetes i activa «Permet els scripts d'usuari». Les galetes, me les menjo igualment."));
  }

  if (confiat) {
    const img = h("img"); img.src = "../icones/galeta.svg";
    const explica = sempre
      ? "És un banc, un web de pagaments o d'un govern. Els seus sistemes contra el frau han de veure el navegador de debò."
      : xarxa
        ? "És una xarxa social, de missatgeria o de cites, o una plataforma on hi ha menors. Hi vas amb la teva identitat real, perquè els seus sistemes contra els comptes falsos, l'assetjament i els usuaris expulsats funcionin."
      : auto
        ? "Aquest web demana una contrasenya o una targeta, fa servir un sistema contra el frau, o el seu certificat és d'un banc o d'una administració. Hi vas sense disfressa, perquè aquests sistemes funcionin."
        : "És un web de confiança: hi vas sense disfressa, i les seves galetes es queden perquè no et tregui de la sessió. Les de tercers i les de seguiment, me les menjo igualment.";
    cos.append(h("div.heroi", img, h("div",
      h("div.mitja.verd", sempre || xarxa || auto ? "Aquí hi vas amb la teva identitat real" : "Aquí no et disfresso"),
      h("div.sota", explica))));
    if (e.galetes.length) {
      cos.append(h("div.titol-llista", "Galetes de tercers i de seguiment · menjades igualment"));
      cos.append(h("div.gls", e.galetes.slice(0, 8).map((g) =>
        h("div.gl", h("code", g.nom), h("s", escurça(g.original || "(buida)")), h("span.fl", "→"), h("b", escurça(g.fals)))
      )));
    }
    if (!sempre && !xarxa && !auto) {
      const b = h("button.sec", "Ja no hi confio");
      b.onclick = () => browser.runtime.sendMessage({ tipus: "confia", lloc, si: false, tabId: tab.id }).then(() => window.close());
      cos.append(h("div.peu", b));
    }
    return;
  }

  // Les galetes
  const img = h("img"); img.src = "../icones/galeta.svg";
  const menjades = e.galetes.length;
  cos.append(h("div.heroi", img, h("div",
    h("div.mitja", menjades ? "Primera galeta: menjada" : "Res per menjar, de moment"),
    h("div.sota", menjades
      ? "Abans que es desés. Aquest web no ha vist mai el teu identificador."
      : "Aquest web encara no t'ha intentat posar cap galeta de seguiment."))));
  if (menjades) {
    cos.append(h("div.titol-llista", "Galetes de seguiment · el que hi va posar → el que diu ara"));
    cos.append(h("div.gls", e.galetes.slice(0, 8).map((g) =>
      h("div.gl", h("code", g.nom), h("s", escurça(g.original || "(buida)")), h("span.fl", "→"), h("b", escurça(g.fals)))
    )));
    if (menjades > 8) cos.append(h("div.nota", `I ${menjades - 8} més.`));
  }
  if (e.funcionament.length) {
    const noms = e.funcionament.slice(0, 2).join(", ");
    cos.append(h("div.nota", `I ${e.funcionament.length} de funcionament (${noms}${e.funcionament.length > 2 ? "…" : ""}), fins que tanquis la pestanya.`));
  }
  if (e.avis) cos.append(h("div.nota", `Avís de galetes: ${e.avis.accio} per tu (${e.avis.cmp}).`));

  // La disfressa
  const real = { w: screen.width, h: screen.height };
  const d = MG.disfressa(cfg, lloc, real);
  const f = cfg.falseja;
  const imgD = h("img"); imgD.src = "../icones/disfressa.svg";
  cos.append(h("div.disf-cap", imgD, h("div", h("div.sota", "I es pensa que ets"), h("div.mitja", d.nom))));
  const idiomaReal = MG.IDIOMES[(navigator.language || "").split("-")[0]] || navigator.language;
  const files = [];
  if (f.navegador) files.push(["Navegador", `${d.navegadorNom} ${cfg.versio} · ${d.soNom}`, `${navegadorReal()} · ${sistemaReal()}`, ""]);
  if (f.ubicacio) files.push(["Ubicació", d.ciutat, "amagada", ""]);
  if (f.idioma) files.push(["Idioma", MG.IDIOMES[d.idiomes[0].split("-")[0]] || d.idiomes[0], idiomaReal, ""]);
  if (f.pantalla) files.push(["Pantalla", `${d.pantalla.w} × ${d.pantalla.h}`, `${real.w} × ${real.h}`, ""]);
  if (f.pantalla) files.push(["Gràfica", d.gpu.nom, graficaReal(), ""]);
  const emp = f.empremta ? empremtes(d) : null;
  if (emp) files.push(["Empremta", emp.falsa, emp.real, ""]);
  const ipReal = e.ipReal || "la real";
  if (f.ipScripts && d.ip) files.push(["IP scripts", `${d.ip} (de ningú)`, ipReal, "ip"]);
  if (f.ipCapcaleres && d.ip) files.push(["IP capçal.", `${d.ip} (de ningú)`, "cap", "ip"]);
  files.push(["IP connexió", ipReal, "la mateixa", "ip real"]);
  const fitxa = h("div.fitxa", h("div.th", "Què"), h("div.th", "Es pensa"), h("div.th", "Veritat"));
  for (const [q, fals, ver, c] of files) {
    const cl = c ? "." + c.split(" ").join(".") : "";
    fitxa.append(h("div.q" + cl, q), h("div.fals" + cl, fals), h("div.ver" + cl, ver));
  }
  cos.append(fitxa);
  if (emp) {
    cos.append(h("div.nota", `Empremta: el codi que treu un web quan fa dibuixar una imatge al navegador. ` +
      `Amb la disfressa, aquest web rep el ${emp.falsa}; sense, rebria el ${emp.real}, que és el teu.`));
  }
  const p = MG.PAISOS[cfg.paisIP];
  cos.append(h("div.nota-ip", cfg.pais === "ip"
    ? `La IP de la connexió és la real. Per això la disfressa és ${p ? p.de : "del teu país"}, com la IP, però d'una altra ciutat.`
    : "La IP de la connexió és la real. La disfressa és d'un país qualsevol, i potser no lliga amb la IP."));

  const menja = h("button.pri", "Menja-te-les totes ara");
  menja.onclick = async () => {
    menja.disabled = true;
    await browser.runtime.sendMessage({ tipus: "menjaAra", lloc, tabId: tab.id });
    window.close();
  };
  const confia = h("button.sec", "Confio en aquest web");
  confia.onclick = () => browser.runtime.sendMessage({ tipus: "confia", lloc, si: true, tabId: tab.id }).then(() => window.close());
  cos.append(h("div.peu", menja, confia));
}

$("#opcions").onclick = () => { browser.runtime.openOptionsPage(); window.close(); };
$("#actiu").onclick = async () => {
  const on = !$("#actiu").classList.contains("on");
  await browser.runtime.sendMessage({ tipus: "actiu", si: on });
  pinta();
};
pinta();
