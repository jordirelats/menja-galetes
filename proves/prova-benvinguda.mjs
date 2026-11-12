#!/usr/bin/env node
// Prova la benvinguda del Chromium: un Vivaldi a part (sense finestra, perfil temporal) on l'interruptor
// «Permet els scripts d'usuari» és apagat, com quan algú la instal·la des de la botiga de Chrome.
//
//     node proves/prova-benvinguda.mjs            (NAVEGADOR=chrome per al Google Chrome)
//
// L'interruptor s'encén a mitja prova des de la pàgina d'extensions (developerPrivate), com faria la persona.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CDP, dorm } from "./cdp.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const EXT = join(AQUI, "..", "construit", "menja-galetes-chromium");
const WEB = "http://localhost:8765";
const PORT = 9336;
const resultats = [];
function comprova(nom, ok, detall = "") {
  resultats.push(!!ok);
  console.log(`  ${ok ? "✓" : "✗"} ${nom}${!ok && detall !== "" ? ` (${detall})` : ""}`);
}
const idDe = (cami) => [...createHash("sha256").update(cami).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
const ambTemps = (p, ms = 8000) => Promise.race([p, dorm(ms).then(() => { throw new Error("sense resposta"); })]);

const servidor = spawn("python3", ["-c", `import sys, time; sys.path.insert(0, ${JSON.stringify(AQUI)}); import servidor; servidor.engega(); time.sleep(100000)`], { stdio: "ignore" });
const perfil = mkdtempSync(join(tmpdir(), "menja-galetes-benvinguda-"));
const id = idDe(realpathSync(EXT));
mkdirSync(join(perfil, "Default"));
// Sense user_scripts_enabled: l'interruptor, apagat.
writeFileSync(join(perfil, "Default", "Preferences"), JSON.stringify({ extensions: { ui: { developer_mode: true } } }));
const ambChrome = process.env.NAVEGADOR === "chrome";
const binari = ambChrome
  ? realpathSync(execFileSync("sh", ["-c", "command -v google-chrome"]).toString().trim())
  : realpathSync(execFileSync("sh", ["-c", "command -v vivaldi"]).toString().trim()).replace(/vivaldi$/, "vivaldi-bin");
console.log("Navegador:", binari);
const nav = spawn(binari, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  ...(ambChrome ? ["--enable-unsafe-extension-debugging"] : [`--load-extension=${EXT}`]),
  `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORT}`,
  "--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable", "--window-size=1280,1200", "about:blank"], { stdio: "ignore" });

let c;
try {
  let v;
  for (let i = 0; i < 60 && !v; i++) { await dorm(500); try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (e) { /* encara no */ } }
  c = await CDP.connecta(v.webSocketDebuggerUrl);
  if (ambChrome) await c.envia("Extensions.loadUnpacked", { path: EXT });
  let sw;
  for (let i = 0; i < 20 && !sw; i++) { await dorm(500); sw = (await c.objectius()).find((t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${id}/`)); }
  if (!sw) throw new Error("no trobo el fons de l'extensió " + id);
  const fons = await c.connectaA(sw.targetId);
  const alFons = (expr) => c.avalua(fons, expr);
  await alFons(`chrome.storage.local.get('config').then(s => chrome.storage.local.set({config: Object.assign(s.config || {}, {urlPais: "${WEB}/pais"})}))`);

  console.log("\n1. Sense el permís");
  comprova("el fons sap que falta el permís", (await alFons("llest.then(() => scriptsUsuari)")) === false);
  const URL_BENV = `chrome-extension://${id}/benvinguda/benvinguda.html`;
  let benv;
  for (let i = 0; i < 20 && !benv; i++) { await dorm(300); benv = (await c.objectius()).find((t) => t.type === "page" && t.url === URL_BENV); }
  comprova("en instal·lar-la, s'obre la benvinguda", !!benv);
  comprova("la icona porta un «!»", (await alFons("chrome.action.getBadgeText({})")) === "!");
  // Una pàgina de l'extensió oberta directament no respon a Runtime.evaluate: es torna a obrir en una
  // pestanya buida (com la finestreta a prova-chromium.mjs).
  await c.envia("Target.closeTarget", { targetId: benv.targetId });
  const { targetId: bT } = await c.envia("Target.createTarget", { url: "about:blank" });
  const pb = await c.connectaA(bT);
  await c.envia("Page.navigate", { url: URL_BENV }, pb);
  const aBenv = (expr) => ambTemps(c.avalua(pb, expr));
  await dorm(1500);
  comprova("la benvinguda diu que falta el permís", (await aBenv("document.body.className")) === "espera" &&
    (await aBenv("document.querySelector('.vista-espera').innerText")).includes("em falta un permís"));
  await c.envia("Page.bringToFront", {}, pb);
  await c.envia("Emulation.setDeviceMetricsOverride", { width: 760, height: 1100, deviceScaleFactor: 1, mobile: false }, pb);
  await dorm(400);
  writeFileSync(join(AQUI, "captures", "benvinguda-espera.png"), Buffer.from((await c.envia("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, pb)).data, "base64"));

  // Una pestanya amb un web: les galetes, sí; la disfressa, no.
  const { targetId: pT } = await c.envia("Target.createTarget", { url: "about:blank" });
  const pag = await c.connectaA(pT);
  const aPagina = (expr) => ambTemps(c.avalua(pag, expr));
  await c.envia("Page.navigate", { url: `${WEB}/primera` }, pag); await dorm(2000);
  const ga = (await c.envia("Storage.getCookies", {})).cookies.find((g) => g.name === "_ga" && g.domain === "localhost");
  comprova("sense el permís, també es menja les galetes (_ga falsa)", ga && ga.value !== "GA1.1.111111111.1700000000", ga && ga.value);
  comprova("i el web veu el navegador de debò", (await aPagina("navigator.platform")).startsWith("Linux"));

  console.log("\n2. La finestreta");
  const { targetId: fT } = await c.envia("Target.createTarget", { url: "about:blank" });
  const fin = await c.connectaA(fT);
  await c.envia("Page.navigate", { url: `chrome-extension://${id}/finestreta/finestreta.html?web=${WEB}/primera` }, fin); await dorm(1800);
  const textFin = await ambTemps(c.avalua(fin, "document.body.innerText"));
  comprova("la finestreta diu que falta el permís, amb el botó «Obre els detalls»", textFin.includes("em falta un permís") && textFin.includes("Obre els detalls"));
  await c.envia("Target.closeTarget", { targetId: fT });

  console.log("\n3. Obre els detalls i encén l'interruptor");
  await aBenv("document.getElementById('detalls').click()");
  let det;
  for (let i = 0; i < 20 && !det; i++) { await dorm(300); det = (await c.objectius()).find((t) => t.url.startsWith("chrome://extensions") && t.url.includes(id)); }
  comprova("el botó obre els detalls de l'extensió", !!det, (await c.objectius()).map((t) => t.url).join(" "));
  // L'interruptor, des d'una altra pestanya de la pàgina d'extensions (la que s'ha obert sola no respon).
  const { targetId: dT } = await c.envia("Target.createTarget", { url: "about:blank" });
  const pd = await c.connectaA(dT);
  await c.envia("Page.navigate", { url: `chrome://extensions/?id=${id}` }, pd);
  await dorm(2000);
  await ambTemps(c.avalua(pd, `chrome.developerPrivate.updateExtensionConfiguration({extensionId: "${id}", userScriptsAccess: true}).then(() => "fet")`));
  let classe = "";
  for (let i = 0; i < 12 && classe !== "fet"; i++) { await dorm(500); classe = await aBenv("document.body.className"); }
  comprova("la benvinguda s'adona sola que ja hi és", classe === "fet", classe);
  comprova("la icona ja no porta el «!»", (await alFons("chrome.action.getBadgeText({})")) === "");

  console.log("\n4. Torna-les a carregar");
  await aPagina("window.__marca = 1");
  await aBenv("document.getElementById('recarrega').click()");
  await dorm(2500);
  comprova("la pestanya del web s'ha tornat a carregar", (await aPagina("typeof window.__marca")) === "undefined");
  const plat = await aPagina("navigator.platform");
  comprova("i ara va disfressada", ["Win32", "MacIntel"].includes(plat), plat);
  const textP = await aBenv("document.getElementById('text-pestanyes').textContent");
  comprova("la benvinguda diu quantes n'ha tornat a carregar", /tornat a carregar \d+ pestany/.test(textP), textP);
  await c.envia("Page.bringToFront", {}, pb);
  await c.envia("Emulation.setDeviceMetricsOverride", { width: 760, height: 700, deviceScaleFactor: 1, mobile: false }, pb);
  await dorm(400);
  writeFileSync(join(AQUI, "captures", "benvinguda-fet.png"), Buffer.from((await c.envia("Page.captureScreenshot", { format: "png" }, pb)).data, "base64"));
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
