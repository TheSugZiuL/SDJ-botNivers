const { getDb } = require("../db/database");

const records = [
  ["03/01", "Pedro Castro", "Palavra e Inter", "https://photos.app.goo.gl/uoJSPP4ckMqWEVJZ8"],
  ["04/01", "Tati Damasceno", "Palavra e MMO", "https://photos.app.goo.gl/DvnSq7YpZ7wm8fxA8"],
  ["05/01", "Karina Lazarin", "Inter", "https://photos.app.goo.gl/JKVPfGuwPGgbAjsY9"],
  ["07/01", "Rafaella Chaves", "Palavra e MMO", "https://photos.app.goo.gl/x5hmhFUMeHvALzBS8"],
  ["07/01", "Beatriz Coltrim", "Inter e Palavra", "https://photos.app.goo.gl/EnBkz1X3jbYXsutx9"],
  ["10/01", "Michelle Rodrigues", "Palavra e MMO", "https://photos.app.goo.gl/urYtLS3AN7zxjDCh7"],
  ["16/01", "Maria Caroline", "Palavra e MMO", "https://photos.app.goo.gl/zSQjUuoXhLKJHmFo6"],
  ["25/01", "Lucas Winck", "Palavra", "https://photos.app.goo.gl/42AaKfwL86URaW1h8"],

  ["16/02", 'Matheus "Árabe"', "MMO", "https://photos.app.goo.gl/iWJx5NKWEgTuVj8C8"],
  ["18/02", "Sérgio Barreto", "MMO e Pastoreio", "https://photos.app.goo.gl/K1kQ4MRknjPhFXCaA"],
  ["19/02", "Gabriella Lima", "Palavra e Intercessão", "https://photos.app.goo.gl/78tx1Nuh7hMfKSzX7"],
  ["21/02", 'Ana Beatriz "Aninha"', "Pastoreio e Inter", "https://photos.app.goo.gl/Zi8fXHC6PfG1Ncq5A"],
  ["21/02", 'Marcelo Correa "Marcelinho"', "Palavra e Inter", "https://photos.app.goo.gl/1QmxVyTHg71pxEKa7"],
  ["22/02", "Gustavo Sato", "Inter e Palavra", "https://photos.app.goo.gl/Qdn8SfoyPYBVSCCdA"],
  ["22/02", "Rodrigo", "MMO", "https://photos.app.goo.gl/r5iWVzpYNLGzLGuU6"],
  ["24/02", 'Maria Luiza "Maluzinha"', "MMO e Inter", "https://photos.app.goo.gl/Yz8zRUZSZtD6AwrV7"],

  ["01/03", 'Mariana "Bigoda"', "Pastoreio e Inter", "https://photos.app.goo.gl/UTB3VomaA1N9xYvg6"],
  ["05/03", "Gabriel Perassoli", "Palavra e MMO", "https://photos.app.goo.gl/Xbz3qxtQY2i99MKm9"],
  ["09/03", "Jessica Fernanda", "Inter e Palavra (coord geral)", "https://photos.app.goo.gl/QPno9UR2R8uT16138"],
  ["10/03", "Rayssa", "Inter, MMO e Palavra", "https://photos.app.goo.gl/XB1zxC4pMVNNKjkK6"],
  ["23/03", "João Francisco", "Pastoreio", "https://photos.app.goo.gl/ocmta562L9wgRG6M6"],
  ["25/03", "Gabriela Meira", "Palavra e Inter (coord. Palavra)", "https://photos.app.goo.gl/HrkkshmcLqEt9USc6"],

  ["01/04", "Raquel Viotto", "Palavra", "https://photos.app.goo.gl/Hyn5ZbS2o6PkWTmf7"],
  ["07/04", "Andressa Marchetti", "MMO e Palavra (coord. MMO)", "https://photos.app.goo.gl/9bKZDYhGyvHT38697"],
  ["08/04", "André Luiz", "MMO e Pastoreio", "https://photos.app.goo.gl/Y2fQLU3S6gtXJQuc8"],
  ["11/04", 'Luiz Gustavo da Silva Souza "Gerente"', "Pastoreio", ""],
  ["12/04", "Vinicius Benício", "Pastoreio, Palavra e MMO", "https://photos.app.goo.gl/yPD2fpfwtGppN4ZW6"],
  ["14/04", "Luis Gustavo Mendes Mangussi", "Intercessão", ""],
  ["15/04", "Mateus Almeida", "Palavra e Artes", "https://photos.app.goo.gl/jUCzjAr9Zc4W4Ri76"],
  ["15/04", "Willian Fattori", "Palavra e Inter", "https://photos.app.goo.gl/Fp1BpiR9P82zEpGH6"],
  ["16/04", "Welton Brandão", "MMO", "https://photos.app.goo.gl/9D55TrmgFvqP5rdr8"],

  ["01/05", "Rafaela Damasceno", "Inter(coord.)", "https://photos.app.goo.gl/kiMKFAfnEJr2KZBM8"],
  ["07/05", "Ana Carolina Correa", "Inter", "https://photos.app.goo.gl/oo26B9mvwJ6Dvpuq7"],
  ["13/05", "Ana Clara de Oliveira", "MMO", "https://photos.app.goo.gl/awQEve6CHrPD8FMW6"],
  ["15/05", "Rômulo", "Pastoreio e Inter", "https://photos.app.goo.gl/kvts6fJvU217La3d8"],
  ["23/05", "Ana Paula", "Inter e Pastoreio", "https://photos.app.goo.gl/pZDxvg1mE6CpSjoY9"],

  ["01/06", "João Pedro de Carvalho", "Pastoreio e MMO", "https://photos.app.goo.gl/fh2NBp19H1CVR4aT8"],
  ["06/06", 'Marcus Vinicius "Teta"', "Música e oração", "https://photos.app.goo.gl/nHNFoe8K9LmRxVLJ9"],
  ["09/06", "Cauã Felipe", "Inter", "https://photos.app.goo.gl/CyvUSDdaFcLebdZM7"],
  ["23/06", "Vitória Martins", "Pastoreio (coord.)", "https://photos.app.goo.gl/8c98SHQ3hR3AHe5C7"],
  ["25/06", 'Bruno Osvaldo "Bruninho"', "Música e oração", "https://photos.app.goo.gl/uvo8LwzVCBjo5uRr8"],

  ["16/07", 'Gabriel Henrique "Bigode"', "Inter, Palavra e MMO (coord. Formação)", "https://photos.app.goo.gl/3pLDkCj6PYwHA7mv7"],
  ["22/07", "Renata Sevidanis", "MMO e Pastoreio", "https://photos.app.goo.gl/RoruKu6DPi1EwDPp9"],
  ["23/07", "Ana Clara dos Reis", "Pastoreio e Inter", "https://photos.app.goo.gl/UiPFTzS5BTBoPGu18"],
  ["30/07", "Marianne", "Palavra e Pastoreio", "https://photos.app.goo.gl/KoqDc8Tp7eun2gE86"],

  ["05/08", "Isabely Benício", "Palavra e MMO", "https://photos.app.goo.gl/cncyVbrVzqWPrnNf6"],
  ["09/08", "Ana Clara Ribeiro", "Pastoreio", "https://photos.app.goo.gl/snDco57MbdtjUER5A"],
  ["11/08", "Leo Yudi", "Pastoreio", "https://photos.app.goo.gl/espyWVBUSbtrtVz37"],
  ["12/08", "Tânia Paraizo", "Inter", "https://photos.app.goo.gl/KB1MXYHq9JRGLsvm7"],
  ["18/08", "Bruna Andrade", "Palavra e Inter (coord. Inter)", "https://photos.app.goo.gl/UbjNoVGHdLAdbJ3V8"],
  ["20/08", "Tia Cida ou Aparecida, Cidoka, Cidinha", "Apoio", "https://photos.app.goo.gl/m3kGvsTRHpLdsimR9"],
  ["28/08", "Felipe Pellizzon", "MMO e Pastoreio", "https://photos.app.goo.gl/XGNKoBw1NHcVuV6U6"],

  ["03/09", "Deborah", "Pastoreio e Intercessão", "https://photos.app.goo.gl/vCUGCQcc198WEnz56"],
  ["10/09", "Marcelo Boaventura", "MMO", "https://photos.app.goo.gl/kpgETMcPa5nQQDqBA"],
  ["14/09", "Camile Vitória", "Artes e Pastoreio", "https://photos.app.goo.gl/LFcA5ivKHDtXixrz5"],
  ["15/09", "Wesley Ademar", "Palavra e MMO", "https://photos.app.goo.gl/D3GveTmsRD3rXEkp6"],
  ["16/09", "Sofia Kawane", "Pastoreio", "https://photos.app.goo.gl/gmC6XFNLYYVQ9uBg9"],

  ["15/10", "Cristiano", "MMO e Palavra", "https://photos.app.goo.gl/PSi263RLJutwJGWB7"],
  ["27/10", 'Maria Fernanda "Maria Maria"', "MMO e Pastoreio", "https://photos.app.goo.gl/7rhWKoSUZgARFmAdA"],

  ["04/11", "Maria Eduarda", "Inter", "https://photos.app.goo.gl/XQVwjFgkBTWSwHDEA"],
  ["09/11", "Eder Estevam", "Palavra", "https://photos.app.goo.gl/3yezf7Cto9Ci3VTQA"],
  ["11/11", 'Wyllian "Dedé"', "Palavra e Inter", "https://photos.app.goo.gl/AXDzZa4wVoKxegEK7"],
  ["16/11", "Jorge", "MMO e Palavra", "https://photos.app.goo.gl/pYfzUqHThBGmd6bu5"],
  ["19/11", "Amanda Rodrigues", "MMO e Palavra", "https://photos.app.goo.gl/2y5nDg2A5cjgGFeXA"],
  ["22/11", "Vinicius Damasceno", "Pastoreio", "https://photos.app.goo.gl/vkJyvRRW8Wisaw4Y7"],
  ["22/11", "Ariadne Scarpelini", "Inter e MMO", ""],
  ["24/11", "Cristiane Damasceno", "Pastoreio, Palavra e Apoio", "https://photos.app.goo.gl/3qTfznDkFiaRq8QW6"],
  ["30/11", "Maike", "Pastoreio e Palavra", "https://photos.app.goo.gl/8RnGWsyR9w1DDnvM6"],

  ["06/12", "Ariane", "Inter", "https://photos.app.goo.gl/GJq6877e5SqAJkgg6"],
  ["12/12", "Viviany Benicio", "Pastoreio e Inter", ""],
  ["19/12", "Ana Beatriz", "Pastoreio e MMO", "https://photos.app.goo.gl/ZE94swJnHkJCf6DX9"],
  ["28/12", 'Maycon "Maycão"', "Pastoreio", "https://photos.app.goo.gl/mh1UqujZGqBXEsfo6"],
  ["30/12", "Malu Campanucci", "Palavra e MMO", "https://photos.app.goo.gl/wxXkPhuAizRnaPJm9"],
  ["31/12", "Luciana", "Pastoreio e MMO", "https://photos.app.goo.gl/rZHqWY9AajGkcfsf6"]
];

function normText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normDate(value) {
  return String(value || "").replace(".", "/").trim();
}

function keyOf(nome, data) {
  return `${normText(nome)}|${normDate(data)}`;
}

function main() {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM birthdays").all();
  const existingByKey = new Map(existing.map((row) => [keyOf(row.nome, row.data_aniversario), row]));
  const touchedIds = new Set();
  const duplicateKeys = new Set();

  const seenKeys = new Set();
  for (const [data, nome] of records) {
    const key = keyOf(nome, data);
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
  }
  if (duplicateKeys.size) {
    throw new Error(`Chaves duplicadas na lista: ${Array.from(duplicateKeys).join(", ")}`);
  }

  const insertStmt = db.prepare(
    `INSERT INTO birthdays (nome, data_aniversario, ativo, observacao, foto_url, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  );
  const updateStmt = db.prepare(
    `UPDATE birthdays
     SET nome = ?, data_aniversario = ?, ativo = 1, observacao = ?, foto_url = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  );
  const deactivateStmt = db.prepare(
    `UPDATE birthdays
     SET ativo = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  );

  let inserted = 0;
  let updated = 0;
  let inactivated = 0;

  const tx = db.transaction(() => {
    for (const [rawData, nome, observacao, fotoUrl] of records) {
      const data = normDate(rawData);
      const row = existingByKey.get(keyOf(nome, data));
      if (row) {
        updateStmt.run(nome, data, observacao || null, fotoUrl || null, row.id);
        touchedIds.add(row.id);
        updated++;
      } else {
        const result = insertStmt.run(nome, data, observacao || null, fotoUrl || null);
        touchedIds.add(Number(result.lastInsertRowid));
        inserted++;
      }
    }

    for (const row of existing) {
      if (!touchedIds.has(row.id) && Number(row.ativo) !== 0) {
        deactivateStmt.run(row.id);
        inactivated++;
      }
    }
  });

  tx();

  const summary = {
    listCount: records.length,
    inserted,
    updated,
    inactivated,
    totalBirthdays: db.prepare("SELECT COUNT(*) AS c FROM birthdays").get().c,
    totalActives: db.prepare("SELECT COUNT(*) AS c FROM birthdays WHERE ativo = 1").get().c
  };

  const samples = {
    january: db
      .prepare("SELECT id, nome, data_aniversario, ativo, observacao, foto_url FROM birthdays WHERE data_aniversario IN ('03/01','07/01','16/01') ORDER BY data_aniversario, nome")
      .all(),
    inactiveExamples: db
      .prepare("SELECT id, nome, data_aniversario, ativo FROM birthdays WHERE ativo = 0 ORDER BY id LIMIT 10")
      .all()
  };

  console.log(JSON.stringify({ summary, samples }, null, 2));
}

main();
