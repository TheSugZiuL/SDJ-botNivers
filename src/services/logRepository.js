const { getDb } = require("../db/database");

function create(data) {
  const result = getDb()
    .prepare(
      `INSERT INTO send_logs (aniversariante_id, data_envio, mensagem_enviada, status, erro, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(
      data.aniversariante_id || null,
      data.data_envio,
      data.mensagem_enviada,
      data.status,
      data.erro || null
    );
  return getDb().prepare("SELECT * FROM send_logs WHERE id = ?").get(result.lastInsertRowid);
}

function hasSuccessfulSendForBirthdayOnDate(aniversarianteId, dataEnvio) {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM send_logs
       WHERE aniversariante_id = ?
         AND data_envio = ?
         AND status = 'sucesso'
       LIMIT 1`
    )
    .get(aniversarianteId, dataEnvio);
  return Boolean(row);
}

function hasSuccessfulMonthlySummaryOnDate(dataEnvio) {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM send_logs
       WHERE aniversariante_id IS NULL
         AND data_envio = ?
         AND status = 'sucesso'
         AND mensagem_enviada LIKE '[RESUMO_MENSAL]%'
       LIMIT 1`
    )
    .get(dataEnvio);
  return Boolean(row);
}

function hasSuccessfulReminderSendForBirthdayOnDate(aniversarianteId, dataEnvio, daysBefore) {
  const prefix = `[LEMBRETE_D-${Number(daysBefore)}]`;
  const row = getDb()
    .prepare(
      `SELECT 1 FROM send_logs
       WHERE aniversariante_id = ?
         AND data_envio = ?
         AND status = 'sucesso'
         AND mensagem_enviada LIKE ?
       LIMIT 1`
    )
    .get(aniversarianteId, dataEnvio, `${prefix}%`);
  return Boolean(row);
}

function listRecent(limit = 100) {
  return getDb()
    .prepare(
      `SELECT l.*, b.nome AS aniversariante_nome
       FROM send_logs l
       LEFT JOIN birthdays b ON b.id = l.aniversariante_id
       ORDER BY l.id DESC
       LIMIT ?`
    )
    .all(limit);
}

function countToday(dateIso) {
  return getDb()
    .prepare("SELECT COUNT(*) AS total FROM send_logs WHERE data_envio = ? AND status = 'sucesso'")
    .get(dateIso).total;
}

module.exports = {
  create,
  hasSuccessfulSendForBirthdayOnDate,
  hasSuccessfulMonthlySummaryOnDate,
  hasSuccessfulReminderSendForBirthdayOnDate,
  listRecent,
  countToday
};
