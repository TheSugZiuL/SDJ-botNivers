const path = require("path");
const express = require("express");
const { getDb } = require("./db/database");
const config = require("./config");
const webRoutes = require("./routes/web");
const whatsappService = require("./services/whatsappService");
const { startBirthdayScheduler } = require("./scheduler/birthdayScheduler");
const { formatDateBr } = require("./utils/dateUtils");
const { buildSecurityMiddlewares } = require("./middleware/security");

const app = express();
app.disable("x-powered-by");
if (config.trustProxy > 0) {
  app.set("trust proxy", config.trustProxy);
}

// Cria o banco/tabelas automaticamente no boot.
getDb();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));
app.use(express.json({ limit: config.bodyLimit }));
app.use(...buildSecurityMiddlewares(config));
app.use(express.static(path.join(process.cwd(), "public")));

app.locals.appName = "Bot-SDJ-Nivers";
app.locals.formatDateBr = formatDateBr;

app.use("/", webRoutes);

app.use((err, req, res, next) => {
  console.error("[HTTP] Erro nao tratado:", err);
  res.status(500).send("Erro interno do servidor.");
});

function startBackgroundServices() {
  whatsappService.initialize().catch((error) => {
    console.error("[WhatsApp] Falha ao iniciar:", error.message);
  });
  startBirthdayScheduler();
}

module.exports = { app, config, startBackgroundServices };
