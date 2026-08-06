/**
 * 把字串裡會被瀏覽器/信箱當成 HTML 標籤解析的字元換成安全的實體字元。
 * 任何要塞進 email HTML 樣板裡的使用者輸入(標題、備註、姓名...)都要先過這一層,
 * 不然有人在欄位裡填 <script> 或 <img onerror=...> 這種東西,會直接被嵌進寄出去的信件。
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 給 <a href="..."> 用的網址檢查:只允許 http/https 開頭,避免 javascript: 這類危險協定被塞進連結。
 * 通過檢查回傳逸出過的網址,沒通過回傳空字串(呼叫端就不會渲染這個連結)。
 */
export function safeUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  return escapeHtml(url);
}
