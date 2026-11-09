# P141 多語導覽系統 — Web Version V0.001

導遊建立群組、遊客透過 QR Code／連結加入，收聽導遊原音。每位遊客獨立選擇關閉字幕、中文原文或英文翻譯；未來增加已驗證語言。P104 不受本專案修改。

## 本版可操作內容

- 零雲端費用的分頁示範：建群、QR／連結、個人字幕開關、中文／英文、需求彙總、最後一人取消後歸零、離線租約回收、結束群組。
- QR Code 在本機產生，不將邀請連結送至外部產圖服務。
- 示範文字是內建範例，**不是語音辨識或即時 AI 翻譯**。示範沒有語音傳輸；麥克風按鈕只測本機裝置許可。
- 示範只支援同一來源、同一瀏覽器儲存分區內的多個分頁，**不能以它驗收跨手機入群**。分頁示範不具備真實服務的授權安全界線。
- 已有 Supabase RPC／LiveKit 前端接線模組；未部署後端前，雲端功能不完整，不宣稱可正式導覽。

## 啟動與驗證

需要 Node.js 22 以上；網站本身為靜態 HTML/CSS/JS，沒有前端框架或建置需求。

```text
npm ci --ignore-scripts
npm run vendor
npm test
npm run check
npm run dev
```

開啟 http://127.0.0.1:4173 ，按「建立示範群組」，再按「開啟遊客示範分頁」。可開兩個遊客分頁，分別選中文與英文，回導遊分頁傳送範例；逐一關閉字幕，觀察需求歸零。

瀏覽器套件版本以 package-lock.json 固定；vendor/ 已附瀏覽器執行檔，可直接作靜態預覽。測試或安裝不會開通 AI 付費帳戶。

## 雲端接線

確認 P141 專用 LiveKit Project 與可沿用的 Supabase Project，依 docs/CLOUD_SETUP.md 完成部署。部署端自行放 config.js，內容只包含 config-sample.js 的公開 Supabase URL／publishable key。**config.js 不進 Git／ZIP；私鑰只存平台伺服器設定。**

雲端辨識、翻譯 Worker 尚待實作。不要只設定 URL 就將示範標記為已完成的 AI 服務。

## 預算與規範

實驗階段不接受固定月費；免費額度不足不自動升級。SBI-P-SDS v3.6 對照中，尚未完成資料庫、權限、正式部署與手機驗收。文件見本目錄的架構／需求／零固定月費方案及 docs/QA_V0.001.md。

V0.001 是前端版本；Git commit SHA 與文件版本另行追蹤。CSS／JS cache-busting 同步為 0.001。
