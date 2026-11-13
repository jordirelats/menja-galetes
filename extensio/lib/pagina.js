/*
 * Menja galetes · el codi que va a cada pàgina.
 *
 * El fons l'embolcalla amb lib/comu.js i la configuració, i el registra amb
 * browser.contentScripts.register a document_start, abans que cap script del
 * web. Aquest fitxer ha de ser només aquesta funció.
 *
 * Toca els objectes de la pàgina a través de window.wrappedJSObject i
 * exportFunction (les «Xray» del Firefox): el web no veu la configuració ni
 * la llavor, i nosaltres continuem veient les funcions originals. Tot el que
 * es fa a una finestra és dins de disfressa(win), perquè es pugui fer també als
 * marcs que la pàgina crea (i que podria llegir abans que hi arribi l'extensió).
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
  // Si no se sap quin és el web de dalt (un marc d'un altre web, sense «referrer»), no es
  // disfressa: podria ser un banc. Només es mengen les galetes de seguiment.
  const desconegut = !llocSuperior;
  if (desconegut) llocSuperior = "atzar:" + MG.aleatori(1e9);
  // Web de confiança, banc, govern, pagaments, xarxa social o de cites, o web amb contrasenya
  // o sistema contra el frau: sense disfressa, però les galetes de seguiment que hi posen els
  // tercers per JavaScript, se les menja.
  const usuari = (cfg.confianca || []).some((w) => MG.lloc(w) === llocSuperior);
  const real = desconegut || usuari || MG.esIdentitatReal(hostSuperior) || (cfg.realAuto || []).includes(llocSuperior);
  if (real && MG.esProtegitFrau(location.hostname) && location.hostname !== hostSuperior) return;

  const f = cfg.falseja;
  const pantallaReal = { w: screen.width, h: screen.height };
  const d = MG.disfressa(cfg, llocSuperior, pantallaReal);
  const zonaReal = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const preludi = MG.codiTreballador(d, f);
  const avisa = (missatge) => {
    try { browser.runtime.sendMessage(missatge).catch(() => {}); } catch (e) { /* res */ }
  };
  const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
  const fetes = new WeakSet();

  function disfressa(win) {
    let W;
    try {
      W = win.wrappedJSObject;
      if (!W || fetes.has(W)) return;
      void W.Navigator;                  // un marc d'un altre origen fa saltar una excepció aquí
    } catch (e) { return; }
    fetes.add(W);
    // Si un altre script de l'extensió ja hi ha passat (el del marc pare o el del mateix marc),
    // no ho tornem a fer. Es fa servir una marca (un símbol registrat, que es veu des de tots
    // els scripts): comparar valors no serveix quan el sistema de debò és el de la disfressa.
    try {
      const marca = Symbol.for(MG.MARCA);
      if (W.Document.prototype[marca]) return;
      Object.defineProperty(W.Document.prototype, marca, { value: true, configurable: true });
    } catch (e) { return; }

    const fn = (g) => exportFunction(g, win);
    const ganxo = (o) => cloneInto(o, win, { cloneFunctions: true });
    const posaGetter = (obj, prop, g) => {
      try { Object.defineProperty(obj, prop, { get: fn(g), configurable: true, enumerable: true }); } catch (e) { /* res */ }
    };
    const embolcalla = (obj, nom, fer) => {
      try { const o = obj && obj[nom]; if (typeof o === "function") obj[nom] = fn(fer(o)); } catch (e) { /* res */ }
    };

    // «No venguis les meves dades» (GPC): també als webs sense disfressa.
    if (cfg.gpc) posaGetter(W.Navigator.prototype, "globalPrivacyControl", () => true);
    galetesJS(win, W, fn);
    if (real) return;

    /* (2…9 més avall) */
    disfressaResta(win, W, fn, ganxo, posaGetter, embolcalla);
  }

  /* ---- 1. Les galetes que es posen per JavaScript ---- */
  function galetesJS(win, W, fn) {
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
        return MG.esSeguiment(nom, hostSuperior) ? ` ${nom}=${MG.galetaFalsa(nom, tros.slice(i + 1).trim())}` : tros;
      }).join(";").trim();
      if (original && original.set) {
        Object.defineProperty(DP, "cookie", {
          configurable: true,
          enumerable: true,
          get: fn(function () {
            const v = original.get.call(this);
            return cfg.identificador === "clic" ? canviaTotes(v) : v;
          }),
          set: fn(function (valor) {
            valor = String(valor);
            const [nv, ...attrs] = valor.split(";");
            const i = nv.indexOf("=");
            const nom = i > 0 ? nv.slice(0, i).trim() : "";
            if (!nom || !MG.esSeguiment(nom, hostSuperior) || esborra(attrs)) return original.set.call(this, valor);
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
      try {
        const CS = W.CookieStore && W.CookieStore.prototype;
        if (CS && CS.set) {
          const set = CS.set;
          CS.set = fn(function (a, b) {
            try {
              const opc = typeof a === "string" ? { name: a, value: b } : JSON.parse(JSON.stringify(a));
              if (opc && opc.name && MG.esSeguiment(opc.name, hostSuperior)) {
                const fals = MG.galetaFalsa(opc.name, opc.value);
                avisa({ tipus: "galeta", via: "js", lloc: llocSuperior, nom: opc.name, original: opc.value, fals });
                delete opc.expires;
                opc.value = fals;
                return set.call(this, cloneInto(opc, win));
              }
            } catch (e) { /* res */ }
            return set.call(this, ...arguments);
          });
        }
      } catch (e) { /* res */ }
    }
  }

  function disfressaResta(win, W, fn, ganxo, posaGetter, embolcalla) {
    /* ---- 2. El navegador i el sistema ---- */
    if (f.navegador) {
      const N = W.Navigator.prototype;
      posaGetter(N, "userAgent", () => d.ua);
      posaGetter(N, "platform", () => d.platform);
      posaGetter(N, "oscpu", () => d.oscpu);
      posaGetter(N, "appVersion", () => d.appVersion);
    }

    /* ---- 3. Idioma i hora: navigator, Intl, Date i Temporal ----
     * (Si la IP és d'un país que la disfressa no coneix, es queden els de debò.) */
    if (f.idioma && d.idiomes) {
      const N = W.Navigator.prototype;
      const llista = W.Object.freeze(cloneInto(d.idiomes, win));
      posaGetter(N, "language", () => d.idiomes[0]);
      posaGetter(N, "languages", () => llista);
      MG.zonaIdioma(W, d, f, { fn, ganxo, Date, DTF: Intl.DateTimeFormat, zonaReal });
    }

    /* ---- 4. Pantalla i maquinari ---- */
    if (f.pantalla) {
      // Al mòbil (d.pantalla null), la pantalla i la densitat es queden les de debò.
      if (d.pantalla) {
        const S = W.Screen.prototype;
        posaGetter(S, "width", () => d.pantalla.w);
        posaGetter(S, "height", () => d.pantalla.h);
        posaGetter(S, "availWidth", () => d.pantalla.aw);
        posaGetter(S, "availHeight", () => d.pantalla.ah);
        posaGetter(S, "colorDepth", () => 24);
        posaGetter(S, "pixelDepth", () => 24);
        // La densitat de la pantalla, la de la disfressa (un Mac és sempre 2).
        try { Object.defineProperty(W, "devicePixelRatio", { get: fn(() => d.pantalla.dpr), configurable: true, enumerable: true }); } catch (e) { /* res */ }
      }
      posaGetter(W.Navigator.prototype, "hardwareConcurrency", () => d.nuclis);
      for (const nom of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        embolcalla(W[nom] && W[nom].prototype, "getParameter", (o) => function (pname) {
          if (pname === 0x9245) return d.gpu.vendor;     // UNMASKED_VENDOR_WEBGL
          if (pname === 0x9246) return d.gpu.renderer;   // UNMASKED_RENDERER_WEBGL
          if (pname === 0x1F01) return d.gpu.renderer;   // RENDERER: al Firefox també diu la targeta de debò
          return o.call(this, pname);
        });
      }
    }

    /* ---- 5. Ubicació ----
     * (Si la IP és d'un país que la disfressa no coneix, no s'inventa: el navegador et pregunta.) */
    if (f.ubicacio && d.lat !== null) {
      try {
        const G = W.Geolocation.prototype;
        const posicio = () => cloneInto({
          coords: {
            latitude: d.lat, longitude: d.lon, accuracy: 20 + (d.soroll % 60),
            altitude: null, altitudeAccuracy: null, heading: null, speed: null,
          },
          timestamp: Date.now(),
        }, win);
        G.getCurrentPosition = fn(function (ok) {
          setTimeout(() => { try { ok(posicio()); } catch (e) { /* res */ } }, 40 + (d.soroll % 200));
        });
        G.watchPosition = fn(function (ok) {
          setTimeout(() => { try { ok(posicio()); } catch (e) { /* res */ } }, 40 + (d.soroll % 200));
          return 1 + MG.aleatori(10000);
        });
        G.clearWatch = fn(function () {});
      } catch (e) { /* res */ }
    }

    /* ---- 6. Empremta: canvas i àudio amb soroll (sempre el mateix al mateix web) ---- */
    if (f.empremta) {
      try {
        const C2 = W.CanvasRenderingContext2D.prototype;
        const getImageData = C2.getImageData;
        C2.getImageData = fn(function () {
          const res = getImageData.call(this, ...arguments);
          try { MG.sorolla(res.data, res.data.length, d.soroll + "|img", MG.M, MG.car); } catch (e) { /* res */ }
          return res;
        });
        // Una còpia del canvas amb soroll. La crida a getImageData de la còpia va per la
        // funció original (les Xray no veuen els canvis que hem fet a la pàgina).
        const copia = (canvas) => {
          const w = canvas.width, h = canvas.height;
          if (!w || !h || w * h > 4e6) return null;
          const c2 = win.document.createElement("canvas");
          c2.width = w; c2.height = h;
          const ctx = c2.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          const img = ctx.getImageData(0, 0, w, h);
          MG.sorolla(img.data, img.data.length, d.soroll + "|img");
          ctx.putImageData(img, 0, 0);
          return c2;
        };
        const HC = W.HTMLCanvasElement.prototype;
        const toDataURL = HC.toDataURL, toBlob = HC.toBlob;
        HC.toDataURL = fn(function () {
          try { const c = copia(this); if (c) return c.toDataURL(...arguments); } catch (e) { /* res */ }
          return toDataURL.call(this, ...arguments);
        });
        HC.toBlob = fn(function () {
          try { const c = copia(this); if (c) return c.toBlob(...arguments); } catch (e) { /* res */ }
          return toBlob.call(this, ...arguments);
        });
      } catch (e) { /* res */ }
      // Els canvas fora de pantalla (OffscreenCanvas) del mateix fil de la pàgina.
      try {
        const OC2 = W.OffscreenCanvasRenderingContext2D && W.OffscreenCanvasRenderingContext2D.prototype;
        if (OC2) {
          const ogid = OC2.getImageData;
          OC2.getImageData = fn(function () {
            const res = ogid.call(this, ...arguments);
            try { MG.sorolla(res.data, res.data.length, d.soroll + "|img", MG.M, MG.car); } catch (e) { /* res */ }
            return res;
          });
          const OCP = W.OffscreenCanvas.prototype, ctb = OCP.convertToBlob;
          if (typeof ctb === "function") {
            OCP.convertToBlob = fn(function () {
              try {
                const w = this.width, h = this.height;
                if (w && h && w * h <= 4e6) {
                  const c = new win.OffscreenCanvas(w, h);
                  const x = c.getContext("2d");
                  x.drawImage(this, 0, 0);
                  const im = x.getImageData(0, 0, w, h);
                  MG.sorolla(im.data, im.data.length, d.soroll + "|img", MG.M, MG.car);
                  x.putImageData(im, 0, 0);
                  return ctb.call(c.wrappedJSObject, ...arguments);
                }
              } catch (e) { /* res */ }
              return ctb.call(this, ...arguments);
            });
          }
        }
      } catch (e) { /* res */ }
      // Els píxels que llegeix WebGL (readPixels): el mateix soroll.
      for (const nom of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        embolcalla(W[nom] && W[nom].prototype, "readPixels", (o) => function () {
          const res = o.call(this, ...arguments);
          try {
            const px = arguments[6];
            if (px && px.BYTES_PER_ELEMENT === 1 && px.length) MG.sorolla(px, px.length, d.soroll + "|gl", MG.M, MG.car);
          } catch (e) { /* res */ }
          return res;
        });
      }
      embolcalla(W.AudioBuffer && W.AudioBuffer.prototype, "getChannelData", (o) => function (canal) {
        const dades = o.call(this, canal);
        try {
          // Arrodoneix i hi suma menys de mig pas: es pot aplicar dues vegades i dona el mateix.
          const r = MG.rng(`${d.soroll}|audio|${dades.length}`);
          for (let i = 0; i < 12; i++) {
            const k = MG.M.floor(r() * dades.length);
            dades[k] = MG.M.round(dades[k] * 1e6) / 1e6 + (r() - 0.5) * 4e-7;
          }
        } catch (e) { /* res */ }
        return dades;
      });
    }

    /* ---- 7. La IP que demanen els scripts (WebRTC) ---- */
    if (f.ipScripts && d.ip) {
      const canviaIP = MG.canviaIP(d.ip);
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
      // toJSON() i getStats() també porten les adreces.
      for (const [classe, camps] of [["RTCIceCandidate", ["candidate", "address", "relatedAddress"]], ["RTCSessionDescription", ["sdp"]]]) {
        embolcalla(W[classe] && W[classe].prototype, "toJSON", (o) => function () {
          const res = o.call(this);
          try {
            const rw = res && (res.wrappedJSObject || res);
            for (const c of camps) if (typeof rw[c] === "string") rw[c] = canviaIP(rw[c]);
          } catch (e) { /* res */ }
          return res;
        });
      }
      embolcalla(W.RTCPeerConnection && W.RTCPeerConnection.prototype, "getStats", (o) => function () {
        const pr = o.call(this, ...arguments);
        try {
          return pr.then(fn((rep) => {
            try {
              const m = new W.Map();
              const rw = rep.wrappedJSObject || rep;
              rw.forEach(fn((v, k) => {
                const c = W.Object.assign(new W.Object(), v.wrappedJSObject || v);
                for (const camp of ["address", "ip", "candidate", "relatedAddress", "url"]) {
                  if (typeof c[camp] === "string") c[camp] = canviaIP(c[camp]);
                }
                m.set(k, c);
              }));
              return m;
            } catch (e) { return rep; }
          }));
        } catch (e) { return pr; }
      });
    }

    /* ---- 8. Els treballadors que la pàgina crea des d'un blob o un data: ----
     * Els que són un fitxer (/worker.js) els disfressa el fons, que afegeix el codi al
     * començament de l'script mentre baixa. Aquests no passen per la xarxa: es
     * fa un blob nou que porta la disfressa i després carrega el de la pàgina. */
    try {
      const fesBlob = (codi) => W.URL.createObjectURL(new W.Blob(cloneInto([codi], win), cloneInto({ type: "text/javascript" }, win)));
      for (const nomC of ["Worker", "SharedWorker"]) {
        const C = W[nomC];
        if (!C) continue;
        const P = new W.Proxy(C, ganxo({
          construct: (t, args, nt) => {
            try {
              const url = String(args[0]);
              if (/^(blob|data):/i.test(url)) {
                const opc = args.length > 1 ? args[1] : undefined;
                const modul = !!opc && typeof opc === "object" && opc.type === "module";
                const nou = modul
                  ? fesBlob(`import ${JSON.stringify(fesBlob(preludi))};\nimport ${JSON.stringify(url)};\n`)
                  : fesBlob(`${preludi}importScripts(${JSON.stringify(url)});\n`);
                const pa = new W.Array();
                pa.push(nou);
                for (let i = 1; i < args.length; i++) pa.push(args[i]);
                return W.Reflect.construct(t, pa, nt);
              }
            } catch (e) { /* res */ }
            return W.Reflect.construct(t, args, nt);
          },
        }));
        W[nomC] = P;
        C.prototype.constructor = P;
      }
    } catch (e) { /* res */ }

    /* ---- 9. Els marcs: es disfressen en el moment que la pàgina els crea o els toca ---- */
    const revisa = (n) => {
      try {
        if (!n || typeof n !== "object") return;
        const t = n.nodeType;
        if (t === 1 && /^(iframe|frame|object)$/.test(n.localName)) {
          const cw = n.contentWindow;
          if (cw) disfressa(cw);
        }
        if ((t === 1 || t === 9 || t === 11) && n.querySelector && n.querySelector("iframe, frame, object")) {
          for (const fr of n.querySelectorAll("iframe, frame, object")) {
            const cw = fr.contentWindow;
            if (cw) disfressa(cw);
          }
        }
      } catch (e) { /* res */ }
    };
    // contentWindow i contentDocument: els disfressa just abans de tornar-los.
    for (const nomC of ["HTMLIFrameElement", "HTMLFrameElement", "HTMLObjectElement"]) {
      const P = W[nomC] && W[nomC].prototype;
      if (!P) continue;
      for (const prop of ["contentWindow", "contentDocument"]) {
        const desc = Object.getOwnPropertyDescriptor(P, prop);
        if (!desc || !desc.get) continue;
        try {
          Object.defineProperty(P, prop, {
            configurable: true,
            enumerable: true,
            get: fn(function () {
              try { const cw = this.contentWindow; if (cw) disfressa(cw); } catch (e) { /* res */ }
              return desc.get.call(this);
            }),
          });
        } catch (e) { /* res */ }
      }
    }
    // Quan s'afegeix un marc al document, el disfressa de seguida (així window[0] ja surt
    // disfressat). Els fragments es buiden en inserir-los: se'n guarden els fills abans.
    const ambInsercio = (proto, nom, sobreJo) => embolcalla(proto, nom, (o) => function () {
      const abans = [];
      try {
        for (let i = 0; i < arguments.length; i++) {
          const a = arguments[i];
          if (a && a.nodeType === 11) for (const c of a.children) abans.push(c);
        }
      } catch (e) { /* res */ }
      const r = o.call(this, ...arguments);
      try {
        if (sobreJo) revisa(this.parentNode || this);
        for (let i = 0; i < arguments.length; i++) revisa(arguments[i]);
        for (const c of abans) revisa(c);
      } catch (e) { /* res */ }
      return r;
    });
    for (const nom of ["appendChild", "insertBefore", "replaceChild"]) ambInsercio(W.Node.prototype, nom, false);
    for (const nom of ["append", "prepend", "after", "before", "replaceWith", "insertAdjacentElement"]) ambInsercio(W.Element.prototype, nom, false);
    ambInsercio(W.Element.prototype, "insertAdjacentHTML", true);
    for (const nom of ["write", "writeln"]) {
      embolcalla(W.Document.prototype, nom, (o) => function () { const r = o.call(this, ...arguments); revisa(this); return r; });
    }
    for (const prop of ["innerHTML", "outerHTML"]) {
      const desc = Object.getOwnPropertyDescriptor(W.Element.prototype, prop);
      if (!desc || !desc.set) continue;
      try {
        Object.defineProperty(W.Element.prototype, prop, {
          configurable: true,
          enumerable: true,
          get: desc.get,
          set: fn(function (v) {
            const pare = this.parentNode;
            desc.set.call(this, v);
            revisa(prop === "outerHTML" ? pare : this);
          }),
        });
      } catch (e) { /* res */ }
    }
    // Les finestres que obre window.open (comencen en blanc, i la pàgina les pot llegir).
    try {
      const obre = W.open;
      if (typeof obre === "function") {
        W.open = fn(function () {
          const w = obre.call(this, ...arguments);
          try { if (w && typeof XPCNativeWrapper === "function") disfressa(XPCNativeWrapper(w)); } catch (e) { /* res */ }
          return w;
        });
      }
    } catch (e) { /* res */ }
  }

  disfressa(window);

  /* ---- Pàgines amb contrasenya o targeta: sense disfressa ----
   * Si el web demana una contrasenya o una targeta, ha de veure el navegador de debò,
   * perquè els sistemes contra el frau i contra els comptes robats funcionin. El fons
   * se'l queda com a web de confiança i torna a carregar la pàgina sense disfressa. */
  // Només el web de dalt i els marcs del mateix web: un marc d'un altre web (un anunci) no pot treure
  // la disfressa a tot el web ensenyant un camp de contrasenya.
  if (!real && MG.lloc(location.hostname) === llocSuperior) {
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
    const comenca = () => {
      obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["type", "style", "class", "hidden"] });
      mira();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", comenca, { once: true });
    else comenca();
  }

  /* ---- Els avisos de galetes ---- */
  // A la pàgina principal, i als marcs que són d'un avís (Sourcepoint en fa servir).
  // (Als webs de confiança, l'avís el respons tu.)
  if (!usuari && cfg.avisos !== "res" && (window.top === window || /consent|cmp|privacy|sp_message|cookie/i.test(location.href))) {
    const accepta = cfg.avisos === "acceptar";
    const ombra = (host) => host.shadowRoot || (host.wrappedJSObject && host.wrappedJSObject.shadowRoot);
    const busca = (arrel) => {
      const b = MG.botoAvis(arrel, accepta, real, visible, ombra);
      if (!b) return false;
      b.el.click();
      avisa({ tipus: "avis", accio: accepta ? "acceptat" : "rebutjat", cmp: b.nom });
      return true;
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
