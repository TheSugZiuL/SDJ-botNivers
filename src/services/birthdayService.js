const config = require("../config");
const birthdayRepository = require("./birthdayRepository");
const templateRepository = require("./templateRepository");
const logRepository = require("./logRepository");
const whatsappService = require("./whatsappService");
const { nowTz, dateParts, getMonthDay, dayjs } = require("../utils/dateUtils");

const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];
const MONTHLY_SUMMARY_LOG_PREFIX = "[RESUMO_MENSAL]";
const MONTHLY_SUMMARY_TEST_LOG_PREFIX = "[RESUMO_MENSAL_TESTE]";
const REMINDER_LOG_PREFIX = "[LEMBRETE_D-";

function currentDateIso() {
  return nowTz(config.timezone).format("YYYY-MM-DD");
}

function nextBirthdayDateForPerson(person, baseDate) {
  const md = getMonthDay(person.data_aniversario);
  if (!md) return null;
  const base = dayjs(baseDate);
  if (!base.isValid()) return null;

  let candidate = base.date(md.day).month(md.month - 1);
  if (!candidate.isValid() || candidate.format("MM-DD") !== `${String(md.month).padStart(2, "0")}-${String(md.day).padStart(2, "0")}`) {
    return null;
  }
  if (candidate.startOf("day").isBefore(base.startOf("day"))) {
    candidate = candidate.add(1, "year");
  }
  return candidate;
}

function renderTemplate(templateText, person, referenceDate, extraPlaceholders = {}) {
  const parts = dateParts(referenceDate);
  const observacao = String(person.observacao || "").trim();
  const map = {
    "{nome}": person.nome,
    "{idade}": "",
    "{observacao}": observacao,
    "{dia}": parts.dia,
    "{mes}": parts.mes,
    "{dias_faltam}": String(extraPlaceholders.dias_faltam || ""),
    "{tipo_aviso}": String(extraPlaceholders.tipo_aviso || "")
  };

  let message = templateText || "";
  for (const [key, value] of Object.entries(map)) {
    message = message.split(key).join(value);
  }
  if (observacao && !String(templateText || "").includes("{observacao}")) {
    message = `${message}\nMinisterio: ${observacao}`;
  }
  return message.trim();
}

function getActiveTemplate() {
  return (
    templateRepository.getActive(templateRepository.TEMPLATE_TYPES.birthdayToday) || {
      conteudo:
        "ðŸŽ‰ Hoje e aniversario de {nome} ({dia}/{mes})! Parabens! Que seu dia seja incrivel e cheio de bencaos! ðŸ™Œâœ¨"
    }
  );
}

function getActiveReminderTemplate() {
  return (
    templateRepository.getActive(templateRepository.TEMPLATE_TYPES.birthdayReminder) || {
      conteudo: "Faltam {dias_faltam} dias para o aniversario do(a) {nome} ({dia}/{mes})."
    }
  );
}

function getActiveReminderTemplateForDays(daysBefore) {
  if (Number(daysBefore) === 1) {
    return (
      templateRepository.getActive(templateRepository.TEMPLATE_TYPES.birthdayReminderD1) ||
      getActiveReminderTemplate()
    );
  }
  return getActiveReminderTemplate();
}

function padRight(value, width) {
  const s = String(value || "");
  return s + " ".repeat(Math.max(0, width - s.length));
}

function buildMonthlyBirthdaysMessage(month, people) {
  const monthIndex = Number(month) - 1;
  const monthLabel = MONTH_NAMES_PT[monthIndex] || `Mes ${month}`;
  const items = (people || []).map((person) => ({
    data: String(person.data_aniversario || ""),
    nome: String(person.nome || ""),
    ministerio: String(person.observacao || "").trim()
  }));

  if (!items.length) {
    return `Aniversariantes ativos de ${monthLabel}\n\n(sem aniversariantes ativos neste mes)`;
  }

  const wData = Math.max(5, ...items.map((i) => i.data.length));
  const wNome = Math.max(4, ...items.map((i) => i.nome.length));
  const wMinisterio = Math.max(10, ...items.map((i) => i.ministerio.length));

  const lines = items.map(
    (i) =>
      `=> | ${padRight(i.data, wData)} | ${padRight(i.nome, wNome)} | ${padRight(i.ministerio, wMinisterio)} |`
  );

  return `Aniversariantes ativos de ${monthLabel}\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

async function sendMonthlySummary({ month, referenceDate, ignoreDuplicate = false, isTest = false } = {}) {
  const dateRef = referenceDate || currentDateIso();
  const monthNumber = Number(month || nowTz(config.timezone).format("MM"));
  const people = birthdayRepository.findActiveByMonth(monthNumber);
  const messageBody = buildMonthlyBirthdaysMessage(monthNumber, people);
  const logPrefix = isTest ? MONTHLY_SUMMARY_TEST_LOG_PREFIX : MONTHLY_SUMMARY_LOG_PREFIX;
  const message = `${logPrefix}\n${messageBody}`;

  if (!ignoreDuplicate && !isTest) {
    const alreadySent = logRepository.hasSuccessfulMonthlySummaryOnDate(dateRef);
    if (alreadySent) {
      return { skipped: true, reason: "Resumo mensal ja enviado.", month: monthNumber, totalFound: people.length };
    }
  }

  try {
    const sendResult = await whatsappService.sendMessageToGroup(config.groupId, messageBody);
    logRepository.create({
      aniversariante_id: null,
      data_envio: dateRef,
      mensagem_enviada: message,
      status: "sucesso"
    });
    return { success: true, groupName: sendResult.groupName, month: monthNumber, totalFound: people.length, message: messageBody };
  } catch (error) {
    logRepository.create({
      aniversariante_id: null,
      data_envio: dateRef,
      mensagem_enviada: message,
      status: "erro",
      erro: error.message
    });
    return { success: false, error: error.message, month: monthNumber, totalFound: people.length, message: messageBody };
  }
}

async function sendBirthdayMessage(person, { referenceDate, ignoreDuplicate = false } = {}) {
  const dateRef = referenceDate || currentDateIso();
  if (!ignoreDuplicate && person.id) {
    const alreadySent = logRepository.hasSuccessfulSendForBirthdayOnDate(person.id, dateRef);
    if (alreadySent) return { skipped: true, reason: "Ja enviado hoje." };
  }

  const template = getActiveTemplate();
  const message = renderTemplate(template.conteudo, person, dateRef);

  try {
    const sendResult = await whatsappService.sendMessageToGroup(config.groupId, message);
    logRepository.create({
      aniversariante_id: person.id || null,
      data_envio: dateRef,
      mensagem_enviada: message,
      status: "sucesso"
    });
    return { success: true, groupName: sendResult.groupName, message };
  } catch (error) {
    logRepository.create({
      aniversariante_id: person.id || null,
      data_envio: dateRef,
      mensagem_enviada: message,
      status: "erro",
      erro: error.message
    });
    return { success: false, error: error.message, message };
  }
}

async function sendReminderMessage(person, daysBefore, { referenceDate, ignoreDuplicate = false } = {}) {
  const dateRef = referenceDate || currentDateIso();
  const days = Number(daysBefore);
  if (!Number.isInteger(days) || days <= 0) {
    return { success: false, error: "Dias de lembrete invalidos." };
  }
  if (!ignoreDuplicate && person.id) {
    const alreadySent = logRepository.hasSuccessfulReminderSendForBirthdayOnDate(person.id, dateRef, days);
    if (alreadySent) return { skipped: true, reason: `Lembrete D-${days} ja enviado hoje.` };
  }

  const nextBirthday = nextBirthdayDateForPerson(person, dateRef);
  if (!nextBirthday) {
    return { success: false, error: "Data de aniversario invalida para lembrete." };
  }

  const messageBody = renderTemplate(
    getActiveReminderTemplateForDays(days).conteudo,
    person,
    nextBirthday.format("YYYY-MM-DD"),
    {
    dias_faltam: String(days),
    tipo_aviso: "lembrete"
    }
  );
  const messageLog = `${REMINDER_LOG_PREFIX}${days}]\n${messageBody}`;

  try {
    const sendResult = await whatsappService.sendMessageToGroup(config.groupId, messageBody);
    logRepository.create({
      aniversariante_id: person.id || null,
      data_envio: dateRef,
      mensagem_enviada: messageLog,
      status: "sucesso"
    });
    return { success: true, groupName: sendResult.groupName, message: messageBody, daysBefore: days };
  } catch (error) {
    logRepository.create({
      aniversariante_id: person.id || null,
      data_envio: dateRef,
      mensagem_enviada: messageLog,
      status: "erro",
      erro: error.message
    });
    return { success: false, error: error.message, message: messageBody, daysBefore: days };
  }
}

async function processTodayBirthdays() {
  const now = nowTz(config.timezone);
  const month = Number(now.format("MM"));
  const day = Number(now.format("DD"));
  const dateRef = now.format("YYYY-MM-DD");
  const people = birthdayRepository.findActiveByMonthDay(month, day);
  const results = [];

  for (const person of people) {
    const result = await sendBirthdayMessage(person, { referenceDate: dateRef });
    results.push({ person, ...result });
  }

  return { date: dateRef, totalFound: people.length, results };
}

function previewUpcomingBirthdayReminders({ referenceDate } = {}) {
  const now = nowTz(config.timezone);
  const dateRef = referenceDate || now.format("YYYY-MM-DD");
  const ref = dayjs(dateRef);
  const allActive = birthdayRepository.listAll().filter((person) => Number(person.ativo) === 1);
  const reminderDays = Array.isArray(config.reminderDaysBefore) ? config.reminderDaysBefore : [];
  const matches = [];

  if (!reminderDays.length || !allActive.length) {
    return { date: dateRef, totalFound: 0, matches };
  }

  for (const person of allActive) {
    const nextBirthday = nextBirthdayDateForPerson(person, dateRef);
    if (!nextBirthday) continue;
    const diffDays = nextBirthday.startOf("day").diff(ref.startOf("day"), "day");
    if (!reminderDays.includes(diffDays)) continue;
    matches.push({
      person,
      daysBefore: diffDays,
      birthdayDate: nextBirthday.format("YYYY-MM-DD"),
      birthdayDateBr: nextBirthday.format("DD/MM")
    });
  }

  matches.sort((a, b) => a.daysBefore - b.daysBefore || String(a.person?.nome || "").localeCompare(String(b.person?.nome || ""), "pt-BR"));
  return { date: dateRef, totalFound: matches.length, matches };
}

function previewNearestUpcomingBirthdayReminder({ referenceDate, includeToday = false } = {}) {
  const now = nowTz(config.timezone);
  const dateRef = referenceDate || now.format("YYYY-MM-DD");
  const ref = dayjs(dateRef);
  const allActive = birthdayRepository.listAll().filter((person) => Number(person.ativo) === 1);

  let best = null;
  for (const person of allActive) {
    const nextBirthday = nextBirthdayDateForPerson(person, dateRef);
    if (!nextBirthday) continue;
    const diffDays = nextBirthday.startOf("day").diff(ref.startOf("day"), "day");
    if (diffDays < 0) continue;
    if (!includeToday && diffDays === 0) continue;

    const candidate = {
      person,
      daysBefore: diffDays,
      birthdayDate: nextBirthday.format("YYYY-MM-DD"),
      birthdayDateBr: nextBirthday.format("DD/MM")
    };

    if (
      !best ||
      candidate.daysBefore < best.daysBefore ||
      (candidate.daysBefore === best.daysBefore &&
        String(candidate.person?.nome || "").localeCompare(String(best.person?.nome || ""), "pt-BR") < 0)
    ) {
      best = candidate;
    }
  }

  return { date: dateRef, item: best };
}

async function processUpcomingBirthdayReminders({ referenceDate, ignoreDuplicate = false } = {}) {
  const preview = previewUpcomingBirthdayReminders({ referenceDate });
  const results = [];

  for (const item of preview.matches) {
    const result = await sendReminderMessage(item.person, item.daysBefore, {
      referenceDate: preview.date,
      ignoreDuplicate
    });
    results.push({ ...item, ...result });
  }

  const totalSent = results.filter((item) => item.success).length;
  return { date: preview.date, totalFound: preview.totalFound, totalSent, results, preview: preview.matches };
}

async function processMonthlySummaryIfNeeded() {
  const now = nowTz(config.timezone);
  if (now.format("DD") !== "01") {
    return { skipped: true, reason: "Nao e o primeiro dia do mes." };
  }
  return sendMonthlySummary({ month: Number(now.format("MM")), referenceDate: now.format("YYYY-MM-DD") });
}

async function sendManualTestMessage(nome) {
  const fakePerson = {
    id: null,
    nome: nome || "Teste SDJ",
    data_aniversario: "2000-01-01"
  };
  return sendBirthdayMessage(fakePerson, { referenceDate: currentDateIso(), ignoreDuplicate: true });
}

async function sendReminderTestMessage(nome, daysBefore = 7) {
  const fakePerson = {
    id: null,
    nome: nome || "Teste SDJ",
    data_aniversario: "2000-01-01"
  };
  return sendReminderMessage(fakePerson, Number(daysBefore) || 7, {
    referenceDate: currentDateIso(),
    ignoreDuplicate: true
  });
}

async function sendNearestUpcomingReminderTest() {
  const preview = previewNearestUpcomingBirthdayReminder({ referenceDate: currentDateIso(), includeToday: false });
  if (!preview.item) {
    return { success: false, error: "Nenhum aniversariante futuro encontrado para teste." };
  }

  const result = await sendReminderMessage(preview.item.person, preview.item.daysBefore, {
    referenceDate: preview.date,
    ignoreDuplicate: true
  });

  return {
    ...result,
    target: preview.item
  };
}

async function sendCurrentMonthSummaryTest() {
  const now = nowTz(config.timezone);
  return sendMonthlySummary({
    month: Number(now.format("MM")),
    referenceDate: now.format("YYYY-MM-DD"),
    ignoreDuplicate: true,
    isTest: true
  });
}

module.exports = {
  renderTemplate,
  buildMonthlyBirthdaysMessage,
  sendMonthlySummary,
  processMonthlySummaryIfNeeded,
  processTodayBirthdays,
  previewUpcomingBirthdayReminders,
  previewNearestUpcomingBirthdayReminder,
  processUpcomingBirthdayReminders,
  sendManualTestMessage,
  sendReminderTestMessage,
  sendNearestUpcomingReminderTest,
  sendCurrentMonthSummaryTest
};

