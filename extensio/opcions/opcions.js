"use strict";
/* Menja galetes · opcions. Cada canvi es desa de seguida; el fons el recull sol. */

const FALSEJA = [
  ["navegador", "Navegador i sistema", "Windows o Mac en comptes de Linux"],
  ["ubicacio", "Ubicació", "Una ciutat inventada, si un web te la demana"],
  ["idioma", "Idioma i hora", "Els del país de la disfressa"],
  ["pantalla", "Pantalla i maquinari", "Mida de pantalla, nuclis i targeta gràfica"],
  ["empremta", "Empremta", "Canvas i àudio amb soroll, perquè no et reconeguin"],
  ["galetes", "Galetes de seguiment", "Se les menja i hi posa identificadors inventats"],
  ["ipScripts", "IP que demanen els scripts", "Els scripts que et pregunten la IP (WebRTC) en reben una de falsa"],
  ["ipCapcaleres", "IP de les capçaleres", "Una IP falsa a X-Forwarded-For, per als webs que se la creuen"],
];

let config = {};

async function carrega() {
  const s = await browser.storage.local.get(["config", "paisIP", "realAuto"]);
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
    for (const b of t.querySelectorAll(".seg")) b.classList.toggle("on", config[t.dataset.clau] === b.dataset.valor);
  }
  document.querySelector("[data-clau='canviPais']").classList.toggle("on", !!config.canviPais);

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
  for (const b of t.querySelectorAll(".seg")) b.onclick = () => desa({ [t.dataset.clau]: b.dataset.valor });
}
document.querySelector("[data-clau='canviPais']").onclick = () => desa({ canviPais: !config.canviPais });
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

carrega();
