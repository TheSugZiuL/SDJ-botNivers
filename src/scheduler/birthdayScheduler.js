const cron = require("node-cron");
const config = require("../config");
const birthdayService = require("../services/birthdayService");

let task;

function startBirthdayScheduler() {
  if (task) return task;

  task = cron.schedule(
    config.cronSchedule,
    async () => {
      console.log(`[Scheduler] Rodando verificacao de aniversarios em ${new Date().toISOString()}`);
      try {
        const monthly = await birthdayService.processMonthlySummaryIfNeeded();
        if (monthly && monthly.success) {
          console.log(
            `[Scheduler] Resumo mensal enviado (${monthly.month}). Total no mes: ${monthly.totalFound}.`
          );
        } else if (monthly && monthly.skipped) {
          console.log(`[Scheduler] Resumo mensal ignorado: ${monthly.reason}`);
        }
        const reminders = await birthdayService.processUpcomingBirthdayReminders();
        console.log(
          `[Scheduler] Lembretes antecipados: encontrados ${reminders.totalFound}, enviados ${reminders.totalSent}.`
        );
        const result = await birthdayService.processTodayBirthdays();
        console.log(`[Scheduler] Encontrados ${result.totalFound} aniversariantes. Finalizado.`);
      } catch (error) {
        console.error("[Scheduler] Erro:", error.message);
      }
    },
    { timezone: config.timezone }
  );

  console.log(`[Scheduler] Agendado: ${config.cronSchedule} (${config.timezone})`);
  return task;
}

module.exports = { startBirthdayScheduler };
