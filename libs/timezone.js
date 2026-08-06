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
