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
  const { actiu, avisos, identificador, disfressa, pais, falseja, secret, epoch, epochLloc, paisIP, versio } = cfg;
  const confianca = [...cfg.confianca, ...cfg.realAuto];
  return { actiu, avisos, identificador, disfressa, pais, falseja, confianca, secret, epoch, epochLloc, paisIP, versio };
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
  if (!lloc || !cfg.actiu || confiat(lloc) || obert(lloc) || pendents.has(lloc)) return;
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
  if (!lloc || confiat(lloc)) return 0;
  if (!obertes && obert(lloc)) return 0;
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
      const url = (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path;
      const det = { url, name: c.name, storeId: c.storeId };
      if (c.partitionKey) det.partitionKey = c.partitionKey;
      if (c.firstPartyDomain) det.firstPartyDomain = c.firstPartyDomain;
      try { if (await browser.cookies.remove(det)) n++; } catch (e) { /* res */ }
    }
  }
  // Les galetes amagades (localStorage, IndexedDB). Als webs on ja hi havia una sessió
  // abans d'instal·lar l'extensió no, perquè sovint hi guarden l'entrada.
  if (protegides || !llocsProtegits.has(lloc)) {
    try { await browser.browsingData.remove({ hostnames: [lloc] }, { localStorage: true, indexedDB: true }); } catch (e) { /* res */ }
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

function llocSuperiorDe(det) {
  if (det.type === "main_frame") return MG.llocDeUrl(det.url);
  const fa = det.frameAncestors;
  if (fa && fa.length) return MG.llocDeUrl(fa[fa.length - 1].url);
  if (det.documentUrl) return MG.llocDeUrl(det.documentUrl);
  const p = pestanyes.get(det.tabId);
  return p ? p.lloc : "";
}

function abansEnviar(det) {
  if (!cfg.actiu || det.tabId < 0) return {};
  const lloc = llocSuperiorDe(det);
  if (det.type === "main_frame" && lloc) estatPestanya(det.tabId, lloc);
  if (!lloc || confiat(lloc) || confiat(MG.llocDeUrl(det.url))) return {};
  const d = disfressaDe(lloc);
  const f = cfg.falseja;
  const hs = det.requestHeaders;
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

async function rebutCapcaleres(det) {
  if (!cfg.actiu || !cfg.falseja.galetes || det.tabId < 0) return {};
  const llocSup = llocSuperiorDe(det);
  if (det.type === "main_frame" && llocSup) estatPestanya(det.tabId, llocSup);
  let host;
  try { host = new URL(det.url).hostname; } catch (e) { return {}; }
  const llocReq = MG.lloc(host);
  if (!llocSup || confiat(llocSup) || confiat(llocReq)) return {};
  const ctx = { host, llocReq, llocSup, tercer: llocReq !== llocSup, tabId: det.tabId, url: det.url };
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
    const m = /^loc=([A-Z]{2})$/m.exec(await r.text());
    if (!m) return;
    nou = m[1];
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
    if (m.lloc && !confiat(m.lloc)) {
      cfg.realAuto.push(m.lloc);
      await browser.storage.local.set({ realAuto: cfg.realAuto });
      disfresses.delete(m.lloc);
      await registra();
      browser.tabs.reload(sender.tab.id);
    }
    return;
  }
  if (m.tipus === "estat") {
    const p = pestanyes.get(m.tabId) || {};
    return {
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
    if (MG.esSeguiment(c.name) && !confiat(MG.lloc(c.domain))) {
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
  for (const l of llocs) if (!confiat(l) && !obert(l)) await menja(l, {});
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
