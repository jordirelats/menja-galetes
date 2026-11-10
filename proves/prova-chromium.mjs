#!/usr/bin/env node
// Prova la versió per al Chromium en un Vivaldi a part (sense finestra, perfil temporal),
// amb el servidor de proves local. No toca el teu perfil del Vivaldi.
//
//     node proves/prova-chromium.mjs
//
// Els noms de prova (*.test, www.prova.gob.es, h.online-metrix.net) van al servidor local amb
// --host-resolver-rules: no surt res a internet.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CDP, dorm } from "./cdp.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARREL = join(AQUI, "..");
const EXT = join(ARREL, "construit", "menja-galetes-chromium");
const WEB = "http://localhost:8765";
const PORT = 9334;
const resultats = [];

function comprova(nom, ok, detall = "") {
  resultats.push(!!ok);
  console.log((ok ? "  OK     " : "  FALLA  ") + nom + (detall !== "" && detall !== undefined ? "  ·  " + String(detall).slice(0, 160) : ""));
}

// L'identificador d'una extensió desempaquetada surt del camí de la carpeta.
const idDe = (cami) => [...createHash("sha256").update(cami).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");

execFileSync("python3", [join(ARREL, "eines", "construeix-chromium.py")]);
const servidor = spawn("python3", ["-c", `import sys, time; sys.path.insert(0, ${JSON.stringify(AQUI)}); import servidor; servidor.engega(); time.sleep(100000)`], { stdio: "ignore" });
const perfil = mkdtempSync(join(tmpdir(), "menja-galetes-vivaldi-"));
const id = idDe(realpathSync(EXT));
mkdirSync(join(perfil, "Default"));
// L'interruptor «Permet els scripts d'usuari», ja encès (al teu Vivaldi l'has d'encendre tu).
writeFileSync(join(perfil, "Default", "Preferences"), JSON.stringify({ extensions: { ui: { developer_mode: true }, settings: { [id]: { user_scripts_enabled: true } } } }));
const vivaldi = realpathSync(execFileSync("sh", ["-c", "command -v vivaldi"]).toString().trim()).replace(/vivaldi$/, "vivaldi-bin");
const nav = spawn(vivaldi, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORT}`, `--load-extension=${EXT}`,
  "--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable",
  "--host-resolver-rules=MAP diari.test 127.0.0.1, MAP www.bancprova.test 127.0.0.1, MAP www.prova.gob.es 127.0.0.1, MAP botiga.test 127.0.0.1, MAP h.online-metrix.net 127.0.0.1",
  "about:blank"], { stdio: "ignore" });

let c;
try {
  let v;
  for (let i = 0; i < 60 && !v; i++) { await dorm(500); try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (e) { /* encara no */ } }
  c = await CDP.connecta(v.webSocketDebuggerUrl);
  let sw;
  for (let i = 0; i < 20 && !sw; i++) { await dorm(500); sw = (await c.objectius()).find((t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${id}/`)); }
  if (!sw) throw new Error("no trobo el fons de l'extensió " + id);
  const fons = await c.connectaA(sw.targetId);
  const alFons = (expr) => c.avalua(fons, expr);
  console.log("Extensió:", id, "· scripts d'usuari:", await alFons("llest.then(() => scriptsUsuari)"));
  await alFons(`chrome.storage.local.get('config').then(s => chrome.storage.local.set({config: Object.assign(s.config || {}, {urlPais: "${WEB}/pais", retardMenjar: 2})}))`);
  await dorm(500);
  console.log("País:", await alFons(`tracta({tipus: "comprovaPais"}, {}).then(JSON.stringify)`));

  // Una pestanya per a les proves.
  const { targetId: pT } = await c.envia("Target.createTarget", { url: "about:blank" });
  const pag = await c.connectaA(pT);
  const ves = async (url, espera = 1200) => { await c.envia("Page.navigate", { url }, pag); await dorm(espera); };
  const aPagina = (expr) => c.avalua(pag, expr);
  const info = async () => {
    for (let i = 0; i < 40; i++) {
      try { const t = await aPagina("(document.getElementById('info') || {}).textContent"); if (t && t !== "...") return JSON.parse(t); } catch (e) { /* encara no */ }
      await dorm(250);
    }
    return {};
  };
  const galetes = async () => (await c.envia("Storage.getCookies", {})).cookies;

  // ---- 1. La primera galeta ----
  console.log("\n1. La primera galeta");
  await ves(`${WEB}/primera`, 1500);
  const i1 = await info();
  await dorm(800);
  let gs = await galetes();
  const ga = gs.find((g) => g.name === "_ga" && g.domain === "localhost");
  comprova("_ga (per capçalera): falsa just després", ga && ga.value !== "GA1.1.111111111.1700000000", ga && ga.value);
  comprova("_ga és de sessió", ga && ga.session);
  const fbp = gs.find((g) => g.name === "_fbp");
  comprova("_fbp (per JavaScript): falsa abans de desar-se", fbp && fbp.value !== "fb.1.1700000000000.222222222", fbp && fbp.value);
  const ses = gs.find((g) => g.name === "sessio");
  comprova("sessio (de funcionament), tal qual", ses && ses.value === "abc123");
  const tercers = gs.filter((g) => g.domain === "127.0.0.1" && ["IDE", "pref"].includes(g.name));
  comprova("les galetes de tercers per capçalera (IDE, pref) no es desen", tercers.length === 0, tercers.map((g) => g.name).join(","));
  comprova("document.cookie del web porta la falsa", !String(i1.cookie).includes("GA1.1.111111111"), i1.cookie);

  // ---- 2. La disfressa ----
  console.log("\n2. La disfressa (el que veu la pàgina)");
  console.log("   ", JSON.stringify(i1).slice(0, 500));
  comprova("userAgent: un Chrome de Windows o Mac", /Chrome\/\d+\.0\.0\.0/.test(i1.userAgent) && !/Linux|Headless/.test(i1.userAgent), i1.userAgent);
  comprova("platform: Win32 o MacIntel", ["Win32", "MacIntel"].includes(i1.platform), i1.platform);
  comprova("idioma de la disfressa (castellà)", String((i1.languages || [])[0]).startsWith("es"), i1.languages);
  comprova("Intl.locale també", String(i1.locale).startsWith("es"), i1.locale);
  comprova("zona horària d'Espanya", i1.zona === "Europe/Madrid", i1.zona);
  comprova("nuclis falsos", [4, 8, 12, 16].includes(i1.nuclis), i1.nuclis);
  comprova("canvas: el mateix soroll dues vegades", i1.canvas1 === i1.canvas2);
  comprova("WebRTC: IP falsa i de ningú", String(i1.rtc).includes(" 100.") && !String(i1.rtc).includes("83.45.10.20"), i1.rtc);
  const uad = await aPagina("navigator.userAgentData ? navigator.userAgentData.platform : 'sense'");
  comprova("userAgentData.platform: Windows o macOS", ["Windows", "macOS"].includes(uad), uad);
  await ves(`${WEB}/primera`, 1200);
  const i1b = await info();
  comprova("en tornar-hi, la mateixa disfressa", i1b.userAgent === i1.userAgent && JSON.stringify(i1b.screen) === JSON.stringify(i1.screen));

  // ---- 2b. Enllaços ----
  await ves(`${WEB}/simple?fbclid=IwAR0abc&utm_source=newsletter&gclid=Cj0K&id=5`, 1000);
  const net = await aPagina("location.href");
  comprova("enllaç: fbclid, gclid i utm_ fora; id=5 es queda", net === `${WEB}/simple?id=5`, net);

  // ---- 3. Les capçaleres ----
  console.log("\n3. Les capçaleres");
  await ves(`${WEB}/eco`, 1000);
  const ecoCru = JSON.parse(await aPagina("document.body.textContent"));
  const eco = {};
  for (const [k, v] of Object.entries(ecoCru)) eco[k] = eco[k.toLowerCase()] = v;   // el nom, en majúscules o minúscules
  eco["X-Forwarded-For"] = eco["x-forwarded-for"];
  comprova("User-Agent de la capçalera = el de la pàgina", eco["User-Agent"] === i1.userAgent, eco["User-Agent"]);
  comprova("Accept-Language en castellà", String(eco["Accept-Language"]).startsWith("es"), eco["Accept-Language"]);
  const xff = String(eco["X-Forwarded-For"] || "0.0.0.0").split(".");
  comprova("X-Forwarded-For: una IP de ningú (100.64.0.0/10)", xff[0] === "100" && +xff[1] >= 64 && +xff[1] <= 127, eco["X-Forwarded-For"]);
  comprova("Sec-CH-UA-Platform de la disfressa", /Windows|macOS/.test(eco["sec-ch-ua-platform"] || eco["Sec-CH-UA-Platform"] || ""), eco["sec-ch-ua-platform"]);

  // ---- 4. L'avís de galetes ----
  console.log("\n4. L'avís de galetes");
  await ves(`${WEB}/avis`, 800);
  let estat = "";
  for (let i = 0; i < 20 && estat !== "acceptat"; i++) { await dorm(300); estat = await aPagina("document.getElementById('estat').textContent"); }
  comprova("ha acceptat l'avís per tu", estat === "acceptat", estat);

  // ---- 5. La finestreta ----
  console.log("\n5. La finestreta");
  // El web, en una altra pestanya; la finestreta, a la de proves.
  const { targetId: wT } = await c.envia("Target.createTarget", { url: `${WEB}/primera` });
  await dorm(1500);
  await ves(`chrome-extension://${id}/finestreta/finestreta.html?web=${WEB}/primera`, 1800);
  const fin = pag;
  const text = await c.avalua(fin, "document.body.innerText");
  comprova("la finestreta diu «Primera galeta: menjada»", text.includes("Primera galeta: menjada"), text.slice(0, 80).replace(/\n/g, " "));
  await c.envia("Emulation.setDeviceMetricsOverride", { width: 400, height: 900, deviceScaleFactor: 1, mobile: false }, fin);
  await dorm(300);
  const alt = await c.avalua(fin, "document.documentElement.scrollHeight");
  await c.envia("Emulation.setDeviceMetricsOverride", { width: 400, height: alt, deviceScaleFactor: 1, mobile: false }, fin);
  await dorm(300);
  const png = await c.envia("Page.captureScreenshot", { format: "png" }, fin);
  mkdirSync(join(AQUI, "captures"), { recursive: true });
  writeFileSync(join(AQUI, "captures", "finestreta-vivaldi.png"), Buffer.from(png.data, "base64"));
  await c.envia("Emulation.clearDeviceMetricsOverride", {}, fin);
  await c.envia("Target.closeTarget", { targetId: wT });

  // ---- 6. En tancar la pestanya ----
  console.log("\n6. En tancar la pestanya, se les menja");
  await ves("about:blank", 300);
  let queden = [];
  for (let i = 0; i < 60; i++) {
    await dorm(1000);
    queden = (await galetes()).filter((g) => g.domain === "localhost").map((g) => g.name);
    if (!queden.length) break;
  }
  comprova("no queda cap galeta de localhost", !queden.length, queden.join(", "));

  // ---- 7. Japó: hora, marcs i treballadors ----
  console.log("\n7. L'hora del Japó, els marcs i els treballadors de blob");
  await fetch(`${WEB}/pais?posa=JP`);
  console.log("   ", await alFons(`tracta({tipus: "comprovaPais"}, {}).then(JSON.stringify)`));
  await ves(`${WEB}/zona`, 1200);
  const z = await info();
  comprova("getTimezoneOffset del Japó (-540)", z.offset === -540, z.offset);
  comprova("new Date(…10:30).getHours() torna 10, i en UTC són la 1", z.hores === 10 && z.utc === 1, `${z.hores} / ${z.utc}`);
  comprova("Date.parse i el text, del Japó", z.parse === true && String(z.text).includes("GMT+0900"), z.text);
  comprova("Intl: Asia/Tokyo i japonès", z.intl === "Asia/Tokyo" && String(z.locale).startsWith("ja"), `${z.intl} · ${z.locale}`);
  await ves(`${WEB}/marcs`, 1200);
  const mc = await info();
  comprova("marc nou i window[0]: disfressats", mc.marc === mc.top && ["Win32", "MacIntel"].includes(mc.index), `${mc.index} · ${mc.error || ""}`);
  comprova("marc nou: zona del Japó", mc.zonaMarc === "Asia/Tokyo", mc.zonaMarc);
  comprova("galeta posada des d'un marc, menjada", !String(mc.cookieMarc).includes("GA1.1.444444444"), mc.cookieMarc);
  await ves(`${WEB}/treballadors`, 2500);
  const tr = await info();
  const blob = tr.blob || {};
  comprova("treballador de blob: navegador i zona falsos", blob.ua === tr.top && blob.zona === "Asia/Tokyo", JSON.stringify(blob).slice(0, 120));

  // ---- 8. Web de confiança ----
  console.log("\n8. Web de confiança");
  await alFons(`tracta({tipus: "confia", lloc: "localhost", si: true, tabId: -1}, {})`);
  await dorm(800);
  await ves(`${WEB}/primera`, 1500);
  const i8 = await info();
  comprova("sense disfressa", /Linux/.test(i8.userAgent), i8.userAgent);
  gs = await galetes();
  const ga8 = gs.find((g) => g.name === "_ga" && g.domain === "localhost");
  comprova("però la _ga (de Google), menjada igualment", ga8 && ga8.value !== "GA1.1.111111111.1700000000", ga8 && ga8.value);
  const ses8 = gs.find((g) => g.name === "sessio" && g.domain === "localhost");
  comprova("i la sessió, tal qual", ses8 && ses8.value === "abc123");

  // ---- 9. Contrasenya ----
  console.log("\n9. Una pàgina amb contrasenya va sense disfressa");
  await ves("http://127.0.0.1:8765/entrada", 3000);
  const i9 = await info();
  comprova("s'ha tornat a carregar, amb el navegador de debò", /Linux/.test(i9.userAgent) && i9.carrega >= 2, `${i9.userAgent} · càrregues ${i9.carrega}`);

  // ---- 10. Bancs, governs i sistemes contra el frau ----
  console.log("\n10. Bancs i governs de tot el món");
  await ves("http://diari.test:8765/simple", 1200);
  comprova("un diari qualsevol: disfressat", !/Linux/.test((await info()).userAgent));
  await ves("http://www.bancprova.test:8765/simple", 1500);
  const b = await info();
  comprova("un banc pel nom: navegador de debò", /Linux/.test(b.userAgent), b.userAgent);
  comprova("la sessió del banc, tal qual", String(b.cookie).includes("sessio=banc123"), b.cookie);
  await ves("http://www.prova.gob.es:8765/simple", 1200);
  comprova("un govern (.gob.es): navegador de debò", /Linux/.test((await info()).userAgent));
  await ves("http://botiga.test:8765/antifrau", 3500);
  const e = await info();
  comprova("una botiga amb sistema contra el frau: navegador de debò", /Linux/.test(e.userAgent), e.userAgent);
} catch (err) {
  console.log("ERROR:", err.message);
  resultats.push(false);
} finally {
  try { c && c.tanca(); } catch (e) { /* res */ }
  nav.kill(); servidor.kill();
  await dorm(800);
  rmSync(perfil, { recursive: true, force: true });
}
const bons = resultats.filter(Boolean).length;
console.log(`\n${bons} de ${resultats.length} proves bé`);
process.exit(bons === resultats.length ? 0 : 1);
