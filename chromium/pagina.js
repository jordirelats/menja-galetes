/*
 * Menja galetes (Chromium: Vivaldi, Chrome, Brave) · el codi que va a cada pàgina.
 *
 * El fons l'embolcalla amb lib/comu.js i la configuració i el registra amb
 * chrome.userScripts al món MAIN, a document_start: s'executa abans que cap script
 * del web i no el para la CSP. Aquest fitxer ha de ser només aquesta funció.
 *
 * Aquí no hi ha Xray com al Firefox: el codi és dins de la pàgina. Per això, abans de
 * tocar res, es guarden les funcions originals del navegador, i el codi fa servir
 * sempre les originals (si no, s'ensopegaria amb els seus propis canvis).
 * Els avisos per a la finestreta surten amb postMessage cap a lib/contingut.js.
 */
function MG_pagina(MG, cfg) {
  "use strict";
  if (!cfg.actiu) return;
  if (location.protocol !== "http:" && location.protocol !== "https:" && location.protocol !== "about:") return;

  /* ---- On som ---- */
  let hostSuperior = location.hostname;
  let llocSuperior = MG.lloc(location.hostname);
  if (window.top !== window) {
    try {
      hostSuperior = window.top.location.hostname;
      llocSuperior = MG.lloc(hostSuperior);
    } catch (e) {
      let ancestre = "";
      try {
        const ao = location.ancestorOrigins;
        if (ao && ao.length) ancestre = ao[ao.length - 1];
      } catch (e2) { /* res */ }
      llocSuperior = MG.llocDeUrl(ancestre || document.referrer || "");
      try { hostSuperior = new URL(ancestre || document.referrer).hostname; } catch (e3) { hostSuperior = llocSuperior; }
    }
  }
  const desconegut = !llocSuperior;   // no se sap quin és el web de dalt: sense disfressa
  if (desconegut) llocSuperior = "atzar:" + MG.aleatori(1e9);
  const usuari = (cfg.confianca || []).some((w) => MG.lloc(w) === llocSuperior);
  const real = desconegut || usuari || MG.esIdentitatReal(hostSuperior) || (cfg.realAuto || []).includes(llocSuperior);
  if (real && MG.esProtegitFrau(location.hostname) && location.hostname !== hostSuperior) return;

  const f = cfg.falseja;
  const d = MG.disfressa(cfg, llocSuperior, { w: screen.width, h: screen.height });
  const zonaReal = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const DateOriginal = Date, DTFOriginal = Intl.DateTimeFormat;
  const preludi = MG.codiTreballador(d, f);
  const postMessageOriginal = window.postMessage;
  const avisa = (missatge) => {
    try { postMessageOriginal.call(window, { __menjaGaletes: 1, missatge }, location.origin === "null" ? "*" : location.origin); } catch (e) { /* res */ }
  };
  const fetes = new WeakSet();
  const getter = (obj, prop, valor) => {
    try { Object.defineProperty(obj, prop, { get: valor, configurable: true, enumerable: true }); } catch (e) { /* res */ }
  };
  const desc = (obj, prop) => { try { return Object.getOwnPropertyDescriptor(obj, prop); } catch (e) { return null; } };

  function disfressa(win) {
    let clau;
    try { clau = win.Navigator.prototype; } catch (e) { return; }   // un marc d'un altre origen
    if (!clau || fetes.has(clau)) return;
    fetes.add(clau);
    // La marca (un símbol registrat) es veu des dels scripts de tots els marcs: si un altre ja
    // hi ha passat, no ho tornem a fer.
    try {
      const marca = Symbol.for(MG.MARCA);
      if (win.Document.prototype[marca]) return;
      Object.defineProperty(win.Document.prototype, marca, { value: true, configurable: true });
    } catch (e) { return; }
    // «No venguis les meves dades» (GPC): també als webs sense disfressa.
    if (cfg.gpc) getter(win.Navigator.prototype, "globalPrivacyControl", () => true);
    galetesJS(win);
    if (!real) resta(win);
  }

  /* ---- 1. Les galetes que es posen per JavaScript ---- */
  function galetesJS(win) {
    if (!f.galetes) return;
    const DP = win.Document.prototype;
    const original = desc(DP, "cookie");
    const esborra = (attrs) => attrs.some((a) => /^\s*max-age\s*=\s*(-|0\s*$)/i.test(a))
      || attrs.some((a) => { const m = /^\s*expires\s*=(.*)$/i.exec(a); return m && DateOriginal.parse(m[1]) < DateOriginal.now(); });
    const llegeix = (cadena, nom) => {
      for (const tros of String(cadena).split(";")) {
        const i = tros.indexOf("=");
        if (i > 0 && tros.slice(0, i).trim() === nom) return tros.slice(i + 1).trim();
      }
      return null;
    };
    const canviaTotes = (cadena) => String(cadena).split(";").map((tros) => {
      const i = tros.indexOf("=");
      if (i < 0) return tros;
      const nom = tros.slice(0, i).trim();
      return MG.esSeguiment(nom, hostSuperior) ? ` ${nom}=${MG.galetaFalsa(nom, tros.slice(i + 1).trim())}` : tros;
    }).join(";").trim();
    if (original && original.set) {
      Object.defineProperty(DP, "cookie", {
        configurable: true,
        enumerable: true,
        get: function () {
          const v = original.get.call(this);
          return cfg.identificador === "clic" ? canviaTotes(v) : v;
        },
        set: function (valor) {
          valor = String(valor);
          const [nv, ...attrs] = valor.split(";");
          const i = nv.indexOf("=");
          const nom = i > 0 ? nv.slice(0, i).trim() : "";
          if (!nom || !MG.esSeguiment(nom, hostSuperior) || esborra(attrs)) return original.set.call(this, valor);
          const vell = nv.slice(i + 1).trim();
          const existent = llegeix(original.get.call(this), nom);
          const fals = existent || MG.galetaFalsa(nom, vell);
          if (!existent) avisa({ tipus: "galeta", via: "js", lloc: llocSuperior, nom, original: vell, fals });
          const sense = attrs.filter((a) => !/^\s*(expires|max-age)\s*=/i.test(a));
          return original.set.call(this, [`${nom}=${fals}`, ...sense].join(";"));
        },
      });
    }
    try {
      const CS = win.CookieStore && win.CookieStore.prototype;
      if (CS && CS.set) {
        const set = CS.set;
        CS.set = function (a, b) {
          try {
            const opc = typeof a === "string" ? { name: a, value: b } : Object.assign({}, a);
            if (opc && opc.name && MG.esSeguiment(opc.name, hostSuperior)) {
              const fals = MG.galetaFalsa(opc.name, opc.value);
              avisa({ tipus: "galeta", via: "js", lloc: llocSuperior, nom: opc.name, original: opc.value, fals });
              delete opc.expires;
              opc.value = fals;
              return set.call(this, opc);
            }
          } catch (e) { /* res */ }
          return set.apply(this, arguments);
        };
      }
    } catch (e) { /* res */ }
  }

  function resta(win) {
    const N = win.Navigator.prototype;

    /* ---- 2. El navegador i el sistema ---- */
    if (f.navegador) {
      getter(N, "userAgent", () => d.ua);
      getter(N, "appVersion", () => d.appVersion);
      getter(N, "platform", () => d.platform);
      MG.uaDades(win, d);
    }

    /* ---- 3. Idioma i hora ---- */
    if (f.idioma) {
      const llista = Object.freeze(d.idiomes.slice());
      getter(N, "language", () => d.idiomes[0]);
      getter(N, "languages", () => llista);
      const id = (x) => x;
      MG.zonaIdioma(win, d, f, { fn: id, ganxo: id, Date: DateOriginal, DTF: DTFOriginal, zonaReal });
    }

    /* ---- 4. Pantalla i maquinari ---- */
    if (f.pantalla) {
      const S = win.Screen.prototype;
      getter(S, "width", () => d.pantalla.w);
      getter(S, "height", () => d.pantalla.h);
      getter(S, "availWidth", () => d.pantalla.aw);
      getter(S, "availHeight", () => d.pantalla.ah);
      getter(S, "colorDepth", () => 24);
      getter(S, "pixelDepth", () => 24);
      getter(N, "hardwareConcurrency", () => d.nuclis);
      if (d.memoria && "deviceMemory" in N) getter(N, "deviceMemory", () => d.memoria);
      for (const nom of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        const P = win[nom] && win[nom].prototype;
        if (!P) continue;
        const o = P.getParameter;
        P.getParameter = function (pname) {
          if (pname === 0x9245) return d.gpu.vendor;
          if (pname === 0x9246) return d.gpu.renderer;
          return o.call(this, pname);
        };
      }
    }

    /* ---- 5. Ubicació ---- */
    if (f.ubicacio && win.Geolocation) {
      const G = win.Geolocation.prototype;
      const posicio = () => ({
        coords: { latitude: d.lat, longitude: d.lon, accuracy: 20 + (d.soroll % 60), altitude: null,
          altitudeAccuracy: null, heading: null, speed: null },
        timestamp: DateOriginal.now(),
      });
      const espera = 40 + (d.soroll % 200);
      G.getCurrentPosition = function (ok) { setTimeout(() => { try { ok(posicio()); } catch (e) { /* res */ } }, espera); };
      G.watchPosition = function (ok) { setTimeout(() => { try { ok(posicio()); } catch (e) { /* res */ } }, espera); return 1 + MG.aleatori(10000); };
      G.clearWatch = function () {};
    }

    /* ---- 6. Empremta: canvas i àudio ---- */
    if (f.empremta) {
      try {
        const C2 = win.CanvasRenderingContext2D.prototype, HC = win.HTMLCanvasElement.prototype;
        const gid = C2.getImageData, pid = C2.putImageData, dib = C2.drawImage, ctxDe = HC.getContext;
        const toDataURL = HC.toDataURL, toBlob = HC.toBlob, crea = win.Document.prototype.createElement;
        C2.getImageData = function () {
          const r = gid.apply(this, arguments);
          try { MG.sorolla(r.data, r.data.length, d.soroll + "|img"); } catch (e) { /* res */ }
          return r;
        };
        // Una còpia amb soroll, feta amb les funcions originals.
        const copia = (canvas) => {
          const w = canvas.width, h = canvas.height;
          if (!w || !h || w * h > 4e6) return null;
          const c2 = crea.call(win.document, "canvas");
          c2.width = w; c2.height = h;
          const ctx = ctxDe.call(c2, "2d");
          dib.call(ctx, canvas, 0, 0);
          const img = gid.call(ctx, 0, 0, w, h);
          MG.sorolla(img.data, img.data.length, d.soroll + "|img");
          pid.call(ctx, img, 0, 0);
          return c2;
        };
        HC.toDataURL = function () {
          try { const c = copia(this); if (c) return toDataURL.apply(c, arguments); } catch (e) { /* res */ }
          return toDataURL.apply(this, arguments);
        };
        HC.toBlob = function () {
          try { const c = copia(this); if (c) return toBlob.apply(c, arguments); } catch (e) { /* res */ }
          return toBlob.apply(this, arguments);
        };
      } catch (e) { /* res */ }
      try {
        const AB = win.AudioBuffer.prototype, gcd = AB.getChannelData;
        AB.getChannelData = function (canal) {
          const dades = gcd.call(this, canal);
          try {
            const r = MG.rng(`${d.soroll}|audio|${dades.length}`);
            for (let i = 0; i < 12; i++) {
              const k = Math.floor(r() * dades.length);
              dades[k] = Math.round(dades[k] * 1e6) / 1e6 + (r() - 0.5) * 4e-7;
            }
          } catch (e) { /* res */ }
          return dades;
        };
      } catch (e) { /* res */ }
    }

    /* ---- 7. La IP que demanen els scripts (WebRTC) ---- */
    if (f.ipScripts && d.ip) {
      const privada = (ip) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
      const canviaIP = (text) => String(text).replace(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/g, (ip) => (privada(ip) ? ip : d.ip));
      for (const [classe, props] of [["RTCIceCandidate", ["candidate", "address"]], ["RTCSessionDescription", ["sdp"]]]) {
        const P = win[classe] && win[classe].prototype;
        if (!P) continue;
        for (const prop of props) {
          const ds = desc(P, prop);
          if (ds && ds.get) getter(P, prop, function () { return canviaIP(ds.get.call(this)); });
        }
      }
    }

    /* ---- 8. Els treballadors que la pàgina crea des d'un blob o un data: ---- */
    try {
      const crearUrl = win.URL.createObjectURL;
      const fesBlob = (codi) => crearUrl.call(win.URL, new win.Blob([codi], { type: "text/javascript" }));
      for (const nomC of ["Worker", "SharedWorker"]) {
        const C = win[nomC];
        if (!C) continue;
        const P = new win.Proxy(C, {
          construct: (t, args, nt) => {
            try {
              const url = String(args[0]);
              if (/^(blob|data):/i.test(url)) {
                const opc = args.length > 1 ? args[1] : undefined;
                const modul = !!opc && typeof opc === "object" && opc.type === "module";
                const nou = modul
                  ? fesBlob(`import ${JSON.stringify(fesBlob(preludi))};\nimport ${JSON.stringify(url)};\n`)
                  : fesBlob(`${preludi}importScripts(${JSON.stringify(url)});\n`);
                return Reflect.construct(t, [nou, ...Array.prototype.slice.call(args, 1)], nt);
              }
            } catch (e) { /* res */ }
            return Reflect.construct(t, args, nt);
          },
        });
        win[nomC] = P;
        C.prototype.constructor = P;
      }
    } catch (e) { /* res */ }

    /* ---- 9. Els marcs: es disfressen en el moment que la pàgina els crea o els toca ---- */
    const finestraDe = {};
    for (const nomC of ["HTMLIFrameElement", "HTMLFrameElement", "HTMLObjectElement"]) {
      const P = win[nomC] && win[nomC].prototype;
      const ds = P && desc(P, "contentWindow");
      if (ds && ds.get) finestraDe[nomC] = ds.get;
    }
    const finestra = (n) => {
      for (const nomC of Object.keys(finestraDe)) {
        if (n instanceof win[nomC]) { try { return finestraDe[nomC].call(n); } catch (e) { return null; } }
      }
      return null;
    };
    const qsa = win.Element.prototype.querySelectorAll, qsaD = win.Document.prototype.querySelectorAll;
    const qsaF = win.DocumentFragment.prototype.querySelectorAll;
    const revisa = (n) => {
      try {
        if (!n || typeof n !== "object") return;
        const w = finestra(n);
        if (w) disfressa(w);
        const q = n.nodeType === 1 ? qsa : n.nodeType === 9 ? qsaD : n.nodeType === 11 ? qsaF : null;
        if (q) for (const fr of q.call(n, "iframe, frame, object")) { const w2 = finestra(fr); if (w2) disfressa(w2); }
      } catch (e) { /* res */ }
    };
    for (const nomC of Object.keys(finestraDe)) {
      const P = win[nomC].prototype;
      for (const prop of ["contentWindow", "contentDocument"]) {
        const ds = desc(P, prop);
        if (!ds || !ds.get) continue;
        getter(P, prop, function () {
          try { const w = finestraDe[nomC].call(this); if (w) disfressa(w); } catch (e) { /* res */ }
          return ds.get.call(this);
        });
      }
    }
    const fills = (args) => {
      const abans = [];
      for (const a of args) if (a && a.nodeType === 11) for (const c of Array.from(a.children)) abans.push(c);
      return abans;
    };
    const ambInsercio = (proto, nom, sobreJo) => {
      const o = proto && proto[nom];
      if (typeof o !== "function") return;
      proto[nom] = function () {
        let abans = [];
        try { abans = fills(arguments); } catch (e) { /* res */ }
        const r = o.apply(this, arguments);
        try {
          if (sobreJo) revisa(this.parentNode || this);
          for (const a of arguments) revisa(a);
          for (const c of abans) revisa(c);
        } catch (e) { /* res */ }
        return r;
      };
    };
    for (const nom of ["appendChild", "insertBefore", "replaceChild"]) ambInsercio(win.Node.prototype, nom, false);
    for (const nom of ["append", "prepend", "after", "before", "replaceWith", "insertAdjacentElement"]) ambInsercio(win.Element.prototype, nom, false);
    ambInsercio(win.Element.prototype, "insertAdjacentHTML", true);
    for (const nom of ["write", "writeln"]) {
      const o = win.Document.prototype[nom];
      if (typeof o === "function") win.Document.prototype[nom] = function () { const r = o.apply(this, arguments); revisa(this); return r; };
    }
    for (const prop of ["innerHTML", "outerHTML"]) {
      const ds = desc(win.Element.prototype, prop);
      if (!ds || !ds.set) continue;
      Object.defineProperty(win.Element.prototype, prop, {
        configurable: true,
        enumerable: true,
        get: ds.get,
        set: function (v) { const pare = this.parentNode; ds.set.call(this, v); revisa(prop === "outerHTML" ? pare : this); },
      });
    }
    const obre = win.open;
    if (typeof obre === "function") {
      win.open = function () {
        const w = obre.apply(this, arguments);
        try { if (w) disfressa(w); } catch (e) { /* res */ }
        return w;
      };
    }
  }

  disfressa(window);
}
