// 免費版 vs Pro 版實際的功能差異,定義在這一個檔案裡,
// 這樣後端限制(event-types 數量上限、Google Calendar 同步開關)
// 跟 pricing 頁面上寫的文案才不會兩邊各自維護、慢慢兜不起來。

// 免費版最多可以開幾個 event type(預約頁上的「活動類型」,例如 "30 分鐘會議"、"諮詢電話")
export const FREE_EVENT_TYPE_LIMIT = 1;

/**
 * 這個使用者能不能用 Google Calendar 雙向同步(即時忙碌檢查 + 寫入行事曆)。
 * 目前規則很單純:User.hasAccess 由 Stripe webhook 控制(訂閱中 = true)。
 */
export function canUseGoogleCalendarSync(user) {
  return Boolean(user?.hasAccess);
}

/**
 * 這個使用者還能不能再新增一個 event type。
 * @param {Object} user
 * @param {number} currentCount 使用者目前已有的 event type 數量
 */
export function canCreateEventType(user, currentCount) {
  if (user?.hasAccess) return true;
  return currentCount < FREE_EVENT_TYPE_LIMIT;
}
