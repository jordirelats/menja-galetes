/*
 * Menja galetes · el codi que va a cada pàgina.
 *
 * El fons l'embolcalla amb lib/comu.js i la configuració, i el registra amb
 * browser.contentScripts.register a document_start, abans que cap script del
 * web. Aquest fitxer ha de ser només aquesta funció.
 *
 * Toca els objectes de la pàgina a través de window.wrappedJSObject i
 * exportFunction (les «Xray» del Firefox): el web no veu la configuració ni
 * la llavor, i nosaltres continuem veient les funcions originals.
 */
function MG_pagina(MG, cfg) {
  "use strict";
  if (!cfg.actiu) return;
  if (location.protocol !== "http:" && location.protocol !== "https:" && location.protocol !== "about:") return;

  /* ---- On som ---- */
  let llocSuperior = MG.lloc(location.hostname);
  if (window.top !== window) {
    try {
      llocSuperior = MG.lloc(window.top.location.hostname);
    } catch (e) {
      let ancestre = "";
      try {
        const ao = location.ancestorOrigins;
        if (ao && ao.length) ancestre = ao[ao.length - 1];
      } catch (e2) { /* res */ }
      llocSuperior = MG.llocDeUrl(ancestre || document.referrer || "");
    }
  }
  if (!llocSuperior) llocSuperior = "atzar:" + MG.aleatori(1e9);
  if (MG.esConfiat(llocSuperior, cfg.confianca)) return;   // web de confiança: no es toca res

  const W = window.wrappedJSObject;
  const f = cfg.falseja;
  const real = { w: screen.width, h: screen.height };
  const d = MG.disfressa(cfg, llocSuperior, real);
  const exporta = (fn) => exportFunction(fn, window);
  const posaGetter = (obj, prop, fn) => {
    try {
      Object.defineProperty(obj, prop, { get: exporta(fn), configurable: true, enumerable: true });
    } catch (e) { /* res */ }
  };
  const avisa = (missatge) => {
    try { browser.runtime.sendMessage(missatge).catch(() => {}); } catch (e) { /* res */ }
  };
  const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");

  /* ---- 0. Pàgines amb contrasenya o targeta: sense disfressa ----
   * Si el web demana una contrasenya o una targeta, ha de veure el navegador de debò,
   * perquè els sistemes contra el frau i contra els comptes robats funcionin. El fons
   * se'l queda com a web de confiança i torna a carregar la pàgina sense disfressa. */
  {
    const SEL = "input[type='password'], input[autocomplete~='cc-number'], input[autocomplete~='cc-csc'], " +
      "input[name*='cardnumber' i], input[name*='card_number' i], input[id*='cardnumber' i]";
    let fet = false;
    const mira = () => {
      if (fet || !document.documentElement) return;
      for (const el of document.querySelectorAll(SEL)) {
        if (!visible(el)) continue;
        fet = true;
        obs.disconnect();
        avisa({ tipus: "identitat", lloc: llocSuperior, motiu: el.type === "password" ? "contrasenya" : "targeta" });
        return;
      }
    };
    const obs = new MutationObserver(() => { clearTimeout(obs.t); obs.t = setTimeout(mira, 300); });
    const comenca = () => { obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["type", "style", "class", "hidden"] }); mira(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", comenca, { once: true });
    else comenca();
  }

  /* ---- 1. Les galetes ---- */
  if (f.galetes) {
    const DP = W.Document.prototype;
    const original = Object.getOwnPropertyDescriptor(DP, "cookie");
    const esborra = (attrs) => attrs.some((a) => /^\s*max-age\s*=\s*(-|0\s*$)/i.test(a))
      || attrs.some((a) => { const m = /^\s*expires\s*=(.*)$/i.exec(a); return m && Date.parse(m[1]) < Date.now(); });
    const llegeix = (cadena, nom) => {
      for (const tros of String(cadena).split(";")) {
        const i = tros.indexOf("=");
        if (i > 0 && tros.slice(0, i).trim() === nom) return tros.slice(i + 1).trim();
      }
      return null;
    };
    // A cada clic: cada vegada que el web llegeix una galeta de seguiment, en rep una de nova.
    const canviaTotes = (cadena) => String(cadena).split(";").map((tros) => {
      const i = tros.indexOf("=");
      if (i < 0) return tros;
      const nom = tros.slice(0, i).trim();
      return MG.esSeguiment(nom) ? ` ${nom}=${MG.galetaFalsa(nom, tros.slice(i + 1).trim())}` : tros;
    }).join(";").trim();

    if (original && original.set) {
      Object.defineProperty(DP, "cookie", {
        configurable: true,
        enumerable: true,
        get: exporta(function () {
          const v = original.get.call(this);
          return cfg.identificador === "clic" ? canviaTotes(v) : v;
        }),
        set: exporta(function (valor) {
          valor = String(valor);
          const [nv, ...attrs] = valor.split(";");
          const i = nv.indexOf("=");
          const nom = i > 0 ? nv.slice(0, i).trim() : "";
          if (!nom || !MG.esSeguiment(nom) || esborra(attrs)) return original.set.call(this, valor);
          const vell = nv.slice(i + 1).trim();
          const existent = llegeix(original.get.call(this), nom);
          const fals = existent || MG.galetaFalsa(nom, vell);
          if (!existent) avisa({ tipus: "galeta", via: "js", lloc: llocSuperior, nom, original: vell, fals });
          // Sense caducitat: s'acaba amb la sessió, i el fons se la menja en tancar la pestanya.
          const sense = attrs.filter((a) => !/^\s*(expires|max-age)\s*=/i.test(a));
          return original.set.call(this, [`${nom}=${fals}`, ...sense].join(";"));
        }),
      });
    }

    // L'API nova de galetes (cookieStore), si n'hi ha.
    try {
      const CS = W.CookieStore && W.CookieStore.prototype;
      if (CS && CS.set) {
        const set = CS.set;
        CS.set = exporta(function (a, b) {
          try {
            const opc = typeof a === "string" ? { name: a, value: b } : JSON.parse(JSON.stringify(a));
            if (opc && opc.name && MG.esSeguiment(opc.name)) {
              const fals = MG.galetaFalsa(opc.name, opc.value);
              avisa({ tipus: "galeta", via: "js", lloc: llocSuperior, nom: opc.name, original: opc.value, fals });
              delete opc.expires;
              opc.value = fals;
              return set.call(this, cloneInto(opc, window));
            }
          } catch (e) { /* res */ }
          return set.apply(this, arguments);
        });
      }
    } catch (e) { /* res */ }
  }

  /* ---- 2. El navegador i el sistema ---- */
  if (f.navegador) {
    const N = W.Navigator.prototype;
    posaGetter(N, "userAgent", () => d.ua);
    posaGetter(N, "platform", () => d.platform);
    posaGetter(N, "oscpu", () => d.oscpu);
    posaGetter(N, "appVersion", () => d.appVersion);
  }

  /* ---- 3. Idioma (i hora, si la disfressa és d'una altra zona) ---- */
  if (f.idioma) {
    const N = W.Navigator.prototype;
    const llista = W.Object.freeze(cloneInto(d.idiomes, window));
    posaGetter(N, "language", () => d.idiomes[0]);
    posaGetter(N, "languages", () => llista);

    const idiomaReal = (navigator.language || "").split("-")[0];
    const zonaReal = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const DTF = W.Intl.DateTimeFormat.prototype;
      const resolt = DTF.resolvedOptions;
      DTF.resolvedOptions = exporta(function () {
        const r = resolt.call(this);
        try {
          const rw = r.wrappedJSObject || r;
          if (String(rw.locale).split("-")[0] === idiomaReal) rw.locale = d.idiomes[0];
          if (rw.timeZone === zonaReal && d.zona !== zonaReal) rw.timeZone = d.zona;
        } catch (e) { /* res */ }
        return r;
      });
    } catch (e) { /* res */ }

    if (d.zona !== zonaReal) {
      // Minuts de diferència amb UTC a la zona de la disfressa, en aquella data.
      const desfase = (ms) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: d.zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        }).formatToParts(new Date(ms));
        const v = {};
        for (const p of parts) v[p.type] = Number(p.value);
        const comALocal = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
        return Math.round((ms - comALocal) / 60000);
      };
      try {
        W.Date.prototype.getTimezoneOffset = exporta(function () {
          return desfase(Date.prototype.getTime.call(this));
        });
      } catch (e) { /* res */ }
    }
  }

  /* ---- 4. Pantalla i maquinari ---- */
  if (f.pantalla) {
    const S = W.Screen.prototype;
    posaGetter(S, "width", () => d.pantalla.w);
    posaGetter(S, "height", () => d.pantalla.h);
    posaGetter(S, "availWidth", () => d.pantalla.aw);
    posaGetter(S, "availHeight", () => d.pantalla.ah);
    posaGetter(S, "colorDepth", () => 24);
    posaGetter(S, "pixelDepth", () => 24);
    posaGetter(W.Navigator.prototype, "hardwareConcurrency", () => d.nuclis);
    try {
      for (const nom of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        const P = W[nom] && W[nom].prototype;
        if (!P) continue;
        const original = P.getParameter;
        P.getParameter = exporta(function (pname) {
          if (pname === 0x9245) return d.gpu.vendor;     // UNMASKED_VENDOR_WEBGL
          if (pname === 0x9246) return d.gpu.renderer;   // UNMASKED_RENDERER_WEBGL
          return original.call(this, pname);
        });
      }
    } catch (e) { /* res */ }
  }

  /* ---- 5. Ubicació ---- */
  if (f.ubicacio) {
    try {
      const G = W.Geolocation.prototype;
      const posicio = () => cloneInto({
        coords: {
          latitude: d.lat, longitude: d.lon, accuracy: 20 + (d.soroll % 60),
          altitude: null, altitudeAccuracy: null, heading: null, speed: null,
        },
        timestamp: Date.now(),
      }, window);
      G.getCurrentPosition = exporta(function (ok) {
        setTimeout(() => { try { ok(posicio()); } catch (e) { /* res */ } }, 40 + (d.soroll % 200));
      });
      G.watchPosition = exporta(function (ok) {
        setTimeout(() => { try { ok(posicio()); } catch (e) { /* res */ } }, 40 + (d.soroll % 200));
        return 1 + MG.aleatori(10000);
      });
      G.clearWatch = exporta(function () {});
    } catch (e) { /* res */ }
  }

  /* ---- 6. Empremta: canvas i àudio amb soroll ---- */
  if (f.empremta) {
    // Sempre el mateix soroll al mateix web: si el web dibuixa dues vegades, no veu cap diferència.
    const sorolla = (dades, llargada, clau) => {
      if (!llargada) return;
      const r = MG.rng(`${d.soroll}|${clau}|${llargada}`);
      const canvis = Math.min(24, Math.max(6, llargada >> 12));
      for (let i = 0; i < canvis; i++) {
        const k = Math.floor(r() * (llargada / 4)) * 4 + Math.floor(r() * 3);
        dades[k] = dades[k] ^ 1;
      }
    };
    try {
      const C2 = W.CanvasRenderingContext2D.prototype;
      const getImageData = C2.getImageData;
      C2.getImageData = exporta(function () {
        const res = getImageData.apply(this, arguments);
        try { sorolla(res.data, res.data.length, "img"); } catch (e) { /* res */ }
        return res;
      });
      // Una còpia del canvas, amb soroll. La crida a getImageData de la còpia va per la
      // funció original (les Xray no veuen els canvis que hem fet a la pàgina).
      const copia = (canvas) => {
        const w = canvas.width, h = canvas.height;
        if (!w || !h || w * h > 4e6) return null;
        const c2 = document.createElement("canvas");
        c2.width = w; c2.height = h;
        const ctx = c2.getContext("2d");
        ctx.drawImage(canvas, 0, 0);
        const img = ctx.getImageData(0, 0, w, h);
        sorolla(img.data, img.data.length, "img");
        ctx.putImageData(img, 0, 0);
        return c2;
      };
      const HC = W.HTMLCanvasElement.prototype;
      const toDataURL = HC.toDataURL, toBlob = HC.toBlob;
      HC.toDataURL = exporta(function () {
        try { const c = copia(this); if (c) return c.toDataURL(...arguments); } catch (e) { /* res */ }
        return toDataURL.apply(this, arguments);
      });
      HC.toBlob = exporta(function () {
        try { const c = copia(this); if (c) return c.toBlob(...arguments); } catch (e) { /* res */ }
        return toBlob.apply(this, arguments);
      });
    } catch (e) { /* res */ }
    try {
      const AB = W.AudioBuffer.prototype;
      const getChannelData = AB.getChannelData;
      const fets = new WeakSet();
      AB.getChannelData = exporta(function (canal) {
        const dades = getChannelData.call(this, canal);
        try {
          if (!fets.has(dades)) {
            fets.add(dades);
            const r = MG.rng(`${d.soroll}|audio|${dades.length}`);
            for (let i = 0; i < 12; i++) {
              const k = Math.floor(r() * dades.length);
              dades[k] = dades[k] + (r() - 0.5) * 1e-6;
            }
          }
        } catch (e) { /* res */ }
        return dades;
      });
    } catch (e) { /* res */ }
  }

  /* ---- 7. La IP que demanen els scripts (WebRTC) ---- */
  if (f.ipScripts && d.ip) {
    const privada = (ip) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
    const canviaIP = (text) => String(text).replace(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/g,
      (ip) => (privada(ip) ? ip : d.ip));
    try {
      const IC = W.RTCIceCandidate && W.RTCIceCandidate.prototype;
      if (IC) {
        for (const prop of ["candidate", "address"]) {
          const desc = Object.getOwnPropertyDescriptor(IC, prop);
          if (desc && desc.get) posaGetter(IC, prop, function () { return canviaIP(desc.get.call(this)); });
        }
      }
      const SD = W.RTCSessionDescription && W.RTCSessionDescription.prototype;
      if (SD) {
        const desc = Object.getOwnPropertyDescriptor(SD, "sdp");
        if (desc && desc.get) posaGetter(SD, "sdp", function () { return canviaIP(desc.get.call(this)); });
      }
    } catch (e) { /* res */ }
  }

  /* ---- 8. Els avisos de galetes ---- */
  // A la pàgina principal, i als marcs que són d'un avís (Sourcepoint en fa servir).
  if (cfg.avisos !== "res" && (window.top === window || /consent|cmp|privacy|sp_message|cookie/i.test(location.href))) {
    const accepta = cfg.avisos === "acceptar";
    // [nom, botó d'acceptar, botó de rebutjar]
    const CMP = [
      ["OneTrust", "#onetrust-accept-btn-handler", "#onetrust-reject-all-handler"],
      ["Cookiebot", "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept",
        "#CybotCookiebotDialogBodyButtonDecline"],
      ["Didomi", "#didomi-notice-agree-button", "#didomi-notice-disagree-button, .didomi-continue-without-agreeing"],
      ["CookieYes", ".cky-btn-accept", ".cky-btn-reject"],
      ["Complianz", ".cmplz-btn.cmplz-accept", ".cmplz-btn.cmplz-deny"],
      ["Borlabs", "a[data-cookie-accept-all], ._brlbs-btn-accept-all", "a[data-cookie-refuse], ._brlbs-refuse-btn a"],
      ["TrustArc", "#truste-consent-button", "#truste-consent-required"],
      ["Osano", ".osano-cm-accept-all", ".osano-cm-denyAll, .osano-cm-deny"],
      ["Termly", "[data-tid='banner-accept']", "[data-tid='banner-decline']"],
      ["Iubenda", ".iubenda-cs-accept-btn", ".iubenda-cs-reject-btn"],
      ["Klaro", ".cm-btn-accept-all, .cm-btn-success", ".cm-btn-decline"],
      ["Cookie Notice", "#cn-accept-cookie", "#cn-refuse-cookie"],
      ["Moove", ".moove-gdpr-infobar-allow-all", ".moove-gdpr-infobar-reject-btn"],
      ["Sourcepoint", "button.sp_choice_type_11", "button.sp_choice_type_13"],
      ["Quantcast", ".qc-cmp2-summary-buttons button[mode='primary']", ""],
    ];
    const ACCEPTAR = /^(acceptar|accepta|acceptar-ho tot|acceptar tot|acceptar totes|accepto|aceptar|aceptar todo|aceptar todas|aceptar y cerrar|acepto|accept|accept all|accept all cookies|allow all|agree|i agree|tout accepter|accepter|alle akzeptieren|akzeptieren|accetta|accetta tutti|aceitar|aceitar todos|ok|d'acord|de acuerdo|entesos|entendido)$/i;
    const REBUTJAR = /^(rebutjar|rebutja|rebutjar-ho tot|rebutjar tot|rebutjar totes|rechazar|rechazar todo|rechazar todas|no acepto|denegar|reject|reject all|decline|decline all|refuse|tout refuser|refuser|alle ablehnen|ablehnen|rifiuta|rifiuta tutti|rejeitar|continuar sin aceptar|continuar sense acceptar|continue without accepting)$/i;
    const clica = (el, cmp) => {
      el.click();
      avisa({ tipus: "avis", accio: accepta ? "acceptat" : "rebutjat", cmp });
      return true;
    };
    const busca = (arrel) => {
      for (const [nom, a, r] of CMP) {
        const sel = accepta ? a : r;
        if (!sel) continue;
        const el = arrel.querySelector(sel);
        if (visible(el)) return clica(el, nom);
      }
      // Usercentrics viu dins d'una «shadow root».
      for (const host of arrel.querySelectorAll("#usercentrics-root, #usercentrics-cmp-ui, aside#usercentrics-cmp-ui")) {
        const sr = host.shadowRoot || (host.wrappedJSObject && host.wrappedJSObject.shadowRoot);
        if (!sr) continue;
        const el = sr.querySelector(accepta ? "[data-testid='uc-accept-all-button']" : "[data-testid='uc-deny-all-button']");
        if (visible(el)) return clica(el, "Usercentrics");
      }
      // Qualsevol altre: un botó amb el text que toca, dins d'alguna cosa que parli de galetes.
      const re = accepta ? ACCEPTAR : REBUTJAR;
      for (const el of arrel.querySelectorAll("button, a[role='button'], [role='button'], input[type='button'], input[type='submit']")) {
        const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
        if (!text || text.length > 40 || !re.test(text) || !visible(el)) continue;
        let pare = el, parla = false;
        for (let i = 0; i < 8 && pare; i++, pare = pare.parentElement) {
          if (/cookie|galet|consent|privacitat|privacidad|privacy/i.test((pare.id || "") + " " + (pare.className || "") + " " + (pare.innerText || "").slice(0, 600))) { parla = true; break; }
        }
        if (parla) return clica(el, "genèric");
      }
      return false;
    };
    const comenca = () => {
      let fet = false;
      const prova = () => { if (!fet && document.body) fet = busca(document); if (fet) para(); };
      const obs = new MutationObserver(() => { clearTimeout(obs.t); obs.t = setTimeout(prova, 150); });
      const para = () => { obs.disconnect(); clearInterval(cada); };
      obs.observe(document.documentElement, { childList: true, subtree: true });
      const cada = setInterval(prova, 700);
      setTimeout(para, 20000);
      prova();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", comenca, { once: true });
    else comenca();
  }
}
