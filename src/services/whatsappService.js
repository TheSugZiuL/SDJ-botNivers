const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs");
const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("../config");

class WhatsAppService {
  constructor() {
    this.client = null;
    this.state = "not_initialized";
    this.lastQr = null;
    this.lastQrAscii = null;
    this.lastQrAt = null;
    this.lastError = null;
    this.initialized = false;
    this.initPromise = null;
    this.idleTimer = null;
  }

  clearIdleTimer() {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  scheduleIdleShutdown() {
    this.clearIdleTimer();
    const idleMs = Number(config.whatsappIdleShutdownMs || 0);
    if (idleMs <= 0 || !this.initialized || !this.client) return;
    this.idleTimer = setTimeout(() => {
      this.shutdown("idle_timeout").catch((error) => {
        console.error("[WhatsApp] Falha ao encerrar cliente ocioso:", error.message);
      });
    }, idleMs);
    if (typeof this.idleTimer.unref === "function") this.idleTimer.unref();
  }

  createClient() {
    fs.mkdirSync(config.whatsappAuthPath, { recursive: true });
    console.log(`[WhatsApp] Pasta de sessao: ${config.whatsappAuthPath}`);

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: config.whatsappSessionName,
        dataPath: config.whatsappAuthPath
      }),
      puppeteer: { headless: true, args: config.whatsappPuppeteerArgs }
    });

    client.on("qr", (qr) => {
      this.state = "qr_pending";
      this.lastQr = qr;
      this.lastQrAt = new Date().toISOString();
      this.lastError = null;
      console.log("\n[WhatsApp] Escaneie o QR Code no celular:");
      qrcodeTerminal.generate(qr, { small: true }, (ascii) => {
        this.lastQrAscii = ascii || null;
        if (ascii) console.log(ascii);
      });
    });

    client.on("authenticated", () => {
      this.state = "authenticated";
      this.lastQr = null;
      this.lastQrAscii = null;
      this.lastQrAt = null;
      console.log("[WhatsApp] Sessao autenticada.");
    });

    client.on("ready", () => {
      this.state = "ready";
      this.lastError = null;
      this.lastQr = null;
      this.lastQrAscii = null;
      this.lastQrAt = null;
      console.log("[WhatsApp] Cliente conectado e pronto.");
      this.scheduleIdleShutdown();
    });

    client.on("auth_failure", (msg) => {
      this.state = "auth_failure";
      this.lastError = msg || "Falha de autenticacao";
      console.error("[WhatsApp] auth_failure:", msg);
    });

    client.on("disconnected", (reason) => {
      this.state = "disconnected";
      this.lastError = reason || "Desconectado";
      console.warn("[WhatsApp] disconnected:", reason);
    });

    client.on("change_state", (newState) => {
      this.state = `state:${newState}`;
    });

    return client;
  }

  async initialize() {
    if (this.initialized && this.client) return this.client;
    if (this.initPromise) return this.initPromise;

    this.state = "initializing";
    this.lastError = null;
    this.client = this.createClient();

    this.initPromise = this.client
      .initialize()
      .then(() => {
        this.initialized = true;
        return this.client;
      })
      .catch((error) => {
        this.initialized = false;
        this.lastError = error.message || "Falha ao inicializar WhatsApp";
        this.client = null;
        throw error;
      })
      .finally(() => {
        this.initPromise = null;
      });

    return this.initPromise;
  }

  async shutdown(reason = "manual") {
    this.clearIdleTimer();
    if (!this.client) {
      this.initialized = false;
      this.state = "not_initialized";
      return;
    }
    await this.client.destroy().catch(() => null);
    this.client = null;
    this.initialized = false;
    this.state = `stopped:${reason}`;
    this.lastQr = null;
    this.lastQrAscii = null;
    this.lastQrAt = null;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      state: this.state,
      hasQr: Boolean(this.lastQr),
      qrAscii: this.lastQrAscii,
      lastQrAt: this.lastQrAt,
      lastError: this.lastError
    };
  }

  async assertReady() {
    if (!this.initialized || !this.client) await this.initialize();
    const state = await this.client.getState().catch(() => null);
    if (this.state !== "ready" && state !== "CONNECTED") {
      throw new Error("WhatsApp nao esta pronto. Escaneie o QR Code e aguarde conectar.");
    }
    this.scheduleIdleShutdown();
  }

  async sendMessageToGroup(groupId, message) {
    if (!groupId) throw new Error("GROUP_ID nao configurado no .env");
    await this.assertReady();

    let chat;
    try {
      chat = await this.client.getChatById(groupId);
    } catch (error) {
      throw new Error("Grupo nao encontrado para o GROUP_ID configurado.");
    }

    if (!chat || !chat.isGroup) {
      throw new Error("O GROUP_ID informado nao corresponde a um grupo.");
    }

    await chat.sendMessage(message);
    this.scheduleIdleShutdown();
    return { ok: true, groupName: chat.name };
  }

  async listGroups() {
    await this.assertReady();
    const chats = await this.client.getChats();
    const safeName = (value) => (typeof value === "string" ? value : "");
    const groups = chats
      .filter((c) => c.isGroup)
      .map((c) => ({ id: c.id?._serialized, nome: safeName(c.name) }))
      .sort((a, b) => safeName(a.nome).localeCompare(safeName(b.nome), "pt-BR"));
    this.scheduleIdleShutdown();
    return groups;
  }
}

module.exports = new WhatsAppService();
