"use strict";
/*
 * Menja galetes (Chromium) · l'script de contingut (món aïllat).
 *
 * - Passa al fons els avisos del codi de pàgina (galetes menjades), que arriben per postMessage.
 * - Respon els avisos de galetes.
 * - Detecta les pàgines amb contrasenya o targeta (aquest web, a partir d'ara, sense disfressa).
 * La configuració la llegeix de chrome.storage (aquí no cal tenir-la abans que el web).
 */
(function () {
  const envia = (m) => { try { chrome.runtime.sendMessage(m).catch(() => {}); } catch (e) { /* res */ } };

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__menjaGaletes !== 1 || !e.data.missatge) return;
    const m = e.data.missatge;
    if (m.tipus === "galeta") envia({ tipus: "galeta", via: m.via, lloc: m.lloc, nom: String(m.nom), original: String(m.original || ""), fals: String(m.fals) });
  });

  const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");

  chrome.storage.local.get(["config", "realAuto"]).then((s) => {
    const cfg = Object.assign({}, MG.PER_DEFECTE, s.config || {});
    if (!cfg.actiu) return;
    let hostSuperior = location.hostname;
    if (window.top !== window) {
      try { hostSuperior = window.top.location.hostname; } catch (e) {
        try { hostSuperior = new URL(document.referrer).hostname; } catch (e2) { hostSuperior = ""; }
      }
    }
    const llocSuperior = MG.lloc(hostSuperior);
    if (!llocSuperior) return;
    const usuari = (cfg.confianca || []).some((w) => MG.lloc(w) === llocSuperior);
    const real = usuari || MG.esIdentitatReal(hostSuperior) || (s.realAuto || []).includes(llocSuperior);

    /* Pàgines amb contrasenya o targeta: sense disfressa */
    if (!real) {
      const SEL = "input[type='password'], input[autocomplete~='cc-number'], input[autocomplete~='cc-csc'], " +
        "input[name*='cardnumber' i], input[name*='card_number' i], input[id*='cardnumber' i]";
      let fet = false;
      const mira = () => {
        if (fet || !document.documentElement) return;
        for (const el of document.querySelectorAll(SEL)) {
          if (!visible(el)) continue;
          fet = true;
          obs.disconnect();
          envia({ tipus: "identitat", lloc: llocSuperior, motiu: el.type === "password" ? "contrasenya" : "targeta" });
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

    /* Els avisos de galetes (als webs de confiança, el respons tu) */
    if (usuari || cfg.avisos === "res") return;
    if (window.top !== window && !/consent|cmp|privacy|sp_message|cookie/i.test(location.href)) return;
    const accepta = cfg.avisos === "acceptar";
    const CMP = [
      ["OneTrust", "#onetrust-accept-btn-handler", "#onetrust-reject-all-handler"],
      ["Cookiebot", "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept", "#CybotCookiebotDialogBodyButtonDecline"],
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
    const clica = (el, cmp) => { el.click(); envia({ tipus: "avis", accio: accepta ? "acceptat" : "rebutjat", cmp }); return true; };
    const busca = (arrel) => {
      for (const [nom, a, r] of CMP) {
        const sel = accepta ? a : r;
        if (!sel) continue;
        const el = arrel.querySelector(sel);
        if (visible(el)) return clica(el, nom);
      }
      for (const host of arrel.querySelectorAll("#usercentrics-root, #usercentrics-cmp-ui, aside#usercentrics-cmp-ui")) {
        const sr = host.shadowRoot;
        if (!sr) continue;
        const el = sr.querySelector(accepta ? "[data-testid='uc-accept-all-button']" : "[data-testid='uc-deny-all-button']");
        if (visible(el)) return clica(el, "Usercentrics");
      }
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
  });
})();
