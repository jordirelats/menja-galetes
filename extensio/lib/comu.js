"use strict";
/*
 * Menja galetes · peces comunes.
 *
 * Les fan servir el fons, la finestreta, les opcions i el codi que s'injecta a
 * cada pàgina (el fons el llegeix com a text i l'embolcalla). Per això aquí no
 * hi pot haver res que depengui de `browser` ni del DOM.
 */

const MG = {};

MG.PER_DEFECTE = {
  actiu: true,
  avisos: "acceptar",        // "acceptar" | "rebutjar" | "res"
  identificador: "visita",   // "visita" | "clic"
  disfressa: "web",          // "web" (una per a cada web) | "dia" (una al dia per a tots)
  pais: "ip",                // "ip" (el de la IP) | "qualsevol"
  canviPais: true,           // si la IP canvia de país: disfressa nova i se les menja totes
  falseja: {
    navegador: true, ubicacio: true, idioma: true, pantalla: true,
    empremta: true, galetes: true, ipScripts: true, ipCapcaleres: true,
  },
  // Webs on no es menja res ni va disfressat. Són llocs (domini registrable):
  // «google.com» inclou mail.google.com.
  confianca: [
    "google.com", "google.es", "youtube.com", "github.com",
    "claude.ai", "anthropic.com", "mozilla.org", "firefox.com",
  ],
  retardMenjar: 20,          // segons que espera després de tancar l'última pestanya d'un web
  minutsPais: 3,             // cada quant mira per quin país surt la connexió
  urlPais: "https://www.cloudflare.com/cdn-cgi/trace",
};

/* ---- Llocs ---------------------------------------------------------------- */

// Dominis de segon nivell habituals. No és la Public Suffix List sencera, però
// cobreix els casos que es veuen a Catalunya i Europa.
MG.SEGON_NIVELL = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "com.au", "net.au", "org.au",
  "com.br", "com.ar", "com.mx", "co.jp", "ne.jp", "or.jp", "co.za", "co.nz",
  "com.es", "org.es", "gob.es", "nom.es", "edu.es", "com.pt", "com.tr", "co.in",
  "com.cn", "com.co", "com.pe", "com.uy", "com.ve", "co.kr", "com.sg",
]);

MG.lloc = function (host) {
  if (!host) return "";
  host = String(host).toLowerCase().replace(/^\./, "").replace(/\.$/, "");
  if (/^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".")) return host;
  const p = host.split(".");
  if (p.length >= 3 && MG.SEGON_NIVELL.has(p.slice(-2).join("."))) return p.slice(-3).join(".");
  return p.slice(-2).join(".");
};

MG.llocDeUrl = function (url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return MG.lloc(u.hostname);
  } catch (e) {
    return "";
  }
};

/*
 * Webs que sempre veuen el navegador de debò, i que no es poden treure.
 * Els sistemes contra el frau dels bancs i dels pagaments, i la identificació de
 * l'Administració, han de funcionar: l'extensió és per a la intimitat, no per
 * enganyar-los. Valen també els subdominis (sede.agenciatributaria.gob.es).
 */
MG.SEMPRE_REAL = [
  // Pagaments i targetes
  "paypal.com", "paypal.me", "paypalobjects.com", "stripe.com", "stripe.network", "redsys.es", "sermepa.es",
  "bizum.es", "ceca.es", "adyen.com", "braintreegateway.com", "checkout.com", "klarna.com", "mollie.com",
  "worldpay.com", "visa.com", "mastercard.com", "americanexpress.com", "cardinalcommerce.com", "arcot.com",
  "3dsecure.io", "modirum.com", "gpayments.net", "apple.com", "wise.com", "revolut.com",
  // Bancs
  "caixabank.es", "caixabank.com", "lacaixa.es", "imaginbank.com", "bbva.es", "bbva.com", "bancosantander.es",
  "santander.com", "bancsabadell.com", "sabadell.com", "ing.es", "openbank.es", "bankinter.com",
  "unicajabanco.es", "kutxabank.es", "abanca.com", "ibercaja.es", "cajamar.es", "ruralvia.com",
  "cajarural.com", "laboralkutxa.com", "evobanco.com", "myinvestor.es", "andbank.com", "andbank.es",
  "creditandorra.ad", "morabanc.ad", "triodos.es", "bancamarch.es", "deutsche-bank.es", "n26.com",
  "selfbank.es", "renta4.com", "caixaontinyent.es", "caixapopular.es", "arquia.com", "bancomediolanum.es",
  // Administració
  "gob.es", "gencat.cat", "aoc.cat", "cat365.cat", "seg-social.es", "fnmt.es", "dnielectronico.es",
  "policia.es", "guardiacivil.es", "boe.es", "europa.eu",
];

MG.esSempreReal = function (lloc) {
  if (!lloc) return false;
  return MG.SEMPRE_REAL.some((s) => lloc === s || lloc.endsWith("." + s));
};

MG.esConfiat = function (lloc, llista) {
  if (!lloc) return false;
  return MG.esSempreReal(lloc) || (llista || []).some((w) => MG.lloc(w) === lloc);
};

/* ---- Atzar ---------------------------------------------------------------- */

// Hash de text (cyrb53): el mateix text dona sempre el mateix número.
MG.hash = function (s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

// Generador amb llavor (mulberry32): la mateixa llavor, la mateixa seqüència.
MG.rng = function (llavor) {
  let a = MG.hash(String(llavor)) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Atzar de debò (per als identificadors falsos).
MG.aleatori = function (n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
};

MG.xifres = function (n) {
  let s = String(1 + MG.aleatori(9));
  for (let i = 1; i < n; i++) s += MG.aleatori(10);
  return s;
};

MG.hex = function (n) {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789abcdef"[MG.aleatori(16)];
  return s;
};

/* ---- Galetes de seguiment -------------------------------------------------------- */

// Noms de galetes que porten un identificador de la persona. Les de sessió que
// només porten comptadors (_ga_XXXX, _gat, _hjSession_…) no hi són.
MG.SEGUIMENT = [
  /^_ga$/, /^_gid$/, /^__utma$/, /^_gcl_(au|aw|dc|gb|gs)$/, /^_fbp$/, /^_fbc$/,
  /^_uetsid$/, /^_uetvid$/, /^_clck$/, /^_hjSessionUser_/, /^_hjid$/, /^_pin_unauth$/,
  /^_ttp$/, /^_scid$/, /^_rdt_uuid$/, /^ajs_anonymous_id$/, /^ajs_user_id$/,
  /^amplitude_id/, /^mp_.*_mixpanel$/, /^_hp2_id\./, /^__hstc$/, /^hubspotutk$/,
  /^_mkto_trk$/, /^IDE$/, /^__gads$/, /^__gpi$/, /^_cc_id$/, /^__qca$/, /^cto_bundle$/,
  /^_pk_id\./, /^_shopify_y$/, /^visitor_id\d*$/, /^_vwo_uuid/, /^optimizelyEndUserId$/,
  /^s_ecid$/, /^AMCV_/, /^s_vi$/, /^_sp_id\./, /^_lr_env/, /^_parsely_visitor$/,
  /^muc_ads$/, /^personalization_id$/, /^guest_id(_ads|_marketing)?$/, /^_derived_epik$/,
  /^li_sugr$/, /^bcookie$/, /^UID$/, /^XANDR_PANID$/, /^uuid2$/, /^anj$/, /^tuuid/,
  /^__adroll/, /^_au_1d$/, /^_lc2_fpi/, /^_tt_enable_cookie$/, /^_pinterest_ct_ua$/,
];

MG.esSeguiment = function (nom) {
  return MG.SEGUIMENT.some((r) => r.test(nom));
};

// Un valor fals amb la mateixa forma que el de debò, perquè el web el
// continuï fent servir sense queixar-se.
MG.galetaFalsa = function (nom, valor) {
  const ara = Math.floor(Date.now() / 1000);
  let m;
  if (nom === "_ga" || nom === "_gid") {
    m = /^(GA\d\.\d+\.)/.exec(valor || "");
    return (m ? m[1] : "GA1.1.") + MG.xifres(9 + MG.aleatori(2)) + "." + (ara - MG.aleatori(3600));
  }
  if (nom === "_fbp" || nom === "_fbc") {
    m = /^fb\.(\d)\./.exec(valor || "");
    const cua = nom === "_fbp" ? MG.xifres(9 + MG.aleatori(2)) : MG.barreja((valor || "").split(".").pop() || MG.hex(20));
    return "fb." + (m ? m[1] : "1") + "." + (Date.now() - MG.aleatori(3600000)) + "." + cua;
  }
  if (/^_gcl_/.test(nom)) {
    m = /^(\d\.\d\.)/.exec(valor || "");
    return (m ? m[1] : "1.1.") + MG.xifres(9 + MG.aleatori(2)) + "." + (ara - MG.aleatori(3600));
  }
  return MG.barreja(valor || MG.hex(24));
};

// Canvia cada xifra per una xifra, cada lletra per una lletra, i deixa la puntuació.
MG.barreja = function (v) {
  const lletres = "abcdefghijklmnopqrstuvwxyz";
  if (/^[0-9a-f]+(-[0-9a-f]+)*$/i.test(v) && /[a-f]/i.test(v)) {
    return v.replace(/[0-9a-f]/gi, (c) => {
      const n = "0123456789abcdef"[MG.aleatori(16)];
      return c === c.toUpperCase() ? n.toUpperCase() : n;
    });
  }
  return v.replace(/[0-9]/g, () => String(MG.aleatori(10)))
    .replace(/[a-z]/g, () => lletres[MG.aleatori(26)])
    .replace(/[A-Z]/g, () => lletres[MG.aleatori(26)].toUpperCase());
};

/* ---- Països i disfresses ----------------------------------------------------------- */

// blocs: rangs d'adreces de proveïdors grans d'aquell país, perquè la IP falsa
// sembli d'allà. Són aproximats; si un país no en té, no s'hi posa IP falsa.
MG.PAISOS = {
  ES: { nom: "Espanya", de: "d'Espanya", idiomes: ["es-ES", "es"],
    accept: "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3", zona: "Europe/Madrid",
    blocs: ["83.32.0.0/11", "88.0.0.0/11"],
    ciutats: [["Saragossa", 41.65, -0.88], ["València", 39.47, -0.38], ["Sevilla", 37.39, -5.98],
      ["Màlaga", 36.72, -4.42], ["Bilbao", 43.26, -2.93], ["Valladolid", 41.65, -4.72],
      ["Múrcia", 37.98, -1.13], ["Palma", 39.57, 2.65], ["Alacant", 38.35, -0.48],
      ["Còrdova", 37.89, -4.78], ["Vigo", 42.24, -8.72], ["Granada", 37.18, -3.6],
      ["Oviedo", 43.36, -5.85], ["Pamplona", 42.81, -1.64], ["Santander", 43.46, -3.81],
      ["Salamanca", 40.97, -5.66], ["Burgos", 42.34, -3.7], ["Logronyo", 42.47, -2.45]] },
  FR: { nom: "França", de: "de França", idiomes: ["fr-FR", "fr"],
    accept: "fr-FR,fr;q=0.8,en-US;q=0.5,en;q=0.3", zona: "Europe/Paris", blocs: ["90.0.0.0/9"],
    ciutats: [["Lió", 45.76, 4.84], ["Marsella", 43.3, 5.37], ["Tolosa", 43.6, 1.44], ["Niça", 43.7, 7.27],
      ["Nantes", 47.22, -1.55], ["Estrasburg", 48.57, 7.75], ["Bordeus", 44.84, -0.58], ["Lilla", 50.63, 3.06]] },
  DE: { nom: "Alemanya", de: "d'Alemanya", idiomes: ["de", "en-US", "en"],
    accept: "de,en-US;q=0.7,en;q=0.3", zona: "Europe/Berlin", blocs: ["79.192.0.0/10"],
    ciutats: [["Berlín", 52.52, 13.4], ["Munic", 48.14, 11.58], ["Hamburg", 53.55, 9.99], ["Colònia", 50.94, 6.96],
      ["Frankfurt", 50.11, 8.68], ["Stuttgart", 48.78, 9.18], ["Leipzig", 51.34, 12.37]] },
  PT: { nom: "Portugal", de: "de Portugal", idiomes: ["pt-PT", "pt"],
    accept: "pt-PT,pt;q=0.8,en;q=0.5,en-US;q=0.3", zona: "Europe/Lisbon", blocs: [],
    ciutats: [["Lisboa", 38.72, -9.14], ["Porto", 41.15, -8.61], ["Braga", 41.55, -8.42], ["Coïmbra", 40.21, -8.43]] },
  IT: { nom: "Itàlia", de: "d'Itàlia", idiomes: ["it-IT", "it"],
    accept: "it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3", zona: "Europe/Rome", blocs: [],
    ciutats: [["Milà", 45.46, 9.19], ["Roma", 41.9, 12.5], ["Torí", 45.07, 7.69], ["Bolonya", 44.49, 11.34],
      ["Florència", 43.77, 11.26], ["Nàpols", 40.85, 14.27]] },
  GB: { nom: "el Regne Unit", de: "del Regne Unit", idiomes: ["en-GB", "en"],
    accept: "en-GB,en;q=0.5", zona: "Europe/London", blocs: ["86.128.0.0/10"],
    ciutats: [["Manchester", 53.48, -2.24], ["Birmingham", 52.49, -1.89], ["Leeds", 53.8, -1.55],
      ["Bristol", 51.45, -2.59], ["Glasgow", 55.86, -4.25], ["Londres", 51.51, -0.13]] },
  NL: { nom: "els Països Baixos", de: "dels Països Baixos", idiomes: ["nl", "en-US", "en"],
    accept: "nl,en-US;q=0.7,en;q=0.3", zona: "Europe/Amsterdam", blocs: [],
    ciutats: [["Amsterdam", 52.37, 4.9], ["Rotterdam", 51.92, 4.48], ["Utrecht", 52.09, 5.12], ["Eindhoven", 51.44, 5.48]] },
  US: { nom: "els Estats Units", de: "dels Estats Units", idiomes: ["en-US", "en"],
    accept: "en-US,en;q=0.5", zona: "America/New_York", blocs: ["73.0.0.0/8"],
    ciutats: [["Nova York", 40.71, -74.01], ["Boston", 42.36, -71.06], ["Filadèlfia", 39.95, -75.17],
      ["Atlanta", 33.75, -84.39], ["Miami", 25.76, -80.19]] },
  JP: { nom: "el Japó", de: "del Japó", idiomes: ["ja", "en-US", "en"],
    accept: "ja,en-US;q=0.7,en;q=0.3", zona: "Asia/Tokyo", blocs: ["126.0.0.0/8"],
    ciutats: [["Tòquio", 35.68, 139.69], ["Osaka", 34.69, 135.5], ["Nagoya", 35.18, 136.91],
      ["Sapporo", 43.06, 141.35], ["Fukuoka", 33.59, 130.4]] },
  AR: { nom: "l'Argentina", de: "de l'Argentina", idiomes: ["es-AR", "es"],
    accept: "es-AR,es;q=0.8,en-US;q=0.5,en;q=0.3", zona: "America/Argentina/Buenos_Aires", blocs: [],
    ciutats: [["Buenos Aires", -34.6, -58.38], ["Córdoba", -31.42, -64.18], ["Rosario", -32.95, -60.65], ["Mendoza", -32.89, -68.83]] },
  AU: { nom: "Austràlia", de: "d'Austràlia", idiomes: ["en-AU", "en"],
    accept: "en-AU,en;q=0.5", zona: "Australia/Sydney", blocs: [],
    ciutats: [["Sydney", -33.87, 151.21], ["Melbourne", -37.81, 144.96], ["Canberra", -35.28, 149.13]] },
  ZA: { nom: "Sud-àfrica", de: "de Sud-àfrica", idiomes: ["en-ZA", "en"],
    accept: "en-ZA,en;q=0.5", zona: "Africa/Johannesburg", blocs: [],
    ciutats: [["Johannesburg", -26.2, 28.05], ["Ciutat del Cap", -33.92, 18.42], ["Durban", -29.86, 31.02], ["Pretòria", -25.75, 28.19]] },
};

MG.IDIOMES = {
  ca: "català", es: "castellà", fr: "francès", de: "alemany", pt: "portuguès", it: "italià",
  en: "anglès", nl: "neerlandès", ja: "japonès",
};

MG.SISTEMES = {
  Windows: {
    nom: "Windows 11",
    ua: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`,
    platform: "Win32", oscpu: "Windows NT 10.0; Win64; x64", appVersion: "5.0 (Windows)",
    pantalles: [[1920, 1080], [1366, 768], [1536, 864], [1600, 900], [1920, 1200], [2560, 1440], [3840, 2160]],
    barra: 48, dpr: [1, 1, 1.25, 1.5],
    gpu: [
      ["Intel UHD 620", "Google Inc. (Intel)", "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0), or similar"],
      ["Intel Iris Xe", "Google Inc. (Intel)", "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0), or similar"],
      ["NVIDIA GTX 1650", "Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0), or similar"],
      ["AMD Radeon RX 580", "Google Inc. (AMD)", "ANGLE (AMD, Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0), or similar"],
    ],
  },
  Mac: {
    nom: "macOS",
    ua: (v) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`,
    platform: "MacIntel", oscpu: "Intel Mac OS X 10.15", appVersion: "5.0 (Macintosh)",
    pantalles: [[1440, 900], [1512, 982], [1680, 1050], [1728, 1117], [2560, 1440]],
    barra: 25, dpr: [2],
    gpu: [
      ["Apple M1", "Apple", "Apple M1, or similar"],
      ["Apple M2", "Apple", "Apple M2, or similar"],
    ],
  },
};

MG.ipDe = function (blocs, r) {
  if (!blocs || !blocs.length) return null;
  const [base, bits] = blocs[Math.floor(r() * blocs.length)].split("/");
  const b = base.split(".").map(Number);
  const inici = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
  const mida = 2 ** (32 - Number(bits));
  const n = inici + 1 + Math.floor(r() * (mida - 2));
  const ip = [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  if (ip[3] === 0 || ip[3] === 255) ip[3] = 1 + Math.floor(r() * 253);
  return ip.join(".");
};

/*
 * La disfressa d'un web. Surt sempre igual amb les mateixes dades, i per això el
 * fons (per a les capçaleres), la pàgina i la finestreta en calculen la mateixa.
 * `real` = {w, h} de la pantalla de debò, perquè la falsa no sigui més petita
 * que la finestra (es notaria).
 */
MG.disfressa = function (cfg, lloc, real) {
  const dia = new Date();
  const avui = `${dia.getFullYear()}-${dia.getMonth() + 1}-${dia.getDate()}`;
  const clau = cfg.disfressa === "dia"
    ? `dia|${avui}`
    : `web|${lloc}|${(cfg.epochLloc || {})[lloc] || 0}`;
  const r = MG.rng(`${cfg.secret}|${cfg.epoch || 0}|${clau}`);
  const tria = (a) => a[Math.floor(r() * a.length)];

  const codis = Object.keys(MG.PAISOS);
  const atzarPais = tria(codis);
  const codiPais = cfg.pais === "qualsevol" ? atzarPais : (MG.PAISOS[cfg.paisIP] ? cfg.paisIP : "ES");
  const p = MG.PAISOS[codiPais];
  const ciutat = tria(p.ciutats);
  const so = r() < 0.7 ? "Windows" : "Mac";
  const S = MG.SISTEMES[so];
  const v = cfg.versio || "158";

  const iPantalla = r();
  let pantalles = S.pantalles;
  if (real && real.w) {
    const grans = pantalles.filter(([w, h]) => w >= real.w && h >= real.h);
    pantalles = grans.length ? grans : [[real.w, real.h]];
  }
  const [w, h] = pantalles[Math.floor(iPantalla * pantalles.length)];
  const dpr = tria(S.dpr);
  const nuclis = tria([4, 8, 8, 12, 16]);
  const gpu = tria(S.gpu);
  const ip = MG.ipDe(p.blocs, r);
  const lat = Math.round((ciutat[1] + (r() - 0.5) * 0.06) * 1e5) / 1e5;
  const lon = Math.round((ciutat[2] + (r() - 0.5) * 0.06) * 1e5) / 1e5;
  const soroll = Math.floor(r() * 2147483647);

  return {
    codiPais, pais: p.nom, dePais: p.de, ciutat: ciutat[0], so, soNom: S.nom,
    ua: S.ua(v), platform: S.platform, oscpu: S.oscpu, appVersion: S.appVersion,
    idiomes: p.idiomes.slice(), acceptLanguage: p.accept, zona: p.zona,
    pantalla: { w, h, aw: w, ah: h - S.barra, dpr },
    nuclis, gpu: { nom: gpu[0], vendor: gpu[1], renderer: gpu[2] },
    ip, lat, lon, soroll,
    nom: `Un ${so} de ${ciutat[0]}`,
  };
};
