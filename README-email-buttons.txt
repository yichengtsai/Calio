放置

libs/emails/bookingConfirmation.js  <- bookingConfirmation.js
app/booking/[id]/cancel/page.js     <- cancel-page.js
app/booking/[id]/reschedule/page.js <- reschedule-page.js（可選）

確認信裡 Reschedule = 紫色實心按鈕、Cancel = 紅框白底按鈕。
新預約後才會用到新模板；舊信不會變。

加速：取消頁改為骨架屏，避免只有轉圈；真正瓶頸多半是 API／資料庫冷啟動。
