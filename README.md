# 訪客自助改期

流程：確認信 / 成功頁 → Reschedule 連結 → 選新時段 → 通知雙方、更新 Google（若有）

路徑：
- 頁面 `/booking/[id]/reschedule?token=...`
- API `GET/POST /api/public/bookings/[id]/reschedule`

token 與取消共用 cancelToken。
