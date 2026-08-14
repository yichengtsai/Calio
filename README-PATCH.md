# Calio patch — 提醒信 + 緩衝時間

## 郵件提醒（預約）

Event Type 的 **Email reminder = N 分鐘**：
在**該筆已確認預約開始前 N 分鐘**寄出。

- **預約人**：一定寄
- **主辦人**：也會寄（subject 前綴 `[Host]`）

需 cron 定期打 `/api/cron/reminders`。

會議（Event）的 reminder 仍寄給該會議的所有參與者。

## 緩衝時間（Buffer）

Event Type 的 bufferMinutes：這筆預約**前後各留空**。

用於：
1. **預約頁空檔**（`libs/slots.js`）：忙碌區間（其他預約、會議、block、Google）前後各擴大 buffer，再套 duration 整段檢查
2. **送出／同意／改期預約**：`findInternalConflicts(..., bufferMinutes)`
3. **建立／改時間會議**：用主辦人所有活動類型的 **最大 buffer**，避免會議貼著預約

例：30 分活動、buffer 15、已有 16:00–16:30 預約  
→ 有效忙碌約 15:45–16:45 → 15:30–16:00、16:30–17:00 都不會放出。

## 必覆蓋檔

```
libs/slots.js
libs/conflicts.js
libs/reminders.js
app/api/public/availability/route.js
app/api/public/availability/month/route.js
app/api/public/bookings/route.js
app/api/public/bookings/[id]/reschedule/route.js
app/api/bookings/[id]/route.js
app/api/events/route.js
app/api/events/[id]/route.js
components/EventTypeForm.js
```
