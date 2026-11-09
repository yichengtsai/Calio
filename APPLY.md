# 側邊欄第一次切頁加速（patch）

## 改了什麼

### `components/DashboardNav.js`
- 進入 dashboard 後用 `router.prefetch()` **背景預抓**所有側邊欄 route 的 RSC payload（`requestIdleCallback`，不搶首屏）。
- Link `onMouseEnter` 再補一次 prefetch（idle 還沒跑完時的雙保險）。
- 原有的 `prefetch={true}`、pending-count 邏輯保留。

### `app/dashboard/loading.js`
- 骨架畫面稍微完整一點，切 route 時較不會「空白一頓」。

## 怎麼套用

把 zip 裡的檔案覆蓋到專案對應路徑：

```
components/DashboardNav.js
app/dashboard/loading.js
```

然後重新 build / 部署即可。

## 預期效果

- 進 dashboard **約 0.2～1.5 秒後**，側邊欄其他分頁的資料已在背景預抓。
- 之後「第一次」點 Insights / Packages / Guide / Settings 會明顯比較接近第二次的速度。
- 若某個頁本身 server 端查 DB 很重（例如 Guide 一次查 bookings + events + blocks），預抓只能提前做這件事，**不能讓 DB 變快**；若仍覺得慢，要再優化該 page 的資料查詢。

## 沒改的部分

- 翻譯（`translate="no"` / `notranslate`）維持不動，避免 Google 翻譯弄壞 React DOM。
- DashboardHub 內的 tab（calendar / bookings / event-types）本來就用 `mountedTabs` 保留掛載，這次沒動。
