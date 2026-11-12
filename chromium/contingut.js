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

  // El web també pot enviar aquests missatges (és la mateixa finestra): només es passen els que són
  // d'una galeta de seguiment, i com a molt 30 per pàgina, perquè no pugui omplir la finestreta.
  let passats = 0;
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__menjaGaletes !== 1 || !e.data.missatge) return;
    const m = e.data.missatge;
    if (m.tipus !== "galeta" || !MG.esSeguiment(String(m.nom)) || ++passats > 30) return;
    envia({ tipus: "galeta", via: m.via, lloc: m.lloc, nom: String(m.nom), original: String(m.original || ""), fals: String(m.fals) });
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

    /* Pàgines amb contrasenya o targeta: sense disfressa. Només el web de dalt i els marcs del mateix
     * web: un marc d'un altre web (un anunci) no pot treure la disfressa a tot el web. */
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
    const busca = (arrel) => {
      const b = MG.botoAvis(arrel, accepta, real, visible, (host) => host.shadowRoot);
      if (!b) return false;
      b.el.click();
      envia({ tipus: "avis", accio: accepta ? "acceptat" : "rebutjat", cmp: b.nom });
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
  });
})();
