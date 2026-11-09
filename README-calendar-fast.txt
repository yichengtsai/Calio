日曆載入加速（兩段式）

問題：/api/schedule 會等 Google API 才回傳，日曆一直轉圈。
解法：
  1) 先抓 ?local=1（只查 Mongo）→ 立刻畫出預約／忙碌
  2) 再抓完整 schedule（含 Google）→ 合併綠標 Google 事件

覆蓋：
  app/api/schedule/route.js  <- schedule-route.js
  components/CalendarView.js

預期：日曆骨架很快消失，接近切換 Bookings 的速度；Google 事件可能晚 0.5–2 秒補上。
