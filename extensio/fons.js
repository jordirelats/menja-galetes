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
const pestanyes = new Map();   // tabId -> {lloc, galetes:[], funcionament:Set, avis}
const pendents = new Map();    // lloc -> temporitzador per menjar-se-les
const disfresses = new Map();  // lloc -> disfressa (per a les capçaleres)
let llocsProtegits = new Set();

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
  cfg = Object.assign(c, {
    secret: s.secret,
    epoch: s.epoch || 0,
    epochLloc: s.epochLloc || {},
    paisIP: s.paisIP || "ES",
    versio: String(info.version).split(".")[0],
    protegides: new Set(s.protegides || []),
    // Webs on s'ha vist un camp de contrasenya o de targeta: van sense disfressa (automàtic).
    realAuto: s.realAuto || [],
  });
  llocsProtegits = new Set([...cfg.protegides].map((k) => MG.lloc(k.split("|")[0])));
  disfresses.clear();
}

// La configuració que va a cada pàgina. «confianca» hi porta també els webs automàtics.
function perAPagina() {
  const { actiu, avisos, identificador, disfressa, pais, falseja, confianca, realAuto, secret, epoch, epochLloc, paisIP, versio } = cfg;
  return { actiu, avisos, identificador, disfressa, pais, falseja, confianca, realAuto, secret, epoch, epochLloc, paisIP, versio };
}

async function registra() {
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
  let d = disfresses.get(lloc);
  if (!d) {
    d = MG.disfressa(cfg, lloc, null);
    disfresses.set(lloc, d);
  }
  return d;
}

const clauGaleta = (c) => `${c.domain.replace(/^\./, "")}|${c.name}`;
const confiat = (lloc) => MG.esConfiat(lloc, cfg.confianca) || cfg.realAuto.includes(lloc);
// Dels webs de confiança de l'usuari no es toca res. Als «reals» (bancs, governs, webs amb
// contrasenya o amb sistemes contra el frau) no hi ha disfressa, però les galetes de
// tercers i de seguiment se les menja igualment.
const deConfianca = (lloc) => !!lloc && (cfg.confianca || []).some((w) => MG.lloc(w) === lloc);
// Als webs de confiança tampoc no hi ha disfressa, i s'hi tracten les galetes com als «reals».
// La confiança només compta quan el web és el de dalt: si surt dins d'un altre (un vídeo de
// YouTube en un diari), és un tercer més.
const esReal = (host) => !!host && (MG.esIdentitatReal(host) || cfg.realAuto.includes(MG.lloc(host)) || deConfianca(MG.lloc(host)));

/* ---- Pestanyes ---- */

function estatPestanya(tabId, lloc) {
  let p = pestanyes.get(tabId);
  if (!p || p.lloc !== lloc) {
    if (p && p.lloc) potserMenja(p.lloc);
    p = { lloc, galetes: [], funcionament: new Set(), avis: null };
    pestanyes.set(tabId, p);
  }
  if (pendents.has(lloc)) {
    clearTimeout(pendents.get(lloc));
    pendents.delete(lloc);
  }
  return p;
}

function anota(tabId, lloc, entrada) {
  const p = pestanyes.get(tabId);
  if (!p || p.lloc !== lloc) return;
  if (!p.galetes.some((g) => g.nom === entrada.nom && g.domini === entrada.domini)) p.galetes.push(entrada);
}

browser.tabs.onUpdated.addListener((tabId, canvi) => {
  if (canvi.url) {
    const lloc = MG.llocDeUrl(canvi.url);
    if (lloc) {
      estatPestanya(tabId, lloc);
    } else {
      // La pestanya ha anat a una pàgina que no és un web (about:blank, una pestanya nova…):
      // el web d'abans ja no hi és obert.
      const p = pestanyes.get(tabId);
      if (p && p.lloc) {
        const vell = p.lloc;
        pestanyes.set(tabId, { lloc: "", galetes: [], funcionament: new Set(), avis: null });
        potserMenja(vell);
      }
    }
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  const p = pestanyes.get(tabId);
  pestanyes.delete(tabId);
  if (p && p.lloc) potserMenja(p.lloc);
});

function obert(lloc) {
  for (const p of pestanyes.values()) if (p.lloc === lloc) return true;
  return false;
}

function potserMenja(lloc) {
  if (!lloc || !cfg.actiu || obert(lloc) || pendents.has(lloc)) return;
  pendents.set(lloc, setTimeout(() => menja(lloc, {}), cfg.retardMenjar * 1000));
}

/*
 * Es menja les galetes d'un web (també les que altres webs hi han deixat, que el
 * Firefox guarda separades per web), i el seu emmagatzematge.
 *   obertes: també si el web és obert en alguna pestanya
 *   protegides: també les que ja hi eren abans d'instal·lar l'extensió
 */
async function menja(lloc, { obertes = false, protegides = false } = {}) {
  pendents.delete(lloc);
  if (!lloc) return 0;
  if (!obertes && obert(lloc)) return 0;
  const real = esReal(lloc);
  const llistes = [];
  try { llistes.push(await browser.cookies.getAll({ domain: lloc })); } catch (e) { /* res */ }
  for (const esquema of ["https://", "http://"]) {
    try { llistes.push(await browser.cookies.getAll({ partitionKey: { topLevelSite: esquema + lloc } })); } catch (e) { /* res */ }
  }
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
        if (!tercer && !MG.esSeguiment(c.name)) continue;
      }
      const url = (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path;
      const det = { url, name: c.name, storeId: c.storeId };
      if (c.partitionKey) det.partitionKey = c.partitionKey;
      if (c.firstPartyDomain) det.firstPartyDomain = c.firstPartyDomain;
      try { if (await browser.cookies.remove(det)) n++; } catch (e) { /* res */ }
    }
  }
  // Les galetes amagades (localStorage, IndexedDB). Als webs on ja hi havia una sessió
  // abans d'instal·lar l'extensió no, perquè sovint hi guarden l'entrada.
  if (!real && (protegides || !llocsProtegits.has(lloc))) {
    try { await browser.browsingData.remove({ hostnames: [lloc] }, { localStorage: true, indexedDB: true, serviceWorkers: true }); } catch (e) { /* res */ }
  }
  if (protegides) {
    let canvi = false;
    for (const k of [...cfg.protegides]) {
      if (MG.lloc(k.split("|")[0]) === lloc) { cfg.protegides.delete(k); canvi = true; }
    }
    if (canvi) {
      llocsProtegits.delete(lloc);
      await browser.storage.local.set({ protegides: [...cfg.protegides] });
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

// Un web que ha de veure el navegador de debò a partir d'ara (automàtic).
const marcant = new Set();
async function marcaReal(lloc, tabId, recarrega) {
  if (!lloc || confiat(lloc) || marcant.has(lloc)) return;
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
function detectaAntifrau(det) {
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
function netejaEnllac(det) {
  if (!cfg.actiu || det.method !== "GET" || det.tabId < 0) return {};
  const lloc = det.type === "main_frame" ? MG.llocDeUrl(det.url) : llocSuperiorDe(det);
  if (!lloc) return {};
  const net = MG.netejaUrl(det.url);
  return net ? { redirectUrl: net } : {};
}
browser.webRequest.onBeforeRequest.addListener(netejaEnllac, { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] }, ["blocking"]);
browser.webRequest.onErrorOccurred.addListener(detectaAntifrau, { urls: ["<all_urls>"] });

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

function abansEnviar(det) {
  if (!cfg.actiu) return {};
  const hs = det.requestHeaders;
  const dest = ((hs.find((h) => h.name.toLowerCase() === "sec-fetch-dest") || {}).value || "").toLowerCase();
  const treballador = /^(worker|sharedworker|serviceworker)$/.test(dest);
  let hostSup = hostSuperiorDe(det);
  if (!hostSup && treballador) hostSup = new URL(det.url).hostname;
  const lloc = MG.lloc(hostSup);
  if (det.type === "main_frame" && lloc && det.tabId >= 0) estatPestanya(det.tabId, lloc);
  const hostReq = new URL(det.url).hostname;
  // Sense disfressa si el web de dalt és de confiança o real, o si la petició va a un banc,
  // un pagament o un sistema contra el frau. (Un botó de Facebook dins d'un diari, en canvi,
  // va disfressat com el diari.)
  if (!lloc || confiatHost(hostSup) || MG.esProtegitFrau(hostReq)) return {};
  // Un sistema contra el frau o de verificació d'identitat: aquest web, sense disfressa.
  if (MG.esAntifrau(new URL(det.url).hostname)) {
    marcaReal(lloc, det.tabId, true);
    return {};
  }
  const d = disfressaDe(lloc);
  const f = cfg.falseja;
  if (treballador) injectaTreballador(det.requestId, MG.codiTreballador(d, f));
  for (const h of hs) {
    const n = h.name.toLowerCase();
    if (n === "user-agent" && f.navegador) h.value = d.ua;
    else if (n === "accept-language" && f.idioma) h.value = d.acceptLanguage;
    else if (n === "cookie" && f.galetes && cfg.identificador === "clic") {
      h.value = h.value.split(";").map((tros) => {
        const i = tros.indexOf("=");
        const nom = i > 0 ? tros.slice(0, i).trim() : "";
        return nom && MG.esSeguiment(nom) ? ` ${nom}=${MG.galetaFalsa(nom, tros.slice(i + 1).trim())}` : tros;
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

async function galetaExistent(url, nom, llocSup, tercer) {
  // Les de tercers, el Firefox les guarda separades per al web de dalt (https o http).
  const particions = tercer ? [{ topLevelSite: "https://" + llocSup }, { topLevelSite: "http://" + llocSup }] : [null];
  for (const pk of particions) {
    const det = { url, name: nom };
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

  // En un banc o un govern: les seves galetes de funcionament, tal qual.
  if (ctx.real && !ctx.tercer && !MG.esSeguiment(nom)) return linia;
  if (!MG.esSeguiment(nom)) {
    // De funcionament: es queda, però només fins que tanquis la pestanya.
    if (cfg.protegides.has(`${domini}|${nom}`)) return linia;
    const p = pestanyes.get(ctx.tabId);
    if (p && p.lloc === ctx.llocSup) p.funcionament.add(nom);
    return [nv, ...sense].join(";");
  }

  // De seguiment: la de debò no es desa mai.
  let fals = null;
  if (cfg.identificador === "visita") fals = await galetaExistent(ctx.url, nom, ctx.llocSup, ctx.tercer);
  if (!fals) fals = MG.galetaFalsa(nom, valor);
  if (fals !== valor) {
    anota(ctx.tabId, ctx.llocSup, { nom, original: valor, fals, via: ctx.tercer ? "tercer" : "http", domini: ctx.llocReq });
  }
  return [`${nom}=${fals}`, ...sense].join(";");
}

// L'organització del certificat del web («O=Banco Bilbao Vizcaya Argentaria S.A.»).
async function organitzacio(det) {
  const prova = (await browser.storage.local.get("provaOrganitzacio")).provaOrganitzacio;   // només per a les proves
  if (prova && prova[MG.llocDeUrl(det.url)]) return prova[MG.llocDeUrl(det.url)];
  try {
    const si = await browser.webRequest.getSecurityInfo(det.requestId, {});
    const subj = si && si.certificates && si.certificates[0] ? si.certificates[0].subject : "";
    const m = /(?:^|,)\s*O=(?:"([^"]+)"|([^,]+))/.exec(subj);
    return m ? (m[1] || m[2]).trim() : "";
  } catch (e) { return ""; }
}

async function rebutCapcaleres(det) {
  if (!cfg.actiu) return {};
  const hostSup = hostSuperiorDe(det);
  const llocSup = MG.lloc(hostSup);
  if (det.type === "main_frame" && llocSup && det.tabId >= 0) estatPestanya(det.tabId, llocSup);
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
      // capçalera): la parem i la tornem a demanar, ara sense disfressa. Només si és GET.
      // (Una redirecció a la mateixa adreça, el Firefox no la fa.)
      if (det.method === "GET" && det.tabId >= 0) {
        setTimeout(() => browser.tabs.update(det.tabId, { url: det.url }), 0);
        return { cancel: true };
      }
      return {};
    }
  }
  if (!cfg.falseja.galetes) return {};
  const ctx = { host, llocReq, llocSup, real, tercer: llocReq !== llocSup, tabId: det.tabId, url: det.url };
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
  try {
    for (const c of await browser.cookies.getAll({})) llocs.add(MG.lloc(c.domain));
    for (const c of await browser.cookies.getAll({ partitionKey: {} })) llocs.add(MG.lloc(c.domain));
  } catch (e) { /* res */ }
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
  for (const t of await browser.tabs.query({})) {
    if (!confiat(MG.llocDeUrl(t.url || ""))) browser.tabs.reload(t.id);
  }
});

browser.alarms.onAlarm.addListener((a) => { if (a.name === "pais") comprovaPais(); });

/* ---- Missatges de la pàgina i de la finestreta ---- */

browser.runtime.onMessage.addListener(async (m, sender) => {
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
    const { ipReal } = await browser.storage.local.get("ipReal");
    return {
      ipReal: ipReal || null,
      cfg: perAPagina(),
      confiancaUsuari: cfg.confianca,
      realAuto: cfg.realAuto,
      lloc: p.lloc || m.lloc || "",
      galetes: p.galetes || [],
      funcionament: [...(p.funcionament || [])],
      avis: p.avis || null,
    };
  }
  if (m.tipus === "menjaAra") {
    cfg.epochLloc[m.lloc] = (cfg.epochLloc[m.lloc] || 0) + 1;
    await browser.storage.local.set({ epochLloc: cfg.epochLloc });
    disfresses.delete(m.lloc);
    const n = await menja(m.lloc, { obertes: true, protegides: true });
    const p = pestanyes.get(m.tabId);
    if (p) { p.galetes = []; p.funcionament = new Set(); p.avis = null; }
    await registra();
    if (m.tabId >= 0) browser.tabs.reload(m.tabId);
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
  if (!canvis.config) return;
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
  try { totes = totes.concat(await browser.cookies.getAll({})); } catch (e) { /* res */ }
  try { totes = totes.concat(await browser.cookies.getAll({ partitionKey: {} })); } catch (e) { /* res */ }
  for (const c of totes) {
    if (MG.esSeguiment(c.name) && !MG.esProtegitFrau(c.domain.replace(/^\./, ""))) {
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
  const llocs = new Set();
  try { for (const c of await browser.cookies.getAll({})) llocs.add(MG.lloc(c.domain)); } catch (e) { /* res */ }
  for (const l of llocs) if (!obert(l)) await menja(l, {});
}

async function arrenca(perInstallar) {
  codiComu = await (await fetch(browser.runtime.getURL("lib/comu.js"))).text();
  codiPagina = await (await fetch(browser.runtime.getURL("lib/pagina.js"))).text();
  await carregaConfig();
  if (perInstallar) {
    await primeraVegada();
    await carregaConfig();
  }
  await registra();
  for (const t of await browser.tabs.query({})) {
    const lloc = MG.llocDeUrl(t.url || "");
    if (lloc) estatPestanya(t.id, lloc);
  }
  if (!perInstallar) await neteja();
  browser.alarms.create("pais", { periodInMinutes: cfg.minutsPais });
  comprovaPais();
}

let installant = false;
browser.runtime.onInstalled.addListener((d) => {
  if (d.reason === "install") installant = true;
});
// onInstalled arriba just després de carregar el fons; li donem un moment.
setTimeout(() => arrenca(installant), 300);
