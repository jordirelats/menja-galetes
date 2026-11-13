"use strict";
/*
 * Menja galetes · el fons.
 *
 * - Es menja la primera galeta: reescriu els Set-Cookie abans que el Firefox les desi.
 * - Posa la disfressa a les capçaleres (User-Agent, Accept-Language, X-Forwarded-For).
 * - Registra el codi de pàgina (lib/pagina.js) amb la configuració.
 * - Quan tanques l'última pestanya d'un web, se'n menja les galetes i l'emmagatzematge.
 * - Mira per quin país surt la connexió i, si canvia, es posa una disfressa nova.
 */

let cfg = null;
let registre = null;
let codiComu = "";
let codiPagina = "";
const pestanyes = new Map();   // tabId -> {lloc, store, galetes:[], funcionament:Set, avis}
const pendents = new Map();    // «lloc|magatzem» -> temporitzador per menjar-se-les
const disfresses = new Map();  // lloc -> disfressa (per a les capçaleres)
let disfressesDia = "";        // el dia de les disfresses desades (mode «una al dia per a tots»)
// Els magatzems de galetes: el normal, els contenidors i el privat. Cadascun té les seves galetes, i
// el que es fa en un no ha de tocar ni copiar res dels altres (si no, l'extensió lligaria identitats).
const MAGATZEM = "firefox-default";
const magatzemsVistos = new Set([MAGATZEM]);
let llocsProtegits = new Set();
// Les galetes velles: quan vas per última vegada a cada web (vegeu menjaVelles).
let visites = {};
let visitesDesDe = Date.now();
let desantVisites = null;
// El resum de la setmana (vegeu MG.suma).
const resumEstat = { resum: null, anterior: null };
let desantResum = null;
// Webs sense disfressa durant una estona (el botó «Compara-la sense disfressa»): lloc -> fins quan.
const realTemporal = new Map();
const temporal = (lloc) => (realTemporal.get(lloc) || 0) > Date.now();

/* ---- Configuració ---- */

async function carregaConfig() {
  const s = await browser.storage.local.get(null);
  const c = Object.assign({}, MG.PER_DEFECTE, s.config || {});
  c.falseja = Object.assign({}, MG.PER_DEFECTE.falseja, (s.config || {}).falseja || {});
  if (!s.secret) {
    s.secret = MG.hex(32);
    await browser.storage.local.set({ secret: s.secret });
  }
  const info = await browser.runtime.getBrowserInfo();
  // Al Firefox d'Android, la disfressa és un altre mòbil Android (MG.disfressa).
  const plataforma = await browser.runtime.getPlatformInfo().catch(() => ({}));
  cfg = Object.assign(c, {
    mobil: plataforma.os === "android",
    secret: s.secret,
    epoch: s.epoch || 0,
    epochLloc: s.epochLloc || {},
    paisIP: s.paisIP || "ES",
    versio: String(info.version).split(".")[0],
    protegides: new Set(s.protegides || []),
    // Webs on s'ha vist un camp de contrasenya o de targeta: van sense disfressa (automàtic).
    realAuto: s.realAuto || [],
    provaOrganitzacio: s.provaOrganitzacio || null,   // només per a les proves
  });
  llocsProtegits = new Set([...cfg.protegides].map((k) => MG.lloc(k.split("|")[0])));
  disfresses.clear();
}

// La configuració que va a cada pàgina. «confianca» hi porta també els webs automàtics.
function perAPagina() {
  const { actiu, avisos, identificador, disfressa, pais, falseja, confianca, secret, epoch, epochLloc, paisIP, versio, gpc, mobil } = cfg;
  const realAuto = [...cfg.realAuto, ...[...realTemporal.keys()].filter(temporal)];
  return { actiu, avisos, identificador, disfressa, pais, falseja, confianca, realAuto, secret, epoch, epochLloc, paisIP, versio, gpc, mobil };
}

// En fila: si se'n fan dues alhora, totes dues desregistren el mateix i en queda un de vell, actiu.
let registrant = Promise.resolve();
function registra() {
  registrant = registrant.then(fesRegistra, fesRegistra);
  return registrant;
}
async function fesRegistra() {
  if (registre) {
    try { await registre.unregister(); } catch (e) { /* res */ }
    registre = null;
  }
  if (!cfg.actiu) return;
  const codi = `(function () {\n${codiComu}\n;(${codiPagina.trim()})(MG, ${JSON.stringify(perAPagina())});\n})();`;
  registre = await browser.contentScripts.register({
    js: [{ code: codi }],
    matches: ["<all_urls>"],
    runAt: "document_start",
    allFrames: true,
    matchAboutBlank: true,
  });
}

function disfressaDe(lloc) {
  // En el mode «una al dia», a mitjanit canvia: les pàgines noves la calculen amb el dia nou, i les
  // capçaleres també ho han de fer.
  if (cfg.disfressa === "dia" && disfressesDia !== MG.avui()) { disfresses.clear(); disfressesDia = MG.avui(); }
  let d = disfresses.get(lloc);
  if (!d) {
    d = MG.disfressa(cfg, lloc, null);
    disfresses.set(lloc, d);
  }
  return d;
}

const clauGaleta = (c) => `${c.domain.replace(/^\./, "")}|${c.name}`;
const confiat = (lloc) => MG.esConfiat(lloc, cfg.confianca) || cfg.realAuto.includes(lloc) || temporal(lloc);
// Dels webs de confiança de l'usuari no es toca res. Als «reals» (bancs, governs, webs amb
// contrasenya o amb sistemes contra el frau) no hi ha disfressa, però les galetes de
// tercers i de seguiment se les menja igualment.
const deConfianca = (lloc) => !!lloc && (cfg.confianca || []).some((w) => MG.lloc(w) === lloc);
// Als webs de confiança tampoc no hi ha disfressa, i s'hi tracten les galetes com als «reals».
// La confiança només compta quan el web és el de dalt: si surt dins d'un altre (un vídeo de
// YouTube en un diari), és un tercer més.
const esReal = (host) => !!host && (MG.esIdentitatReal(host) || cfg.realAuto.includes(MG.lloc(host)) || deConfianca(MG.lloc(host)) || temporal(MG.lloc(host)));

/* ---- Pestanyes ---- */

const estatBuit = (lloc, store = MAGATZEM) => ({ lloc, store, galetes: [], funcionament: new Set(), avis: null, pendent: null, gravadors: [], espies: [], espiesN: 0 });
const clauPendent = (lloc, store) => `${lloc}|${store || MAGATZEM}`;
function noMenjis(lloc, store) {
  const k = clauPendent(lloc, store);
  if (pendents.has(k)) { clearTimeout(pendents.get(k)); pendents.delete(k); }
}
function vistMagatzem(store) {
  if (!store || store === "firefox-private" || magatzemsVistos.has(store)) return;
  magatzemsVistos.add(store);
  browser.storage.local.set({ magatzems: [...magatzemsVistos] });
}
// Tots els magatzems on hi pot haver galetes.
async function magatzems() {
  const ids = new Set(magatzemsVistos);
  try { for (const m of await browser.cookies.getAllCookieStores()) ids.add(m.id); } catch (e) { /* res */ }
  return [...ids];
}

// Quan la pestanya demana un web nou: encara no hi és (pot ser una baixada, o no arribar mai).
// Les galetes d'aquesta càrrega s'apunten a part, a «pendent».
function preparaPestanya(tabId, lloc, store = MAGATZEM) {
  let p = pestanyes.get(tabId);
  if (!p) { p = estatBuit("", store); pestanyes.set(tabId, p); }
  p.pendent = p.lloc === lloc ? null : { lloc, galetes: [], funcionament: new Set(), gravadors: [], espies: [], espiesN: 0 };
  noMenjis(lloc, store);
}

// Quan la pàgina ja hi és (canvia l'adreça de la pestanya): ara sí, el web d'abans ha marxat.
function estatPestanya(tabId, lloc, store = MAGATZEM) {
  visita(lloc);
  vistMagatzem(store);
  let p = pestanyes.get(tabId);
  if (!p || p.lloc !== lloc || p.store !== store) {
    const vell = p ? p.lloc : "", magVell = p ? p.store : MAGATZEM;
    const nou = estatBuit(lloc, store);
    if (p && p.pendent && p.pendent.lloc === lloc) {
      for (const k of ["galetes", "funcionament", "gravadors", "espies", "espiesN"]) nou[k] = p.pendent[k];
    }
    pestanyes.set(tabId, nou);
    p = nou;
    if (vell) potserMenja(vell, magVell);
  } else {
    p.pendent = null;
  }
  noMenjis(lloc, store);
  return p;
}

// On s'apunta el que passa en una pestanya per a un web: el web d'ara, o el que s'està carregant.
function apuntDe(tabId, lloc) {
  const p = pestanyes.get(tabId);
  if (!p) return null;
  if (p.lloc === lloc) return p;
  if (p.pendent && p.pendent.lloc === lloc) return p.pendent;
  return null;
}

function anota(tabId, lloc, entrada) {
  const p = apuntDe(tabId, lloc);
  if (!p) return;
  if (!p.galetes.some((g) => g.nom === entrada.nom && g.domini === entrada.domini)) {
    p.galetes.push(entrada);
    compta("galetes", MG.empresa(entrada.nom, entrada.domini));
  }
}

// Un gravador o un espia menjat en aquesta pestanya (per a la finestreta). Torna si és nou.
function apunta(tabId, lloc, clau, nom) {
  const p = apuntDe(tabId, lloc);
  if (!p) return true;
  if (clau === "espies") p.espiesN = (p.espiesN || 0) + 1;
  if (p[clau].includes(nom)) return false;
  p[clau].push(nom);
  return true;
}

// Una cosa menjada més al resum de la setmana.
function compta(clau, empresa) {
  MG.suma(resumEstat, clau, empresa);
  clearTimeout(desantResum);
  desantResum = setTimeout(() => browser.storage.local.set({ resum: resumEstat.resum, resumAnterior: resumEstat.anterior }), 1500);
}

// Quan vas a un web (per saber quines galetes són velles). Només els webs que tenen galetes
// protegides: de la resta no cal saber res (i no es desa un historial de tot el que mires).
function visita(lloc) {
  if (!lloc || !llocsProtegits.has(lloc)) return;
  visites[lloc] = Date.now();
  clearTimeout(desantVisites);
  desantVisites = setTimeout(() => browser.storage.local.set({ visites }), 3000);
}

// Les galetes que ja hi havia en instal·lar-la (protegides, perquè no perdessis cap sessió):
// les dels webs on no vas fa més de cfg.velles dies, se les menja. Les dels webs de confiança,
// els oberts, i els pagaments, bancs i sistemes contra el frau, no.
async function menjaVelles(ara = Date.now()) {
  if (!cfg.actiu || !cfg.velles) return 0;
  cfg.protegides = new Set((await browser.storage.local.get("protegides")).protegides || []);
  llocsProtegits = new Set([...cfg.protegides].map((k) => MG.lloc(k.split("|")[0])));
  let n = 0;
  for (const lloc of [...llocsProtegits]) {
    if (!lloc || obert(lloc) || deConfianca(lloc) || MG.esProtegitFrau(lloc)) continue;
    if (!MG.esVell(visites[lloc] || visitesDesDe, cfg.velles, ara)) continue;
    n += await menja(lloc, { protegides: true });
  }
  return n;
}

// Cada dilluns a les 9 (o en obrir el Firefox, si ja han passat): el resum de la setmana passada.
async function avisaResum() {
  const setmana = MG.setmana();
  if (Date.now() < new Date(`${setmana}T09:00:00`).getTime()) return;
  const { resumAvisat } = await browser.storage.local.get("resumAvisat");
  if (resumAvisat === setmana) return;
  if (resumEstat.resum && resumEstat.resum.setmana !== setmana) {
    resumEstat.anterior = MG.esSetmanaPassada(resumEstat.resum.setmana) ? resumEstat.resum : null;
    resumEstat.resum = MG.resumBuit(setmana);
  }
  await browser.storage.local.set({ resumAvisat: setmana, resum: resumEstat.resum, resumAnterior: resumEstat.anterior });
  const r = resumEstat.anterior;
  if (!cfg.resumAvis || !r || !r.galetes || r.setmana !== MG.setmana(new Date(Date.now() - 7 * 864e5))) return;
  browser.notifications.create("resum", {
    type: "basic",
    iconUrl: browser.runtime.getURL("icones/galeta-96.png"),
    title: `La setmana passada em vaig menjar ${r.galetes} galetes`,
    message: MG.textResum(r),
  });
}

browser.tabs.onUpdated.addListener(async (tabId, canvi, tab) => {
  await llest;
  if (canvi.url) {
    const lloc = MG.llocDeUrl(canvi.url);
    const store = (tab && tab.cookieStoreId) || MAGATZEM;
    if (lloc) {
      estatPestanya(tabId, lloc, store);
    } else {
      // La pestanya ha anat a una pàgina que no és un web (about:blank, una pestanya nova…):
      // el web d'abans ja no hi és obert.
      const p = pestanyes.get(tabId);
      if (p && p.lloc) {
        const vell = p.lloc;
        pestanyes.set(tabId, estatBuit("", store));
        potserMenja(vell, p.store);
      }
    }
  }
});

browser.tabs.onRemoved.addListener(async (tabId) => {
  await llest;
  const p = pestanyes.get(tabId);
  pestanyes.delete(tabId);
  if (p && p.lloc) potserMenja(p.lloc, p.store);
});

// El web és obert en alguna pestanya (d'aquest magatzem, o de qualsevol si no se'n diu cap).
function obert(lloc, store = null) {
  for (const p of pestanyes.values()) if (p.lloc === lloc && (!store || (p.store || MAGATZEM) === store)) return true;
  return false;
}

function potserMenja(lloc, store = MAGATZEM) {
  const k = clauPendent(lloc, store);
  if (!lloc || !cfg.actiu || obert(lloc, store) || pendents.has(k)) return;
  pendents.set(k, setTimeout(() => { pendents.delete(k); menja(lloc, { store }); }, cfg.retardMenjar * 1000));
}

/*
 * Es menja les galetes d'un web (també les que altres webs hi han deixat, que el
 * Firefox guarda separades per web), i el seu emmagatzematge.
 *   obertes: també si el web és obert en alguna pestanya
 *   protegides: també les que ja hi eren abans d'instal·lar l'extensió
 */
//   store: només en aquest magatzem (si no, en tots)
async function menja(lloc, { obertes = false, protegides = false, store = null } = {}) {
  if (!lloc) return 0;
  const real = esReal(lloc);
  const llistes = [];
  const fets = [];
  for (const st of store ? [store] : await magatzems()) {
    if (!obertes && obert(lloc, st)) continue;
    fets.push(st);
    try { llistes.push(await browser.cookies.getAll({ domain: lloc, storeId: st })); } catch (e) { /* res */ }
    for (const esquema of ["https://", "http://"]) {
      try { llistes.push(await browser.cookies.getAll({ partitionKey: { topLevelSite: esquema + lloc }, storeId: st })); } catch (e) { /* res */ }
    }
  }
  if (!fets.length) return 0;
  let n = 0;
  const vistes = new Set();
  for (const llista of llistes) {
    for (const c of llista) {
      const id = `${c.domain}|${c.name}|${c.path}|${JSON.stringify(c.partitionKey || null)}`;
      if (vistes.has(id)) continue;
      vistes.add(id);
      if (!protegides && cfg.protegides.has(clauGaleta(c)) && !MG.esSeguiment(c.name)) continue;
      // En un banc o un govern: només les de tercers i les de seguiment, i mai les d'un banc,
      // un pagament o un sistema contra el frau.
      if (real) {
        const tercer = !!c.partitionKey || MG.lloc(c.domain) !== lloc;
        if (MG.esProtegitFrau(c.domain.replace(/^\./, "")) && !(MG.esSeguiment(c.name) && MG.lloc(c.domain) === lloc)) continue;
        if (!tercer && !MG.esSeguiment(c.name, lloc)) continue;
      }
      const url = (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path;
      const det = { url, name: c.name, storeId: c.storeId };
      if (c.partitionKey) det.partitionKey = c.partitionKey;
      if (c.firstPartyDomain) det.firstPartyDomain = c.firstPartyDomain;
      try { if (await browser.cookies.remove(det)) { n++; compta("galetes", MG.empresa(c.name, c.domain)); } } catch (e) { /* res */ }
    }
  }
  // Les galetes amagades (localStorage, IndexedDB). Als webs on ja hi havia una sessió
  // abans d'instal·lar l'extensió no, perquè sovint hi guarden l'entrada.
  if (!real && (protegides || !llocsProtegits.has(lloc))) {
    for (const st of fets) {
      try {
        await browser.browsingData.remove({ hostnames: [lloc], cookieStoreId: st }, { localStorage: true, indexedDB: true, serviceWorkers: true });
      } catch (e) {
        if (st === MAGATZEM) { try { await browser.browsingData.remove({ hostnames: [lloc] }, { localStorage: true, indexedDB: true }); } catch (e2) { /* res */ } }
      }
    }
  }
  if (protegides) {
    let canvi = false;
    for (const k of [...cfg.protegides]) {
      if (MG.lloc(k.split("|")[0]) === lloc) { cfg.protegides.delete(k); canvi = true; }
    }
    if (canvi) {
      llocsProtegits.delete(lloc);
      delete visites[lloc];
      await browser.storage.local.set({ protegides: [...cfg.protegides], visites });
    }
  }
  return n;
}

/* ---- Peticions ---- */

// El nom (host) del web de dalt de tot de la pestanya. Les peticions que no són de cap
// pestanya (treballadors compartits, service workers) fan servir el document que les fa.
function hostSuperiorDe(det) {
  const host = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname : ""; } catch (e) { return ""; } };
  if (det.type === "main_frame") return host(det.url);
  const fa = det.frameAncestors;
  if (fa && fa.length) return host(fa[fa.length - 1].url);
  if (det.documentUrl) return host(det.documentUrl);
  if (det.tabId < 0) return host(det.originUrl || "");
  const p = pestanyes.get(det.tabId);
  return p ? p.lloc : "";
}
const llocSuperiorDe = (det) => MG.lloc(hostSuperiorDe(det));
// Un web de confiança, o que sempre va amb la identitat real (bancs, governs, xarxes…).
const confiatHost = (host) => !!host && (confiat(MG.lloc(host)) || MG.esIdentitatReal(host));

// Un web disfressat que es torna a carregar sense parar (vegeu MG.esBucle).
const carregues = new Map();
function avisaBucle(lloc) {
  browser.notifications.create("bucle|" + lloc, {
    type: "basic",
    iconUrl: browser.runtime.getURL("icones/galeta-96.png"),
    title: `${lloc}: ara sense disfressa`,
    message: `Amb la disfressa, ${lloc} es tornava a carregar sense parar. Durant un dia hi vas amb el navegador de debò. ` +
      "Les galetes de seguiment i les de tercers, me les continuo menjant.",
  });
}

// Un web sense disfressa durant una estona: per comparar la prova de la disfressa, o perquè amb la
// disfressa es tornava a carregar sense parar. (No és per sempre: un fals positiu, un web que es
// recarrega sol o un web que ho fa expressament no poden treure la disfressa per sempre.)
async function senseDisfressaUnaEstona(lloc, minuts, tabId = -1) {
  const fins = Date.now() + minuts * 60000;
  realTemporal.set(lloc, fins);
  disfresses.delete(lloc);
  await registra();
  setTimeout(async () => {
    if ((realTemporal.get(lloc) || 0) > fins) return;   // l'han allargat
    realTemporal.delete(lloc);
    disfresses.delete(lloc);
    await registra();
  }, minuts * 60000 + 500);
  if (tabId >= 0) browser.tabs.reload(tabId);
  return fins;
}

// Un web que ha de veure el navegador de debò a partir d'ara (automàtic).
const marcant = new Set();
async function marcaReal(lloc, tabId, recarrega) {
  // «atzar:…» vol dir que no se sap quin és el web de dalt: marcar-lo faria recarregar la
  // pàgina cada vegada (amb un valor nou cada cop).
  if (!lloc || /[^a-z0-9.\-]/i.test(lloc) || confiat(lloc) || marcant.has(lloc)) return;
  marcant.add(lloc);
  cfg.realAuto.push(lloc);
  await browser.storage.local.set({ realAuto: cfg.realAuto });
  disfresses.delete(lloc);
  await registra();
  marcant.delete(lloc);
  if (recarrega && tabId >= 0) browser.tabs.reload(tabId);
}

// Els sistemes contra el frau es detecten tan aviat com la pàgina els demana, i també si el
// Firefox els bloqueja (la protecció contra el rastreig en bloqueja alguns).
async function detectaAntifrau(det) {
  await llest;
  if (!cfg.actiu || det.tabId < 0) return;
  let host;
  try { host = new URL(det.url).hostname; } catch (e) { return; }
  if (!MG.esAntifrau(host)) return;
  const hostSup = hostSuperiorDe(det);
  const lloc = MG.lloc(hostSup);
  if (!lloc || deConfianca(lloc) || esReal(hostSup)) return;
  marcaReal(lloc, det.tabId, true);
}
browser.webRequest.onBeforeRequest.addListener(detectaAntifrau, { urls: ["<all_urls>"] });

// Els identificadors dels enllaços (fbclid, gclid, utm_…) es treuen abans que la pàgina carregui.
async function netejaEnllac(det) {
  await llest;
  if (!cfg.actiu || det.method !== "GET" || det.tabId < 0) return {};
  // Un rebot (l.facebook.com/l.php?u=…, google.com/url?q=…): directament al destí.
  if (det.type === "main_frame" && cfg.rebots) {
    const r = MG.destiRebot(det.url);
    if (r) { compta("rebots"); return { redirectUrl: MG.netejaUrl(r.desti) || r.desti }; }
  }
  const lloc = det.type === "main_frame" ? MG.llocDeUrl(det.url) : llocSuperiorDe(det);
  if (!lloc) return {};
  const net = MG.netejaUrl(det.url);
  return net ? { redirectUrl: net } : {};
}
browser.webRequest.onBeforeRequest.addListener(netejaEnllac, { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] }, ["blocking"]);
browser.webRequest.onErrorOccurred.addListener(detectaAntifrau, { urls: ["<all_urls>"] });

// Els gravadors de sessió i els píxels espia dels correus: no es carreguen (llevat que siguis al
// web del mateix gravador).
async function atura(det) {
  await llest;
  if (!cfg.actiu || det.type === "main_frame") return {};
  let host = "";
  try { host = new URL(det.url).hostname; } catch (e) { return {}; }
  const hostSup = hostSuperiorDe(det);
  const lloc = MG.lloc(hostSup);
  if (cfg.gravadors) {
    const g = MG.gravadorDe(host);
    if (g && !MG.gravadorDe(hostSup)) {
      if (apunta(det.tabId, lloc, "gravadors", g)) compta("gravadors");
      return { cancel: true };
    }
  }
  if (cfg.espies) {
    const e = MG.espiaDe(det.url);
    if (e) {
      apunta(det.tabId, lloc, "espies", e);
      compta("espies");
      return { cancel: true };
    }
  }
  return {};
}
browser.webRequest.onBeforeRequest.addListener(atura, { urls: ["<all_urls>"] }, ["blocking"]);

// Afegeix la disfressa al començament de l'script d'un treballador mentre baixa.
function injectaTreballador(requestId, codi) {
  let filtre;
  try { filtre = browser.webRequest.filterResponseData(requestId); } catch (e) { return false; }
  const enc = new TextEncoder();
  let primer = true;
  filtre.ondata = (e) => {
    if (!primer) { filtre.write(e.data); return; }
    primer = false;
    let dades = new Uint8Array(e.data);
    if (dades.length >= 3 && dades[0] === 0xEF && dades[1] === 0xBB && dades[2] === 0xBF) {
      filtre.write(dades.subarray(0, 3));           // la marca BOM, al seu lloc
      dades = dades.subarray(3);
    }
    // «"use strict"» ha de continuar sent la primera línia de l'script.
    const m = /^\s*(['"])use strict\1;?/.exec(new TextDecoder().decode(dades.subarray(0, 200)));
    if (m) {
      const n = enc.encode(m[0]).length;
      filtre.write(dades.subarray(0, n));
      dades = dades.subarray(n);
    }
    filtre.write(enc.encode(codi));
    filtre.write(dades);
  };
  filtre.onstop = () => { if (primer) filtre.write(enc.encode(codi)); filtre.close(); };
  filtre.onerror = () => {};
  return true;
}

async function abansEnviar(det) {
  await llest;
  if (!cfg.actiu) return {};
  const hs = det.requestHeaders;
  // «No venguis les meves dades» (GPC), a tots els webs.
  const gpc = cfg.gpc && !hs.some((h) => h.name.toLowerCase() === "sec-gpc");
  if (gpc) hs.push({ name: "Sec-GPC", value: "1" });
  const fet = gpc ? { requestHeaders: hs } : {};
  const dest = ((hs.find((h) => h.name.toLowerCase() === "sec-fetch-dest") || {}).value || "").toLowerCase();
  const treballador = /^(worker|sharedworker|serviceworker)$/.test(dest);
  let hostSup = hostSuperiorDe(det);
  if (!hostSup && treballador) hostSup = new URL(det.url).hostname;
  const lloc = MG.lloc(hostSup);
  if (det.type === "main_frame" && lloc && det.tabId >= 0) {
    preparaPestanya(det.tabId, lloc, det.cookieStoreId);
    // Si la disfressa fa que el web es torni a carregar sense parar: un dia sense.
    if (!confiatHost(hostSup) && MG.esBucle(carregues, det.tabId, det.url)) {
      avisaBucle(lloc);
      senseDisfressaUnaEstona(lloc, 24 * 60, det.tabId);
      return fet;
    }
  }
  const hostReq = new URL(det.url).hostname;
  // Sense disfressa si el web de dalt és de confiança o real, o si la petició va a un banc,
  // un pagament o un sistema contra el frau. (Un botó de Facebook dins d'un diari, en canvi,
  // va disfressat com el diari.)
  if (!lloc || confiatHost(hostSup) || MG.esProtegitFrau(hostReq)) return fet;
  // Un sistema contra el frau o de verificació d'identitat: aquest web, sense disfressa.
  if (MG.esAntifrau(new URL(det.url).hostname)) {
    marcaReal(lloc, det.tabId, true);
    return fet;
  }
  const d = disfressaDe(lloc);
  const f = cfg.falseja;
  if (treballador) injectaTreballador(det.requestId, MG.codiTreballador(d, f));
  for (const h of hs) {
    const n = h.name.toLowerCase();
    if (n === "user-agent" && f.navegador) h.value = d.ua;
    else if (n === "accept-language" && f.idioma && d.acceptLanguage) h.value = d.acceptLanguage;
    else if (n === "cookie" && f.galetes && cfg.identificador === "clic") {
      h.value = h.value.split(";").map((tros) => {
        const i = tros.indexOf("=");
        const nom = i > 0 ? tros.slice(0, i).trim() : "";
        return nom && MG.esSeguiment(nom, hostSup) ? ` ${nom}=${MG.galetaFalsa(nom, tros.slice(i + 1).trim())}` : tros;
      }).join(";").trim();
    }
  }
  if (f.ipCapcaleres && d.ip) hs.push({ name: "X-Forwarded-For", value: d.ip });
  // ETag: un tercer pot fer servir la memòria cau com una galeta (et dona un ETag únic i el
  // reconeix quan el navegador el torna). Als tercers no se'ls torna.
  if (f.galetes && MG.lloc(hostReq) !== lloc) {
    for (let i = hs.length - 1; i >= 0; i--) if (hs[i].name.toLowerCase() === "if-none-match") hs.splice(i, 1);
  }
  return { requestHeaders: hs };
}

async function galetaExistent(url, nom, llocSup, tercer, store) {
  // Les de tercers, el Firefox les guarda separades per al web de dalt (https o http).
  // Sempre del mateix magatzem: una pestanya d'un contenidor o privada no pot rebre l'identificador
  // fals de la finestra normal (el web veuria la mateixa persona a tots dos llocs).
  const particions = tercer ? [{ topLevelSite: "https://" + llocSup }, { topLevelSite: "http://" + llocSup }] : [null];
  for (const pk of particions) {
    const det = { url, name: nom, storeId: store || MAGATZEM };
    if (pk) det.partitionKey = pk;
    try {
      const c = await browser.cookies.get(det);
      if (c) return c.value;
    } catch (e) { /* res */ }
  }
  return null;
}

async function reescriuSetCookie(linia, ctx) {
  const [nv, ...attrs] = linia.split(";");
  const i = nv.indexOf("=");
  if (i <= 0) return linia;
  const nom = nv.slice(0, i).trim();
  const valor = nv.slice(i + 1).trim();
  const esborra = attrs.some((a) => /^\s*max-age\s*=\s*(-|0\s*$)/i.test(a))
    || attrs.some((a) => { const m = /^\s*expires\s*=(.*)$/i.exec(a); return m && Date.parse(m[1]) < Date.now(); });
  if (esborra) return linia;
  const sense = attrs.filter((a) => !/^\s*(expires|max-age)\s*=/i.test(a));
  const dom = attrs.map((a) => /^\s*domain\s*=\s*\.?(.+)$/i.exec(a)).find(Boolean);
  const domini = dom ? dom[1].trim().toLowerCase() : ctx.host;

  const seguiment = MG.esSeguiment(nom, ctx.hostSup);
  // En un banc o un govern: les seves galetes de funcionament, tal qual.
  if (ctx.real && !ctx.tercer && !seguiment) return linia;
  if (!seguiment) {
    // De funcionament: es queda, però només fins que tanquis la pestanya.
    if (cfg.protegides.has(`${domini}|${nom}`)) return linia;
    const p = apuntDe(ctx.tabId, ctx.llocSup);
    if (p) p.funcionament.add(nom);
    return [nv, ...sense].join(";");
  }

  // De seguiment: la de debò no es desa mai.
  let fals = null;
  if (cfg.identificador === "visita") fals = await galetaExistent(ctx.url, nom, ctx.llocSup, ctx.tercer, ctx.store);
  if (!fals) fals = MG.galetaFalsa(nom, valor);
  if (fals !== valor) {
    anota(ctx.tabId, ctx.llocSup, { nom, original: valor, fals, via: ctx.tercer ? "tercer" : "http", domini: ctx.llocReq });
  }
  return [`${nom}=${fals}`, ...sense].join(";");
}

// L'organització del certificat del web («O=Banco Bilbao Vizcaya Argentaria S.A.»).
async function organitzacio(det) {
  const prova = cfg.provaOrganitzacio;   // només per a les proves
  if (prova && prova[MG.llocDeUrl(det.url)]) return prova[MG.llocDeUrl(det.url)];
  try {
    const si = await browser.webRequest.getSecurityInfo(det.requestId, {});
    const subj = si && si.certificates && si.certificates[0] ? si.certificates[0].subject : "";
    const m = /(?:^|,)\s*O=(?:"([^"]+)"|([^,]+))/.exec(subj);
    return m ? (m[1] || m[2]).trim() : "";
  } catch (e) { return ""; }
}

async function rebutCapcaleres(det) {
  await llest;
  if (!cfg.actiu) return {};
  const hostSup = hostSuperiorDe(det);
  const llocSup = MG.lloc(hostSup);
  if (det.type === "main_frame" && llocSup && det.tabId >= 0) preparaPestanya(det.tabId, llocSup, det.cookieStoreId);
  let host;
  try { host = new URL(det.url).hostname; } catch (e) { return {}; }
  const llocReq = MG.lloc(host);
  if (!llocSup) return {};
  const real = esReal(hostSup);
  // Les galetes d'un banc, d'un pagament o d'un sistema contra el frau no es toquen mai.
  if (llocReq !== llocSup && (MG.esProtegitFrau(host) || cfg.realAuto.includes(llocReq))) return {};
  // Bancs i governs de tot el món: si el certificat és d'un banc o d'una administració,
  // el web passa a anar sense disfressa abans que el document comenci a carregar.
  if (det.type === "main_frame" && !real) {
    const org = await organitzacio(det);
    if (org && MG.esOrganitzacioReal(org)) {
      await marcaReal(llocSup, det.tabId, false);
      // Aquesta petició ja ha sortit disfressada (i el Firefox treu navigator.userAgent de la
      // capçalera): la parem i la tornem a demanar, ara sense disfressa. Només si és GET, i només
      // si ara el web ja és «real» (si no, es tornaria a parar cada vegada).
      // (Una redirecció a la mateixa adreça, el Firefox no la fa.)
      if (det.method === "GET" && det.tabId >= 0 && esReal(hostSup)) {
        setTimeout(() => browser.tabs.update(det.tabId, { url: det.url }), 0);
        return { cancel: true };
      }
      return {};
    }
  }
  if (!cfg.falseja.galetes) return {};
  const ctx = { host, hostSup, llocReq, llocSup, real, tercer: llocReq !== llocSup, tabId: det.tabId, url: det.url, store: det.cookieStoreId || MAGATZEM };
  let canviat = false;
  for (const h of det.responseHeaders) {
    if (h.name.toLowerCase() !== "set-cookie") continue;
    const noves = [];
    // El Firefox ajunta totes les Set-Cookie en una sola capçalera, separades per salts de línia.
    for (const linia of h.value.split("\n")) noves.push(await reescriuSetCookie(linia, ctx));
    h.value = noves.join("\n");
    canviat = true;
  }
  return canviat ? { responseHeaders: det.responseHeaders } : {};
}

browser.webRequest.onBeforeSendHeaders.addListener(abansEnviar, { urls: ["<all_urls>"] }, ["blocking", "requestHeaders"]);
browser.webRequest.onHeadersReceived.addListener(rebutCapcaleres, { urls: ["<all_urls>"] }, ["blocking", "responseHeaders"]);

/* ---- El país de la connexió ---- */

async function comprovaPais() {
  if (!cfg.actiu) return;
  let nou;
  try {
    const r = await fetch(cfg.urlPais, { cache: "no-store", credentials: "omit" });
    const text = await r.text();
    const m = /^loc=([A-Z]{2})$/m.exec(text);
    if (!m) return;
    nou = m[1];
    // La IP de debò, per ensenyar-la a la finestreta. Només es desa en aquest ordinador.
    const ip = (/^ip=([0-9a-fA-F.:]+)$/m.exec(text) || [])[1];
    if (ip) await browser.storage.local.set({ ipReal: ip });
    // El centre de Cloudflare per on surts (BCN, MAD…): és més o menys la ciutat que la IP diu als webs.
    const colo = (/^colo=([A-Z]{3})$/m.exec(text) || [])[1];
    await browser.storage.local.set({ coloReal: colo || null });
  } catch (e) {
    return;
  }
  const { paisIP: vell } = await browser.storage.local.get("paisIP");
  if (nou === vell) return;
  await browser.storage.local.set({ paisIP: nou });
  cfg.paisIP = nou;
  disfresses.clear();
  if (!vell || !cfg.canviPais) {
    await registra();
    return;
  }
  // La IP ha canviat de país: disfressa nova i se les menja totes.
  cfg.epoch += 1;
  await browser.storage.local.set({ epoch: cfg.epoch });
  disfresses.clear();
  await registra();
  const llocs = new Set();
  for (const st of await magatzems()) {
    try {
      for (const c of await browser.cookies.getAll({ storeId: st })) llocs.add(MG.lloc(c.domain));
      for (const c of await browser.cookies.getAll({ partitionKey: {}, storeId: st })) llocs.add(MG.lloc(c.domain));
    } catch (e) { /* res */ }
  }
  let n = 0;
  for (const l of llocs) n += await menja(l, { obertes: true });
  const p = MG.PAISOS[nou];
  const d = MG.disfressa(cfg, "exemple", null);
  const de = p ? p.de : `de ${nou}`;
  browser.notifications.create("pais", {
    type: "basic",
    iconUrl: browser.runtime.getURL("icones/galeta-96.png"),
    title: `La teva IP ara és ${de}`,
    message: `T'he posat una disfressa ${de} (${d.nom.toLowerCase()}) i m'he menjat ${n} galetes. ` +
      "Fes clic aquí per tornar a carregar les pestanyes obertes.",
  });
}

browser.notifications.onClicked.addListener(async (id) => {
  if (id !== "pais") return;
  await llest;
  // Mai els bancs, els governs, les xarxes ni els webs de confiança: hi podries tenir un pagament a mitges.
  for (const t of await browser.tabs.query({})) {
    let host = "";
    try { const u = new URL(t.url || ""); if (/^https?:$/.test(u.protocol)) host = u.hostname; } catch (e) { /* res */ }
    if (host && !confiatHost(host)) browser.tabs.reload(t.id);
  }
});

browser.alarms.onAlarm.addListener(async (a) => {
  await llest;
  if (a.name === "pais") comprovaPais();
  if (a.name === "velles") menjaVelles();
  if (a.name === "resum") { await avisaResum(); browser.alarms.create("resum", { when: MG.properDilluns() }); }
});

/* ---- «Menja-te-les totes ara»: el mico i la recàrrega ---- */

// Els noms de les galetes de seguiment que s'ha menjat en aquesta pestanya (el mico els porta
// escrits a les galetes). Només lletres, xifres i _.-, i com a molt cinc.
function nomsMenjades(p) {
  const noms = (p && p.galetes ? p.galetes : []).map((g) => String(g.nom || "").replace(/[^\w.-]/g, "")).filter(Boolean);
  return [...new Set(noms)].slice(0, 5);
}

// El personatge triat (el mico, l'ós rentador o el bufó) travessa la pàgina (lib/monstre.js). Si la pàgina
// no ho permet (about:, la botiga de Mozilla, un PDF…) o triga massa, es passa de llarg.
async function monstre(tabId, noms) {
  const personatge = /^[a-z]{1,20}$/.test(cfg.personatge) ? cfg.personatge : "mico";
  try {
    await browser.tabs.executeScript(tabId, { file: "/lib/monstre.js", frameId: 0 });
    await Promise.race([
      browser.tabs.executeScript(tabId, { code: `MG_monstre(${JSON.stringify({ noms: noms || [], personatge })})`, frameId: 0 }),
      new Promise((r) => setTimeout(r, 11000)),
    ]);
  } catch (e) { /* res */ }
}

// Quan el mico ha marxat, es torna a menjar el que el web hagi posat mentrestant i es torna a
// carregar la pàgina amb la disfressa nova.
async function acabaDeMenjar(tabId, lloc, noms, store) {
  await monstre(tabId, noms);
  await menja(lloc, { obertes: true, protegides: true, store });
  const p = pestanyes.get(tabId);
  if (p) { p.galetes = []; p.funcionament = new Set(); p.avis = null; }
  browser.tabs.reload(tabId);
}

/* ---- Missatges de la pàgina i de la finestreta ---- */

browser.runtime.onMessage.addListener(async (m, sender) => {
  await llest;
  if (m.tipus === "galeta" && sender.tab) {
    anota(sender.tab.id, m.lloc, { nom: m.nom, original: m.original, fals: m.fals, via: m.via, domini: m.lloc });
    return;
  }
  if (m.tipus === "avis" && sender.tab) {
    const p = pestanyes.get(sender.tab.id);
    if (p) p.avis = { accio: m.accio, cmp: m.cmp };
    return;
  }
  if (m.tipus === "identitat" && sender.tab) {
    // Una pàgina amb contrasenya o targeta: aquest web, a partir d'ara, sense disfressa.
    await marcaReal(m.lloc, sender.tab.id, true);
    return;
  }
  if (m.tipus === "estat") {
    const p = pestanyes.get(m.tabId) || {};
    const { ipReal, coloReal } = await browser.storage.local.get(["ipReal", "coloReal"]);
    return {
      ipReal: ipReal || null, coloReal: coloReal || null,
      cfg: perAPagina(),
      confiancaUsuari: cfg.confianca,
      realAuto: cfg.realAuto,
      lloc: p.lloc || m.lloc || "",
      galetes: p.galetes || [],
      funcionament: [...(p.funcionament || [])],
      avis: p.avis || null,
      gravadors: p.gravadors || [], espies: p.espies || [], espiesN: p.espiesN || 0,
      resum: resumEstat.resum && resumEstat.resum.setmana === MG.setmana() ? resumEstat.resum : null,
      resumAnterior: resumEstat.anterior && MG.esSetmanaPassada(resumEstat.anterior.setmana) ? resumEstat.anterior : null,
      temporals: Object.fromEntries([...realTemporal].filter(([l]) => temporal(l))),
    };
  }
  if (m.tipus === "menjaVelles") return { menjades: await menjaVelles(m.ara) };
  if (m.tipus === "senseDisfressa") {
    // Un web sense disfressa durant uns minuts (per comparar la prova de la disfressa).
    const minuts = Math.min(Math.max(Number(m.minuts) || 15, 1), 60);
    return { fins: await senseDisfressaUnaEstona(m.lloc, minuts) };
  }
  if (m.tipus === "menjaAra") {
    cfg.epochLloc[m.lloc] = (cfg.epochLloc[m.lloc] || 0) + 1;
    await browser.storage.local.set({ epochLloc: cfg.epochLloc });
    disfresses.delete(m.lloc);
    const p = pestanyes.get(m.tabId);
    const store = (p && p.store) || MAGATZEM;
    const n = await menja(m.lloc, { obertes: true, protegides: true, store });
    const noms = nomsMenjades(p);
    if (p) { p.galetes = []; p.funcionament = new Set(); p.avis = null; }
    await registra();
    if (m.tabId >= 0) acabaDeMenjar(m.tabId, m.lloc, noms, store);   // sense esperar: la finestreta es tanca i surt el mico
    return { menjades: n };
  }
  if (m.tipus === "confia") {
    const llista = cfg.confianca.filter((w) => MG.lloc(w) !== m.lloc);
    if (m.si) llista.push(m.lloc);
    await desaConfig({ confianca: llista });
    if (m.tabId >= 0) browser.tabs.reload(m.tabId);
    return { confianca: llista };
  }
  if (m.tipus === "actiu") {
    await desaConfig({ actiu: !!m.si });
    return { actiu: cfg.actiu };
  }
  if (m.tipus === "comprovaPais") {
    await comprovaPais();
    return { paisIP: cfg.paisIP };
  }
});

async function desaConfig(canvis) {
  const { config = {} } = await browser.storage.local.get("config");
  await browser.storage.local.set({ config: Object.assign(config, canvis) });
}

browser.storage.onChanged.addListener(async (canvis) => {
  if (!canvis.config && !canvis.provaOrganitzacio) return;
  await llest;
  await carregaConfig();
  await registra();
});

/* ---- Instal·lació i arrencada ---- */

// En instal·lar-la: les galetes de seguiment que ja hi havia se les menja (porten el teu
// identificador de debò). Les altres les protegeix, perquè no et tregui de les sessions
// que ja tens obertes.
async function primeraVegada() {
  const protegides = new Set();
  let menjades = 0;
  let totes = [];
  for (const st of await magatzems()) {
    try { totes = totes.concat(await browser.cookies.getAll({ storeId: st })); } catch (e) { /* res */ }
    try { totes = totes.concat(await browser.cookies.getAll({ partitionKey: {}, storeId: st })); } catch (e) { /* res */ }
  }
  for (const c of totes) {
    if (MG.esSeguiment(c.name, c.domain.replace(/^\./, "")) && !MG.esProtegitFrau(c.domain.replace(/^\./, ""))) {
      const det = { url: (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path, name: c.name, storeId: c.storeId };
      if (c.partitionKey) det.partitionKey = c.partitionKey;
      if (c.firstPartyDomain) det.firstPartyDomain = c.firstPartyDomain;
      try { if (await browser.cookies.remove(det)) menjades++; } catch (e) { /* res */ }
    } else {
      protegides.add(clauGaleta(c));
    }
  }
  await browser.storage.local.set({ protegides: [...protegides], installada: Date.now(), menjadesEnInstallar: menjades });
}

// En arrencar: les galetes dels webs que no són oberts ni de confiança, que ja no
// haurien de ser-hi (per exemple, si el Firefox es va tancar de cop).
async function neteja() {
  for (const st of await magatzems()) {
    const llocs = new Set();
    try { for (const c of await browser.cookies.getAll({ storeId: st })) llocs.add(MG.lloc(c.domain)); } catch (e) { /* res */ }
    for (const l of llocs) if (!obert(l, st)) await menja(l, { store: st });
  }
}

async function arrenca() {
  codiComu = await (await fetch(browser.runtime.getURL("lib/comu.js"))).text();
  codiPagina = await (await fetch(browser.runtime.getURL("lib/pagina.js"))).text();
  await carregaConfig();
  const g = await browser.storage.local.get(["visites", "visitesDesDe", "resum", "resumAnterior", "magatzems"]);
  for (const st of g.magatzems || []) magatzemsVistos.add(st);
  // Només les visites als webs amb galetes protegides (les altres no calen; les versions d'abans les desaven totes).
  visites = {};
  for (const [l, t] of Object.entries(g.visites || {})) if (llocsProtegits.has(l)) visites[l] = t;
  if (Object.keys(g.visites || {}).length !== Object.keys(visites).length) await browser.storage.local.set({ visites });
  visitesDesDe = g.visitesDesDe || Date.now();
  if (!g.visitesDesDe) await browser.storage.local.set({ visitesDesDe });
  resumEstat.resum = g.resum || null;
  resumEstat.anterior = g.resumAnterior || null;
  // És la primera vegada si encara no hi ha la marca d'instal·lada (no depèn de quan arribi onInstalled).
  const perInstallar = !(await browser.storage.local.get("installada")).installada;
  if (perInstallar) {
    await primeraVegada();
    await carregaConfig();
  }
  await registra();
  for (const t of await browser.tabs.query({})) {
    const lloc = MG.llocDeUrl(t.url || "");
    if (lloc) estatPestanya(t.id, lloc, t.cookieStoreId || MAGATZEM);
  }
  if (!perInstallar) await neteja();
  browser.alarms.create("pais", { periodInMinutes: cfg.minutsPais });
  comprovaPais();
  browser.alarms.create("velles", { delayInMinutes: 10, periodInMinutes: 24 * 60 });
  browser.alarms.create("resum", { when: MG.properDilluns() });
  avisaResum();
}

// Arrenca de seguida; els escoltadors esperen «llest» abans de fer res.
// eslint-disable-next-line no-var
var llest = arrenca().catch((e) => console.error("Menja galetes no ha pogut arrencar:", e));
