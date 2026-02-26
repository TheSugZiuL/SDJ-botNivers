const { getDb } = require("../db/database");

const TEMPLATE_TYPES = {
  birthdayToday: "birthday_today",
  birthdayReminder: "birthday_reminder",
  birthdayReminderD5: "birthday_reminder_d5",
  birthdayReminderD3: "birthday_reminder_d3",
  birthdayReminderD1: "birthday_reminder_d1"
};

function listAll() {
  return getDb()
    .prepare(
      `SELECT id, nome, conteudo, tipo, ativo, created_at, updated_at
       FROM message_templates
       ORDER BY tipo ASC, ativo DESC, id DESC`
    )
    .all();
}

function findById(id) {
  return getDb().prepare("SELECT * FROM message_templates WHERE id = ?").get(id);
}

function getActive(tipo = null) {
  if (tipo) {
    return getDb()
      .prepare("SELECT * FROM message_templates WHERE ativo = 1 AND tipo = ? ORDER BY id DESC LIMIT 1")
      .get(tipo);
  }
  return getDb().prepare("SELECT * FROM message_templates WHERE ativo = 1 ORDER BY id DESC LIMIT 1").get();
}

function create(data) {
  const db = getDb();
  const tx = db.transaction(() => {
    if (data.ativo) {
      db.prepare("UPDATE message_templates SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE tipo = ?").run(data.tipo);
    }
    const result = db
      .prepare(
        `INSERT INTO message_templates (nome, conteudo, tipo, ativo, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .run(data.nome, data.conteudo, data.tipo, data.ativo ? 1 : 0);
    return findById(result.lastInsertRowid);
  });
  return tx();
}

function update(id, data) {
  const db = getDb();
  const tx = db.transaction(() => {
    const existing = findById(id);
    if (!existing) return null;
    if (data.ativo) {
      db.prepare("UPDATE message_templates SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE tipo = ?").run(data.tipo);
    } else if (existing.tipo !== data.tipo && existing.ativo) {
      // Se mudar o tipo de um template ativo, mantem consistencia: desativa o antigo tipo e nao carrega ativo por engano.
      db.prepare("UPDATE message_templates SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    }
    db.prepare(
      `UPDATE message_templates
       SET nome = ?, conteudo = ?, tipo = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(data.nome, data.conteudo, data.tipo, data.ativo ? 1 : 0, id);
    return findById(id);
  });
  return tx();
}

function activate(id) {
  const db = getDb();
  const tx = db.transaction(() => {
    const item = findById(id);
    if (!item) return null;
    db.prepare("UPDATE message_templates SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE tipo = ?").run(item.tipo);
    db.prepare("UPDATE message_templates SET ativo = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    return findById(id);
  });
  return tx();
}

function remove(id) {
  return getDb().prepare("DELETE FROM message_templates WHERE id = ?").run(id);
}

function countAll() {
  return getDb().prepare("SELECT COUNT(*) AS total FROM message_templates").get().total;
}

module.exports = { listAll, findById, getActive, create, update, activate, remove, countAll, TEMPLATE_TYPES };
