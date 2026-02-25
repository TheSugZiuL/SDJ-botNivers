const { getDb } = require("../db/database");

function create(data) {
  const result = getDb()
    .prepare(
      `INSERT INTO audit_logs (username, action, description, method, path, ip, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(
      String(data.username || "desconhecido"),
      String(data.action || "unknown"),
      String(data.description || "Acao sem descricao"),
      String(data.method || "GET"),
      String(data.path || "/"),
      data.ip ? String(data.ip) : null,
      data.details ? String(data.details) : null
    );

  return getDb().prepare("SELECT * FROM audit_logs WHERE id = ?").get(result.lastInsertRowid);
}

function listRecent(limit = 200) {
  return getDb()
    .prepare(
      `SELECT id, username, action, description, method, path, ip, details, created_at
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit);
}

module.exports = {
  create,
  listRecent
};
