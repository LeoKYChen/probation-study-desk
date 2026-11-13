# 觀護人學習平臺 — iOS / Android 封裝

## 範圍

本目錄只把 [既有觀護人學習平臺](https://leokychen.github.io/probation-study-desk/) 封裝為 iOS / Android App。
**不重設計介面、不新增帳號、不啟用雲端同步、不變更題庫或正式站**。網站原始碼仍位於儲存庫根目錄。

開發中的 App 與 Safari / Chrome / GitHub Pages 使用不同儲存來源。**原本的 IndexedDB / localStorage 學習紀錄不會自動搬入 App**，必須先使用既有 JSON 匯出及各模組相容的匯入功能，且在真機驗收後才能視為完成遷移。不要以清除網站資料的方式測試。

## 本機建置（Capacitor 8）

需 Node.js 22+。iOS 建置需 macOS 與 Xcode；Android 建置需 Android Studio、Android SDK。

```sh
cd mobile-app
npm install
npm run build:web       # 將既有網站靜態資源複製到 www/
npx cap add ios         # macOS
npx cap add android
npx cap sync
npx cap open ios        # 使用 Xcode 建置與真機測試
npx cap open android    # 使用 Android Studio 建置與真機測試
```

每次網站程式更新後：
```sh
cd mobile-app
npm run sync
```

`www/` 為生成資料，不提交到 Git；`capacitor.config.json` 的 package ID 為開發用預設值，上架前必須由開發者確認、設定正式簽署與商店識別資訊。首次 `cap add` 生成的 iOS / Android 原生專案，應在本分支完成實機驗收後納入版本控管。

## 必須驗證（尚未完成）

- 首頁、六大入口、子頁導覽、題庫載入，以及本機與外部連結
- 每日 30 分鐘、進度月曆、跨頁作答與返回指定題目
- 備考書桌、函授進度及 v2.5 的 IndexedDB / localStorage 寫入、重啟持久化
- JSON 匯出、匯入、Markdown 及 PDF / 列印（原生 WebView 行為可能不同）
- 離線使用（App 內含靜態資源；Service Worker 不應被當作所有原生平台必然支援）
- iOS WebKit 與 Android WebView 真機測試、備份及升級時資料不遺失
- 隱私政策、授權聲明、商店素材、簽署憑證及商店審核

Apple App Store 4.2 有最低功能要求；單純 WebView 容器不保證過審。若需要修改，應限於通過平台審核與維持現有功能必需的最小範圍。

## 版權與隱私

專案中可合法授權的原創程式碼依 GPL-3.0-only；第三方教材、考題與圖片需獨立確認使用權限。不得將個人學習備份、機密資料、簽署金鑰或密碼提交到儲存庫。正式發行要提供相應授權資訊及公開原始碼取得方式。

技術依據：
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/ios
- https://developer.apple.com/app-store/review/guidelines/
