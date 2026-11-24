#!/usr/bin/env node
// Prova què fa la versió del Chromium quan s'actualitza: un Vivaldi a part (sense finestra, perfil temporal)
// amb una còpia de l'extensió, a la qual es canvia el número de versió i es torna a carregar.
//
//     node proves/prova-actualitzacio.mjs            (NAVEGADOR=chrome per al Google Chrome)
//
// El 24/11/2026, després de les actualitzacions de la botiga, el Vivaldi d'en Jordi no deixava registrar el
// codi de pàgina fins que es reiniciava (vegeu recarregaUnCop a chromium/fons.js). Aquí no es pot fer fallar
// igual, i es fa fallar apagant l'interruptor «Permet els scripts d'usuari» abans d'actualitzar.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CDP, dorm } from "./cdp.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const ORIGEN = join(AQUI, "..", "construit", "menja-galetes-chromium");
const PORT = 9337;
const resultats = [];
function comprova(nom, ok, detall = "") {
  resultats.push(!!ok);
  console.log(`  ${ok ? "✓" : "✗"} ${nom}${!ok && detall !== "" ? ` (${detall})` : ""}`);
}
const idDe = (cami) => [...createHash("sha256").update(cami).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
const ambTemps = (p, ms = 8000) => Promise.race([p, dorm(ms).then(() => { throw new Error("sense resposta"); })]);

const temp = mkdtempSync(join(tmpdir(), "menja-galetes-actualitzacio-"));
const EXT = join(temp, "extensio");
const perfil = join(temp, "perfil");
const VERSIO = JSON.parse(readFileSync(join(ORIGEN, "manifest.json"), "utf8")).version;
// La còpia de l'extensió, amb el número de versió que es vulgui (com si arribés una versió nova).
function posaVersio(v) {
  rmSync(EXT, { recursive: true, force: true });
  cpSync(ORIGEN, EXT, { recursive: true });
  const m = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));
  m.version = v;
  writeFileSync(join(EXT, "manifest.json"), JSON.stringify(m, null, 2));
}
posaVersio("0.0.1");
const id = idDe(realpathSync(EXT));
mkdirSync(join(perfil, "Default"), { recursive: true });
writeFileSync(join(perfil, "Default", "Preferences"), JSON.stringify({ extensions: { ui: { developer_mode: true }, settings: { [id]: { user_scripts_enabled: true } } } }));
const ambChrome = process.env.NAVEGADOR === "chrome";
const binari = ambChrome
  ? realpathSync(execFileSync("sh", ["-c", "command -v google-chrome"]).toString().trim())
  : realpathSync(execFileSync("sh", ["-c", "command -v vivaldi"]).toString().trim()).replace(/vivaldi$/, "vivaldi-bin");
console.log("Navegador:", binari);
const nav = spawn(binari, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  ...(ambChrome ? ["--enable-unsafe-extension-debugging"] : [`--load-extension=${EXT}`]),
  `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });

let c;
const fonsVists = new Set();
// El fons d'ara. Si se'n demana un de nou, espera que n'hi hagi un que no s'hagi vist abans.
async function fons(nou = false) {
  for (let i = 0; i < 40; i++) {
    const sw = (await c.objectius()).find((t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${id}/`) && (!nou || !fonsVists.has(t.targetId)));
    if (sw) { fonsVists.add(sw.targetId); return { sw, f: await c.connectaA(sw.targetId) }; }
    await dorm(500);
  }
  throw new Error("no trobo el fons de l'extensió " + id);
}
const fonsActuals = async () => (await c.objectius()).filter((t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${id}/`)).map((t) => t.targetId);
async function interruptor(si) {
  const { targetId } = await c.envia("Target.createTarget", { url: "about:blank" });
  const pd = await c.connectaA(targetId);
  await c.envia("Page.navigate", { url: `chrome://extensions/?id=${id}` }, pd);
  await dorm(2000);
  await ambTemps(c.avalua(pd, `chrome.developerPrivate.updateExtensionConfiguration({extensionId: "${id}", userScriptsAccess: ${si}}).then(() => "fet")`));
  await c.envia("Target.closeTarget", { targetId });
}
// Torna a carregar l'extensió amb la versió nova, com faria la botiga en actualitzar-la.
async function actualitza(f, v) {
  posaVersio(v);
  await c.avalua(f, "setTimeout(() => chrome.runtime.reload(), 50), 1").catch(() => {});
  await dorm(1500);
}
// Espera que el fons hagi provat de registrar el codi de pàgina (i que no es torni a carregar).
async function estable(ms = 4000) {
  let ara = (await fonsActuals()).join(), des = Date.now();
  while (Date.now() - des < ms) {
    await dorm(500);
    const nou = (await fonsActuals()).join();
    if (nou !== ara) { ara = nou; des = Date.now(); }
  }
  const { f } = await fons();
  let s = null;
  for (let i = 0; i < 40 && s === null; i++) { s = await c.avalua(f, "llest.then(() => registrant).then(() => scriptsUsuari)"); if (s === null) await dorm(250); }
  return f;
}

try {
  let v;
  for (let i = 0; i < 60 && !v; i++) { await dorm(500); try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (e) { /* encara no */ } }
  c = await CDP.connecta(v.webSocketDebuggerUrl);
  if (ambChrome) await c.envia("Extensions.loadUnpacked", { path: EXT });
  let { f } = await fons();
  f = await estable(1000);
  const a = (expr) => ambTemps(c.avalua(f, expr));
  comprova("la 0.0.1 registra el codi de pàgina", (await a("scriptsUsuari")) === true);

  console.log("\n1. Una actualització normal (amb l'interruptor encès)");
  await actualitza(f, "0.0.2");
  f = await estable();
  const b = (expr) => ambTemps(c.avalua(f, expr));
  comprova("ja és la 0.0.2", (await b("chrome.runtime.getManifest().version")) === "0.0.2");
  comprova("registra el codi de pàgina", (await b("scriptsUsuari")) === true);
  comprova("i no es torna a carregar sola", (await b("chrome.storage.local.get('recarregadaPer').then(s => s.recarregadaPer || null)")) === null);

  console.log("\n2. Una actualització en què el registre falla");
  await interruptor(false);
  await actualitza(f, VERSIO);
  f = await estable();
  const d = (expr) => ambTemps(c.avalua(f, expr));
  const desat = await d("chrome.storage.local.get(null).then(s => JSON.stringify({recarregadaPer: s.recarregadaPer, recarregant: s.recarregant, errorScripts: s.errorScripts}))").then(JSON.parse);
  comprova(`ja és la ${VERSIO}`, (await d("chrome.runtime.getManifest().version")) === VERSIO);
  comprova("s'ha tornat a carregar sola, un cop", desat.recarregadaPer === VERSIO, JSON.stringify(desat));
  comprova("i després ho ha tornat a provar (i ha refet les regles)", !desat.recarregant && (await d("scriptsUsuari")) === false);
  const sw = (await fonsActuals()).join();
  await dorm(4000);
  comprova("no es torna a carregar en bucle", (await fonsActuals()).join() === sw);
  comprova("desa què ha dit el navegador", desat.errorScripts && desat.errorScripts.missatge && desat.errorScripts.versio === VERSIO, JSON.stringify(desat.errorScripts));
  console.log(`    (el navegador diu: «${desat.errorScripts && desat.errorScripts.missatge}»)`);
  comprova("la icona porta el «!»", (await d("chrome.action.getBadgeText({})")) === "!");
  const estat = await d("tracta({tipus: 'estat', tabId: -1}, {}).then(r => JSON.stringify({scriptsUsuari: r.scriptsUsuari, errorScripts: r.errorScripts}))").then(JSON.parse);
  comprova("la finestreta rep el missatge del navegador", estat.scriptsUsuari === false && !!estat.errorScripts, JSON.stringify(estat));
  const regles = await d("chrome.declarativeNetRequest.getDynamicRules().then(r => r.map(x => x.id))");
  comprova("les regles hi són (les galetes de tercers, la 4)", regles.includes(4), JSON.stringify(regles));

  console.log("\n3. S'encén l'interruptor");
  await interruptor(true);
  const r = await d("tracta({tipus: 'estat', tabId: -1}, {}).then(r => JSON.stringify({scriptsUsuari: r.scriptsUsuari, errorScripts: r.errorScripts}))").then(JSON.parse);
  comprova("en obrir la finestreta, registra el codi de pàgina", r.scriptsUsuari === true && r.errorScripts === null, JSON.stringify(r));
  comprova("la icona ja no porta el «!»", (await d("chrome.action.getBadgeText({})")) === "");
} catch (e) {
  console.log("  ✗ la prova ha arribat al final  ·  " + e.message);
  resultats.push(false);
} finally {
  if (c) c.tanca?.();
  nav.kill();
  await dorm(500);
  rmSync(temp, { recursive: true, force: true });
}
const bons = resultats.filter(Boolean).length;
console.log(`\n${bons} de ${resultats.length} proves bé`);
process.exit(bons === resultats.length ? 0 : 1);
