# 效能優化說明

## 問題
1. 側邊欄每次切頁都打 `/api/bookings` 拉**全部**預約只為了算 pending 數字
2. DashboardHub 再打一次完整 bookings
3. GET /api/bookings 先跑完「過期清理」才回傳，拖慢列表
4. 無 limit、無 lean
5. EventType model 每次 import 刪除重註冊（極慢）

## 改動
| 檔案 | 內容 |
|------|------|
| `app/api/bookings/pending-count/route.js` | 輕量 count only |
| `app/api/bookings/route.js` | lean + limit + select；expiry 非阻塞 |
| `components/DashboardNav.js` | 改打 pending-count，只掛載時一次 |
| `components/DashboardHub.js` | 同上 |
| `models/EventType.js` | 不再每次 delete model |
| `models/Booking.js` | 加 organizer+status index |
| `next.config.js` | optimizePackageImports |

部署後切 dashboard 分頁應明顯較快。
