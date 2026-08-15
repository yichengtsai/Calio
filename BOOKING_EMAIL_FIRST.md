# 預約頁：Email 優先流程

## 流程

1. 訪客打開 `/username` → **先填 email**（名字可選）
2. 後端 `GET /api/public/student-courses?username=&email=` 回傳可預約課程
3. 列表顯示：課程名稱、時長、**剩餘堂數**（需方案的課）、**價錢**（若有設定）
4. 點選課程 → 進入日曆選時段（已帶入 email，需堂數的課不再重填）

## 可預約規則

| 課程類型 | 是否顯示 |
|---------|---------|
| `requiresSessionPackage = true` | 該 email 有 active 方案且剩餘堂數 > 0 |
| `requiresSessionPackage = false` | 一律顯示（公開可約） |

## 價錢

- 在後台 **Event type** 表單可填 **Price** + **Currency**（可選）
- 存於 `EventType.price` / `EventType.currency`
- 列表與預約頁有值才顯示

## 相關檔案

- `components/EventTypePicker.js` — email → 課程列表 → BookingWidget
- `components/BookingWidget.js` — 支援 `initialEmail` / `initialRemainingSessions` 略過 identify
- `app/api/public/student-courses/route.js` — 依 email 查可約課程
- `models/EventType.js` — `price`、`currency`
- `components/EventTypeForm.js` — 後台編輯價錢

## 舊連結

`/username/slug` 仍會導向 `/username?event=slug`；訪客仍需先填 email，若該課在可約列表中會自動進入該課。
