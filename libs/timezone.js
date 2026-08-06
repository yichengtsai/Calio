/**
 * 把「某個 IANA 時區裡的某天某個時刻」轉成正確的 UTC Date 物件。
 * 例如 zonedTimeToUtc("2026-08-03", "09:00", "America/New_York")
 * 會正確處理夏令時間,不是簡單加減固定小時數。
 *
 * 原理:先假設這個時刻本身就是 UTC,套用目標時區格式化回去看差了多少,
 * 再用這個差值校正一次,就是該時區在那個時間點的正確 UTC 偏移。
 */
export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(utcGuess).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  const hourVal = parts.hour === "24" ? 0 : Number(parts.hour);

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hourVal,
    Number(parts.minute),
    Number(parts.second)
  );

  const offset = asIfUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

/**
 * 給一個 UTC 時間點,回傳它在某個 IANA 時區裡是星期幾(0=Sun ... 6=Sat)。
 * 這裡我們預期輸入的是像 "2026-08-03" 這樣「已經是該時區的日曆日期」的字串,
 * 所以直接用 UTC 解析日期部分即可,不用再轉一次時區。
 */
export function dayOfWeekForDateStr(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// 預約頁面上,讓「預約人」自己挑時區用的常見清單(先列出來,其餘的時區排在後面)
export const COMMON_TIMEZONES = [
  "Asia/Taipei",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

/**
 * 回傳所有 IANA 時區,常見的排前面,其餘照字母順序接在後面。
 * 環境不支援 Intl.supportedValuesOf 的話(極舊瀏覽器),就退回常見清單。
 */
export function getAllTimezones() {
  try {
    const all = Intl.supportedValuesOf("timeZone");
    const rest = all.filter((tz) => !COMMON_TIMEZONES.includes(tz)).sort();
    return [...COMMON_TIMEZONES, ...rest];
  } catch {
    return COMMON_TIMEZONES;
  }
}

/**
 * 算出某個時區在某個時間點,相對 UTC 差幾分鐘(例如 UTC+8 回傳 480)。
 * 用跟 zonedTimeToUtc 一樣的「格式化回推」技巧,所以夏令時間也會自動正確。
 */
export function getTimezoneOffsetMinutes(timeZone, date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  const hourVal = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hourVal,
    Number(parts.minute),
    Number(parts.second)
  );

  return Math.round((asUTC - date.getTime()) / 60000);
}

// 480 -> "GMT+8", 330 -> "GMT+5:30"
export function formatOffsetLabel(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

// "Asia/Taipei" -> "Taipei (GMT+8)"
export function formatTimezoneLabel(timeZone, date = new Date()) {
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") || timeZone;
  const offset = formatOffsetLabel(getTimezoneOffsetMinutes(timeZone, date));
  return `${city} (${offset})`;
}

// 給一個 UTC 時間點跟目標時區,回傳那個時區當下的「YYYY-MM-DD」日曆日期字串
export function dateStrInTimezone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// 純日曆日期加減天數,不牽涉時區換算,例如 addDaysToDateStr("2026-08-03", -1) -> "2026-08-02"
export function addDaysToDateStr(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
