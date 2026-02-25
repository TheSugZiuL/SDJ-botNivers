const { getDb } = require("../db/database");

try {
  getDb();
  console.log("Banco SQLite inicializado com sucesso.");
} catch (error) {
  console.error("Erro ao inicializar banco:", error.message);
  process.exitCode = 1;
}
