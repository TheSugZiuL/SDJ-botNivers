CREATE TABLE IF NOT EXISTS birthdays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  data_aniversario TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  observacao TEXT,
  foto_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'birthday_today',
  ativo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aniversariante_id INTEGER,
  data_envio TEXT NOT NULL,
  mensagem_enviada TEXT NOT NULL,
  status TEXT NOT NULL,
  erro TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (aniversariante_id) REFERENCES birthdays(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  ip TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_birthdays_ativo ON birthdays(ativo);
CREATE INDEX IF NOT EXISTS idx_send_logs_lookup ON send_logs(aniversariante_id, data_envio, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

INSERT INTO message_templates (nome, conteudo, ativo)
SELECT
  'Template padrao',
  'Hoje e aniversario de {nome} ({dia}/{mes})! Parabens! Que Deus abencoe muito seu dia e sua caminhada.',
  1
WHERE NOT EXISTS (SELECT 1 FROM message_templates);
