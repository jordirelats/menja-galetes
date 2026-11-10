/*
 * Menja galetes · l'hàmster que travessa la pàgina quan cliques «Menja-te-les totes ara».
 *
 * Entra per la dreta menjant-se una filera de galetes, s'atura a l'esquerra, diu «Tinc gana…
 * no n'hi ha més?» i se'n va. Torna una promesa que s'acaba quan ha marxat (llavors el fons
 * torna a carregar la pàgina).
 *
 * Funciona igual al Firefox (script de contingut) i al Chromium (món aïllat). No fa servir cap
 * full d'estil ni cap script en línia: els estils van per CSSOM i les animacions amb
 * element.animate(), perquè la CSP del web no ho pugui bloquejar. És dins d'una «shadow root»
 * tancada, perquè els estils del web no el toquin.
 *
 * És un personatge propi (en Jordi el va triar el 10/11/2026 entre quatre de la maqueta v3).
 */
function MG_monstre(quantes) {
  const HAMSTER = `
<svg viewBox="0 0 220 200" width="170" height="155" aria-hidden="true">
  <g class="cama-a"><ellipse cx="88" cy="186" rx="17" ry="9" fill="#F2B98A"/></g>
  <g class="cama-b"><ellipse cx="146" cy="186" rx="17" ry="9" fill="#F2B98A"/></g>
  <circle cx="80" cy="44" r="19" fill="#E8A15C"/><circle cx="80" cy="44" r="10" fill="#F6B6B6"/>
  <circle cx="148" cy="40" r="19" fill="#E8A15C"/><circle cx="148" cy="40" r="10" fill="#F6B6B6"/>
  <ellipse cx="118" cy="112" rx="88" ry="78" fill="#E8A15C"/>
  <ellipse cx="100" cy="134" rx="56" ry="48" fill="#FFF3E0"/>
  <g class="galtes"><ellipse cx="60" cy="118" rx="25" ry="20" fill="#FFF3E0"/><ellipse cx="130" cy="116" rx="23" ry="19" fill="#FFF3E0"/></g>
  <ellipse cx="56" cy="122" rx="10" ry="6" fill="#F49A9A" opacity=".8"/><ellipse cx="134" cy="120" rx="10" ry="6" fill="#F49A9A" opacity=".8"/>
  <g class="ulls">
    <circle cx="72" cy="80" r="11" fill="#1A0F08"/><circle cx="68" cy="76" r="4" fill="#fff"/>
    <circle cx="114" cy="78" r="10" fill="#1A0F08"/><circle cx="110" cy="74" r="3.5" fill="#fff"/>
  </g>
  <ellipse cx="92" cy="100" rx="7" ry="5" fill="#E77F8F"/>
  <path d="M58 100 L28 93 M58 106 L28 108 M126 100 L156 93 M126 106 L156 108" stroke="#C98A4B" stroke-width="2" stroke-linecap="round"/>
  <g class="boca">
    <path d="M80 110 Q92 125 104 110 Z" fill="#4A2C1A"/>
    <rect x="86.5" y="110" width="5.5" height="7" rx="1" fill="#fff"/><rect x="92.5" y="110" width="5.5" height="7" rx="1" fill="#fff"/>
  </g>
  <ellipse cx="80" cy="152" rx="11" ry="7" fill="#F2B98A"/><ellipse cx="112" cy="152" rx="11" ry="7" fill="#F2B98A"/>
</svg>`;
  const GALETA = `<svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
  <circle cx="32" cy="32" r="28" fill="#D9A15E" stroke="#B57A3A" stroke-width="3"/>
  <circle cx="22" cy="24" r="4" fill="#4A2C1A"/><circle cx="38" cy="38" r="4.5" fill="#4A2C1A"/>
  <circle cx="20" cy="42" r="3.5" fill="#4A2C1A"/><circle cx="40" cy="20" r="3" fill="#4A2C1A"/></svg>`;
  const FRASE = "Tinc gana… no n'hi ha més?";

  return new Promise((acaba) => {
    let host;
    const plega = () => { try { host.remove(); } catch (e) { /* res */ } acaba(true); };
    try {
      const doc = document;
      host = doc.createElement("div");
      host.id = "menja-galetes-monstre";
      host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;contain:strict;";
      const arrel = host.attachShadow ? host.attachShadow({ mode: "closed" }) : host;
      (doc.body || doc.documentElement).appendChild(host);
      const escena = doc.createElement("div");
      escena.style.cssText = "position:absolute;inset:0;overflow:hidden;font-family:system-ui,sans-serif;";
      arrel.appendChild(escena);
      const W = window.innerWidth, H = window.innerHeight;

      // La bombolla del que diu
      const bombolla = (x, y) => {
        const b = doc.createElement("div");
        b.textContent = FRASE;
        b.style.cssText = `position:absolute;left:${x}px;top:${y}px;max-width:230px;font:700 17px/1.3 system-ui,sans-serif;` +
          "color:#4A2C1A;background:#fff;border:3px solid #4A2C1A;border-radius:16px;padding:9px 15px;" +
          "box-shadow:0 6px 14px rgba(43,27,16,.2);";
        const cua = doc.createElement("div");
        cua.style.cssText = "position:absolute;left:-15px;top:18px;width:0;height:0;border-style:solid;" +
          "border-width:12px 15px 12px 0;border-color:transparent #4A2C1A transparent transparent;";
        b.appendChild(cua);
        escena.appendChild(b);
        return b;
      };

      // Si el sistema demana menys moviment: només la bombolla, un moment.
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        bombolla(Math.max(16, W / 2 - 115), Math.max(16, H / 2 - 30));
        setTimeout(plega, 1800);
        return;
      }

      const monstre = doc.createElement("div");
      monstre.style.cssText = "position:absolute;left:0;top:0;width:170px;height:155px;" +
        "filter:drop-shadow(0 6px 8px rgba(43,27,16,.25));will-change:transform;";
      monstre.innerHTML = HAMSTER;
      escena.appendChild(monstre);
      const tros = (sel) => monstre.querySelector(sel);
      const infinit = (el, frames, ms, retard) => el.animate(frames, { duration: ms, iterations: Infinity, delay: retard || 0 });
      const boca = tros(".boca"), ulls = tros(".ulls");
      boca.style.transformOrigin = "92px 110px";
      ulls.style.transformOrigin = "92px 79px";
      const anims = [
        infinit(boca, [{ transform: "scaleY(1)" }, { transform: "scaleY(.35)" }, { transform: "scaleY(1)" }], 300),
        infinit(tros(".cama-a"), [{ transform: "translateY(0)" }, { transform: "translateY(-7px)" }, { transform: "translateY(0)" }], 400),
        infinit(tros(".cama-b"), [{ transform: "translateY(0)" }, { transform: "translateY(-7px)" }, { transform: "translateY(0)" }], 400, 200),
      ];
      for (const g of monstre.querySelectorAll(".galtes ellipse")) {
        g.style.transformBox = "fill-box";
        g.style.transformOrigin = "center";
        anims.push(infinit(g, [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], 300));
      }
      infinit(ulls, [{ transform: "scaleY(1)", offset: 0 }, { transform: "scaleY(1)", offset: 0.93 },
        { transform: "scaleY(.1)", offset: 0.96 }, { transform: "scaleY(1)", offset: 1 }], 3400);

      // Una filera de galetes: tantes com se n'ha menjat (entre 3 i 8)
      const n = Math.max(3, Math.min(8, quantes || 6));
      const yBoca = Math.round(H * 0.55);
      const galetes = [];
      for (let i = 0; i < n; i++) {
        const g = doc.createElement("div");
        g.innerHTML = GALETA;
        const x = Math.round(W * (0.14 + (i * 0.72) / Math.max(1, n - 1)));
        const y = yBoca - 10 + (i % 2 ? 10 : -8);
        g.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:46px;height:46px;`;
        escena.appendChild(g);
        galetes.push({ el: g, x: x + 23, y: y + 23, menjada: false });
      }
      const engrunes = (x, y) => {
        for (let i = 0; i < 8; i++) {
          const e = doc.createElement("div");
          e.style.cssText = `position:absolute;left:0;top:0;width:6px;height:6px;border-radius:50%;background:#B57A3A;`;
          escena.appendChild(e);
          const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 60;
          e.animate([{ transform: `translate(${x}px, ${y}px)`, opacity: 1 },
            { transform: `translate(${x + Math.cos(a) * v}px, ${y + Math.sin(a) * v + 24}px)`, opacity: 0 }],
          { duration: 600, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => e.remove();
        }
      };

      const entrar = 3000, aturat = 2000, sortir = 700, inici = performance.now();
      const desde = W + 30, parada = 16, fins = -230;
      let haDit = false, quiet = false;
      const pas = (ara) => {
        const ms = ara - inici;
        let x, mou = true;
        if (ms < entrar) x = desde + (parada - desde) * (ms / entrar);
        else if (ms < entrar + aturat) { x = parada; mou = false; }
        else x = parada + (fins - parada) * Math.min(1, (ms - entrar - aturat) / sortir);
        const salt = mou ? Math.abs(Math.sin((ms / 1000) * Math.PI * 2.5)) * -8 : 0;
        monstre.style.transform = `translate(${x}px, ${yBoca - 120 + salt}px)`;
        if (quiet === mou) { quiet = !mou; for (const a of anims) quiet ? a.pause() : a.play(); }
        const bocaX = x + 40;
        for (const g of galetes) {
          if (!g.menjada && bocaX <= g.x) {
            g.menjada = true;
            g.el.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.2) rotate(-40deg)", opacity: 0 }],
              { duration: 180, fill: "forwards" });
            engrunes(g.x, g.y);
          }
        }
        if (!mou && !haDit) {
          haDit = true;
          const b = bombolla(parada + 185, yBoca - 100);
          setTimeout(() => b.remove(), aturat - 150);
        }
        if (ms < entrar + aturat + sortir) requestAnimationFrame(pas);
        else plega();
      };
      requestAnimationFrame(pas);
      setTimeout(plega, entrar + aturat + sortir + 2000);   // per si de cas (pestanya amagada, etc.)
    } catch (e) {
      plega();
    }
  });
}
