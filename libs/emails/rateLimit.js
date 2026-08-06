// 簡易的記憶體內速率限制。適合單一 Node process 的部署(例如小規模 VPS、本機測試)。
// 如果之後部署到會自動水平擴展的環境(例如 Vercel 的多個 serverless instance),
// 因為每個 instance 記憶體是分開的,這個限制器不會共享狀態,防護效果會打折——
// 到那個規模建議換成 Upstash Redis 這類外部共用儲存的方案。

const buckets = new Map();

/**
 * @param {string} key 限制的對象,通常是 IP 或 IP+動作 的組合
 * @param {number} limit 這個時間窗口內最多允許幾次
 * @param {number} windowMs 時間窗口長度(毫秒)
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const existing = buckets.get(key) || [];
  const recent = existing.filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);

  // 順手清掉太舊的紀錄,避免這個 Map 無限長大吃記憶體
  if (buckets.size > 5000) {
    for (const [k, timestamps] of buckets) {
      if (timestamps.every((t) => now - t > windowMs)) {
        buckets.delete(k);
      }
    }
  }

  return {
    allowed: recent.length <= limit,
    remaining: Math.max(0, limit - recent.length),
  };
}

/**
 * 從 Next.js 的 Request 物件盡量抓出真實的客戶端 IP。
 * 本機開發環境通常抓不到,會回傳 "unknown"——這是正常的,部署到 Vercel 之類的平台後才會有正確的值。
 */
export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
