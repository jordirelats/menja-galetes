#!/usr/bin/env node
// Fa les icones PNG (48, 96 i 128 px) a partir de extensio/icones/galeta.svg, amb el fons
// transparent, amb el Chrome sense finestra. Les botigues (Mozilla, Chrome Web Store) les volen en PNG.
//     node eines/icones.mjs
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CDP, dorm } from "../proves/cdp.mjs";

const ARREL = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(ARREL, "extensio/icones/galeta.svg"), "utf8");
const binari = realpathSync(execFileSync("sh", ["-c", "command -v google-chrome"]).toString().trim());
const perfil = mkdtempSync(join(tmpdir(), "menja-galetes-icones-"));
const PORT = 9342;
const nav = spawn(binari, ["--headless=new", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${perfil}`,
  `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
let c;
try {
  let v;
  for (let i = 0; i < 40 && !v; i++) { await dorm(300); try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (e) { /* encara no */ } }
  c = await CDP.connecta(v.webSocketDebuggerUrl);
  for (const mida of [48, 96, 128]) {
    const html = `<!doctype html><html><body style="margin:0;background:transparent">${svg.replace(/width="64" height="64"/, `width="${mida}" height="${mida}"`)}</body></html>`;
    const { sessionId } = await c.pestanya("data:text/html;base64," + Buffer.from(html).toString("base64"));
    await c.envia("Emulation.setDeviceMetricsOverride", { width: mida, height: mida, deviceScaleFactor: 1, mobile: false }, sessionId);
    await c.envia("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }, sessionId);
    await dorm(400);
    const r = await c.envia("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: mida, height: mida, scale: 1 } }, sessionId);
    const desti = join(ARREL, `extensio/icones/galeta-${mida}.png`);
    writeFileSync(desti, Buffer.from(r.data, "base64"));
    console.log(desti);
  }
} finally {
  try { c && c.tanca(); } catch (e) { /* res */ }
  nav.kill();
  await dorm(500);
  rmSync(perfil, { recursive: true, force: true });
}
