const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs");
const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("../config");

class WhatsAppService {
  constructor() {
    this.client = null;
    this.state = "not_initialized";
    this.lastQr = null;
    this.lastError = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return Promise.resolve(this.client);

    fs.mkdirSync(config.whatsappAuthPath, { recursive: true });
    console.log(`[WhatsApp] Pasta de sessao: ${config.whatsappAuthPath}`);

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: config.whatsappSessionName,
        dataPath: config.whatsappAuthPath
      }),
      puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
    });

    this.client.on("qr", (qr) => {
      this.state = "qr_pending";
      this.lastQr = qr;
      this.lastError = null;
      console.log("\n[WhatsApp] Escaneie o QR Code no celular:");
      qrcodeTerminal.generate(qr, { small: true });
    });

    this.client.on("authenticated", () => {
      this.state = "authenticated";
      this.lastQr = null;
      console.log("[WhatsApp] Sessao autenticada.");
    });

    this.client.on("ready", () => {
      this.state = "ready";
      this.lastError = null;
      this.lastQr = null;
      console.log("[WhatsApp] Cliente conectado e pronto.");
    });

    this.client.on("auth_failure", (msg) => {
      this.state = "auth_failure";
      this.lastError = msg || "Falha de autenticacao";
      console.error("[WhatsApp] auth_failure:", msg);
    });

    this.client.on("disconnected", (reason) => {
      this.state = "disconnected";
      this.lastError = reason || "Desconectado";
      console.warn("[WhatsApp] disconnected:", reason);
    });

    this.client.on("change_state", (newState) => {
      this.state = `state:${newState}`;
    });

    this.initialized = true;
    return this.client.initialize().then(() => this.client);
  }

  getStatus() {
    return {
      initialized: this.initialized,
      state: this.state,
      hasQr: Boolean(this.lastQr),
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
      throw new Error(`Grupo nao encontrado para GROUP_ID: ${groupId}`);
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
