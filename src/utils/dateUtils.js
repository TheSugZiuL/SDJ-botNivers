const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const [y, m, day] = value.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

function isValidMonthDay(value) {
  const normalized = String(value || "").trim();
  if (!/^\d{2}\/\d{2}$/.test(normalized)) return false;
  const [day, month] = normalized.split("/").map(Number);
  const d = new Date(`2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getMonth() + 1 === month && d.getDate() === day;
}

function normalizeBirthdayDate(value) {
  const raw = String(value || "").trim();
  if (isValidMonthDay(raw)) return raw;
  if (isValidIsoDate(raw)) {
    const [, month, day] = raw.split("-");
    return `${day}/${month}`;
  }
  return null;
}

function getMonthDay(value) {
  const raw = String(value || "").trim();
  if (isValidMonthDay(raw)) {
    const [day, month] = raw.split("/").map(Number);
    return { day, month };
  }
  if (isValidIsoDate(raw)) {
    const [, month, day] = raw.split("-").map(Number);
    return { day, month };
  }
  return null;
}

function nowTz(tz) {
  return dayjs().tz(tz);
}

function formatDateBr(value) {
  if (!value) return "-";
  const normalized = normalizeBirthdayDate(value);
  if (normalized) return normalized;
  const d = dayjs(value);
  return d.isValid() ? d.format("DD/MM/YYYY") : "-";
}

function calculateAge(birthDate, referenceDate) {
  if (!birthDate || !referenceDate) return null;
  if (!isValidIsoDate(birthDate)) return null;
  const birth = dayjs(birthDate);
  const ref = dayjs(referenceDate);
  if (!birth.isValid() || !ref.isValid()) return null;

  let age = ref.year() - birth.year();
  const hadBirthday =
    ref.month() > birth.month() || (ref.month() === birth.month() && ref.date() >= birth.date());
  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function dateParts(referenceDate) {
  const d = dayjs(referenceDate);
  return { dia: d.format("DD"), mes: d.format("MM") };
}

module.exports = {
  dayjs,
  isValidIsoDate,
  isValidMonthDay,
  normalizeBirthdayDate,
  getMonthDay,
  nowTz,
  formatDateBr,
  calculateAge,
  dateParts
};
