# Calio Phase A+B — 套用到本機 ship-fast

目標目錄：`C:\Users\yiche\Desktop\work_to_github\ship-fast`

## 怎麼套用

在 **PowerShell** 裡：

```powershell
# 1. 先備份（建議）
cd C:\Users\yiche\Desktop\work_to_github\ship-fast
git status
git checkout -b feature/calendar-sync-rules

# 2. 把這個資料夾裡的檔案覆蓋到專案（路徑結構已對齊）
# 假設你把解壓後的 calio-phase-ab 放在 Downloads：
$src = "$env:USERPROFILE\Downloads\calio-phase-ab"
$dst = "C:\Users\yiche\Desktop\work_to_github\ship-fast"

# 複製（覆蓋）
Get-ChildItem -Path $src -Recurse -File | Where-Object { $_.Name -ne "README_APPLY.md" } | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length + 1)
  $target = Join-Path $dst $rel
  $dir = Split-Path $target -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item $_.FullName $target -Force
  Write-Host "Updated $rel"
}
```

或手動把下列檔案覆蓋到對應路徑即可。

## 包含檔案

- models/EventType.js, User.js, Booking.js
- libs/auth.js, googleCalendar.js, slots.js
- app/api/public/availability/route.js
- app/api/public/bookings/route.js
- app/api/bookings/[id]/route.js
- app/api/event-types/route.js, [id]/route.js
- app/api/account/calendars/route.js  ← 新檔
- components/EventTypeForm.js, AccountSettingsForm.js, EventTypePicker.js
- app/[username]/page.js

## 套用後

1. 重啟 dev server（Mongoose schema 有快取）
2. 既有使用者需**重新登入 Google**一次，才會拿到 `calendar.readonly`（多日曆 Free/Busy）
3. Settings 裡可勾選要算進忙碌的日曆（Pro）
4. Event Type 可設 buffer / 最遠天數 / 每日上限 / location type

## 功能摘要

- 多日曆 Free/Busy 合併
- 預約確認寫入 Google（opaque 忙碌）+ 可選 Google Meet
- bookingWindowDays、maxBookingsPerDay、buffer、minimum notice
