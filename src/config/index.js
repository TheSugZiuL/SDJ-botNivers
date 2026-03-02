const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

function parseBoolean(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parseCsv(value) {
  if (value == null || value === "") return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = (process.env.NODE_ENV || "development").trim();
const isProduction = nodeEnv === "production";
const reminderDaysBefore = String(process.env.REMINDER_DAYS_BEFORE || "5,3,1")
  .split(",")
  .map((value) => Number(String(value).trim()))
  .filter((value) => Number.isInteger(value) && value > 0)
  .filter((value, index, arr) => arr.indexOf(value) === index)
  .sort((a, b) => b - a);

module.exports = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3000),
  groupId: (process.env.GROUP_ID || "").trim(),
  cronSchedule: (process.env.CRON_SCHEDULE || "0 8 * * *").trim(),
  timezone: (process.env.TZ || "America/Sao_Paulo").trim(),
  reminderDaysBefore,
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH || "./data/bot_sdj_nivers.db"),
  whatsappSessionName: (process.env.WHATSAPP_SESSION_NAME || "bot-sdj-nivers").trim(),
  whatsappAuthPath: path.resolve(process.cwd(), process.env.WHATSAPP_AUTH_PATH || "./data/whatsapp-auth"),
  whatsappAutoReconnect: parseBoolean(process.env.WHATSAPP_AUTO_RECONNECT, true),
  whatsappReconnectDelayMs: Math.max(1000, Number(process.env.WHATSAPP_RECONNECT_DELAY_MS || 15000)),
  whatsappMaxReconnectAttempts: Math.max(0, Number(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || 0)),
  whatsappPuppeteerArgs:
    parseCsv(process.env.WHATSAPP_PUPPETEER_ARGS).length > 0
      ? parseCsv(process.env.WHATSAPP_PUPPETEER_ARGS)
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--no-first-run",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-default-apps"
        ],
  trustProxy: Number(process.env.TRUST_PROXY || (isProduction ? 1 : 0)),
  requireHttps: parseBoolean(process.env.REQUIRE_HTTPS, isProduction),
  csrfCheckOrigin: parseBoolean(process.env.CSRF_CHECK_ORIGIN, isProduction),
  bodyLimit: (process.env.BODY_LIMIT || "50kb").trim(),
  panelAuthEnabled: parseBoolean(process.env.PANEL_BASIC_AUTH_ENABLED, isProduction),
  panelAuthUser: (process.env.PANEL_LOGIN_USER || process.env.PANEL_BASIC_AUTH_USER || "").trim(),
  panelAuthPassword: process.env.PANEL_LOGIN_PASSWORD || process.env.PANEL_BASIC_AUTH_PASSWORD || "",
  panelSessionSecret: process.env.PANEL_SESSION_SECRET || "",
  panelSessionMaxAgeSec: Number(process.env.PANEL_SESSION_MAX_AGE_SEC || 60 * 60 * 12),
  panelSessionIdleTimeoutSec: Number(process.env.PANEL_SESSION_IDLE_TIMEOUT_SEC || 60 * 30),
  panelLoginMaxFailuresPerIp: Number(process.env.PANEL_LOGIN_MAX_FAILURES_PER_IP || 5),
  panelLoginFailureWindowSec: Number(process.env.PANEL_LOGIN_FAILURE_WINDOW_SEC || 60 * 15),
  panelLoginLockoutSec: Number(process.env.PANEL_LOGIN_LOCKOUT_SEC || 60 * 30),
  panelIpAllowlist: String(process.env.PANEL_IP_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};
