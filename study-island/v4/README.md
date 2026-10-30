# 觀護學習島 v4｜可玩 Demo A

依《觀護學習島 v4 開發規格書》第九節「第一個實作切片」實作。**這是獨立預覽，不是正式上線功能**；未整合到正式首頁、PWA 離線清單或備份中心。

## 本切片包含

- 20×16 原創小島（小屋、廣場、小路、樹林、沙灘、海），Canvas 繪製、格子碰撞；地表不畫方格線，海岸是柔和曲線。
- 玩家角色：點地面以 A* 自動尋路繞過房屋、樹、岩石與居民；WASD／方向鍵；可開啟的螢幕方向鍵。撞到障礙時顯示紅色 × 與一句提示。
- 居民栗子：在廣場東邊小範圍散步，頭上有「！」；點牠（或靠近按 E／「互動」）就走過去聊天。玩家走過去時栗子會停下。
- 海灘 3 個貝殼，依本機日期每天重新出現；拾取時有「+1 🐚」動畫。
- 背包：4 類材料（Demo A 只開放貝殼）、1 件新手木凳、3 種衣服顏色。
- 「任務」顯示今日遊戲委託進度；「建造」說明下一階段開放。
- 存檔：IndexedDB `probation-study-island-v4`。保存位置（角色停下後）、背包、當日採集紀錄、對話紀錄。

## 試玩

```bash
python3 -m http.server 8790   # 在儲存庫根目錄
```

開啟 `http://localhost:8790/study-island/v4/`。

| 操作 | 手機 | 電腦 |
| --- | --- | --- |
| 移動 | 點地面；或按右下 ✥ 開方向鍵 | WASD／方向鍵、點地面 |
| 互動 | 點居民／貝殼，或底部「互動」 | E（Enter／空白鍵亦可） |
| 背包／任務／建造 | 底部三個按鈕 | B（或 I）／T／C |
| 關閉 | ✕ 按鈕 | Esc |

## 資料保全設計

- 撿貝殼：在**同一個 IndexedDB readwrite 交易**內「讀最新存檔 → 檢查今天是否撿過 → 加入背包 → 寫回」。交易 commit 後才顯示入袋；失敗時提示「沒有放進背包」並顯示橫幅。
- 多分頁：IndexedDB 會將 readwrite 交易排隊，所以兩個分頁同時撿同一個貝殼只有一邊成功；另以 BroadcastChannel 通知其他分頁更新數字。
- 無法使用 IndexedDB（例如某些無痕模式）：遊戲照常可玩，但頂部顯示警告，拾取提示會加上「（未保存）」，不假裝已永久保存。
- **不讀寫** `localStorage["probationStudyIsland.v1"]`（v3 小島）、`study-desk/`、`v2.5/`、`lectures/` 或任何考古題資料。唯一的 localStorage 是「方向鍵是否顯示」這個介面偏好。
- 不同網域（Vercel 預覽與 GitHub Pages）存檔不互通。

## 程式結構

```text
study-island/v4/
  index.html  style.css
  src/world/map.js          地圖、地表、碰撞
  src/player/pathfinding.js 4 方向 A*
  src/npc/dialogue.js       居民資料、原創對話、散步
  src/collectibles.js       每日採集點
  src/inventory.js          材料與家具
  src/state.js              存檔格式、正規化、所有會改存檔的動作（純函式）
  src/persistence.js        IndexedDB 交易與記憶體後備
  src/render.js             Canvas 繪製（原創向量圖形）
  src/ui.js                 HUD、對話框、抽屜
  src/main.js               輸入、移動、遊戲迴圈接線
  tests/logic.test.mjs      Node 單元測試（已加入 npm test）
  tests/e2e.mjs             Playwright 瀏覽器驗收
```

繪製迴圈只在移動或動畫時以 requestAnimationFrame 執行；閒置時降到約 8 FPS（貝殼閃光），開啟「減少動態效果」時完全停止並停止居民散步。切回分頁時重設計時，角色不會瞬移。

## 測試結果（2026-10-30）

- [x] `npm test`：31/31 通過（含 13 項 v4 單元測試：地圖尺寸與障礙、A* 繞過小屋、貝殼每日去重、存檔正規化、居民範圍）。
- [x] `tests/e2e.mjs`（Chromium 模擬 iPhone 13 375px 寬與 1280px 桌面）14/14 通過，連續多次執行穩定：
  首次進入、375px 不水平溢出、點地繞過小屋、點房屋有提示、點栗子走到旁邊並對話、撿 3 個貝殼、背包開關、重新整理後貝殼與位置保留、兩分頁同時撿只成功一次、連點互動不重複入袋、方向鍵不遮住底部按鈕、不讀寫其他資料、桌面 WASD／E／B／Esc、沒有 JS 錯誤。
- [ ] **真實 iPhone Safari／Android Chrome 實機**：尚未驗收（模擬器不能取代）。
- [ ] 手機 30 FPS：尚未實測。

執行瀏覽器測試：

```bash
python3 -m http.server 8790 &
node study-island/v4/tests/e2e.mjs http://localhost:8790/study-island/v4/
```

## 尚未實作（依規格書後續階段）

其他 3 位居民、森林採集（木材／葉子／果實）、工坊與家具擺放、遊戲委託獎勵、專注計時與學習任務、JSON 匯出／匯入、v3 舊島花園遷移。
