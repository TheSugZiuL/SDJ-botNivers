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
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
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
      this.reconnectAttempts = 0;
      console.log("[WhatsApp] Sessao autenticada.");
    });

    client.on("ready", () => {
      this.state = "ready";
      this.lastError = null;
      this.lastQr = null;
      this.lastQrAscii = null;
      this.lastQrAt = null;
      this.reconnectAttempts = 0;
      console.log("[WhatsApp] Cliente conectado e pronto.");
    });

    client.on("auth_failure", (msg) => {
      this.state = "auth_failure";
      this.lastError = msg || "Falha de autenticacao";
      console.error("[WhatsApp] auth_failure:", msg);
      this.scheduleReconnect("auth_failure");
    });

    client.on("disconnected", (reason) => {
      this.state = "disconnected";
      this.lastError = reason || "Desconectado";
      console.warn("[WhatsApp] disconnected:", reason);
      this.scheduleReconnect("disconnected");
    });

    client.on("change_state", (newState) => {
      this.state = `state:${newState}`;
    });

    return client;
  }

  scheduleReconnect(trigger) {
    if (!config.whatsappAutoReconnect) return;
    if (this.reconnectTimer) return;

    const max = Number(config.whatsappMaxReconnectAttempts || 0);
    if (max > 0 && this.reconnectAttempts >= max) {
      console.error("[WhatsApp] Limite de reconexao atingido.");
      return;
    }

    const delay = Number(config.whatsappReconnectDelayMs || 15000);
    this.reconnectAttempts += 1;
    this.state = "reconnecting";
    console.warn(`[WhatsApp] Reconexao agendada em ${delay}ms (motivo: ${trigger}). Tentativa ${this.reconnectAttempts}.`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initialize(true).catch((error) => {
        this.lastError = error.message || "Falha na reconexao";
        this.scheduleReconnect("reconnect_error");
      });
    }, delay);
  }

  async initialize(force = false) {
    if (this.initialized && this.client && !force) return this.client;
    if (this.initPromise && !force) return this.initPromise;

    if (force && this.client) {
      await this.client.destroy().catch(() => null);
      this.client = null;
      this.initialized = false;
    }

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
        this.scheduleReconnect("initialize_error");
        throw error;
      })
      .finally(() => {
        this.initPromise = null;
      });

    return this.initPromise;
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
    if (!this.initialized || !this.client) {
      throw new Error("WhatsApp ainda nao foi inicializado.");
    }
    const state = await this.client.getState().catch(() => null);
    if (this.state !== "ready" && state !== "CONNECTED") {
      throw new Error("WhatsApp nao esta pronto. Escaneie o QR Code e aguarde conectar.");
    }
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
    return { ok: true, groupName: chat.name };
  }

  async listGroups() {
    await this.assertReady();
    const chats = await this.client.getChats();
    const safeName = (value) => (typeof value === "string" ? value : "");
    return chats
      .filter((c) => c.isGroup)
      .map((c) => ({ id: c.id?._serialized, nome: safeName(c.name) }))
      .sort((a, b) => safeName(a.nome).localeCompare(safeName(b.nome), "pt-BR"));
  }
}

module.exports = new WhatsAppService();
