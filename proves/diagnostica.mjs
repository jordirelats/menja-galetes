#!/usr/bin/env node
// Diagnosi d'un web que no va bé amb l'extensió: l'obre en un Vivaldi a part (sense finestra,
// perfil temporal), primer sense l'extensió i després amb, i compara què passa.
//
//     node proves/diagnostica.mjs https://mail.zoho.eu/zm/ [segons]
//
// Va a internet de debò (només a l'adreça que li dones i al que aquesta carregui). No entra a cap
// compte: veu el web com algú que no hi ha entrat. Les captures van a proves/captures/diagnosi-*.png.
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
const URL_WEB = process.argv[2];
const SEGONS = Number(process.argv[3] || 12);
if (!URL_WEB) { console.log("Fes servir: node proves/diagnostica.mjs <adreça> [segons]"); process.exit(2); }

const idDe = (cami) => [...createHash("sha256").update(cami).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
execFileSync("python3", [join(ARREL, "eines", "construeix-chromium.py")]);
const binari = realpathSync(execFileSync("sh", ["-c", "command -v vivaldi"]).toString().trim()).replace(/vivaldi$/, "vivaldi-bin");

async function passada(ambExtensio, port) {
  const perfil = mkdtempSync(join(tmpdir(), "menja-galetes-diagnosi-"));
  const id = idDe(realpathSync(EXT));
  mkdirSync(join(perfil, "Default"));
  writeFileSync(join(perfil, "Default", "Preferences"), JSON.stringify({ extensions: { ui: { developer_mode: true }, settings: { [id]: { user_scripts_enabled: true } } } }));
  const nav = spawn(binari, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    ...(ambExtensio ? [`--load-extension=${EXT}`] : []), `--user-data-dir=${perfil}`, `--remote-debugging-port=${port}`,
    "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  const r = { excepcions: [], consola: [], fallades: [], navegacions: [], peticions: 0 };
  let c;
  try {
    let v;
    for (let i = 0; i < 60 && !v; i++) { await dorm(500); try { v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) { /* encara no */ } }
    c = await CDP.connecta(v.webSocketDebuggerUrl);
    if (ambExtensio) {
      let sw;
      for (let i = 0; i < 20 && !sw; i++) { await dorm(500); sw = (await c.objectius()).find((t) => t.type === "service_worker" && t.url.includes(id)); }
      const fons = await c.connectaA(sw.targetId);
      await c.avalua(fons, "llest");
      r.sw = fons;
    }
    const { targetId } = await c.envia("Target.createTarget", { url: "about:blank" });
    const pag = await c.connectaA(targetId);
    const urls = new Map();
    c.on((d) => {
      const p = d.params || {};
      if (d.sessionId === r.sw) {
        if (d.method === "Runtime.exceptionThrown") r.excepcions.push("[fons] " + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0, 300));
        if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(p.type)) r.consola.push("[fons] " + p.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
        return;
      }
      if (d.sessionId !== pag) return;
      if (d.method === "Runtime.exceptionThrown") {
        const e = p.exceptionDetails;
        r.excepcions.push(((e.exception && e.exception.description) || e.text).slice(0, 300) + (e.url ? `  @ ${e.url.slice(0, 120)}:${e.lineNumber}` : ""));
      }
      if (d.method === "Runtime.consoleAPICalled" && p.type === "error") r.consola.push(p.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
      if (d.method === "Log.entryAdded" && p.entry.level === "error") r.consola.push(`[${p.entry.source}] ${p.entry.text.slice(0, 300)}`);
      if (d.method === "Network.requestWillBeSent") { r.peticions++; urls.set(p.requestId, p.request.url); }
      if (d.method === "Network.loadingFailed" && !p.canceled) r.fallades.push(`${p.errorText}${p.blockedReason ? " (" + p.blockedReason + ")" : ""}  ${String(urls.get(p.requestId)).slice(0, 140)}`);
      if (d.method === "Page.frameNavigated" && !p.frame.parentId) r.navegacions.push(p.frame.url.slice(0, 160));
    });
    for (const dom of ["Page", "Network", "Log", "Runtime"]) {
      try { await c.envia(`${dom}.enable`, {}, pag); } catch (e) { console.log("   (no es pot activar " + dom + ": " + e.message + ")"); }
    }
    await c.envia("Page.navigate", { url: URL_WEB }, pag);
    await dorm(SEGONS * 1000);
    r.final = await c.avalua(pag, "location.href").catch((e) => "error " + e.message);
    r.titol = await c.avalua(pag, "document.title").catch(() => "");
    r.text = (await c.avalua(pag, "document.body ? document.body.innerText : ''").catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    const png = await c.envia("Page.captureScreenshot", { format: "png" }, pag);
    mkdirSync(join(AQUI, "captures"), { recursive: true });
    writeFileSync(join(AQUI, "captures", `diagnosi-${ambExtensio ? "amb" : "sense"}.png`), Buffer.from(png.data, "base64"));
    if (ambExtensio) r.estat = await c.avalua(r.sw, "JSON.stringify({realAuto: cfg.realAuto, pestanyes: [...pestanyes.values()].map(p => ({lloc: p.lloc, galetes: (p.galetes || []).map(g => g.nom)}))})").catch((e) => e.message);
  } finally {
    try { c && c.tanca(); } catch (e) { /* res */ }
    nav.kill();
    await dorm(800);
    rmSync(perfil, { recursive: true, force: true });
  }
  return r;
}

for (const amb of [false, true]) {
  const r = await passada(amb, amb ? 9336 : 9335);
  console.log(`\n==== ${amb ? "AMB" : "SENSE"} l'extensió ====`);
  console.log("Navegacions:", r.navegacions.length, "\n  " + r.navegacions.join("\n  "));
  console.log("Final:", r.final, "·", r.titol);
  console.log("Text:", r.text);
  console.log("Peticions:", r.peticions);
  console.log(`Excepcions (${r.excepcions.length}):` + r.excepcions.slice(0, 15).map((x) => "\n  " + x).join(""));
  console.log(`Errors de consola (${r.consola.length}):` + r.consola.slice(0, 15).map((x) => "\n  " + x).join(""));
  console.log(`Peticions fallades (${r.fallades.length}):` + r.fallades.slice(0, 20).map((x) => "\n  " + x).join(""));
  if (r.estat) console.log("Estat de l'extensió:", r.estat);
}
