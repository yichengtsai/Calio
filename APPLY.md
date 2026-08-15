# 強制套用（請完整照做）

## 1. 找到「正在跑 localhost:3000」的那個資料夾

在跑 dev 的終端機看路徑，例如：
cd ~/xxx/Calio
npm run dev

下面說的「專案根目錄」= 有 package.json 的那層。

## 2. 確認舊檔內容（套用前）

在專案根目錄執行：

grep -n "請先輸入 Email" components/EventTypePicker.js
grep -n "student-courses" components/EventTypePicker.js

若都沒有結果 = 還是舊檔。

## 3. 覆蓋檔案

解壓後，把 Calio-patch 裡的檔案對應覆蓋到專案根目錄：

components/EventTypePicker.js
components/BookingWidget.js
components/EventTypeForm.js
app/[username]/page.js
app/api/event-types/route.js
app/api/event-types/[id]/route.js
models/EventType.js

並「新建」：
app/api/public/student-courses/route.js

注意：不要只把整個 Calio-patch 資料夾丟進去，
而是把裡面的路徑對齊專案根目錄覆蓋。

## 4. 清快取並重啟（很重要）

在專案根目錄：

# 停掉 npm run dev（Ctrl+C）
rm -rf .next
npm run dev

瀏覽器用無痕視窗開：
http://localhost:3000/onlif-7lu

## 5. 成功的樣子

上面：教練個人資料（頭像、名字…）
下面：大標題「請先輸入 Email 才能預約」
       不會直接出現課程列表

## 6. 再確認一次

grep -n "請先輸入 Email" components/EventTypePicker.js

應該會印出一行行號。
