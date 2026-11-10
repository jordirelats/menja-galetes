"use strict";
/*
 * Menja galetes (Chromium: Vivaldi, Chrome, Brave) · el fons (service worker).
 *
 * Fa el mateix que el del Firefox, amb les eines que hi ha al Chromium (Manifest V3):
 * - El codi de pàgina es registra amb chrome.userScripts (cal «Permet els scripts d'usuari»).
 * - La disfressa de les capçaleres va amb regles de declarativeNetRequest per a cada pestanya.
 * - Les galetes de tercers no arriben ni a desar-se: una regla en treu Set-Cookie i Cookie
 *   (excepte als bancs, pagaments i sistemes contra el frau).
 * - Les de seguiment que el web posa per capçalera es canvien per falses just després de desar-se
 *   (el Chromium no deixa reescriure-les abans); les que posa per JavaScript, abans.
 * - Quan tanques l'última pestanya d'un web, se'n menja les galetes i l'emmagatzematge.
 * El service worker es pot adormir: l'estat de les pestanyes es desa a chrome.storage.session.
 */
importScripts("lib/navegador.js", "lib/comu.js");

const TOTS = ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest",
  "ping", "csp_report", "media", "websocket", "webtransport", "webbundle", "other"];
const ID_SCRIPT = "menja-galetes";

let cfg = null;
let codiComu = "";
let codiPagina = "";
let pestanyes = new Map();   // tabId -> {lloc, origens:[], galetes:[], funcionament:[], avis}
const disfresses = new Map();
let llocsProtegits = new Set();
let scriptsUsuari = null;

/* ---- Configuració ---- */

async function carregaConfig() {
  const s = await chrome.storage.local.get(null);
  const c = Object.assign({}, MG.PER_DEFECTE, s.config || {});
  c.falseja = Object.assign({}, MG.PER_DEFECTE.falseja, (s.config || {}).falseja || {});
  if (!s.secret) {
    s.secret = MG.hex(32);
    await chrome.storage.local.set({ secret: s.secret });
  }
  const versio = (/Chrome\/(\d+)/.exec(navigator.userAgent) || [])[1] || "156";
  cfg = Object.assign(c, {
    secret: s.secret, epoch: s.epoch || 0, epochLloc: s.epochLloc || {}, paisIP: s.paisIP || "ES",
    versio, navegador: "chrome", protegides: new Set(s.protegides || []), realAuto: s.realAuto || [],
  });
  llocsProtegits = new Set([...cfg.protegides].map((k) => MG.lloc(k.split("|")[0])));
  disfresses.clear();
}

function perAPagina() {
  const { actiu, avisos, identificador, disfressa, pais, falseja, confianca, realAuto, secret, epoch, epochLloc, paisIP, versio, navegador } = cfg;
  return { actiu, avisos, identificador, disfressa, pais, falseja, confianca, realAuto, secret, epoch, epochLloc, paisIP, versio, navegador };
}

const disfressaDe = (lloc) => {
  let d = disfresses.get(lloc);
  if (!d) { d = MG.disfressa(cfg, lloc, null); disfresses.set(lloc, d); }
  return d;
};
const clauGaleta = (c) => `${c.domain.replace(/^\./, "")}|${c.name}`;
const confiat = (lloc) => MG.esConfiat(lloc, cfg.confianca) || cfg.realAuto.includes(lloc);
const deConfianca = (lloc) => !!lloc && (cfg.confianca || []).some((w) => MG.lloc(w) === lloc);
const esReal = (host) => !!host && (MG.esIdentitatReal(host) || cfg.realAuto.includes(MG.lloc(host)) || deConfianca(MG.lloc(host)));
const hostDe = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname : ""; } catch (e) { return ""; } };

/* ---- El codi de pàgina (scripts d'usuari) ---- */

async function registra() {
  if (!chrome.userScripts) { scriptsUsuari = false; return; }
  const codi = `(function () {\n${codiComu}\n;(${codiPagina.trim()})(MG, ${JSON.stringify(perAPagina())});\n})();`;
  try {
    const ara = await chrome.userScripts.getScripts({ ids: [ID_SCRIPT] });
    if (!cfg.actiu) {
      if (ara.length) await chrome.userScripts.unregister({ ids: [ID_SCRIPT] });
      scriptsUsuari = true;
      return;
    }
    const nou = { id: ID_SCRIPT, matches: ["<all_urls>"], js: [{ code: codi }], runAt: "document_start", world: "MAIN", allFrames: true };
    if (ara.length && ara[0].js && ara[0].js[0] && ara[0].js[0].code === codi) { scriptsUsuari = true; return; }
    if (ara.length) await chrome.userScripts.update([nou]);
    else await chrome.userScripts.register([nou]);
    scriptsUsuari = true;
  } catch (e) {
    scriptsUsuari = false;   // l'interruptor «Permet els scripts d'usuari» és apagat
  }
  await chrome.storage.session.set({ scriptsUsuari });
}

/* ---- Regles de xarxa ---- */

async function regles() {
  const params = MG.PARAMS_LLISTA;
  const protegits = [...MG.SEMPRE_REAL, ...MG.ANTIFRAU];
  // Fora els identificadors dels enllaços (fbclid, gclid, utm_…): una regla per paràmetre
  // («^» vol dir «després d'un ? o un &»), perquè un sol patró amb tots passa del límit.
  const enllacos = params.map((nom, i) => ({
    id: 100 + i, priority: 1,
    action: { type: "redirect", redirect: { transform: { queryTransform: { removeParams: params } } } },
    condition: { urlFilter: `^${nom}=`, resourceTypes: ["main_frame", "sub_frame"] },
  }));
  const totes = [
    ...enllacos,
    // Sense ETag als tercers.
    { id: 2, priority: 1, action: { type: "modifyHeaders", requestHeaders: [{ header: "if-none-match", operation: "remove" }] },
      condition: { domainType: "thirdParty", resourceTypes: TOTS.filter((t) => t !== "main_frame") } },
    // Les galetes de tercers no es desen ni s'envien.
    { id: 4, priority: 1, action: { type: "modifyHeaders", requestHeaders: [{ header: "cookie", operation: "remove" }],
      responseHeaders: [{ header: "set-cookie", operation: "remove" }] },
      condition: { domainType: "thirdParty", resourceTypes: TOTS.filter((t) => t !== "main_frame") } },
    // Bancs, pagaments, governs i sistemes contra el frau: no es toca res.
    { id: 3, priority: 100, action: { type: "allow" }, condition: { requestDomains: protegits, resourceTypes: TOTS } },
  ];
  const ara = (await chrome.declarativeNetRequest.getDynamicRules()).map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ara, addRules: cfg.actiu ? totes : [] });
}

// La disfressa de les capçaleres d'una pestanya (una regla per pestanya).
async function capcaleres(tabId, host) {
  const id = tabId + 1000;
  const lloc = MG.lloc(host);
  const afegeix = [];
  if (cfg.actiu && lloc && !esReal(host)) {
    const d = disfressaDe(lloc);
    const f = cfg.falseja;
    const hs = [];
    if (f.navegador) {
      hs.push({ header: "user-agent", operation: "set", value: d.ua });
      hs.push({ header: "sec-ch-ua-platform", operation: "set", value: `"${d.uaDades.platform}"` });
    }
    if (f.idioma) hs.push({ header: "accept-language", operation: "set", value: d.acceptLanguage });
    if (f.ipCapcaleres && d.ip) hs.push({ header: "x-forwarded-for", operation: "set", value: d.ip });
    if (hs.length) afegeix.push({ id, priority: 1, action: { type: "modifyHeaders", requestHeaders: hs }, condition: { tabIds: [tabId], resourceTypes: TOTS } });
  }
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id], addRules: afegeix }); } catch (e) { /* res */ }
}

/* ---- Pestanyes ---- */

let desant = null;
function desaPestanyes() {
  clearTimeout(desant);
  desant = setTimeout(() => chrome.storage.session.set({ pestanyes: [...pestanyes] }), 150);
}

function estatPestanya(tabId, lloc, origen) {
  let p = pestanyes.get(tabId);
  if (!p || p.lloc !== lloc) {
    if (p && p.lloc) potserMenja(p.lloc);
    p = { lloc, origens: [], galetes: [], funcionament: [], avis: null };
    pestanyes.set(tabId, p);
  }
  if (origen && !p.origens.includes(origen)) p.origens.push(origen);
  chrome.alarms.clear("menja|" + lloc);
  desaPestanyes();
  return p;
}

function anota(tabId, lloc, entrada) {
  const p = pestanyes.get(tabId);
  if (!p || p.lloc !== lloc) return;
  if (!p.galetes.some((g) => g.nom === entrada.nom && g.domini === entrada.domini)) {
    p.galetes.push(entrada);
    desaPestanyes();
  }
}

const obert = (lloc) => [...pestanyes.values()].some((p) => p.lloc === lloc);

function potserMenja(lloc) {
  if (!lloc || !cfg.actiu || obert(lloc)) return;
  chrome.alarms.create("menja|" + lloc, { delayInMinutes: Math.max(cfg.retardMenjar, 1) / 60 });
}

async function menja(lloc, { obertes = false, protegides = false } = {}) {
  if (!lloc || (!obertes && obert(lloc))) return 0;
  const real = esReal(lloc);
  const llistes = [];
  try { llistes.push(await chrome.cookies.getAll({ domain: lloc })); } catch (e) { /* res */ }
  for (const esquema of ["https://", "http://"]) {
    try { llistes.push(await chrome.cookies.getAll({ partitionKey: { topLevelSite: esquema + lloc } })); } catch (e) { /* res */ }
  }
  let n = 0;
  const vistes = new Set();
  for (const llista of llistes) {
    for (const c of llista) {
      const id = `${c.domain}|${c.name}|${c.path}|${JSON.stringify(c.partitionKey || null)}`;
      if (vistes.has(id)) continue;
      vistes.add(id);
      if (!protegides && cfg.protegides.has(clauGaleta(c)) && !MG.esSeguiment(c.name)) continue;
      if (real) {
        const tercer = !!c.partitionKey || MG.lloc(c.domain) !== lloc;
        if (MG.esProtegitFrau(c.domain.replace(/^\./, "")) && !(MG.esSeguiment(c.name) && MG.lloc(c.domain) === lloc)) continue;
        if (!tercer && !MG.esSeguiment(c.name)) continue;
      }
      const det = { url: (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path, name: c.name, storeId: c.storeId };
      if (c.partitionKey) det.partitionKey = c.partitionKey;
      try { if (await chrome.cookies.remove(det)) n++; } catch (e) { /* res */ }
    }
  }
  if (!real && (protegides || !llocsProtegits.has(lloc))) {
    const origens = new Set([`https://${lloc}`, `http://${lloc}`, `https://www.${lloc}`, `http://www.${lloc}`]);
    for (const p of pestanyes.values()) if (p.lloc === lloc) p.origens.forEach((o) => origens.add(o));
    try {
      await chrome.browsingData.remove({ origins: [...origens] },
        { localStorage: true, indexedDB: true, cacheStorage: true, serviceWorkers: true, fileSystems: true });
    } catch (e) { /* res */ }
  }
  if (protegides) {
    for (const k of [...cfg.protegides]) if (MG.lloc(k.split("|")[0]) === lloc) cfg.protegides.delete(k);
    llocsProtegits.delete(lloc);
    await chrome.storage.local.set({ protegides: [...cfg.protegides] });
  }
  return n;
}

/* ---- Galetes de seguiment posades per capçalera: falses just després ---- */

async function galetesResposta(det) {
  await llest;
  if (!cfg.actiu || !cfg.falseja.galetes || det.tabId < 0) return;
  const linies = (det.responseHeaders || []).filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
  if (!linies.length) return;
  // El web de dalt és el de la pestanya (l'«initiator» pot ser un marc d'un altre web).
  const hostSup = det.type === "main_frame" ? hostDe(det.url) : (pestanyes.get(det.tabId) || {}).lloc || hostDe(det.initiator || "");
  const llocSup = MG.lloc(hostSup);
  const host = hostDe(det.url);
  const llocReq = MG.lloc(host);
  if (!llocSup || !host) return;
  if (llocReq !== llocSup && MG.esProtegitFrau(host)) return;
  const real = esReal(hostSup);
  for (const linia of linies) {
    const [nv, ...attrs] = linia.split(";");
    const i = nv.indexOf("=");
    if (i <= 0) continue;
    const nom = nv.slice(0, i).trim();
    const valor = nv.slice(i + 1).trim();
    if (attrs.some((a) => /^\s*max-age\s*=\s*(-|0\s*$)/i.test(a))) continue;
    if (!MG.esSeguiment(nom)) {
      if (!real && llocReq === llocSup) {
        const p = pestanyes.get(det.tabId);
        if (p && p.lloc === llocSup && !p.funcionament.includes(nom)) { p.funcionament.push(nom); desaPestanyes(); }
      }
      continue;
    }
    // De seguiment: la canviem per una de falsa, de sessió.
    let c = null;
    for (let intent = 0; intent < 3 && !c; intent++) {
      try { c = await chrome.cookies.get({ url: det.url, name: nom }); } catch (e) { /* res */ }
      if (!c) await new Promise((r) => setTimeout(r, 80));
    }
    if (!c || c.value !== valor) continue;   // no s'ha desat, o ja l'han canviat
    const fals = MG.galetaFalsa(nom, valor);
    const nova = { url: (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path, name: c.name, value: fals,
      path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, storeId: c.storeId };
    if (!c.hostOnly) nova.domain = c.domain;
    if (c.partitionKey) nova.partitionKey = c.partitionKey;
    try {
      await chrome.cookies.set(nova);
      anota(det.tabId, llocSup, { nom, original: valor, fals, via: llocReq !== llocSup ? "tercer" : "http", domini: llocReq });
    } catch (e) { /* res */ }
  }
}

/* ---- Bancs, governs i sistemes contra el frau ---- */

const marcant = new Set();
async function marcaReal(lloc, tabId, recarrega) {
  if (!lloc || confiat(lloc) || marcant.has(lloc)) return;
  marcant.add(lloc);
  cfg.realAuto.push(lloc);
  await chrome.storage.local.set({ realAuto: cfg.realAuto });
  disfresses.delete(lloc);
  await registra();
  marcant.delete(lloc);
  if (tabId >= 0) {
    try { const t = await chrome.tabs.get(tabId); await capcaleres(tabId, hostDe(t.url || "")); } catch (e) { /* res */ }
    if (recarrega) chrome.tabs.reload(tabId);
  }
}

async function detectaAntifrau(det) {
  await llest;
  if (!cfg.actiu || det.tabId < 0 || !MG.esAntifrau(hostDe(det.url))) return;
  const hostSup = (pestanyes.get(det.tabId) || {}).lloc || hostDe(det.initiator || "");
  const lloc = MG.lloc(hostSup);
  if (!lloc || esReal(hostSup)) return;
  marcaReal(lloc, det.tabId, true);
}

/* ---- El país de la connexió ---- */

async function comprovaPais() {
  if (!cfg.actiu) return;
  let nou;
  try {
    const r = await fetch(cfg.urlPais, { cache: "no-store", credentials: "omit" });
    const m = /^loc=([A-Z]{2})$/m.exec(await r.text());
    if (!m) return;
    nou = m[1];
  } catch (e) { return; }
  const { paisIP: vell } = await chrome.storage.local.get("paisIP");
  if (nou === vell) return;
  await chrome.storage.local.set({ paisIP: nou });
  cfg.paisIP = nou;
  disfresses.clear();
  if (!vell || !cfg.canviPais) { await registra(); return; }
  cfg.epoch += 1;
  await chrome.storage.local.set({ epoch: cfg.epoch });
  disfresses.clear();
  await registra();
  for (const [tabId, p] of pestanyes) if (p.lloc) await capcaleres(tabId, p.lloc);
  const llocs = new Set();
  try { for (const c of await chrome.cookies.getAll({})) llocs.add(MG.lloc(c.domain)); } catch (e) { /* res */ }
  let n = 0;
  for (const l of llocs) n += await menja(l, { obertes: true });
  const p = MG.PAISOS[nou];
  const de = p ? p.de : `de ${nou}`;
  const d = MG.disfressa(cfg, "exemple", null);
  chrome.notifications.create("pais", {
    type: "basic", iconUrl: chrome.runtime.getURL("icones/galeta-96.png"),
    title: `La teva IP ara és ${de}`,
    message: `T'he posat una disfressa ${de} (${d.nom.toLowerCase()}) i m'he menjat ${n} galetes. Fes clic aquí per tornar a carregar les pestanyes obertes.`,
  });
}

/* ---- Missatges ---- */

async function tracta(m, sender) {
  await llest;
  const tabId = sender.tab ? sender.tab.id : -1;
  switch (m.tipus) {
    case "galeta":
      anota(tabId, m.lloc, { nom: m.nom, original: m.original, fals: m.fals, via: m.via, domini: m.lloc });
      return null;
    case "avis": {
      const p = pestanyes.get(tabId);
      if (p) { p.avis = { accio: m.accio, cmp: m.cmp }; desaPestanyes(); }
      return null;
    }
    case "identitat":
      await marcaReal(m.lloc, tabId, true);
      return null;
    case "estat": {
      const p = pestanyes.get(m.tabId) || {};
      return { cfg: perAPagina(), confiancaUsuari: cfg.confianca, realAuto: cfg.realAuto, scriptsUsuari,
        lloc: p.lloc || m.lloc || "", galetes: p.galetes || [], funcionament: p.funcionament || [], avis: p.avis || null };
    }
    case "menjaAra": {
      cfg.epochLloc[m.lloc] = (cfg.epochLloc[m.lloc] || 0) + 1;
      await chrome.storage.local.set({ epochLloc: cfg.epochLloc });
      disfresses.delete(m.lloc);
      const n = await menja(m.lloc, { obertes: true, protegides: true });
      const p = pestanyes.get(m.tabId);
      if (p) { p.galetes = []; p.funcionament = []; p.avis = null; desaPestanyes(); }
      await registra();
      if (m.tabId >= 0) { await capcaleres(m.tabId, m.lloc); chrome.tabs.reload(m.tabId); }
      return { menjades: n };
    }
    case "confia": {
      const llista = cfg.confianca.filter((w) => MG.lloc(w) !== m.lloc);
      if (m.si) llista.push(m.lloc);
      await desaConfig({ confianca: llista });
      if (m.tabId >= 0) chrome.tabs.reload(m.tabId);
      return { confianca: llista };
    }
    case "actiu":
      await desaConfig({ actiu: !!m.si });
      return { actiu: !!m.si };
    case "comprovaPais":
      await comprovaPais();
      return { paisIP: cfg.paisIP };
    default:
      return null;
  }
}

async function desaConfig(canvis) {
  const { config = {} } = await chrome.storage.local.get("config");
  await chrome.storage.local.set({ config: Object.assign(config, canvis) });
}

/* ---- Instal·lació i arrencada ---- */

async function primeraVegada() {
  const protegides = new Set();
  let totes = [];
  try { totes = await chrome.cookies.getAll({}); } catch (e) { /* res */ }
  for (const c of totes) {
    if (MG.esSeguiment(c.name) && !MG.esProtegitFrau(c.domain.replace(/^\./, ""))) {
      const det = { url: (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path, name: c.name, storeId: c.storeId };
      if (c.partitionKey) det.partitionKey = c.partitionKey;
      try { await chrome.cookies.remove(det); } catch (e) { /* res */ }
    } else {
      protegides.add(clauGaleta(c));
    }
  }
  await chrome.storage.local.set({ protegides: [...protegides], installada: Date.now() });
}

async function neteja() {
  const llocs = new Set();
  try { for (const c of await chrome.cookies.getAll({})) llocs.add(MG.lloc(c.domain)); } catch (e) { /* res */ }
  for (const l of llocs) if (!obert(l)) await menja(l, {});
}

async function inicia() {
  codiComu = await (await fetch(chrome.runtime.getURL("lib/comu.js"))).text();
  codiPagina = await (await fetch(chrome.runtime.getURL("pagina.js"))).text();
  await carregaConfig();
  const s = await chrome.storage.session.get(["pestanyes", "scriptsUsuari"]);
  if (s.pestanyes) pestanyes = new Map(s.pestanyes);
  await registra();
  await regles();
  if (!(await chrome.alarms.get("pais"))) chrome.alarms.create("pais", { periodInMinutes: cfg.minutsPais });
}
const llest = inicia();

/* ---- Gestors (es registren de seguida, perquè el service worker es pot despertar per qualsevol) ---- */

chrome.runtime.onInstalled.addListener(async (d) => {
  await llest;
  if (d.reason === "install") { await primeraVegada(); await carregaConfig(); await registra(); }
  for (const t of await chrome.tabs.query({})) {
    const host = hostDe(t.url || "");
    if (host) { estatPestanya(t.id, MG.lloc(host), new URL(t.url).origin); await capcaleres(t.id, host); }
  }
  comprovaPais();
});

chrome.runtime.onStartup.addListener(async () => {
  await llest;
  pestanyes = new Map();
  for (const t of await chrome.tabs.query({})) {
    const host = hostDe(t.url || "");
    if (host) { estatPestanya(t.id, MG.lloc(host), new URL(t.url).origin); await capcaleres(t.id, host); }
  }
  await neteja();
  comprovaPais();
});

chrome.webNavigation.onBeforeNavigate.addListener(async (det) => {
  if (det.frameId !== 0) return;
  await llest;
  const host = hostDe(det.url);
  if (host) estatPestanya(det.tabId, MG.lloc(host), new URL(det.url).origin);
  await capcaleres(det.tabId, host);
});

chrome.tabs.onUpdated.addListener(async (tabId, canvi) => {
  if (!canvi.url) return;
  await llest;
  const host = hostDe(canvi.url);
  if (host) { estatPestanya(tabId, MG.lloc(host), new URL(canvi.url).origin); return; }
  const p = pestanyes.get(tabId);
  if (p && p.lloc) {
    const vell = p.lloc;
    pestanyes.set(tabId, { lloc: "", origens: [], galetes: [], funcionament: [], avis: null });
    desaPestanyes();
    potserMenja(vell);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await llest;
  const p = pestanyes.get(tabId);
  pestanyes.delete(tabId);
  desaPestanyes();
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId + 1000] }); } catch (e) { /* res */ }
  if (p && p.lloc) potserMenja(p.lloc);
});

chrome.alarms.onAlarm.addListener(async (a) => {
  await llest;
  if (a.name === "pais") comprovaPais();
  else if (a.name.startsWith("menja|")) await menja(a.name.slice(6), {});
});

chrome.webRequest.onResponseStarted.addListener(galetesResposta, { urls: ["<all_urls>"] }, ["responseHeaders", "extraHeaders"]);
chrome.webRequest.onBeforeRequest.addListener(detectaAntifrau, { urls: ["<all_urls>"] });
chrome.webRequest.onErrorOccurred.addListener(detectaAntifrau, { urls: ["<all_urls>"] });

chrome.notifications.onClicked.addListener(async (id) => {
  if (id !== "pais") return;
  await llest;
  for (const t of await chrome.tabs.query({})) if (!confiat(MG.llocDeUrl(t.url || ""))) chrome.tabs.reload(t.id);
});

chrome.runtime.onMessage.addListener((m, sender, resposta) => {
  tracta(m, sender).then(resposta, () => resposta(null));
  return true;
});

chrome.storage.onChanged.addListener(async (canvis, area) => {
  if (area !== "local" || !canvis.config) return;
  await llest;
  await carregaConfig();
  await registra();
  await regles();
  for (const [tabId, p] of pestanyes) if (p.lloc) await capcaleres(tabId, p.lloc);
});
