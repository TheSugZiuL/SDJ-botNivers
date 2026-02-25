const { getDb } = require("../db/database");

const MONTH_SQL = `CASE
  WHEN data_aniversario LIKE '____-__-__' THEN CAST(substr(data_aniversario, 6, 2) AS INTEGER)
  WHEN data_aniversario LIKE '__/__' THEN CAST(substr(data_aniversario, 4, 2) AS INTEGER)
  ELSE NULL
END`;

const DAY_SQL = `CASE
  WHEN data_aniversario LIKE '____-__-__' THEN CAST(substr(data_aniversario, 9, 2) AS INTEGER)
  WHEN data_aniversario LIKE '__/__' THEN CAST(substr(data_aniversario, 1, 2) AS INTEGER)
  ELSE NULL
END`;

function listAll() {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, nome, data_aniversario, ativo, observacao, created_at, updated_at
              , foto_url
       FROM birthdays
       ORDER BY ${MONTH_SQL},
                ${DAY_SQL},
                nome`
    )
    .all();
}

function findById(id) {
  return getDb().prepare("SELECT * FROM birthdays WHERE id = ?").get(id);
}

function create(data) {
  const result = getDb()
    .prepare(
      `INSERT INTO birthdays (nome, data_aniversario, ativo, observacao, foto_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .run(
      data.nome,
      data.data_aniversario,
      data.ativo ? 1 : 0,
      data.observacao || null,
      data.foto_url || null
    );
  return findById(result.lastInsertRowid);
}

function update(id, data) {
  getDb()
    .prepare(
      `UPDATE birthdays
       SET nome = ?, data_aniversario = ?, ativo = ?, observacao = ?, foto_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .run(
      data.nome,
      data.data_aniversario,
      data.ativo ? 1 : 0,
      data.observacao || null,
      data.foto_url || null,
      id
    );
  return findById(id);
}

function remove(id) {
  return getDb().prepare("DELETE FROM birthdays WHERE id = ?").run(id);
}

function findActiveByMonthDay(month, day) {
  return getDb()
    .prepare(
      `SELECT * FROM birthdays
       WHERE ativo = 1
         AND ${MONTH_SQL} = ?
         AND ${DAY_SQL} = ?
       ORDER BY nome`
    )
    .all(month, day);
}

function findActiveByMonth(month) {
  return getDb()
    .prepare(
      `SELECT * FROM birthdays
       WHERE ativo = 1
         AND ${MONTH_SQL} = ?
       ORDER BY ${DAY_SQL}, nome`
    )
    .all(month);
}

function countAll() {
  return getDb().prepare("SELECT COUNT(*) AS total FROM birthdays").get().total;
}

module.exports = { listAll, findById, create, update, remove, findActiveByMonthDay, findActiveByMonth, countAll };
