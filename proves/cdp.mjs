// Client mínim del protocol DevTools (CDP) per controlar el Vivaldi o el Chrome sense finestra.
// Només fa servir el WebSocket que porta el Node.

export class CDP {
  static async connecta(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
    return new CDP(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendents = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pendents.has(d.id)) {
        const { ok, ko } = this.pendents.get(d.id);
        this.pendents.delete(d.id);
        if (d.error) ko(new Error(JSON.stringify(d.error)));
        else ok(d.result);
      }
    };
  }

  envia(metode, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method: metode, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    // Cap ordre no pot quedar penjada: als 20 segons, error.
    return new Promise((ok, ko) => {
      const t = setTimeout(() => { this.pendents.delete(id); ko(new Error(`${metode}: sense resposta`)); }, 20000);
      this.pendents.set(id, { ok: (v) => { clearTimeout(t); ok(v); }, ko: (e) => { clearTimeout(t); ko(e); } });
    });
  }

  async objectius() {
    return (await this.envia("Target.getTargets")).targetInfos;
  }

  async connectaA(targetId) {
    return (await this.envia("Target.attachToTarget", { targetId, flatten: true })).sessionId;
  }

  // Avalua una expressió (pot ser una promesa) en una sessió i en torna el valor.
  async avalua(sessionId, expressio) {
    const r = await this.envia("Runtime.evaluate", { expression: expressio, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }

  // Obre una pestanya nova i en torna {targetId, sessionId}.
  async pestanya(url = "about:blank") {
    const { targetId } = await this.envia("Target.createTarget", { url });
    const sessionId = await this.connectaA(targetId);
    await this.envia("Page.enable", {}, sessionId);
    return { targetId, sessionId };
  }

  async ves(sessionId, url, espera = 1500) {
    await this.envia("Page.navigate", { url }, sessionId);
    await new Promise((r) => setTimeout(r, espera));
  }

  tanca() { this.ws.close(); }
}

export const dorm = (ms) => new Promise((r) => setTimeout(r, ms));
