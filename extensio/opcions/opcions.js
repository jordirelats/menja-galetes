"use strict";
/* Menja galetes · opcions. Cada canvi es desa de seguida; el fons el recull sol. */

const FALSEJA = [
  ["navegador", "Navegador i sistema", "Windows o Mac en comptes de Linux"],
  ["ubicacio", "Ubicació", "Una ciutat inventada, si un web te la demana"],
  ["idioma", "Idioma i hora", "Els del país de la disfressa"],
  ["pantalla", "Pantalla i maquinari", "Mida de pantalla, nuclis i targeta gràfica"],
  ["empremta", "Empremta", "Canvas i àudio amb soroll, perquè no et reconeguin"],
  ["galetes", "Galetes de seguiment", "Se les menja i hi posa identificadors inventats"],
  ["ipScripts", "IP que demanen els scripts", "Els scripts que et pregunten la IP (WebRTC) en reben una de falsa, que no és de ningú (100.64.x.x)"],
  ["ipCapcaleres", "IP de les capçaleres", "Una IP falsa a X-Forwarded-For, que tampoc no és de ningú, per als webs que se la creuen"],
];

// Els interruptors que són una opció de dalt de tot de la configuració.
const INTERRUPTORS = ["canviPais", "gravadors", "espies", "rebots", "gpc", "resumAvis"];

let config = {};

async function carrega() {
  const s = await browser.storage.local.get(["config", "paisIP", "realAuto", "protegides"]);
  const webs = new Set((s.protegides || []).map((k) => MG.lloc(k.split("|")[0]))).size;
  document.getElementById("vellesAra").textContent = webs
    ? `Les que ja tenies en instal·lar-la, que vaig protegir perquè no perdessis cap sessió. Ara n'hi ha de ${webs} webs.`
    : "Les que ja tenies en instal·lar-la, que vaig protegir perquè no perdessis cap sessió. Ja no en queda cap.";
  document.getElementById("sempreReal").textContent =
    `${MG.SEMPRE_REAL.length} webs fixos: ${MG.SEMPRE_REAL.slice(0, 12).join(", ")}…`;
  const auto = document.getElementById("realAuto");
  auto.textContent = "";
  for (const w of s.realAuto || []) auto.append(Object.assign(document.createElement("li"), { textContent: w }));
  if (!(s.realAuto || []).length) auto.append(Object.assign(document.createElement("li"), { textContent: "cap, de moment" }));
  config = Object.assign({}, MG.PER_DEFECTE, s.config || {});
  config.falseja = Object.assign({}, MG.PER_DEFECTE.falseja, (s.config || {}).falseja || {});
  const p = MG.PAISOS[s.paisIP];
  if (p) document.getElementById("paisAra").textContent =
    `Ara la teva IP és ${p.de}. Si la disfressa no és del país de la IP, no lliga i fa més olor de disfressa.`;
  pinta();
}

async function desa(canvis) {
  const { config: vell = {} } = await browser.storage.local.get("config");
  Object.assign(config, canvis);
  await browser.storage.local.set({ config: Object.assign(vell, canvis) });
  pinta();
}

function pinta() {
  for (const t of document.querySelectorAll(".triador")) {
    for (const b of t.querySelectorAll(".seg")) b.classList.toggle("on", String(config[t.dataset.clau]) === b.dataset.valor);
  }
  for (const clau of INTERRUPTORS) document.querySelector(`[data-clau='${clau}']`).classList.toggle("on", !!config[clau]);
  const triat = PERSONATGES[config.personatge] ? config.personatge : "mico";
  for (const b of document.querySelectorAll(".personatge")) b.classList.toggle("on", b.dataset.id === triat);

  const fals = document.getElementById("falseja");
  fals.textContent = "";
  for (const [clau, titol, desc] of FALSEJA) {
    const fila = document.createElement("div");
    fila.className = "opcio";
    const text = document.createElement("div");
    text.className = "text";
    const b = document.createElement("b"); b.textContent = titol;
    const s = document.createElement("small"); s.textContent = desc;
    text.append(b, s);
    const inter = document.createElement("button");
    inter.className = "inter" + (config.falseja[clau] ? " on" : "");
    inter.append(Object.assign(document.createElement("span"), { className: "bola" }));
    inter.onclick = () => desa({ falseja: Object.assign({}, config.falseja, { [clau]: !config.falseja[clau] }) });
    fila.append(text, inter);
    fals.append(fila);
  }

  const llista = document.getElementById("confianca");
  llista.textContent = "";
  for (const w of config.confianca) {
    const li = document.createElement("li");
    li.append(w);
    const treu = document.createElement("button");
    treu.textContent = "×";
    treu.title = "Treu-lo";
    treu.onclick = () => desa({ confianca: config.confianca.filter((x) => x !== w) });
    li.append(treu);
    llista.append(li);
  }
}

for (const t of document.querySelectorAll(".triador")) {
  for (const b of t.querySelectorAll(".seg")) b.onclick = () => desa({ [t.dataset.clau]: t.dataset.num ? Number(b.dataset.valor) : b.dataset.valor });
}
for (const clau of INTERRUPTORS) document.querySelector(`[data-clau='${clau}']`).onclick = () => desa({ [clau]: !config[clau] });
document.getElementById("afegeix").onsubmit = (ev) => {
  ev.preventDefault();
  const camp = document.getElementById("nouWeb");
  let v = camp.value.trim();
  if (!v) return;
  if (!/^https?:\/\//.test(v)) v = "https://" + v;
  const lloc = MG.llocDeUrl(v);
  if (lloc && !config.confianca.some((w) => MG.lloc(w) === lloc)) desa({ confianca: [...config.confianca, lloc] });
  camp.value = "";
};

// Qui se les menja (lib/monstre.js): el dibuix de cada personatge, i «Mira'l» el fa sortir aquí mateix.
const PERSONATGES = MG_personatges();
for (const [id, p] of Object.entries(PERSONATGES)) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "personatge";
  b.dataset.id = id;
  const dibuix = document.createElement("div");
  dibuix.className = "dibuix";
  dibuix.innerHTML = p.svg;
  b.append(dibuix, p.nom);
  b.onclick = () => desa({ personatge: id });
  document.getElementById("personatges").append(b);
}
document.getElementById("mira").onclick = async (ev) => {
  const boto = ev.currentTarget;
  boto.disabled = true;
  try {
    await MG_monstre({ noms: ["_ga", "_fbp", "_gid", "_hjid", "_gcl_au"], personatge: config.personatge });
  } finally {
    boto.disabled = false;
  }
};

// Al Vivaldi, el Chrome i el Brave, «a cada clic» només canvia el que llegeix JavaScript: les
// regles del Chromium no poden posar un valor diferent a cada petició.
if (!/Firefox\//.test(navigator.userAgent)) {
  const nota = document.querySelector("[data-clau='identificador'] small");
  if (nota) nota.textContent += " En aquest navegador, a cada clic només canvia el que llegeix JavaScript; " +
    "les peticions porten el fals de la visita.";
}

carrega();
