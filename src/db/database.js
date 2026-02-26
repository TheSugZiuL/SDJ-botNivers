const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("../config");

let dbInstance;

function ensureBirthdaysColumns(db) {
  const columns = db.prepare("PRAGMA table_info(birthdays)").all().map((row) => row.name);
  if (!columns.includes("foto_url")) {
    db.exec("ALTER TABLE birthdays ADD COLUMN foto_url TEXT");
  }
}

function ensureMessageTemplatesColumns(db) {
  const columns = db.prepare("PRAGMA table_info(message_templates)").all().map((row) => row.name);
  if (!columns.includes("tipo")) {
    db.exec("ALTER TABLE message_templates ADD COLUMN tipo TEXT NOT NULL DEFAULT 'birthday_today'");
    db.exec("UPDATE message_templates SET tipo = 'birthday_today' WHERE tipo IS NULL OR tipo = ''");
  }
}

function ensureDefaultTemplates(db) {
  const upsertDefaultActiveTemplate = (tipo, nome, conteudo, legacyContents = []) => {
    const active = db
      .prepare("SELECT id, nome, conteudo FROM message_templates WHERE tipo = ? AND ativo = 1 ORDER BY id DESC LIMIT 1")
      .get(tipo);

    if (active) {
      const shouldMigrateLegacyContent = legacyContents.includes(String(active.conteudo || ""));
      if (shouldMigrateLegacyContent) {
        db.prepare(
          `UPDATE message_templates
           SET nome = ?, conteudo = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(nome, conteudo, active.id);
      }
      return;
    }

    db.prepare("UPDATE message_templates SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE tipo = ?").run(tipo);
    db.prepare(
      `INSERT INTO message_templates (nome, conteudo, tipo, ativo, created_at, updated_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(nome, conteudo, tipo);
  };

  upsertDefaultActiveTemplate(
    "birthday_today",
    "Template aniversario (padrao)",
    "Hoje e aniversario do(a) {nome} ({dia}/{mes})! Parabens!\nQue Deus abencoe sua vida com saude, paz e alegria\nQue Nossa Senhora interceda por voce e te conduza sempre no caminho do bem. Amem ✨",
    [
      "Hoje e aniversario de {nome} ({dia}/{mes})! Parabens! Que Deus abencoe muito seu dia e sua caminhada."
    ]
  );

  upsertDefaultActiveTemplate(
    "birthday_reminder_d5",
    "Template lembrete D-5 (padrao)",
    "⏳ Faltam {dias_faltam} dias para o aniversario do(a) {nome} ({dia}/{mes})!\nVamos desde ja lembrar em oracao e carinho ✨\nQue Deus abencoe a vida do(a) {nome} e Nossa Senhora o(a) cubra com seu manto. Amem"
  );

  upsertDefaultActiveTemplate(
    "birthday_reminder_d3",
    "Template lembrete D-3 (padrao)",
    "Esta chegando! Faltam {dias_faltam} dias para o aniversario do(a) {nome} ({dia}/{mes})\nVamos rezar por ele(a) e preparar o coracao para celebrar essa vida\nDeus abencoe e guarde o(a) {nome}. Amem!"
  );

  upsertDefaultActiveTemplate(
    "birthday_reminder_d1",
    "Template lembrete D-1 (padrao)",
    "Amanha e o aniversario do(a) {nome} ({dia}/{mes})! Falta {dias_faltam} dia\nVamos nos preparar para parabenizar e interceder por essa vida\nQue Deus derrame gracas e paz sobre o(a) {nome}. Amem ✨",
    [
      "Amanhã e aniversario do(a) {nome} ({dia}/{mes})! Faltam {dias_faltam} dia. Vamos nos preparar para parabenizar!",
      "AmanhÃ£ e aniversario do(a) {nome} ({dia}/{mes})! Faltam {dias_faltam} dia. Vamos nos preparar para parabenizar!"
    ]
  );

  // Mantem um template generico legado para compatibilidade/fallback.
  db.prepare(
    `INSERT INTO message_templates (nome, conteudo, tipo, ativo, created_at, updated_at)
     SELECT ?, ?, 'birthday_reminder', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE tipo = 'birthday_reminder')`
  ).run(
    "Template lembrete (legado)",
    "Faltam {dias_faltam} dias para o aniversario do(a) {nome} ({dia}/{mes})."
  );

  // Garante apenas um ativo por tipo para templates antigos/duplicados.
  const rows = db
    .prepare(
      `SELECT tipo, GROUP_CONCAT(id) AS ids
       FROM message_templates
       WHERE ativo = 1
       GROUP BY tipo`
    )
    .all();

  for (const row of rows) {
    const ids = String(row.ids || "")
      .split(",")
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v));
    if (ids.length <= 1) continue;
    const [keepId, ...disableIds] = ids.sort((a, b) => b - a);
    db.prepare(
      `UPDATE message_templates
       SET ativo = CASE WHEN id = ? THEN 1 ELSE 0 END,
           updated_at = CURRENT_TIMESTAMP
       WHERE tipo = ?`
    ).run(keepId, row.tipo);
    if (disableIds.length) {
      db.prepare(
        `UPDATE message_templates
         SET ativo = 0, updated_at = CURRENT_TIMESTAMP
         WHERE tipo = ? AND id != ?`
      ).run(row.tipo, keepId);
    }
  }
}

function initializeSchema(db) {
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schemaSql);
  ensureBirthdaysColumns(db);
  ensureMessageTemplatesColumns(db);
  ensureDefaultTemplates(db);
}

function getDb() {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  dbInstance = new Database(config.dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  initializeSchema(dbInstance);
  return dbInstance;
}

module.exports = { getDb, initializeSchema };
