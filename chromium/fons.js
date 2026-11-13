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
const SENSE_DOCUMENT = TOTS.filter((t) => t !== "main_frame");
const ID_SCRIPT = "menja-galetes";
// Les regles de cada web (vegeu reglesLloc) fan servir números d'aquí en amunt; les de les pestanyes,
// tabId + 1000. Cada web té el seu número, desat (numLloc), sense col·lisions.
const PRIMER_ID_LLOC = 1000000000, MAX_LLOCS = 600;
let numLloc = {};             // lloc (o «h:host») -> {id, t}
let disfressesDia = "";

let cfg = null;
let codiComu = "";
let codiPagina = "";
let pestanyes = new Map();   // tabId -> {lloc, origens:[], galetes:[], funcionament:[], avis}
const disfresses = new Map();
let llocsProtegits = new Set();
let scriptsUsuari = null;
// Les galetes velles: quan vas per última vegada a cada web (vegeu menjaVelles).
let visites = {};
let visitesDesDe = Date.now();
let desantVisites = null;
// El resum de la setmana (vegeu MG.suma).
const resumEstat = { resum: null, anterior: null };
let desantResum = null;
// Webs sense disfressa durant una estona (el botó «Compara-la sense disfressa»): lloc -> fins quan.
// Es desa a storage.session, perquè el service worker es pot adormir.
let realTemporal = {};
const temporal = (lloc) => (realTemporal[lloc] || 0) > Date.now();

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
  const { actiu, avisos, identificador, disfressa, pais, falseja, confianca, secret, epoch, epochLloc, paisIP, versio, navegador, gpc } = cfg;
  const realAuto = [...cfg.realAuto, ...Object.keys(realTemporal).filter(temporal)];
  return { actiu, avisos, identificador, disfressa, pais, falseja, confianca, realAuto, secret, epoch, epochLloc, paisIP, versio, navegador, gpc };
}

const disfressaDe = (lloc) => {
  // En el mode «una al dia», a mitjanit canvia (vegeu l'alarma «mitjanit»).
  if (cfg.disfressa === "dia" && disfressesDia !== MG.avui()) { disfresses.clear(); disfressesDia = MG.avui(); }
  let d = disfresses.get(lloc);
  if (!d) { d = MG.disfressa(cfg, lloc, null); disfresses.set(lloc, d); }
  return d;
};
const clauGaleta = (c) => `${c.domain.replace(/^\./, "")}|${c.name}`;
const confiat = (lloc) => MG.esConfiat(lloc, cfg.confianca) || cfg.realAuto.includes(lloc) || temporal(lloc);
const deConfianca = (lloc) => !!lloc && (cfg.confianca || []).some((w) => MG.lloc(w) === lloc);
const esReal = (host) => !!host && (MG.esIdentitatReal(host) || cfg.realAuto.includes(MG.lloc(host)) || deConfianca(MG.lloc(host)) || temporal(MG.lloc(host)));
const hostDe = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname : ""; } catch (e) { return ""; } };

/* ---- El codi de pàgina (scripts d'usuari) ---- */

// En fila: dues alhora farien que la segona fallés (el mateix id) i semblaria que falta el permís.
let registrant = Promise.resolve();
function registra() {
  registrant = registrant.then(fesRegistra, fesRegistra);
  return registrant;
}
async function fesRegistra() {
  scriptsUsuari = await provaRegistra();
  await chrome.storage.session.set({ scriptsUsuari });
  insignia();
}
async function provaRegistra() {
  if (!chrome.userScripts) return false;
  const codi = `(function () {\n${codiComu}\n;(${codiPagina.trim()})(MG, ${JSON.stringify(perAPagina())});\n})();`;
  try {
    const ara = await chrome.userScripts.getScripts({ ids: [ID_SCRIPT] });
    if (!cfg.actiu) {
      if (ara.length) await chrome.userScripts.unregister({ ids: [ID_SCRIPT] });
      return true;
    }
    const nou = { id: ID_SCRIPT, matches: ["<all_urls>"], js: [{ code: codi }], runAt: "document_start", world: "MAIN", allFrames: true };
    if (ara.length && ara[0].js && ara[0].js[0] && ara[0].js[0].code === codi) return true;
    if (ara.length) await chrome.userScripts.update([nou]);
    else await chrome.userScripts.register([nou]);
    return true;
  } catch (e) {
    return false;   // l'interruptor «Permet els scripts d'usuari» és apagat
  }
}

// Mentre falti el permís (i l'extensió és encesa), la icona porta un «!» vermell.
function insignia() {
  const falta = scriptsUsuari === false && !!cfg && cfg.actiu;
  chrome.action.setBadgeText({ text: falta ? "!" : "" }).catch(() => {});
  if (falta) chrome.action.setBadgeBackgroundColor({ color: "#B5463A" }).catch(() => {});
}

// Torna a carregar les pestanyes perquè s'hi posi la disfressa. Mai els bancs, els governs, les xarxes
// ni els webs de confiança: hi podries tenir un pagament a mitges.
async function recarregaPestanyes() {
  let n = 0;
  for (const t of await chrome.tabs.query({})) {
    const h = hostDe(t.url || "");
    if (h && !esReal(h)) { chrome.tabs.reload(t.id); n++; }
  }
  return n;
}

/* ---- Regles de xarxa ---- */

async function regles() {
  const params = MG.PARAMS_LLISTA;
  const protegits = [...MG.SEMPRE_REAL, ...MG.ANTIFRAU, ...MG.SSO];
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
  const senseDocument = TOTS.filter((t) => t !== "main_frame");
  // «No venguis les meves dades» (GPC), a tots els webs (també als bancs: per això va per sobre de la 3).
  if (cfg.gpc) totes.push({ id: 8, priority: 200, action: { type: "modifyHeaders", requestHeaders: [{ header: "sec-gpc", operation: "set", value: "1" }] },
    condition: { resourceTypes: TOTS } });
  // Els gravadors de sessió: no es carreguen ni envien res (llevat del seu propi web).
  if (cfg.gravadors) totes.push({ id: 7, priority: 1, action: { type: "block" },
    condition: { requestDomains: MG.DOMINIS_GRAVADORS, excludedInitiatorDomains: MG.DOMINIS_GRAVADORS, resourceTypes: senseDocument } });
  const regex = [];
  // Els píxels espia dels correus.
  if (cfg.espies) MG.ESPIES.forEach((e, i) => regex.push({ id: 300 + i, priority: 1, action: { type: "block" },
    condition: { regexFilter: e.re, resourceTypes: senseDocument } }));
  // Els rebots dels enllaços: a rebot.html, que en treu el destí i hi va directament.
  if (cfg.rebots) MG.REBOTS.forEach((r, i) => regex.push({ id: 400 + i, priority: 2,
    action: { type: "redirect", redirect: { regexSubstitution: chrome.runtime.getURL("rebot.html") + "#\\0" } },
    condition: { regexFilter: r.re + ".*", resourceTypes: ["main_frame"] } }));
  // Una expressió que el Chromium no accepti faria fallar totes les regles: es comproven abans.
  for (const r of regex) {
    try { if ((await chrome.declarativeNetRequest.isRegexSupported({ regex: r.condition.regexFilter })).isSupported) totes.push(r); } catch (e) { /* fora */ }
  }
  const ara = (await chrome.declarativeNetRequest.getDynamicRules()).map((r) => r.id).filter((id) => id < PRIMER_ID_LLOC);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ara, addRules: cfg.actiu ? totes : [] });
}

// Les capçaleres de la disfressa d'un web, o null si hi va sense (real, de confiança, apagat…).
function capcaleresDe(host) {
  const lloc = MG.lloc(host);
  if (!cfg.actiu || !lloc || esReal(host)) return null;
  const d = disfressaDe(lloc);
  const f = cfg.falseja;
  const hs = [];
  if (f.navegador) {
    const u = d.uaDades;
    hs.push({ header: "user-agent", operation: "set", value: d.ua });
    // També les pistes del navegador (client hints) que un web pot demanar amb Accept-CH: si no,
    // portarien les de debò (Linux, la versió del sistema, x86…).
    hs.push({ header: "sec-ch-ua-platform", operation: "set", value: `"${u.platform}"` });
    hs.push({ header: "sec-ch-ua-platform-version", operation: "set", value: `"${u.platformVersion}"` });
    hs.push({ header: "sec-ch-ua-arch", operation: "set", value: `"${u.architecture}"` });
    hs.push({ header: "sec-ch-ua-bitness", operation: "set", value: `"${u.bitness}"` });
    hs.push({ header: "sec-ch-ua-model", operation: "set", value: '""' });
    hs.push({ header: "sec-ch-ua-wow64", operation: "set", value: "?0" });
    hs.push({ header: "sec-ch-ua-mobile", operation: "set", value: "?0" });
  }
  if (f.idioma && d.acceptLanguage) hs.push({ header: "accept-language", operation: "set", value: d.acceptLanguage });
  if (f.ipCapcaleres && d.ip) hs.push({ header: "x-forwarded-for", operation: "set", value: d.ip });
  return hs.length ? hs : null;
}

// El número de les regles d'un web (o d'un host, «h:…»). Si n'hi ha massa, es treuen les del més vell.
let desantNums = null;
function desaNums() { clearTimeout(desantNums); desantNums = setTimeout(() => chrome.storage.local.set({ numLloc }), 500); }
async function idDe(clau, crea = true) {
  if (numLloc[clau]) { numLloc[clau].t = Date.now(); desaNums(); return numLloc[clau].id; }
  if (!crea) return null;
  const usats = new Set(Object.values(numLloc).map((x) => x.id));
  let id = PRIMER_ID_LLOC;
  while (usats.has(id)) id++;
  numLloc[clau] = { id, t: Date.now() };
  const claus = Object.keys(numLloc);
  if (claus.length > MAX_LLOCS) {
    const vell = claus.sort((a, b) => numLloc[a].t - numLloc[b].t)[0];
    const idVell = numLloc[vell].id;
    delete numLloc[vell];
    try { await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [idVell] }); } catch (e) { /* res */ }
    try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [idVell] }); } catch (e) { /* res */ }
  }
  desaNums();
  return id;
}

// Les regles d'un web: el document (main_frame), que es desa i es queda (així, quan hi tornes, la
// petició del document ja surt disfressada: la de la pestanya arribaria tard), i les peticions que el
// web fa sense pestanya (el seu service worker, els treballadors compartits).
function reglesDe(lloc, id) {
  const hs = capcaleresDe(lloc);
  if (!hs) return { dinamiques: [], sessio: [] };
  const accio = { type: "modifyHeaders", requestHeaders: hs };
  return {
    dinamiques: [{ id, priority: 2, action: accio, condition: { requestDomains: [lloc], resourceTypes: ["main_frame"] } }],
    sessio: [{ id, priority: 1, action: accio, condition: { tabIds: [-1], initiatorDomains: [lloc], resourceTypes: TOTS } }],
  };
}
async function reglesLloc(lloc) {
  if (!lloc) return;
  const real = !capcaleresDe(lloc);
  const id = await idDe(lloc, !real);
  if (id === null) return;
  const { dinamiques, sessio } = reglesDe(lloc, id);
  try { await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [id], addRules: dinamiques }); } catch (e) { /* res */ }
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id], addRules: sessio }); } catch (e) { /* res */ }
}
// Un host que va sense disfressa dins d'un web que sí que en porta (sede.exemple.com): el seu
// document, tal qual.
async function excepcioHost(host) {
  const id = await idDe("h:" + host);
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [id],
      addRules: [{ id, priority: 3, action: { type: "allow" }, condition: { requestDomains: [host], resourceTypes: ["main_frame"] } }] });
  } catch (e) { /* res */ }
}
// Totes de cop (quan canvia la configuració, el país o el dia).
async function totesReglesLloc() {
  const ids = [], dinamiques = [], sessio = [];
  for (const [clau, { id }] of Object.entries(numLloc)) {
    if (clau.startsWith("h:")) continue;
    ids.push(id);
    const rs = reglesDe(clau, id);
    dinamiques.push(...rs.dinamiques);
    sessio.push(...rs.sessio);
  }
  try { await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids, addRules: dinamiques }); } catch (e) { /* res */ }
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids, addRules: sessio }); } catch (e) { /* res */ }
}

// La disfressa de les capçaleres d'una pestanya: la regla de la pestanya (tot menys el document,
// que va per la regla del web) i les del web.
async function capcaleres(tabId, host) {
  const id = tabId + 1000;
  const lloc = MG.lloc(host);
  const hs = lloc ? capcaleresDe(host) : null;
  const afegeix = hs ? [{ id, priority: 1, action: { type: "modifyHeaders", requestHeaders: hs }, condition: { tabIds: [tabId], resourceTypes: SENSE_DOCUMENT } }] : [];
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id], addRules: afegeix }); } catch (e) { /* res */ }
  if (lloc) await reglesLloc(lloc);
  if (lloc && host !== lloc && esReal(host) && !esReal(lloc)) await excepcioHost(host);
}

// Si la disfressa fa que un web es torni a carregar sense parar: a partir d'ara, sense disfressa.
const carregues = new Map();
function avisaBucle(lloc) {
  chrome.notifications.create("bucle|" + lloc, {
    type: "basic", iconUrl: chrome.runtime.getURL("icones/galeta-96.png"),
    title: `${lloc}: ara sense disfressa`,
    message: `Amb la disfressa, ${lloc} es tornava a carregar sense parar. Durant un dia hi vas amb el navegador de debò. Les galetes de seguiment i les de tercers, me les continuo menjant.`,
  });
}

/* ---- Pestanyes ---- */

let desant = null;
function desaPestanyes() {
  clearTimeout(desant);
  desant = setTimeout(() => chrome.storage.session.set({ pestanyes: [...pestanyes] }), 150);
}

const estatBuit = (lloc) => ({ lloc, origens: [], galetes: [], funcionament: [], avis: null, pendent: null, gravadors: [], espies: [], espiesN: 0 });

// Quan la pestanya demana un web nou: encara no hi és (pot ser una baixada). Les galetes
// d'aquesta càrrega s'apunten a part, a «pendent».
function preparaPestanya(tabId, lloc, origen) {
  let p = pestanyes.get(tabId);
  if (!p) { p = estatBuit(""); pestanyes.set(tabId, p); }
  p.pendent = p.lloc === lloc ? null : { lloc, origen, galetes: [], funcionament: [], gravadors: [], espies: [], espiesN: 0 };
  chrome.alarms.clear("menja|" + lloc);
  desaPestanyes();
}

// Quan la pàgina ja hi és: ara sí, el web d'abans ha marxat.
function estatPestanya(tabId, lloc, origen) {
  visita(lloc);
  let p = pestanyes.get(tabId);
  if (!p || p.lloc !== lloc) {
    const vell = p ? p.lloc : "";
    const nou = estatBuit(lloc);
    if (p && p.pendent && p.pendent.lloc === lloc) {
      for (const k of ["galetes", "funcionament", "gravadors", "espies", "espiesN"]) if (p.pendent[k] !== undefined) nou[k] = p.pendent[k];
    }
    pestanyes.set(tabId, nou);
    p = nou;
    if (vell) potserMenja(vell);
  } else {
    p.pendent = null;
  }
  if (origen && !p.origens.includes(origen)) p.origens.push(origen);
  chrome.alarms.clear("menja|" + lloc);
  desaPestanyes();
  return p;
}

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
    desaPestanyes();
    compta("galetes", MG.empresa(entrada.nom, entrada.domini));
  }
}

// Un gravador o un espia menjat en aquesta pestanya (per a la finestreta). Torna si és nou.
function apunta(tabId, lloc, clau, nom) {
  const p = apuntDe(tabId, lloc);
  if (!p) return true;
  p[clau] = p[clau] || [];
  if (clau === "espies") p.espiesN = (p.espiesN || 0) + 1;
  desaPestanyes();
  if (p[clau].includes(nom)) return false;
  p[clau].push(nom);
  return true;
}

// Una cosa menjada més al resum de la setmana.
function compta(clau, empresa) {
  MG.suma(resumEstat, clau, empresa);
  clearTimeout(desantResum);
  desantResum = setTimeout(() => chrome.storage.local.set({ resum: resumEstat.resum, resumAnterior: resumEstat.anterior }), 1000);
}

// Quan vas a un web (per saber quines galetes són velles). Només els webs que tenen galetes
// protegides: de la resta no cal saber res (i no es desa un historial de tot el que mires).
function visita(lloc) {
  if (!lloc || !llocsProtegits.has(lloc)) return;
  visites[lloc] = Date.now();
  clearTimeout(desantVisites);
  desantVisites = setTimeout(() => chrome.storage.local.set({ visites }), 1000);
}

// Les galetes que ja hi havia en instal·lar-la (protegides, perquè no perdessis cap sessió):
// les dels webs on no vas fa més de cfg.velles dies, se les menja. Les dels webs de confiança,
// els oberts, i els pagaments, bancs i sistemes contra el frau, no.
async function menjaVelles(ara = Date.now()) {
  if (!cfg.actiu || !cfg.velles) return 0;
  cfg.protegides = new Set((await chrome.storage.local.get("protegides")).protegides || []);
  llocsProtegits = new Set([...cfg.protegides].map((k) => MG.lloc(k.split("|")[0])));
  let n = 0;
  for (const lloc of [...llocsProtegits]) {
    if (!lloc || obert(lloc) || deConfianca(lloc) || MG.esProtegitFrau(lloc)) continue;
    if (!MG.esVell(visites[lloc] || visitesDesDe, cfg.velles, ara)) continue;
    n += await menja(lloc, { protegides: true });
  }
  return n;
}

// Cada dilluns a les 9 (o en obrir el navegador, si ja han passat): el resum de la setmana passada.
async function avisaResum() {
  const setmana = MG.setmana();
  if (Date.now() < new Date(`${setmana}T09:00:00`).getTime()) return;
  const { resumAvisat } = await chrome.storage.local.get("resumAvisat");
  if (resumAvisat === setmana) return;
  if (resumEstat.resum && resumEstat.resum.setmana !== setmana) {
    resumEstat.anterior = MG.esSetmanaPassada(resumEstat.resum.setmana) ? resumEstat.resum : null;
    resumEstat.resum = MG.resumBuit(setmana);
  }
  await chrome.storage.local.set({ resumAvisat: setmana, resum: resumEstat.resum, resumAnterior: resumEstat.anterior });
  const r = resumEstat.anterior;
  if (!cfg.resumAvis || !r || !r.galetes || r.setmana !== MG.setmana(new Date(Date.now() - 7 * 864e5))) return;
  chrome.notifications.create("resum", {
    type: "basic", iconUrl: chrome.runtime.getURL("icones/galeta-96.png"),
    title: `La setmana passada em vaig menjar ${r.galetes} galetes`, message: MG.textResum(r),
  });
}

// Un web sense disfressa durant uns minuts, o tornar-lo a disfressar quan s'acaben.
async function canviaTemporal(lloc, fins) {
  if (fins) realTemporal[lloc] = fins; else delete realTemporal[lloc];
  await chrome.storage.session.set({ realTemporal });
  disfresses.delete(lloc);
  await registra();
  for (const [tabId, p] of pestanyes) if (p.lloc === lloc) await capcaleres(tabId, lloc);
  await reglesLloc(lloc);
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
        if (!tercer && !MG.esSeguiment(c.name, lloc)) continue;
      }
      const det = { url: (c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + c.path, name: c.name, storeId: c.storeId };
      if (c.partitionKey) det.partitionKey = c.partitionKey;
      try { if (await chrome.cookies.remove(det)) { n++; compta("galetes", MG.empresa(c.name, c.domain)); } } catch (e) { /* res */ }
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
    delete visites[lloc];
    await chrome.storage.local.set({ protegides: [...cfg.protegides], visites });
  }
  return n;
}

/* ---- Galetes de seguiment posades per capçalera: falses just després ---- */

// El magatzem de galetes d'una pestanya (el d'incògnit, si ho és).
async function magatzemDe(tabId) {
  try { for (const m of await chrome.cookies.getAllCookieStores()) if (m.tabIds.includes(tabId)) return m.id; } catch (e) { /* res */ }
  return null;
}

async function galetesResposta(det) {
  await llest;
  if (!cfg.actiu || !cfg.falseja.galetes || det.tabId < 0) return;
  const linies = (det.responseHeaders || []).filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
  if (!linies.length) return;
  // El web de dalt és el de la pestanya (l'«initiator» pot ser un marc d'un altre web); si
  // s'està carregant un web nou, el que es carrega.
  const pt = pestanyes.get(det.tabId) || {};
  const hostSup = det.type === "main_frame" ? hostDe(det.url) : (pt.pendent && pt.pendent.lloc) || pt.lloc || hostDe(det.initiator || "");
  const llocSup = MG.lloc(hostSup);
  const host = hostDe(det.url);
  const llocReq = MG.lloc(host);
  if (!llocSup || !host) return;
  if (llocReq !== llocSup && MG.esProtegitFrau(host)) return;
  const real = esReal(hostSup);
  let storeId;
  for (const linia of linies) {
    const [nv, ...attrs] = linia.split(";");
    const i = nv.indexOf("=");
    if (i <= 0) continue;
    const nom = nv.slice(0, i).trim();
    const valor = nv.slice(i + 1).trim();
    if (attrs.some((a) => /^\s*max-age\s*=\s*(-|0\s*$)/i.test(a))) continue;
    if (!MG.esSeguiment(nom, hostSup)) {
      if (!real && llocReq === llocSup) {
        const p = apuntDe(det.tabId, llocSup);
        if (p && !p.funcionament.includes(nom)) { p.funcionament.push(nom); desaPestanyes(); }
      }
      continue;
    }
    // De seguiment: la canviem per una de falsa, de sessió (al magatzem de la pestanya: incògnit o no).
    if (storeId === undefined) storeId = await magatzemDe(det.tabId);
    let c = null;
    for (let intent = 0; intent < 3 && !c; intent++) {
      try { c = await chrome.cookies.get(storeId ? { url: det.url, name: nom, storeId } : { url: det.url, name: nom }); } catch (e) { /* res */ }
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
  if (!lloc || /[^a-z0-9.\-]/i.test(lloc) || confiat(lloc) || marcant.has(lloc)) return;
  marcant.add(lloc);
  cfg.realAuto.push(lloc);
  await chrome.storage.local.set({ realAuto: cfg.realAuto });
  disfresses.delete(lloc);
  await registra();
  marcant.delete(lloc);
  await reglesLloc(lloc);
  if (tabId >= 0) {
    try { const t = await chrome.tabs.get(tabId); await capcaleres(tabId, hostDe(t.url || "")); } catch (e) { /* res */ }
    if (recarrega) chrome.tabs.reload(tabId);
  }
}

async function detectaAntifrau(det) {
  await llest;
  if (!cfg.actiu || det.tabId < 0 || !MG.esAntifrau(hostDe(det.url))) return;
  const pt = pestanyes.get(det.tabId) || {};
  const hostSup = (pt.pendent && pt.pendent.lloc) || pt.lloc || hostDe(det.initiator || "");
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
    const text = await r.text();
    const m = /^loc=([A-Z]{2})$/m.exec(text);
    if (!m) return;
    nou = m[1];
    // La IP de debò, per ensenyar-la a la finestreta. Només es desa en aquest ordinador.
    const ip = (/^ip=([0-9a-fA-F.:]+)$/m.exec(text) || [])[1];
    if (ip) await chrome.storage.local.set({ ipReal: ip });
    // El centre de Cloudflare per on surts (BCN, MAD…): és més o menys la ciutat que la IP diu als webs.
    const colo = (/^colo=([A-Z]{3})$/m.exec(text) || [])[1];
    await chrome.storage.local.set({ coloReal: colo || null });
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
  await totesReglesLloc();
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

/* ---- «Menja-te-les totes ara»: el mico i la recàrrega ---- */

// Els noms de les galetes de seguiment que s'ha menjat en aquesta pestanya (el mico els porta
// escrits a les galetes). Només lletres, xifres i _.-, i com a molt cinc.
function nomsMenjades(p) {
  const noms = (p && p.galetes ? p.galetes : []).map((g) => String(g.nom || "").replace(/[^\w.-]/g, "")).filter(Boolean);
  return [...new Set(noms)].slice(0, 5);
}

// El personatge triat (el mico, l'ós rentador o el bufó) travessa la pàgina (lib/monstre.js, al món
// aïllat). Si la pàgina no ho permet (chrome://, la botiga, un PDF…) o triga massa, es passa de llarg.
async function monstre(tabId, noms) {
  const target = { tabId, frameIds: [0] };
  const personatge = /^[a-z]{1,20}$/.test(cfg.personatge) ? cfg.personatge : "mico";
  try {
    await chrome.scripting.executeScript({ target, files: ["lib/monstre.js"] });
    await Promise.race([
      chrome.scripting.executeScript({ target, func: (o) => MG_monstre(o), args: [{ noms: noms || [], personatge }] }),
      new Promise((r) => setTimeout(r, 11000)),
    ]);
  } catch (e) { /* res */ }
}

// Quan el mico ha marxat, es torna a menjar el que el web hagi posat mentrestant i es torna a
// carregar la pàgina amb la disfressa nova.
async function acabaDeMenjar(tabId, lloc, noms) {
  await monstre(tabId, noms);
  await menja(lloc, { obertes: true, protegides: true });
  const p = pestanyes.get(tabId);
  if (p) { p.galetes = []; p.funcionament = []; p.avis = null; desaPestanyes(); }
  await capcaleres(tabId, lloc);
  chrome.tabs.reload(tabId);
}

/* ---- Missatges ---- */

async function tracta(m, sender) {
  await llest;
  const tabId = sender.tab ? sender.tab.id : -1;
  switch (m.tipus) {
    case "galeta":
      if (!MG.esSeguiment(String(m.nom))) return null;
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
      // Si fins ara no es podia (l'interruptor «Permet els scripts d'usuari» era apagat), ho torna a provar.
      if (scriptsUsuari !== true) await registra();
      const p = pestanyes.get(m.tabId) || {};
      const { ipReal, coloReal } = await chrome.storage.local.get(["ipReal", "coloReal"]);
      return { ipReal: ipReal || null, coloReal: coloReal || null, cfg: perAPagina(), confiancaUsuari: cfg.confianca, realAuto: cfg.realAuto, scriptsUsuari,
        lloc: p.lloc || m.lloc || "", galetes: p.galetes || [], funcionament: p.funcionament || [], avis: p.avis || null,
        gravadors: p.gravadors || [], espies: p.espies || [], espiesN: p.espiesN || 0,
        resum: resumEstat.resum && resumEstat.resum.setmana === MG.setmana() ? resumEstat.resum : null,
        resumAnterior: resumEstat.anterior && MG.esSetmanaPassada(resumEstat.anterior.setmana) ? resumEstat.anterior : null,
        temporals: Object.fromEntries(Object.entries(realTemporal).filter(([l]) => temporal(l))) };
    }
    case "menjaVelles":
      return { menjades: await menjaVelles(m.ara) };
    case "senseDisfressa": {
      // Un web sense disfressa durant uns minuts (per comparar la prova de la disfressa).
      const minuts = Math.min(Math.max(Number(m.minuts) || 15, 1), 60);
      const fins = Date.now() + minuts * 60000;
      await canviaTemporal(m.lloc, fins);
      chrome.alarms.create("temporal|" + m.lloc, { when: fins + 500 });
      return { fins };
    }
    case "rebot":
      compta("rebots");
      return null;
    case "menjaAra": {
      cfg.epochLloc[m.lloc] = (cfg.epochLloc[m.lloc] || 0) + 1;
      await chrome.storage.local.set({ epochLloc: cfg.epochLloc });
      disfresses.delete(m.lloc);
      const n = await menja(m.lloc, { obertes: true, protegides: true });
      const p = pestanyes.get(m.tabId);
      const noms = nomsMenjades(p);
      if (p) { p.galetes = []; p.funcionament = []; p.avis = null; desaPestanyes(); }
      await registra();
      if (m.tabId >= 0) acabaDeMenjar(m.tabId, m.lloc, noms);   // sense esperar: la finestreta es tanca i surt el mico
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
    case "permis":
      // La benvinguda ho pregunta cada segon: el navegador no avisa quan s'encén l'interruptor.
      await registra();
      return { scriptsUsuari };
    case "recarregaPestanyes":
      return { recarregades: await recarregaPestanyes() };
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
    if (MG.esSeguiment(c.name, c.domain.replace(/^\./, "")) && !MG.esProtegitFrau(c.domain.replace(/^\./, ""))) {
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
  if (typeof s.scriptsUsuari === "boolean") scriptsUsuari = s.scriptsUsuari;
  realTemporal = (await chrome.storage.session.get("realTemporal")).realTemporal || {};
  const g = await chrome.storage.local.get(["visites", "visitesDesDe", "resum", "resumAnterior", "numLloc"]);
  numLloc = g.numLloc || {};
  // Només les visites als webs amb galetes protegides (les altres no calen; les versions d'abans les desaven totes).
  visites = {};
  for (const [l, t] of Object.entries(g.visites || {})) if (llocsProtegits.has(l)) visites[l] = t;
  if (Object.keys(g.visites || {}).length !== Object.keys(visites).length) await chrome.storage.local.set({ visites });
  visitesDesDe = g.visitesDesDe || Date.now();
  if (!g.visitesDesDe) await chrome.storage.local.set({ visitesDesDe });
  resumEstat.resum = g.resum || null;
  resumEstat.anterior = g.resumAnterior || null;
  if (!(await chrome.alarms.get("velles"))) chrome.alarms.create("velles", { delayInMinutes: 10, periodInMinutes: 24 * 60 });
  if (!(await chrome.alarms.get("resum"))) chrome.alarms.create("resum", { when: MG.properDilluns() });
  // Les regles i el script d'usuari es queden desats entre despertars: només es refan en
  // instal·lar-la, en arrencar el navegador i quan canvia la configuració.
  if (!(await chrome.alarms.get("pais"))) chrome.alarms.create("pais", { periodInMinutes: cfg.minutsPais });
  if (!(await chrome.alarms.get("mitjanit"))) chrome.alarms.create("mitjanit", { when: properaMitjanit(), periodInMinutes: 24 * 60 });
}
const properaMitjanit = () => { const d = new Date(); d.setHours(24, 0, 5, 0); return d.getTime(); };
const llest = inicia();

/* ---- Gestors (es registren de seguida, perquè el service worker es pot despertar per qualsevol) ---- */

chrome.runtime.onInstalled.addListener(async (d) => {
  await llest;
  if (d.reason === "install") { await primeraVegada(); await carregaConfig(); }
  // Les regles per web de les versions d'abans (números de 200000 a 900000), fora.
  try {
    const velles = (await chrome.declarativeNetRequest.getSessionRules()).map((x) => x.id).filter((id) => id >= 200000 && id < 1000000);
    if (velles.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: velles });
  } catch (e) { /* res */ }
  await registra();
  // Sense el permís «Permet els scripts d'usuari» no hi ha disfressa: la benvinguda explica com donar-lo.
  if (d.reason === "install" && scriptsUsuari === false) chrome.tabs.create({ url: chrome.runtime.getURL("benvinguda/benvinguda.html") });
  await regles();
  await totesReglesLloc();
  for (const t of await chrome.tabs.query({})) {
    const host = hostDe(t.url || "");
    if (host) { estatPestanya(t.id, MG.lloc(host), new URL(t.url).origin); await capcaleres(t.id, host); }
  }
  comprovaPais();
});

chrome.runtime.onStartup.addListener(async () => {
  await llest;
  await registra();
  await regles();
  pestanyes = new Map();
  for (const t of await chrome.tabs.query({})) {
    const host = hostDe(t.url || "");
    if (host) { estatPestanya(t.id, MG.lloc(host), new URL(t.url).origin); await capcaleres(t.id, host); }
  }
  await neteja();
  comprovaPais();
  avisaResum();
});

chrome.webNavigation.onBeforeNavigate.addListener(async (det) => {
  if (det.frameId !== 0) return;
  await llest;
  const host = hostDe(det.url);
  if (host) preparaPestanya(det.tabId, MG.lloc(host), new URL(det.url).origin);
  if (host && cfg.actiu && !esReal(host) && MG.esBucle(carregues, det.tabId, det.url)) {
    // Un dia sense disfressa (no per sempre: podria ser un web que es recarrega sol, o que ho fa expressament).
    const lloc = MG.lloc(host);
    avisaBucle(lloc);
    const fins = Date.now() + 24 * 60 * 60000;
    await canviaTemporal(lloc, fins);
    chrome.alarms.create("temporal|" + lloc, { when: fins + 500 });
    chrome.tabs.reload(det.tabId);
    return;
  }
  await capcaleres(det.tabId, host);
});

chrome.webNavigation.onCommitted.addListener(async (det) => {
  if (det.frameId !== 0) return;
  await llest;
  const host = hostDe(det.url);
  if (host) estatPestanya(det.tabId, MG.lloc(host), new URL(det.url).origin);
});

// Si la càrrega no arriba a ser una pàgina (una baixada, un error), la disfressa de les
// capçaleres torna a ser la del web que hi ha.
chrome.webNavigation.onErrorOccurred.addListener(async (det) => {
  if (det.frameId !== 0) return;
  await llest;
  const p = pestanyes.get(det.tabId);
  if (p) { p.pendent = null; desaPestanyes(); await capcaleres(det.tabId, p.lloc); }
});

// El Chromium de vegades canvia una pestanya per una altra (precàrrega, pestanyes adormides).
chrome.tabs.onReplaced.addListener(async (nova, vella) => {
  await llest;
  const p = pestanyes.get(vella);
  pestanyes.delete(vella);
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [vella + 1000] }); } catch (e) { /* res */ }
  try {
    const t = await chrome.tabs.get(nova);
    const host = hostDe(t.url || "");
    if (p) pestanyes.set(nova, p);
    else if (host) estatPestanya(nova, MG.lloc(host), new URL(t.url).origin);
    desaPestanyes();
    await capcaleres(nova, host);
  } catch (e) { /* res */ }
});

chrome.tabs.onUpdated.addListener(async (tabId, canvi) => {
  if (!canvi.url) return;
  await llest;
  const host = hostDe(canvi.url);
  if (host) { estatPestanya(tabId, MG.lloc(host), new URL(canvi.url).origin); return; }
  const p = pestanyes.get(tabId);
  if (p && p.lloc) {
    const vell = p.lloc;
    pestanyes.set(tabId, estatBuit(""));
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
  else if (a.name.startsWith("temporal|")) await canviaTemporal(a.name.slice(9), 0);
  else if (a.name === "velles") await menjaVelles();
  else if (a.name === "resum") { await avisaResum(); chrome.alarms.create("resum", { when: MG.properDilluns() }); }
  else if (a.name === "mitjanit" && cfg.disfressa === "dia") {
    // Disfressa nova del dia: les regles dels webs i de les pestanyes obertes.
    disfresses.clear();
    await totesReglesLloc();
    for (const [tabId, p] of pestanyes) if (p.lloc) await capcaleres(tabId, p.lloc);
  }
});

// Els gravadors i els espies que les regles no han deixat carregar: s'apunten per a la finestreta.
chrome.webRequest.onErrorOccurred.addListener(async (det) => {
  if (det.error !== "net::ERR_BLOCKED_BY_CLIENT" || det.type === "main_frame") return;
  await llest;
  const pt = pestanyes.get(det.tabId) || {};
  const lloc = (pt.pendent && pt.pendent.lloc) || pt.lloc || MG.lloc(hostDe(det.initiator || ""));
  const g = cfg.gravadors && MG.gravadorDe(hostDe(det.url));
  if (g) { if (apunta(det.tabId, lloc, "gravadors", g)) compta("gravadors"); return; }
  const e = cfg.espies && MG.espiaDe(det.url);
  if (e) { apunta(det.tabId, lloc, "espies", e); compta("espies"); }
}, { urls: ["<all_urls>"] });

chrome.webRequest.onResponseStarted.addListener(galetesResposta, { urls: ["<all_urls>"] }, ["responseHeaders", "extraHeaders"]);
chrome.webRequest.onBeforeRequest.addListener(detectaAntifrau, { urls: ["<all_urls>"] });
chrome.webRequest.onErrorOccurred.addListener(detectaAntifrau, { urls: ["<all_urls>"] });

chrome.notifications.onClicked.addListener(async (id) => {
  if (id !== "pais") return;
  await llest;
  await recarregaPestanyes();
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
  await totesReglesLloc();
  for (const [tabId, p] of pestanyes) if (p.lloc) await capcaleres(tabId, p.lloc);
});
