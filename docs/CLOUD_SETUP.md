# P141 雲端接線清單 — 未部署

本文件是下一步接線契約，不是已存在的資料庫或服務。不應對共用平台直接貼入全域權限 SQL；本輪未修改雲端。

## 先確認兩個既有專案

1. Supabase Dashboard → 專案列表：確認既有共用 Project 名稱、Project URL 與目前方案。不要另外開月費 Project。匿名身分啟用屬共用設定變更，先確認他案影響。
2. LiveKit Cloud → Project：確認 P141 專用 Project 及 Build $0 方案。不要重用 P104 API Secret，也不要貼到聊天或前端。
3. 只需記下 Project 控制台網址／名稱。後續伺服器秘密在平台設定，前端只放公開 Supabase 設定。

## 前端期待的 RPC（均須 INVOKER 與房間授權）

| RPC | 輸入 | 最小回傳 |
|---|---|---|
| P141_CreateRoom | 無；使用已驗證匿名 auth.uid | room_id、invite（只建立時回傳一次） |
| P141_JoinRoom | p_invite | room_id；授權只加入，不得升導遊 |
| P141_Heartbeat | p_room_id、p_caption_enabled、p_language、p_version | listeners、captionUsers、stt、translations、closed |
| P141_LeaveRoom | p_room_id | 確認本人已退出 |
| P141_CloseRoom | p_room_id | 只允許擁有者；記錄關閉及冪等工作 |
| P141_GetVoiceGrant | p_room_id | 後端確定的 role、identity、livekit_room、guide_identity、caption_identity |

表設於未暴露的 p141_data，TblP141... 命名，RLS 常開；逐表 GRANT、必要 sequence、PUBLIC EXECUTE 撤除及 exposed schema 決策同 migration 明列。auth.uid 只代表身分，角色需 P141 本地授權；敏感 RPC 不授權 anon。

本輪不提供假裝安全完整的空 RLS 或 generic SQL。實作前須確認既有平台允許的 exposed RPC schema；如需 SECURITY DEFINER，另提出具體例外審核，不默認採用。

## LiveKit 權杖 Function

`P141_livekit_token` 僅接受經 Supabase 驗證的 caller；讀取 RPC 結果而非前端 role，使用 P141 專用 LiveKit 秘密簽發短效權杖。導遊只准麥克風，遊客不能發音／資料；Worker 是另一個受控身分。回傳 token、url、guide_identity、caption_identity。完整後端須同時實作建立限速、房間／人數／時長配額、關閉撤銷及請求稽核。

## AI Worker 與事件

LiveKit `P141.caption.v1` text stream 只接受指定 caption_identity。前端期待 JSON：roomId、segmentId（含 session epoch）、sequence（房間全域單調遞增）、revision、language（zh／en）、text、final。

Worker 必須按有效成員需求啟停：有人要任一字幕才辨識，一語一份翻譯，全團零需求釋放字幕工作。即時租約、工作 fencing、去重、容量與預算限制都在伺服器實作；示範中的瀏覽器需求彙總不能替代它。尚未選定或啟用 AI 供應商。

結束房間須主動移除 LiveKit 參與者／關閉房間並停止 Worker；JWT 到期不會立即斷開已連線者。雲端前端可本機斷線，但不能以此宣稱後端工作已停止。

## 實機驗收前的必要條件

後端 RPC、RLS、Token Function、房間關閉工作、服務租約與限速先驗收，再設定部署端 config.js。之後先驗 Android／iOS 一對一原音，再開 STT、翻譯及一對十的三十分鐘量測。
