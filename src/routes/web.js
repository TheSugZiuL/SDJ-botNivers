const express = require("express");
const config = require("../config");
const birthdayRepository = require("../services/birthdayRepository");
const templateRepository = require("../services/templateRepository");
const logRepository = require("../services/logRepository");
const birthdayService = require("../services/birthdayService");
const whatsappService = require("../services/whatsappService");
const auditLogRepository = require("../services/auditLogRepository");
const { createPanelAuth } = require("../middleware/panelAuth");
const { normalizeBirthdayDate, nowTz } = require("../utils/dateUtils");

const router = express.Router();
const panelAuth = createPanelAuth(config);

function parseIdParam(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function maskGroupId(groupId) {
  if (!groupId) return "";
  if (groupId.length <= 12) return "***";
  return `${groupId.slice(0, 6)}...${groupId.slice(-6)}`;
}

function redirectWithMessage(res, path, type, message) {
  const params = new URLSearchParams();
  params.set(type, message);
  res.redirect(`${path}?${params.toString()}`);
}

function parseBirthdayForm(body) {
  const data = {
    nome: String(body.nome || "").trim(),
    data_aniversario: String(body.data_aniversario || "").trim(),
    ativo: body.ativo === "on" || body.ativo === "1",
    observacao: String(body.observacao || "").trim(),
    foto_url: String(body.foto_url || "").trim()
  };
  const errors = [];
  if (!data.nome) errors.push("Nome e obrigatorio.");
  const normalizedBirthday = normalizeBirthdayDate(data.data_aniversario);
  data.data_aniversario = normalizedBirthday || data.data_aniversario;
  if (!normalizedBirthday) errors.push("Data invalida. Use DD/MM.");
  if (data.foto_url && !/^https?:\/\/\S+$/i.test(data.foto_url)) errors.push("Foto URL invalida.");
  return { data, errors };
}

function parseTemplateForm(body) {
  const tipo = String(body.tipo || templateRepository.TEMPLATE_TYPES.birthdayToday).trim();
  const data = {
    nome: String(body.nome || "").trim(),
    conteudo: String(body.conteudo || "").trim(),
    tipo,
    ativo: body.ativo === "on" || body.ativo === "1"
  };
  const errors = [];
  if (!Object.values(templateRepository.TEMPLATE_TYPES).includes(tipo)) {
    errors.push("Tipo de template invalido.");
  }
  if (!data.nome) errors.push("Nome do template e obrigatorio.");
  if (!data.conteudo) errors.push("Conteudo do template e obrigatorio.");
  return { data, errors };
}

function safeText(value, max = 200) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function writeAuditLog(req, action, description, details, usernameOverride) {
  try {
    auditLogRepository.create({
      username: usernameOverride || req.user?.username || "anon",
      action,
      description,
      method: req.method,
      path: req.originalUrl || req.path || "/",
      ip: panelAuth.getClientIp(req),
      details: details ? JSON.stringify(details) : null
    });
  } catch (error) {
    console.error("[AUDIT] Falha ao registrar log:", error.message);
  }
}

router.use(panelAuth.attachSession);

router.get("/login", panelAuth.redirectIfAuthenticated, (req, res) => {
  res.render("login", {
    pageTitle: "Login",
    nextUrl: typeof req.query.next === "string" ? req.query.next : ""
  });
});

router.post("/login", panelAuth.redirectIfAuthenticated, (req, res) => {
  const blockState = panelAuth.getLoginBlockState(req);
  if (blockState.blocked) {
    writeAuditLog(req, "auth.login_blocked_ip", "Tentativa de login bloqueada por excesso de falhas", {
      retryAfterSec: blockState.retryAfterSec
    });
    return res.status(429).render("login", {
      pageTitle: "Login",
      nextUrl: typeof req.body.next === "string" ? req.body.next : "",
      error: `Muitas tentativas. Tente novamente em ${blockState.retryAfterSec}s.`
    });
  }

  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const nextUrl = typeof req.body.next === "string" ? req.body.next : "";

  if (!panelAuth.credentialsMatch(username, password)) {
    const failure = panelAuth.recordLoginFailure(req);
    writeAuditLog(
      req,
      "auth.login_failed",
      `Tentativa de login falhou para usuario "${safeText(username || "(vazio)", 60)}"`,
      {
        usernameTried: safeText(username, 60),
        failedCount: failure.count,
        locked: failure.blocked,
        retryAfterSec: failure.retryAfterSec
      },
      username || "desconhecido"
    );
    return res.status(401).render("login", {
      pageTitle: "Login",
      nextUrl,
      error: "Usuario ou senha invalidos."
    });
  }

  panelAuth.recordLoginSuccess(req);
  panelAuth.issueSession(res, username, req);
  req.user = { username };
  res.locals.currentUser = req.user;
  writeAuditLog(req, "auth.login_success", `Login realizado com sucesso por "${username}"`);

  const redirectPath = nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/";
  return res.redirect(redirectPath);
});

router.post("/logout", (req, res) => {
  const username = req.user?.username || "desconhecido";
  panelAuth.clearSession(req, res);
  writeAuditLog(req, "auth.logout", `Logout realizado por "${username}"`, null, username);
  return res.redirect("/login");
});

router.use(panelAuth.requireAuth);

router.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.flashOk = req.query.ok || null;
  res.locals.flashErr = req.query.err || null;
  res.locals.config = {
    cronSchedule: config.cronSchedule,
    timezone: config.timezone,
    groupIdMasked: maskGroupId(config.groupId),
    panelProtected: config.panelAuthEnabled,
    panelIpAllowlistEnabled: config.panelIpAllowlist.length > 0,
    panelSessionMaxAgeSec: config.panelSessionMaxAgeSec,
    panelSessionIdleTimeoutSec: config.panelSessionIdleTimeoutSec,
    panelLoginMaxFailuresPerIp: config.panelLoginMaxFailuresPerIp,
    panelLoginLockoutSec: config.panelLoginLockoutSec,
    reminderDaysBefore: config.reminderDaysBefore
  };
  res.locals.currentUser = req.user || null;
  next();
});

router.get("/", (req, res) => {
  const todayIso = nowTz(config.timezone).format("YYYY-MM-DD");
  res.render("dashboard", {
    pageTitle: "Dashboard",
    stats: {
      totalAniversariantes: birthdayRepository.countAll(),
      totalTemplates: templateRepository.countAll(),
      enviosHoje: logRepository.countToday(todayIso)
    },
    whatsappStatus: whatsappService.getStatus(),
    activeTemplates: {
      birthdayToday: templateRepository.getActive(templateRepository.TEMPLATE_TYPES.birthdayToday),
      birthdayReminder: templateRepository.getActive(templateRepository.TEMPLATE_TYPES.birthdayReminder),
      birthdayReminderD1: templateRepository.getActive(templateRepository.TEMPLATE_TYPES.birthdayReminderD1)
    },
    reminderPreview: birthdayService.previewUpcomingBirthdayReminders({ referenceDate: todayIso }),
    todayIso
  });
});

router.get("/aniversariantes", (req, res) => {
  res.render("aniversariantes/index", {
    pageTitle: "Aniversariantes",
    items: birthdayRepository.listAll()
  });
});

router.get("/aniversariantes/novo", (req, res) => {
  res.render("aniversariantes/form", {
    pageTitle: "Novo Aniversariante",
    formMode: "create",
    item: { nome: "", data_aniversario: "", observacao: "", foto_url: "", ativo: 1 },
    errors: []
  });
});

router.post("/aniversariantes", (req, res) => {
  const { data, errors } = parseBirthdayForm(req.body);
  if (errors.length) {
    writeAuditLog(req, "birthday.create_failed", "Falha ao criar aniversariante por validacao", {
      nome: safeText(data.nome, 100),
      errors
    });
    return res.status(400).render("aniversariantes/form", {
      pageTitle: "Novo Aniversariante",
      formMode: "create",
      item: data,
      errors
    });
  }
  const created = birthdayRepository.create(data);
  writeAuditLog(req, "birthday.create", `Criou aniversariante #${created.id} (${safeText(created.nome, 100)})`, {
    id: created.id,
    nome: safeText(created.nome, 100)
  });
  return redirectWithMessage(res, "/aniversariantes", "ok", "Aniversariante cadastrado.");
});

router.get("/aniversariantes/:id/editar", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!id) return redirectWithMessage(res, "/aniversariantes", "err", "ID invalido.");
  const item = birthdayRepository.findById(id);
  if (!item) return redirectWithMessage(res, "/aniversariantes", "err", "Cadastro nao encontrado.");
  return res.render("aniversariantes/form", {
    pageTitle: "Editar Aniversariante",
    formMode: "edit",
    item,
    errors: []
  });
});

router.post("/aniversariantes/:id", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!id) return redirectWithMessage(res, "/aniversariantes", "err", "ID invalido.");
  const existing = birthdayRepository.findById(id);
  if (!existing) return redirectWithMessage(res, "/aniversariantes", "err", "Cadastro nao encontrado.");

  const { data, errors } = parseBirthdayForm(req.body);
  if (errors.length) {
    writeAuditLog(req, "birthday.update_failed", `Falha ao atualizar aniversariante #${id} por validacao`, {
      id,
      nome: safeText(data.nome, 100),
      errors
    });
    return res.status(400).render("aniversariantes/form", {
      pageTitle: "Editar Aniversariante",
      formMode: "edit",
      item: { ...data, id },
      errors
    });
  }
  const updated = birthdayRepository.update(id, data);
  writeAuditLog(req, "birthday.update", `Atualizou aniversariante #${id} (${safeText(updated?.nome, 100)})`, {
    id,
    nome: safeText(updated?.nome, 100)
  });
  return redirectWithMessage(res, "/aniversariantes", "ok", "Aniversariante atualizado.");
});

router.post("/aniversariantes/:id/excluir", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!id) return redirectWithMessage(res, "/aniversariantes", "err", "ID invalido.");
  const existing = birthdayRepository.findById(id);
  birthdayRepository.remove(id);
  writeAuditLog(req, "birthday.delete", `Excluiu aniversariante #${id} (${safeText(existing?.nome, 100) || "desconhecido"})`, {
    id,
    nome: safeText(existing?.nome, 100)
  });
  return redirectWithMessage(res, "/aniversariantes", "ok", "Aniversariante excluido.");
});

router.get("/templates", (req, res) => {
  res.render("templates/index", {
    pageTitle: "Templates",
    items: templateRepository.listAll()
  });
});

router.get("/templates/novo", (req, res) => {
  res.render("templates/form", {
    pageTitle: "Novo Template",
    formMode: "create",
    item: { nome: "", conteudo: "", tipo: templateRepository.TEMPLATE_TYPES.birthdayToday, ativo: 0 },
    errors: []
  });
});

router.post("/templates", (req, res) => {
  const { data, errors } = parseTemplateForm(req.body);
  if (errors.length) {
    writeAuditLog(req, "template.create_failed", "Falha ao criar template por validacao", {
      nome: safeText(data.nome, 80),
      errors
    });
    return res.status(400).render("templates/form", {
      pageTitle: "Novo Template",
      formMode: "create",
      item: data,
      errors
    });
  }
  const created = templateRepository.create(data);
  writeAuditLog(req, "template.create", `Criou template #${created.id} (${safeText(created.nome, 80)})`, {
    id: created.id,
    nome: safeText(created.nome, 80),
    ativo: Boolean(created.ativo)
  });
  return redirectWithMessage(res, "/templates", "ok", "Template salvo.");
});

router.get("/templates/:id/editar", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!id) return redirectWithMessage(res, "/templates", "err", "ID invalido.");
  const item = templateRepository.findById(id);
  if (!item) return redirectWithMessage(res, "/templates", "err", "Template nao encontrado.");
  return res.render("templates/form", {
    pageTitle: "Editar Template",
    formMode: "edit",
    item,
    errors: []
  });
});

router.post("/templates/:id", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!id) return redirectWithMessage(res, "/templates", "err", "ID invalido.");
  if (!templateRepository.findById(id)) {
    return redirectWithMessage(res, "/templates", "err", "Template nao encontrado.");
  }
  const { data, errors } = parseTemplateForm(req.body);
  if (errors.length) {
    writeAuditLog(req, "template.update_failed", `Falha ao atualizar template #${id} por validacao`, {
      id,
      nome: safeText(data.nome, 80),
      errors
    });
    return res.status(400).render("templates/form", {
      pageTitle: "Editar Template",
      formMode: "edit",
      item: { ...data, id },
      errors
    });
  }
  const updated = templateRepository.update(id, data);
  writeAuditLog(req, "template.update", `Atualizou template #${id} (${safeText(updated?.nome, 80)})`, {
    id,
    nome: safeText(updated?.nome, 80),
    ativo: Boolean(updated?.ativo)
  });
  return redirectWithMessage(res, "/templates", "ok", "Template atualizado.");
});

router.post("/templates/:id/ativar", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!id) return redirectWithMessage(res, "/templates", "err", "ID invalido.");
  if (!templateRepository.findById(id)) {
    return redirectWithMessage(res, "/templates", "err", "Template nao encontrado.");
  }
  const activated = templateRepository.activate(id);
  writeAuditLog(req, "template.activate", `Ativou template #${id} (${safeText(activated?.nome, 80)})`, {
    id,
    nome: safeText(activated?.nome, 80)
  });
  return redirectWithMessage(res, "/templates", "ok", "Template ativado.");
});

router.post("/templates/:id/excluir", (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!id) return redirectWithMessage(res, "/templates", "err", "ID invalido.");
  if (!templateRepository.findById(id)) {
    return redirectWithMessage(res, "/templates", "err", "Template nao encontrado.");
  }
  const existing = templateRepository.findById(id);
  templateRepository.remove(id);
  writeAuditLog(req, "template.delete", `Excluiu template #${id} (${safeText(existing?.nome, 80)})`, {
    id,
    nome: safeText(existing?.nome, 80)
  });
  return redirectWithMessage(res, "/templates", "ok", "Template excluido.");
});

router.post("/enviar-teste", async (req, res) => {
  try {
    const nomeTeste = String(req.body.nome_teste || "Teste SDJ").trim();
    const result = await birthdayService.sendManualTestMessage(nomeTeste);
    if (!result.success) {
      writeAuditLog(req, "send.test_failed", "Falha ao enviar teste manual", {
        nomeTeste: safeText(nomeTeste, 80),
        error: safeText(result.error, 160)
      });
      return redirectWithMessage(res, "/", "err", `Falha no teste: ${result.error}`);
    }
    writeAuditLog(req, "send.test", `Enviou teste manual para grupo "${safeText(result.groupName, 120)}"`, {
      nomeTeste: safeText(nomeTeste, 80),
      grupo: safeText(result.groupName, 120)
    });
    return redirectWithMessage(res, "/", "ok", `Teste enviado para "${result.groupName}".`);
  } catch (error) {
    writeAuditLog(req, "send.test_error", "Erro ao enviar teste manual", {
      error: safeText(error.message, 160)
    });
    return redirectWithMessage(res, "/", "err", `Erro no teste: ${error.message}`);
  }
});

router.post("/enviar-lembrete-teste", async (req, res) => {
  try {
    const nomeTeste = String(req.body.nome_teste || "Teste SDJ").trim();
    const diasLembrete = Number(req.body.dias_lembrete || 7);
    const result = await birthdayService.sendReminderTestMessage(nomeTeste, diasLembrete);
    if (!result.success) {
      writeAuditLog(req, "send.reminder_test_failed", "Falha ao enviar lembrete de teste", {
        nomeTeste: safeText(nomeTeste, 80),
        diasLembrete,
        error: safeText(result.error, 160)
      });
      return redirectWithMessage(res, "/", "err", `Falha no lembrete de teste: ${result.error}`);
    }
    writeAuditLog(req, "send.reminder_test", "Enviou lembrete de teste", {
      nomeTeste: safeText(nomeTeste, 80),
      diasLembrete,
      grupo: safeText(result.groupName, 120)
    });
    return redirectWithMessage(res, "/", "ok", `Lembrete D-${diasLembrete} enviado para "${result.groupName}".`);
  } catch (error) {
    writeAuditLog(req, "send.reminder_test_error", "Erro ao enviar lembrete de teste", {
      error: safeText(error.message, 160)
    });
    return redirectWithMessage(res, "/", "err", `Erro no lembrete de teste: ${error.message}`);
  }
});

router.post("/enviar-lembrete-proximo-teste", async (req, res) => {
  try {
    const result = await birthdayService.sendNearestUpcomingReminderTest();
    if (!result.success) {
      writeAuditLog(req, "send.reminder_nearest_test_failed", "Falha ao enviar lembrete de teste do proximo aniversariante", {
        error: safeText(result.error, 160)
      });
      return redirectWithMessage(res, "/", "err", `Falha no teste do proximo aniversariante: ${result.error}`);
    }

    writeAuditLog(req, "send.reminder_nearest_test", "Enviou lembrete de teste do proximo aniversariante", {
      nome: safeText(result.target?.person?.nome, 100),
      diasFaltam: result.target?.daysBefore,
      aniversario: result.target?.birthdayDateBr,
      grupo: safeText(result.groupName, 120)
    });

    return redirectWithMessage(
      res,
      "/",
      "ok",
      `Teste enviado: ${result.target.person.nome} (D-${result.target.daysBefore}, aniversario em ${result.target.birthdayDateBr}).`
    );
  } catch (error) {
    writeAuditLog(req, "send.reminder_nearest_test_error", "Erro ao enviar lembrete de teste do proximo aniversariante", {
      error: safeText(error.message, 160)
    });
    return redirectWithMessage(res, "/", "err", `Erro no teste do proximo aniversariante: ${error.message}`);
  }
});

router.post("/enviar-resumo-mensal-teste", async (req, res) => {
  try {
    const result = await birthdayService.sendCurrentMonthSummaryTest();
    if (!result.success) {
      writeAuditLog(req, "send.monthly_summary_test_failed", "Falha ao enviar resumo mensal de teste", {
        month: result.month,
        error: safeText(result.error, 160)
      });
      return redirectWithMessage(res, "/", "err", `Falha no resumo mensal: ${result.error}`);
    }
    writeAuditLog(req, "send.monthly_summary_test", "Enviou resumo mensal de teste", {
      month: result.month,
      grupo: safeText(result.groupName, 120),
      totalFound: result.totalFound
    });
    return redirectWithMessage(
      res,
      "/",
      "ok",
      `Resumo mensal (${String(result.month).padStart(2, "0")}) enviado para "${result.groupName}".`
    );
  } catch (error) {
    writeAuditLog(req, "send.monthly_summary_test_error", "Erro ao enviar resumo mensal de teste", {
      error: safeText(error.message, 160)
    });
    return redirectWithMessage(res, "/", "err", `Erro no resumo mensal: ${error.message}`);
  }
});

router.post("/executar-agora", async (req, res) => {
  try {
    const reminders = await birthdayService.processUpcomingBirthdayReminders();
    const result = await birthdayService.processTodayBirthdays();
    writeAuditLog(req, "scheduler.run_now", "Executou verificacao manual de aniversarios e lembretes", {
      totalFound: result.totalFound,
      remindersFound: reminders.totalFound,
      remindersSent: reminders.totalSent,
      date: result.date
    });
    return redirectWithMessage(
      res,
      "/",
      "ok",
      `Verificacao executada. Lembretes: ${reminders.totalSent}/${reminders.totalFound}. Aniversarios hoje: ${result.totalFound}.`
    );
  } catch (error) {
    writeAuditLog(req, "scheduler.run_now_error", "Erro ao executar verificacao manual", {
      error: safeText(error.message, 160)
    });
    return redirectWithMessage(res, "/", "err", `Erro ao executar: ${error.message}`);
  }
});

router.post("/executar-lembretes-agora", async (req, res) => {
  try {
    const ignoreDuplicate = req.body.ignore_duplicate === "1";
    const reminders = await birthdayService.processUpcomingBirthdayReminders({ ignoreDuplicate });
    writeAuditLog(req, "scheduler.run_reminders_now", "Executou manualmente apenas lembretes antecipados", {
      remindersFound: reminders.totalFound,
      remindersSent: reminders.totalSent,
      ignoreDuplicate
    });
    return redirectWithMessage(
      res,
      "/",
      "ok",
      `Lembretes executados (${ignoreDuplicate ? "modo teste" : "normal"}): ${reminders.totalSent}/${reminders.totalFound}.`
    );
  } catch (error) {
    writeAuditLog(req, "scheduler.run_reminders_now_error", "Erro ao executar lembretes manualmente", {
      error: safeText(error.message, 160)
    });
    return redirectWithMessage(res, "/", "err", `Erro ao executar lembretes: ${error.message}`);
  }
});

router.get("/logs", (req, res) => {
  writeAuditLog(req, "panel.view_send_logs", "Visualizou logs de envio");
  res.render("logs/index", {
    pageTitle: "Logs",
    items: logRepository.listRecent(200)
  });
});

router.get("/grupos", async (req, res) => {
  try {
    const groups = await whatsappService.listGroups();
    writeAuditLog(req, "whatsapp.groups_list", "Listou grupos do WhatsApp no painel", {
      totalGroups: groups.length
    });
    return res.render("groups/index", { pageTitle: "Grupos WhatsApp", groups, error: null });
  } catch (error) {
    writeAuditLog(req, "whatsapp.groups_list_error", "Falha ao listar grupos do WhatsApp", {
      error: safeText(error.message, 160)
    });
    return res.render("groups/index", { pageTitle: "Grupos WhatsApp", groups: [], error: error.message });
  }
});

router.get("/auditoria", (req, res) => {
  writeAuditLog(req, "panel.view_audit_logs", "Visualizou logs de auditoria");
  res.render("auditoria/index", {
    pageTitle: "Auditoria do Painel",
    items: auditLogRepository.listRecent(300)
  });
});

module.exports = router;
