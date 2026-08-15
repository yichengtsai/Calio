# 預約 + 堂數（更新）

## 可用堂數公式（P0）

```
可約堂數 = totalSessions - usedSessions - reservedSessions
```

- **used**：上課開始後 cron 已扣的堂數  
- **reserved**：status 為 pending/confirmed、尚未 `sessionDeductedAt` 的預約（佔用額度）  
- 取消 / 拒絕後不再計入 reserved → 堂數自動釋出  

列表 API、單課 balance、建立預約、後台方案列表皆用同一套計算。

## 流程

1. `/username` 上半：教練個人資料  
2. 下半：先填 email → 可約課程（堂數課 / 開放課）  
3. 堂數課顯示「可約 X 堂」與已預約未上  
4. 選時段送出時後端再驗證可約堂數 > 0  

## 相關檔

- `libs/sessions.js`
- `app/api/public/student-courses/route.js`
- `app/api/public/session-balance/route.js`
- `app/api/public/bookings/route.js`
- `app/api/client-packages/route.js`
- `components/EventTypePicker.js`
- `components/BookingWidget.js`
- `components/ClientPackagesManager.js`
