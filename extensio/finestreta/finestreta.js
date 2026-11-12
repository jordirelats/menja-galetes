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

// Una galeta de la llista: el nom, el que hi va posar el web → el que diu ara, i a sota de qui és
// i què s'emporta (MG.queFa).
function filaGaleta(g) {
  const q = MG.queFa(g.nom);
  return h("div.gl", h("code", g.nom), h("s", escurça(g.original || "(buida)")), h("span.fl", "→"), h("b", escurça(g.fals)),
    h("div.que", q ? [h("b", q.qui), " · ", q.que] : "Un identificador per reconèixer-te quan tornis, o en altres webs on hi hagi la mateixa empresa."));
}

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

// On et situa la IP: el país, i la ciutat del centre de Cloudflare per on surts (codi d'aeroport).
const CIUTATS_COLO = {
  BCN: "Barcelona", MAD: "Madrid", VLC: "València", AGP: "Màlaga", BIO: "Bilbao", PMI: "Palma", LIS: "Lisboa",
  OPO: "Porto", MRS: "Marsella", TLS: "Tolosa", CDG: "París", ORY: "París", LYS: "Lió", FRA: "Frankfurt",
  MUC: "Munic", BER: "Berlín", TXL: "Berlín", HAM: "Hamburg", DUS: "Düsseldorf", AMS: "Amsterdam",
  BRU: "Brussel·les", LHR: "Londres", MAN: "Manchester", DUB: "Dublín", MXP: "Milà", FCO: "Roma", ZRH: "Zuric",
  GVA: "Ginebra", VIE: "Viena", CPH: "Copenhaguen", ARN: "Estocolm", OSL: "Oslo", HEL: "Hèlsinki",
  WAW: "Varsòvia", PRG: "Praga", EWR: "Nova York", JFK: "Nova York", IAD: "Washington", LAX: "Los Angeles",
  NRT: "Tòquio", KIX: "Osaka", EZE: "Buenos Aires", SYD: "Sydney", JNB: "Johannesburg",
};
function ubicacioReal(paisIP, colo) {
  const p = MG.PAISOS[paisIP];
  let pais = p ? p.nom.replace(/^(el|els|l')\s?/, "") : (paisIP || "");
  pais = pais.charAt(0).toUpperCase() + pais.slice(1);
  const ciutat = CIUTATS_COLO[colo];
  return ciutat ? `${pais}, a prop de ${ciutat}` : (pais || "no la sé");
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

// Els gravadors i els espies que s'ha menjat en aquesta pestanya.
function aturats(e) {
  const fora = [];
  if ((e.gravadors || []).length) {
    fora.push(h("div.aturat", "🎥 ", h("b", "Aquest web et volia gravar"), ` · ${e.gravadors.join(", ")}. Ha gravat: res.`));
  }
  if (e.espiesN) {
    fora.push(h("div.aturat", "👁 ", h("b", `${e.espiesN} ${e.espiesN === 1 ? "espia de correu menjat" : "espies de correu menjats"}`),
      ` (${e.espies.join(", ")}): no saben que has obert el correu.`));
  }
  return fora;
}

// El resum de la setmana (o el de la passada, si aquesta encara és buida).
function seccioResum(e) {
  const r = e.resum && e.resum.galetes ? e.resum : null;
  const x = r || (e.resumAnterior && e.resumAnterior.galetes ? e.resumAnterior : null);
  if (!x) return null;
  const llista = MG.empresesOrdenades(x);
  const top = llista.filter(([n]) => n !== "Altres").slice(0, 4);
  const altres = llista.slice(top.length).reduce((t, [, n]) => t + n, 0);
  if (altres) top.push(["Altres", altres]);
  const max = Math.max(1, ...top.map(([, n]) => n));
  const div = h("div.resum", h("div.titol-llista", r ? "Aquesta setmana" : "La setmana passada"),
    h("div.resum-t", "M'he menjat ", h("b", `${x.galetes} galetes`)));
  for (const [nom, n] of top) {
    const barra = h("i");
    barra.style.width = `${Math.round((n / max) * 100)}%`;
    div.append(h("div.barra", h("span.bn", nom), h("span.bb", barra), h("span.bx", n)));
  }
  const extra = MG.textResum(Object.assign({}, x, { empreses: {} })).trim();
  if (extra) div.append(h("div.nota", extra));
  return div;
}

// Prova la disfressa: Cover Your Tracks, de l'EFF, amb disfressa i sense.
const PROVA = "https://coveryourtracks.eff.org/";
function seccioProva() {
  const amb = h("button.enllac", "Prova la disfressa");
  amb.onclick = () => browser.tabs.create({ url: PROVA }).then(() => window.close());
  const sense = h("button.enllac", "Compara-la sense disfressa");
  sense.onclick = async () => {
    await browser.runtime.sendMessage({ tipus: "senseDisfressa", lloc: "eff.org", minuts: 15 });
    await browser.tabs.create({ url: PROVA });
    window.close();
  };
  return h("div.prova", "🧪 ", amb, " · ", sense,
    h("div.nota", "Una prova de l'EFF que mira si el teu navegador es pot reconèixer. Sense disfressa: durant 15 minuts, només en aquella prova."));
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
  // Sense disfressa una estona (la prova de la disfressa, o un web que es tornava a carregar sense parar).
  const fins = !sempre && !xarxa && !usuari && (e.temporals || {})[lloc];
  const auto = !fins && (cfg.realAuto || []).includes(lloc);
  const confiat = usuari || sempre || xarxa || auto || !!fins;
  const etiq = !cfg.actiu ? h("span.etiq.apagat", "Apagat") : fins ? h("span.etiq.conf", "Sense disfressa") : confiat ? h("span.etiq.conf", "De confiança") : h("span.etiq.disf", "Disfressat");
  cos.append(h("div.web", "🌐", h("span.domini", lloc), etiq));

  if (!cfg.actiu) {
    cos.append(h("div.buit", "Menja galetes dorm. Encén-lo amb l'interruptor de dalt."));
    return;
  }
  if (e.scriptsUsuari === false) {
    // Només al Vivaldi i al Chrome: el Firefox no té aquest permís.
    const detalls = h("button.pri", "Obre els detalls");
    detalls.addEventListener("click", () => {
      browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
      window.close();
    });
    cos.append(h("div.nota-ip.permis", h("b", "Per disfressar-te, em falta un permís."),
      " Obre els detalls de Menja galetes i activa «Permet els scripts d'usuari». Les galetes, me les menjo igualment.",
      h("div", detalls)));
  }

  if (confiat) {
    const img = h("img"); img.src = "../icones/galeta.svg";
    const hora = fins ? new Date(fins).toLocaleTimeString("ca", { hour: "2-digit", minute: "2-digit" }) : "";
    const explica = fins
      ? `Fins a les ${hora} hi vas sense disfressa: per comparar la prova de la disfressa, o perquè amb la disfressa ` +
        "es tornava a carregar sense parar. Després, et torno a disfressar. Les galetes de seguiment i les de tercers, me les menjo igualment."
      : sempre
      ? "És un banc, un web de pagaments o d'un govern. Els seus sistemes contra el frau han de veure el navegador de debò."
      : xarxa
        ? "És una xarxa social, de missatgeria o de cites, o una plataforma on hi ha menors. Hi vas amb la teva identitat real, perquè els seus sistemes contra els comptes falsos, l'assetjament i els usuaris expulsats funcionin."
      : auto
        ? "Aquest web demana una contrasenya o una targeta, fa servir un sistema contra el frau, té el certificat d'un banc o d'una administració, o amb la disfressa es tornava a carregar sense parar. Hi vas sense disfressa, perquè funcioni."
        : "És un web de confiança: hi vas sense disfressa, i les seves galetes es queden perquè no et tregui de la sessió. Les de tercers i les de seguiment, me les menjo igualment.";
    cos.append(h("div.heroi", img, h("div",
      h("div.mitja.verd", fins ? "Aquí no et disfresso, una estona" : sempre || xarxa || auto ? "Aquí hi vas amb la teva identitat real" : "Aquí no et disfresso"),
      h("div.sota", explica))));
    if (e.galetes.length) {
      cos.append(h("div.titol-llista", "Galetes de tercers i de seguiment · menjades igualment"));
      cos.append(h("div.gls", e.galetes.slice(0, 8).map(filaGaleta)));
    }
    cos.append(...aturats(e));
    const rc = seccioResum(e);
    if (rc) cos.append(rc);
    if (!sempre && !xarxa && !auto && !fins) {
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
    cos.append(h("div.gls", e.galetes.slice(0, 8).map(filaGaleta)));
    cos.append(h("div.nota", "Cada galeta és un número que t'identifica. El que s'emporten és el que l'empresa hi apunta al costat cada vegada que hi tornes. Ara, amb el número fals, no et poden reconèixer."));
    if (menjades > 8) cos.append(h("div.nota", `I ${menjades - 8} més.`));
  }
  if (e.funcionament.length) {
    const noms = e.funcionament.slice(0, 2).join(", ");
    cos.append(h("div.nota", `I ${e.funcionament.length} de funcionament (${noms}${e.funcionament.length > 2 ? "…" : ""}), fins que tanquis la pestanya.`));
  }
  if (e.avis) cos.append(h("div.nota", `Avís de galetes: ${e.avis.accio} per tu (${e.avis.cmp}).`));
  cos.append(...aturats(e));

  // La disfressa
  const real = { w: screen.width, h: screen.height };
  const d = MG.disfressa(cfg, lloc, real);
  const f = cfg.falseja;
  const imgD = h("img"); imgD.src = "../icones/disfressa.svg";
  cos.append(h("div.disf-cap", imgD, h("div", h("div.sota", "I es pensa que ets"), h("div.mitja", d.nom))));
  const idiomaReal = MG.IDIOMES[(navigator.language || "").split("-")[0]] || navigator.language;
  const files = [];
  if (f.navegador) files.push(["Navegador", `${d.navegadorNom} ${cfg.versio} · ${d.soNom}`, `${navegadorReal()} · ${sistemaReal()}`, ""]);
  if (f.ubicacio) files.push(["Ubicació", d.ciutat || "la de debò", ubicacioReal(cfg.paisIP, e.coloReal), ""]);
  if (f.idioma) files.push(["Idioma", d.idiomes ? MG.IDIOMES[d.idiomes[0].split("-")[0]] || d.idiomes[0] : "el de debò", idiomaReal, ""]);
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
  if (f.ubicacio) {
    cos.append(h("div.nota", "Ubicació de debò: la que els webs poden treure de la teva IP (el país, i més o menys la ciutat). " +
      "L'extensió no sap on ets exactament, ni ho pregunta."));
  }
  if (emp) {
    cos.append(h("div.nota", `Empremta: el codi que treu un web quan fa dibuixar una imatge al navegador. ` +
      `Amb la disfressa, aquest web rep el ${emp.falsa}; sense, rebria el ${emp.real}, que és el teu.`));
  }
  const p = MG.PAISOS[cfg.paisIP];
  cos.append(h("div.nota-ip", cfg.pais !== "ip"
    ? "La IP de la connexió és la real. La disfressa és d'un país qualsevol, i potser no lliga amb la IP."
    : p
      ? `La IP de la connexió és la real. Per això la disfressa és ${p.de}, com la IP, però d'una altra ciutat.`
      : "La IP de la connexió és la real, i és d'un país que la disfressa no coneix: l'idioma, l'hora i la ubicació es queden els de debò, perquè lliguin amb la IP."));

  cos.append(seccioProva());
  const rs = seccioResum(e);
  if (rs) cos.append(rs);

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
