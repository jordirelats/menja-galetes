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
    "claude.ai", "anthropic.com", "mozilla.org", "firefox.com", "vivaldi.com", "vivaldi.net",
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
  "gov.br", "gob.mx", "gob.ar", "gov.ar", "com.ua", "co.il", "org.il", "ac.jp", "go.jp", "gov.au", "edu.au",
  "com.hk", "com.tw", "co.th", "com.my", "com.ph", "gov.in", "ac.in", "co.id", "go.id", "com.vn", "com.pl",
  "org.pl", "co.at", "or.at", "com.gr", "gov.it", "gouv.fr", "gov.pt", "gob.pe", "gob.cl", "gov.co", "gub.uy",
  // Plataformes on cada usuari té el seu propi web (a.github.io i b.github.io són webs diferents)
  "github.io", "gitlab.io", "blogspot.com", "netlify.app", "vercel.app", "pages.dev", "workers.dev",
  "herokuapp.com", "appspot.com", "web.app", "firebaseapp.com", "azurewebsites.net", "cloudfront.net",
  "wordpress.com", "wixsite.com", "neocities.org", "glitch.me", "onrender.com", "fly.dev", "repl.co",
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
  "policia.es", "guardiacivil.es", "boe.es", "europa.eu", "aeat.es", "sepe.es", "dgt.es", "060.es", "diba.cat",
  "gva.es", "euskadi.eus", "navarra.es", "aragon.es", "jcyl.es", "carm.es", "caib.es", "comunidad.madrid",
  "castillalamancha.es", "juntaex.es", "asturias.es", "cantabria.es", "larioja.org", "gobiernodecanarias.org",
  // Governs que no ho diuen al nom del web
  "canada.ca", "bund.de", "elster.de", "arbeitsagentur.de", "service-public.fr", "belgium.be", "skatteverket.se",
  "forsakringskassan.se", "nav.no", "skatteetaten.no", "skat.dk", "virk.dk", "vero.fi", "kela.fi", "eesti.ee",
  "inps.it", "agenziaentrate.it",
];

// Bancs i governs de tot el món, pel nom del web. Es pot passar el nom sencer (host) o
// el lloc: les paraules es miren a totes les parts del nom.
MG.GOVERN_SUFIXOS = [
  /(^|\.)(gov|mil|int)$/,                                                   // irs.gov, nato.int
  /(^|\.)(gov|gob|gouv|govt|gv|gub|go|mil|admin|govern|gouv|gc)\.[a-z]{2}$/,  // gov.uk, gob.mx, gouv.fr, go.jp, admin.ch, gc.ca
];
MG.GOVERN_PARAULES = /^(gov|gob|gouv|govt|govern|governo|gobierno|gouvernement|government|regierung|police|policia|polizei|hacienda|tributaria|ajuntament.*|ayuntamiento.*|concello.*|udala.*|diputaci.*|generalitat.*|xunta.*|juntade.*|cabildo.*|ministr.*|bundesregierung|bundesfinanzministerium|rijksoverheid|overheid|regjeringen|regeringen|valtioneuvosto|suomi|borger|seg-social|sede)$/;
MG.BANC_TROSSOS = /(bank|banc|banque|caixa|kasse|kutxa|raiffeisen|creditunion|credit-union)/;
MG.BANC_MARQUES = [
  "caja", "nordea", "swedbank", "danske", "rabobank", "abnamro", "hsbc", "barclays", "lloyds", "natwest",
  "santander", "bbva", "wellsfargo", "citi", "capitalone", "scotiabank", "westpac", "bradesco", "nubank",
  "mercadopago", "icici", "hdfc", "onlinesbi", "mufg", "smbc", "mizuho", "bnpparibas", "societegenerale",
  "unicredit", "intesasanpaolo", "commerzbank", "comdirect", "belfius", "millennium", "novobanco", "creditmutuel",
  "credit-agricole", "labanquepostale", "postfinance", "chase", "usbank", "pnc", "tdbank", "rbcroyalbank", "cibc",
  "itau", "ocbc", "kotak", "axisbank", "ubs", "monzo", "starlingbank", "bunq", "venmo", "zellepay",
];
MG.BANC_EXACTES = new Set(["td.com", "bmo.com", "rbc.com", "anz.com", "anz.com.au", "nab.com.au", "dbs.com",
  "dbs.com.sg", "uob.com.sg", "ing.es", "ing.de", "ing.nl", "ing.com", "ing.be", "ing.fr", "ing.it", "kbc.be",
  "kbc.com", "lcl.fr", "cgd.pt", "mps.it", "bper.it", "dkb.de", "cash.app"]);

MG.esSempreReal = function (nom) {
  if (!nom) return false;
  nom = String(nom).toLowerCase();
  const lloc = MG.lloc(nom);
  if (MG.SEMPRE_REAL.some((s) => lloc === s || lloc.endsWith("." + s))) return true;
  if (MG.BANC_EXACTES.has(lloc)) return true;
  if (MG.GOVERN_SUFIXOS.some((r) => r.test(lloc))) return true;
  if (nom.split(/[.-]/).some((t) => MG.GOVERN_PARAULES.test(t))) return true;
  const marca = lloc.split(".")[0];
  if (MG.BANC_TROSSOS.test(marca)) return true;
  return MG.BANC_MARQUES.some((m) => marca === m || marca.startsWith(m));
};

// Bancs, finances i governs pel nom de l'organització del certificat del web.
MG.ORGANITZACIO_REAL = /\b(bank|banco|banca|banque|bancaire|caixa|caja|sparkasse|kasse|kutxa|credit union|crédit|credito|crédito|kredit|savings|building society|financial|finance|financière|securities|investment|trust company|payments?|pagos|pagaments|government|gobierno|govern|gouvernement|governo|regierung|ministry|ministerio|ministère|ministero|ministeri|minister|department of|state of|city of|county of|council|ajuntament|ayuntamiento|generalitat|junta de|diputaci|agencia|agència|agence|administración|administració|administration|hacienda|tributaria|tributària|seguridad social|seguretat social|police|policía|policia|polizei|république|republic|bundesamt|kommune|gemeente|municipality|municipal|federal|treasury|tesoro|tresor)\b/i;
MG.esOrganitzacioReal = (org) => MG.ORGANITZACIO_REAL.test(String(org || ""));

// Sistemes contra el frau i de verificació d'identitat. Si una pàgina en carrega un, el
// web ha de veure el navegador de debò.
MG.ANTIFRAU = [
  "online-metrix.net", "threatmetrix.com", "iesnare.com", "iovation.com", "biocatch.com", "nudatasecurity.com",
  "kount.net", "kaxsdc.com", "forter.com", "riskified.com", "signifyd.com", "seon.io", "sardine.ai",
  "accertify.com", "feedzai.com", "sift.com", "siftscience.com", "fpjs.io", "fpcdn.io", "fpapi.io",
  "incognia.com", "socure.com", "jumio.com", "onfido.com", "veriff.com", "veriff.me", "sumsub.com",
  "idnow.de", "idnow.io", "withpersona.com", "arkoselabs.com", "funcaptcha.com", "trulioo.com", "mitek.com",
];
MG.esAntifrau = (host) => { const l = MG.lloc(host); return MG.ANTIFRAU.some((s) => l === s || l.endsWith("." + s)); };

// Identificadors que viatgen dins dels enllaços (galetes que no són galetes): els clics
// d'anuncis i de xarxes socials, i les campanyes.
MG.PARAMS_SEGUIMENT = /^(fbclid|gclid|gbraid|wbraid|dclid|gclsrc|msclkid|yclid|twclid|ttclid|li_fat_id|igshid|igsh|epik|mc_eid|_hsenc|_hsmi|__hssc|__hstc|__hsfp|hsCtaTracking|mkt_tok|vero_id|oly_anon_id|oly_enc_id|rb_clickid|_openstat|s_cid|ef_id|irclickid|wickedid|srsltid|utm_[a-z_]+)$/i;

// La mateixa llista amb noms exactes (les regles del Chromium no admeten patrons).
MG.PARAMS_LLISTA = ["fbclid", "gclid", "gbraid", "wbraid", "dclid", "gclsrc", "msclkid", "yclid", "twclid", "ttclid",
  "li_fat_id", "igshid", "igsh", "epik", "mc_eid", "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp", "hsCtaTracking",
  "mkt_tok", "vero_id", "oly_anon_id", "oly_enc_id", "rb_clickid", "_openstat", "s_cid", "ef_id", "irclickid",
  "wickedid", "srsltid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "utm_name",
  "utm_cid", "utm_reader", "utm_social", "utm_brand", "utm_place", "utm_pubreferrer", "utm_swu", "utm_viz_id"];

// Treu-los d'una adreça. Torna null si no n'hi havia cap.
// Es treuen del text de l'adreça tal com és: la resta de paràmetres no es tornen a codificar
// (una adreça signada continua valent, i «?a» no passa a ser «?a=»).
MG.netejaUrl = function (url) {
  const h = url.indexOf("#");
  const sense = h < 0 ? url : url.slice(0, h);
  const fragment = h < 0 ? "" : url.slice(h);
  const q = sense.indexOf("?");
  if (q < 0) return null;
  const parells = sense.slice(q + 1).split("&");
  const queden = parells.filter((p) => {
    const nom = p.split("=")[0];
    let clau = nom;
    try { clau = decodeURIComponent(nom.replace(/\+/g, " ")); } catch (e) { /* tal qual */ }
    return !MG.PARAMS_SEGUIMENT.test(clau);
  });
  if (queden.length === parells.length) return null;
  return sense.slice(0, q) + (queden.length ? "?" + queden.join("&") : "") + fragment;
};

// Xarxes socials, missatgeria, cites i plataformes on hi ha menors: s'hi va amb la identitat
// real, perquè els seus sistemes contra els comptes falsos, l'assetjament i els usuaris
// expulsats que tornen amb un altre compte funcionin. (Les galetes de tercers, igualment
// se les menja.)
MG.XARXES = [
  "facebook.com", "fb.com", "messenger.com", "instagram.com", "threads.net", "threads.com", "whatsapp.com",
  "tiktok.com", "x.com", "twitter.com", "snapchat.com", "discord.com", "discord.gg", "telegram.org", "t.me",
  "signal.org", "reddit.com", "twitch.tv", "kick.com", "linkedin.com", "pinterest.com", "tumblr.com", "bsky.app",
  "mastodon.social", "vk.com", "ok.ru", "wechat.com", "line.me", "viber.com", "skype.com", "kik.com",
  "tinder.com", "gotinder.com", "bumble.com", "badoo.com", "hinge.co", "grindr.com", "okcupid.com", "meetic.es",
  "meetic.com", "match.com", "pof.com", "lovoo.com", "happn.com", "feeld.co",
  "roblox.com", "minecraft.net", "epicgames.com", "fortnite.com", "steamcommunity.com", "steampowered.com",
  "xbox.com", "playstation.com", "chatroulette.com", "ome.tv", "yubo.live", "wattpad.com", "habbo.com",
  "moviestarplanet.com", "ask.fm", "tellonym.me", "ngl.link",
];
MG.esXarxa = (host) => { const l = MG.lloc(host); return MG.XARXES.some((s) => l === s || l.endsWith("." + s)); };

// Webs on es va sense disfressa: bancs, pagaments, governs, i xarxes i cites.
MG.esIdentitatReal = (host) => MG.esSempreReal(host) || MG.esXarxa(host);

// Entrada única (SSO): els proveïdors d'identitat que els webs fan servir dins de marcs per
// mantenir la sessió (Teams, Microsoft 365, Google, Apple, Okta…). Les seves galetes no es treuen.
MG.SSO = ["microsoftonline.com", "microsoftonline-p.com", "live.com", "windows.net", "msauth.net", "msftauth.net",
  "accounts.google.com", "appleid.apple.com", "okta.com", "oktacdn.com", "auth0.com", "onelogin.com",
  "duosecurity.com", "pingidentity.com", "id.me", "login.gov"];

// Galetes que no es toquen mai, ni als bancs: les dels bancs, pagaments, governs i sistemes
// contra el frau (encara que vinguin d'un altre web).
MG.esProtegitFrau = (host) => MG.esSempreReal(host) || MG.esAntifrau(host);

MG.MARCA = "menja-galetes";

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
  /^li_sugr$/, /^bcookie$/, /^XANDR_PANID$/, /^uuid2$/, /^anj$/, /^tuuid/,
  /^__adroll/, /^_au_1d$/, /^_lc2_fpi/, /^_tt_enable_cookie$/, /^_pinterest_ct_ua$/,
  /^VISITOR_INFO1_LIVE$/,   // l'identificador de visitant de YouTube
  /^datr$/,                 // el de Facebook (a facebook.com mateix no compta: vegeu ID_PLATAFORMA)
];

// Els que una xarxa social fa servir per reconèixer el navegador contra els comptes falsos i
// l'abús. A la mateixa xarxa es deixen estar (hi vas amb la identitat real); a altres webs, són
// galetes de seguiment com les altres.
MG.ID_PLATAFORMA = [/^bcookie$/, /^bscookie$/, /^li_sugr$/, /^guest_id(_ads|_marketing)?$/, /^personalization_id$/,
  /^muc_ads$/, /^_pin_unauth$/, /^datr$/, /^sb$/];

// És una galeta de seguiment? Si es diu en quin web és (hostSup), a les xarxes socials no
// compten els seus identificadors propis.
MG.esSeguiment = function (nom, hostSup) {
  if (hostSup && MG.esXarxa && MG.esXarxa(hostSup) && MG.ID_PLATAFORMA.some((r) => r.test(nom))) return false;
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

// La IP falsa (la que reben els scripts i la de X-Forwarded-For) surt sempre de l'espai
// compartit que els proveïdors fan servir per dins (100.64.0.0/10, RFC 6598): sembla
// d'una connexió de debò, però no és l'adreça de ningú, i no pot apuntar cap persona.
MG.BLOC_IP_FALSA = "100.64.0.0/10";

MG.PAISOS = {
  ES: { nom: "Espanya", de: "d'Espanya", idiomes: ["es-ES", "es"],
    accept: "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3", zona: "Europe/Madrid",
    ciutats: [["Saragossa", 41.65, -0.88], ["València", 39.47, -0.38], ["Sevilla", 37.39, -5.98],
      ["Màlaga", 36.72, -4.42], ["Bilbao", 43.26, -2.93], ["Valladolid", 41.65, -4.72],
      ["Múrcia", 37.98, -1.13], ["Palma", 39.57, 2.65], ["Alacant", 38.35, -0.48],
      ["Còrdova", 37.89, -4.78], ["Vigo", 42.24, -8.72], ["Granada", 37.18, -3.6],
      ["Oviedo", 43.36, -5.85], ["Pamplona", 42.81, -1.64], ["Santander", 43.46, -3.81],
      ["Salamanca", 40.97, -5.66], ["Burgos", 42.34, -3.7], ["Logronyo", 42.47, -2.45]] },
  FR: { nom: "França", de: "de França", idiomes: ["fr-FR", "fr"],
    accept: "fr-FR,fr;q=0.8,en-US;q=0.5,en;q=0.3", zona: "Europe/Paris",
    ciutats: [["Lió", 45.76, 4.84], ["Marsella", 43.3, 5.37], ["Tolosa", 43.6, 1.44], ["Niça", 43.7, 7.27],
      ["Nantes", 47.22, -1.55], ["Estrasburg", 48.57, 7.75], ["Bordeus", 44.84, -0.58], ["Lilla", 50.63, 3.06]] },
  DE: { nom: "Alemanya", de: "d'Alemanya", idiomes: ["de", "en-US", "en"],
    accept: "de,en-US;q=0.7,en;q=0.3", zona: "Europe/Berlin",
    ciutats: [["Berlín", 52.52, 13.4], ["Munic", 48.14, 11.58], ["Hamburg", 53.55, 9.99], ["Colònia", 50.94, 6.96],
      ["Frankfurt", 50.11, 8.68], ["Stuttgart", 48.78, 9.18], ["Leipzig", 51.34, 12.37]] },
  PT: { nom: "Portugal", de: "de Portugal", idiomes: ["pt-PT", "pt"],
    accept: "pt-PT,pt;q=0.8,en;q=0.5,en-US;q=0.3", zona: "Europe/Lisbon",
    ciutats: [["Lisboa", 38.72, -9.14], ["Porto", 41.15, -8.61], ["Braga", 41.55, -8.42], ["Coïmbra", 40.21, -8.43]] },
  IT: { nom: "Itàlia", de: "d'Itàlia", idiomes: ["it-IT", "it"],
    accept: "it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3", zona: "Europe/Rome",
    ciutats: [["Milà", 45.46, 9.19], ["Roma", 41.9, 12.5], ["Torí", 45.07, 7.69], ["Bolonya", 44.49, 11.34],
      ["Florència", 43.77, 11.26], ["Nàpols", 40.85, 14.27]] },
  GB: { nom: "el Regne Unit", de: "del Regne Unit", idiomes: ["en-GB", "en"],
    accept: "en-GB,en;q=0.5", zona: "Europe/London",
    ciutats: [["Manchester", 53.48, -2.24], ["Birmingham", 52.49, -1.89], ["Leeds", 53.8, -1.55],
      ["Bristol", 51.45, -2.59], ["Glasgow", 55.86, -4.25], ["Londres", 51.51, -0.13]] },
  NL: { nom: "els Països Baixos", de: "dels Països Baixos", idiomes: ["nl", "en-US", "en"],
    accept: "nl,en-US;q=0.7,en;q=0.3", zona: "Europe/Amsterdam",
    ciutats: [["Amsterdam", 52.37, 4.9], ["Rotterdam", 51.92, 4.48], ["Utrecht", 52.09, 5.12], ["Eindhoven", 51.44, 5.48]] },
  US: { nom: "els Estats Units", de: "dels Estats Units", idiomes: ["en-US", "en"],
    accept: "en-US,en;q=0.5", zona: "America/New_York",
    ciutats: [["Nova York", 40.71, -74.01], ["Boston", 42.36, -71.06], ["Filadèlfia", 39.95, -75.17],
      ["Atlanta", 33.75, -84.39], ["Miami", 25.76, -80.19]] },
  JP: { nom: "el Japó", de: "del Japó", idiomes: ["ja", "en-US", "en"],
    accept: "ja,en-US;q=0.7,en;q=0.3", zona: "Asia/Tokyo",
    ciutats: [["Tòquio", 35.68, 139.69], ["Osaka", 34.69, 135.5], ["Nagoya", 35.18, 136.91],
      ["Sapporo", 43.06, 141.35], ["Fukuoka", 33.59, 130.4]] },
  AR: { nom: "l'Argentina", de: "de l'Argentina", idiomes: ["es-AR", "es"],
    accept: "es-AR,es;q=0.8,en-US;q=0.5,en;q=0.3", zona: "America/Argentina/Buenos_Aires",
    ciutats: [["Buenos Aires", -34.6, -58.38], ["Córdoba", -31.42, -64.18], ["Rosario", -32.95, -60.65], ["Mendoza", -32.89, -68.83]] },
  AU: { nom: "Austràlia", de: "d'Austràlia", idiomes: ["en-AU", "en"],
    accept: "en-AU,en;q=0.5", zona: "Australia/Sydney",
    ciutats: [["Sydney", -33.87, 151.21], ["Melbourne", -37.81, 144.96], ["Canberra", -35.28, 149.13]] },
  ZA: { nom: "Sud-àfrica", de: "de Sud-àfrica", idiomes: ["en-ZA", "en"],
    accept: "en-ZA,en;q=0.5", zona: "Africa/Johannesburg",
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
    uaChrome: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`,
    platform: "Win32", oscpu: "Windows NT 10.0; Win64; x64", appVersion: "5.0 (Windows)",
    uaDades: { platform: "Windows", versions: ["15.0.0", "19.0.0"], arquitectures: ["x86"] },
    pantalles: [[1920, 1080], [1366, 768], [1536, 864], [1600, 900], [1920, 1200], [2560, 1440], [3840, 2160]],
    barra: 48, dpr: [1, 1, 1.25, 1.5],
    gpu: [
      ["Intel UHD 620", "Google Inc. (Intel)", "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0), or similar"],
      ["Intel Iris Xe", "Google Inc. (Intel)", "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0), or similar"],
      ["NVIDIA GTX 1650", "Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0), or similar"],
      ["AMD Radeon RX 580", "Google Inc. (AMD)", "ANGLE (AMD, Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0), or similar"],
    ],
    gpuChrome: [
      ["Intel UHD 620", "Google Inc. (Intel)", "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)"],
      ["Intel Iris Xe", "Google Inc. (Intel)", "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)"],
      ["NVIDIA GTX 1650", "Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 (0x00001F82) Direct3D11 vs_5_0 ps_5_0, D3D11)"],
      ["AMD Radeon RX 580", "Google Inc. (AMD)", "ANGLE (AMD, Radeon RX 580 Series (0x000067DF) Direct3D11 vs_5_0 ps_5_0, D3D11)"],
    ],
  },
  Mac: {
    nom: "macOS",
    ua: (v) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`,
    uaChrome: (v) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`,
    platform: "MacIntel", oscpu: "Intel Mac OS X 10.15", appVersion: "5.0 (Macintosh)",
    uaDades: { platform: "macOS", versions: ["14.6.1", "15.3.0"], arquitectures: ["arm", "x86"] },
    pantalles: [[1440, 900], [1512, 982], [1680, 1050], [1728, 1117], [2560, 1440]],
    barra: 25, dpr: [2],
    gpu: [
      ["Apple M1", "Apple", "Apple M1, or similar"],
      ["Apple M2", "Apple", "Apple M2, or similar"],
    ],
    gpuChrome: [
      ["Apple M1", "Google Inc. (Apple)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)"],
      ["Apple M2", "Google Inc. (Apple)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)"],
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
  const iGpu = Math.floor(r() * S.gpu.length);
  const ip = MG.ipDe([MG.BLOC_IP_FALSA], r);
  const lat = Math.round((ciutat[1] + (r() - 0.5) * 0.06) * 1e5) / 1e5;
  const lon = Math.round((ciutat[2] + (r() - 0.5) * 0.06) * 1e5) / 1e5;
  const soroll = Math.floor(r() * 2147483647);
  // Al Vivaldi, el Chrome i el Brave, la disfressa és un Chrome; al Firefox, un Firefox.
  const chrome = cfg.navegador === "chrome";
  const gpu = (chrome ? S.gpuChrome : S.gpu)[iGpu];
  const memoria = tria([4, 8, 8]);
  const uaDades = {
    platform: S.uaDades.platform, platformVersion: tria(S.uaDades.versions),
    architecture: tria(S.uaDades.arquitectures), bitness: "64", model: "", mobile: false, wow64: false,
  };
  const ua = chrome ? S.uaChrome(v) : S.ua(v);

  return {
    codiPais, pais: p.nom, dePais: p.de, ciutat: ciutat[0], so, soNom: S.nom,
    navegador: chrome ? "chrome" : "firefox", navegadorNom: chrome ? "Chrome" : "Firefox",
    ua, platform: S.platform, oscpu: chrome ? null : S.oscpu, appVersion: chrome ? ua.slice(8) : S.appVersion,
    memoria: chrome ? memoria : null, uaDades: chrome ? uaDades : null,
    idiomes: p.idiomes.slice(), acceptLanguage: p.accept, zona: p.zona,
    pantalla: { w, h, aw: w, ah: h - S.barra, dpr },
    nuclis, gpu: { nom: gpu[0], vendor: gpu[1], renderer: gpu[2] },
    ip, lat, lon, soroll,
    nom: `Un ${so} de ${ciutat[0]}`,
  };
};

/* ---- Peces que van també dins dels treballadors (workers) ----------------------------
 * Aquestes funcions no poden fer servir res de fora seu (ni MG): el fons i la pàgina
 * en copien el text dins del codi que s'afegeix al començament de cada treballador.
 */

// Soroll a les dades d'una imatge. Sempre el mateix per a la mateixa llavor, i es pot
// aplicar dues vegades sense que canviï res (posa un bit, no el gira).
MG.sorolla = function (dades, llargada, llavor) {
  let h = 2166136261;
  const s = String(llavor) + "|" + llargada;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (!llargada) return;
  const canvis = Math.min(24, Math.max(6, llargada >> 12));
  for (let i = 0; i < canvis; i++) {
    const k = Math.floor(r() * (llargada / 4)) * 4 + Math.floor(r() * 3);
    const bit = r() < 0.5 ? 0 : 1;
    dades[k] = (dades[k] & 0xFE) | bit;
  }
};

/*
 * L'hora i l'idioma de la disfressa, complets: Date (hores, dates, textos, constructor
 * i Date.parse), Intl (idioma i zona per defecte), toLocale*, localeCompare i Temporal.
 *   G: l'objecte global (la finestra vista amb wrappedJSObject, o `self` en un treballador)
 *   eina.fn / eina.ganxo: exportFunction i cloneInto(…, {cloneFunctions}) a les finestres;
 *     la identitat als treballadors
 *   eina.Date / eina.DTF: el Date i l'Intl.DateTimeFormat originals, per calcular
 *   eina.zonaReal: la zona horària de debò
 */
MG.zonaIdioma = function (G, d, f, eina) {
  "use strict";
  if (!f.idioma) return;
  const fn = eina.fn, ganxo = eina.ganxo, DC = eina.Date, DTFo = eina.DTF, zonaReal = eina.zonaReal;
  const OD = G.Date, ODP = OD.prototype;
  const canviaZona = d.zona !== zonaReal;

  // Minuts de diferència amb UTC (el mateix signe que getTimezoneOffset) en un instant.
  const fmts = {};
  const fmt = (z) => fmts[z] || (fmts[z] = new DTFo("en-US", {
    timeZone: z, hourCycle: "h23", era: "short", year: "numeric", month: "numeric",
    day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }));
  const desfase = (t, z) => {
    if (!(t === t) || !isFinite(t)) return NaN;
    const v = {};
    for (const p of fmt(z).formatToParts(t)) v[p.type] = p.value;
    let y = +v.year;
    if (/^B/.test(v.era || "")) y = 1 - y;
    const x = new DC(0);
    x.setUTCFullYear(y, +v.month - 1, +v.day);
    x.setUTCHours(+v.hour % 24, +v.minute, +v.second, 0);
    const base = t - (((t % 1000) + 1000) % 1000);
    return Math.round((base - x.getTime()) / 60000);
  };
  const aUTC = (L) => { let t = L + desfase(L, d.zona) * 60000; t = L + desfase(t, d.zona) * 60000; return t; };
  const local = (t) => new DC(t - desfase(t, d.zona) * 60000);

  // Si un altre script de l'extensió ja hi ha passat, no ho tornem a fer.
  // (Es mira el nom de la zona: dues zones poden tenir la mateixa diferència amb UTC.)
  if (canviaZona) { try { if (new G.Intl.DateTimeFormat().resolvedOptions().timeZone === d.zona) return; } catch (e) { /* res */ } }

  /* Idioma per defecte a Intl i a toLocale* */
  const paginaArray = (llista) => { const a = new G.Array(); for (const v of llista) a.push(v); return a; };
  const idiomes = paginaArray(d.idiomes);
  const ambZona = (o) => {
    if (!canviaZona) return o;
    if (o === undefined || o === null) { const n = new G.Object(); n.timeZone = d.zona; return n; }
    let tz;
    try { tz = o.timeZone; } catch (e) { /* res */ }
    if (tz !== undefined) return o;
    const n = G.Object.assign(new G.Object(), o);
    n.timeZone = d.zona;
    return n;
  };
  const ajusta = (args, zona) => {
    const a = [];
    for (let i = 0; i < args.length; i++) a.push(args[i]);
    if (a[0] === undefined) a[0] = idiomes;
    if (zona) a[1] = ambZona(a[1]);
    return paginaArray(a);
  };
  for (const nom of ["DateTimeFormat", "NumberFormat", "Collator", "PluralRules", "RelativeTimeFormat",
    "ListFormat", "DisplayNames", "Segmenter", "DurationFormat"]) {
    const C = G.Intl && G.Intl[nom];
    if (!C) continue;
    const zona = nom === "DateTimeFormat";
    try {
      const P = new G.Proxy(C, ganxo({
        construct: (t, args, nt) => G.Reflect.construct(t, ajusta(args, zona), nt),
        apply: (t, th, args) => G.Reflect.apply(t, th, ajusta(args, zona)),
      }));
      G.Intl[nom] = P;
      C.prototype.constructor = P;
    } catch (e) { /* res */ }
  }
  const posa = (proto, nom, fer) => {
    try { const o = proto && proto[nom]; if (typeof o === "function") proto[nom] = fn(fer(o)); } catch (e) { /* res */ }
  };
  for (const nom of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
    posa(ODP, nom, (o) => function (loc, opc) { return o.call(this, loc === undefined ? idiomes : loc, ambZona(opc)); });
  }
  posa(G.Number.prototype, "toLocaleString", (o) => function (loc, opc) { return o.call(this, loc === undefined ? idiomes : loc, opc); });
  if (G.BigInt) posa(G.BigInt.prototype, "toLocaleString", (o) => function (loc, opc) { return o.call(this, loc === undefined ? idiomes : loc, opc); });
  posa(G.String.prototype, "localeCompare", (o) => function (que, loc, opc) { return o.call(this, que, loc === undefined ? idiomes : loc, opc); });

  if (!canviaZona) return;

  /* La zona horària: Date sencer */
  const getTime = ODP.getTime, setTime = ODP.setTime, parseOriginal = OD.parse;
  const GETS = { getFullYear: "getUTCFullYear", getMonth: "getUTCMonth", getDate: "getUTCDate", getDay: "getUTCDay",
    getHours: "getUTCHours", getMinutes: "getUTCMinutes", getSeconds: "getUTCSeconds", getMilliseconds: "getUTCMilliseconds" };
  for (const k of Object.keys(GETS)) {
    const u = GETS[k];
    ODP[k] = fn(function () { const t = getTime.call(this); return t === t ? local(t)[u]() : NaN; });
  }
  ODP.getYear = fn(function () { const t = getTime.call(this); return t === t ? local(t).getUTCFullYear() - 1900 : NaN; });
  ODP.getTimezoneOffset = fn(function () { const t = getTime.call(this); return t === t ? desfase(t, d.zona) : NaN; });
  const SETS = { setFullYear: "setUTCFullYear", setMonth: "setUTCMonth", setDate: "setUTCDate", setHours: "setUTCHours",
    setMinutes: "setUTCMinutes", setSeconds: "setUTCSeconds", setMilliseconds: "setUTCMilliseconds" };
  for (const k of Object.keys(SETS)) {
    const u = SETS[k];
    ODP[k] = fn(function () {
      let t = getTime.call(this);
      if (!(t === t)) { if (k !== "setFullYear") return NaN; t = aUTC(0); }
      const x = local(t);
      const a = [];
      for (let i = 0; i < arguments.length; i++) a.push(Number(arguments[i]));
      DC.prototype[u].apply(x, a);
      return setTime.call(this, aUTC(x.getTime()));
    });
  }
  const setFullYear = ODP.setFullYear;
  ODP.setYear = fn(function (y) { y = Number(y); if (y >= 0 && y <= 99) y += 1900; return setFullYear.call(this, y); });

  const DIES = "Sun Mon Tue Wed Thu Fri Sat".split(" ");
  const MESOS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const dos = (n) => String(n).padStart(2, "0");
  const any = (y) => (y < 0 ? "-" + String(-y).padStart(6, "0") : String(y).padStart(4, "0"));
  let fmtNom = null;
  const nomZona = (t) => {
    try {
      fmtNom = fmtNom || new DTFo(d.idiomes[0], { timeZone: d.zona, timeZoneName: "long" });
      const p = fmtNom.formatToParts(t).find((x) => x.type === "timeZoneName");
      return p ? p.value : d.zona;
    } catch (e) { return d.zona; }
  };
  const gmt = (off) => { const m = -off, a = Math.abs(m); return "GMT" + (m >= 0 ? "+" : "-") + dos(Math.floor(a / 60)) + dos(a % 60); };
  const txtData = (x) => `${DIES[x.getUTCDay()]} ${MESOS[x.getUTCMonth()]} ${dos(x.getUTCDate())} ${any(x.getUTCFullYear())}`;
  const txtHora = (t, x) => `${dos(x.getUTCHours())}:${dos(x.getUTCMinutes())}:${dos(x.getUTCSeconds())} ${gmt(desfase(t, d.zona))} (${nomZona(t)})`;
  const txt = (t) => { if (!(t === t)) return "Invalid Date"; const x = local(t); return `${txtData(x)} ${txtHora(t, x)}`; };
  ODP.toString = fn(function () { return txt(getTime.call(this)); });
  ODP.toDateString = fn(function () { const t = getTime.call(this); return t === t ? txtData(local(t)) : "Invalid Date"; });
  ODP.toTimeString = fn(function () { const t = getTime.call(this); return t === t ? txtHora(t, local(t)) : "Invalid Date"; });

  // Els textos sense zona («2024-01-15T10:30», «Jan 15 2024 10:30») són hora local.
  const teZona = /(?:Z|[+-]\d{2}:?\d{2}|\bGMT\b|\bUTC?\b|\b[ECMP][SD]T\b)\s*(?:\(.*\))?\s*$/i;
  const nomesData = /^\s*[+-]?\d{4,6}(?:-\d{2}(?:-\d{2})?)?\s*$/;
  const llegeix = (s) => {
    const t = parseOriginal.call(OD, s);
    if (!(t === t) || teZona.test(s) || nomesData.test(s)) return t;
    return aUTC(t - desfase(t, zonaReal) * 60000);
  };
  OD.parse = fn(function (s) { return llegeix(String(s)); });
  try {
    const DateFals = new G.Proxy(OD, ganxo({
      construct: (t, args, nt) => {
        const n = args.length;
        let ms = null;
        if (n >= 2) {
          const v = [];
          for (let i = 0; i < 7; i++) v.push(i < n ? Number(args[i]) : (i === 2 ? 1 : 0));
          let y = v[0];
          if (Math.trunc(y) >= 0 && Math.trunc(y) <= 99) y = 1900 + Math.trunc(y);
          const x = new DC(0);
          x.setUTCFullYear(y, v[1], v[2]);
          x.setUTCHours(v[3], v[4], v[5], v[6]);
          ms = aUTC(x.getTime());
        } else if (n === 1 && typeof args[0] === "string") {
          ms = llegeix(args[0]);
        }
        if (ms === null) return G.Reflect.construct(t, args, nt);
        return G.Reflect.construct(t, paginaArray([ms]), nt);
      },
      apply: () => txt(DC.now()),
    }));
    G.Date = DateFals;
    ODP.constructor = DateFals;
  } catch (e) { /* res */ }

  // Temporal (Firefox 139 i més nous)
  try {
    const TN = G.Temporal && G.Temporal.Now;
    if (TN) {
      TN.timeZoneId = fn(function () { return d.zona; });
      for (const k of ["zonedDateTimeISO", "plainDateTimeISO", "plainDateISO", "plainTimeISO"]) {
        const o = TN[k];
        if (typeof o === "function") TN[k] = fn(function (tz) { return o.call(this, tz === undefined ? d.zona : tz); });
      }
    }
  } catch (e) { /* res */ }
};

// La resta de la disfressa dins d'un treballador: navigator, WebGL i OffscreenCanvas.
MG.restaTreballador = function (G, d, f, sorolla) {
  "use strict";
  const def = (o, p, v) => {
    try { Object.defineProperty(o, p, { get: function () { return v; }, configurable: true, enumerable: true }); } catch (e) { /* res */ }
  };
  const N = G.WorkerNavigator && G.WorkerNavigator.prototype;
  if (N) {
    if (f.navegador) { def(N, "userAgent", d.ua); def(N, "platform", d.platform); def(N, "appVersion", d.appVersion); }
    if (f.idioma) { def(N, "language", d.idiomes[0]); def(N, "languages", Object.freeze(d.idiomes.slice())); }
    if (f.pantalla) def(N, "hardwareConcurrency", d.nuclis);
    if (f.pantalla && d.memoria && "deviceMemory" in N) def(N, "deviceMemory", d.memoria);
  }
  if (f.pantalla) {
    for (const nom of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
      const P = G[nom] && G[nom].prototype;
      if (!P) continue;
      const o = P.getParameter;
      P.getParameter = function (p) {
        if (p === 0x9245) return d.gpu.vendor;
        if (p === 0x9246) return d.gpu.renderer;
        return o.call(this, p);
      };
    }
  }
  if (f.empremta && G.OffscreenCanvasRenderingContext2D) {
    const C2 = G.OffscreenCanvasRenderingContext2D.prototype;
    const gid = C2.getImageData;
    C2.getImageData = function () {
      const r = gid.apply(this, arguments);
      try { sorolla(r.data, r.data.length, d.soroll + "|img"); } catch (e) { /* res */ }
      return r;
    };
    const OC = G.OffscreenCanvas.prototype;
    const ctb = OC.convertToBlob;
    if (ctb) {
      OC.convertToBlob = function () {
        try {
          const c = new G.OffscreenCanvas(this.width, this.height);
          const x = c.getContext("2d");
          x.drawImage(this, 0, 0);
          const im = gid.call(x, 0, 0, this.width, this.height);
          sorolla(im.data, im.data.length, d.soroll + "|img");
          x.putImageData(im, 0, 0);
          return ctb.apply(c, arguments);
        } catch (e) { return ctb.apply(this, arguments); }
      };
    }
  }
};

// navigator.userAgentData (només als navegadors Chromium): la plataforma de la disfressa.
// Les marques i les versions es queden les de debò, perquè lliguin amb el navegador.
MG.uaDades = function (G, d) {
  "use strict";
  const P = G.NavigatorUAData && G.NavigatorUAData.prototype;
  if (!P || !d.uaDades) return;
  const u = d.uaDades;
  const def = (prop, v) => {
    try { Object.defineProperty(P, prop, { get: function () { return v; }, configurable: true, enumerable: true }); } catch (e) { /* res */ }
  };
  def("platform", u.platform);
  def("mobile", false);
  const ghev = P.getHighEntropyValues;
  if (typeof ghev === "function") {
    P.getHighEntropyValues = function (pistes) {
      return ghev.call(this, pistes).then((r) => {
        for (const k of ["platform", "platformVersion", "architecture", "bitness", "model", "mobile", "wow64"]) {
          if (k in r || (Array.isArray(pistes) && pistes.includes(k))) r[k] = u[k];
        }
        if ("formFactors" in r) r.formFactors = ["Desktop"];
        return r;
      });
    };
  }
  const json = P.toJSON;
  if (typeof json === "function") {
    P.toJSON = function () { const r = json.call(this); r.platform = u.platform; r.mobile = false; return r; };
  }
};

// El codi que va al començament de cada treballador: només ASCII, perquè serveixi
// sigui quina sigui la codificació de l'script.
MG.codiTreballador = function (d, f) {
  const json = (o) => JSON.stringify(o).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  const ascii = (s) => s.replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return ascii("(function(){try{var d=" + json(d) + ",f=" + json(f) + ",id=function(x){return x};" +
    "var zonaReal=Intl.DateTimeFormat().resolvedOptions().timeZone;" +
    "var sorolla=" + MG.sorolla.toString() + ";" +
    "(" + MG.zonaIdioma.toString() + ")(self,d,f,{fn:id,ganxo:id,Date:Date,DTF:Intl.DateTimeFormat,zonaReal:zonaReal});" +
    "(" + MG.restaTreballador.toString() + ")(self,d,f,sorolla);" +
    "if(f.navegador)(" + MG.uaDades.toString() + ")(self,d);" +
    "}catch(e){}})();\n");
};
