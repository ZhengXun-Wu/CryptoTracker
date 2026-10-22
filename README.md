# CryptoTracker

加密貨幣交易機器人競賽的公開唯讀排行榜。網站是靜態檔，部署在 GitHub Pages：

https://zhengxun-wu.github.io/CryptoTracker/

桌面（約 1366×768 以上）把四位機器人放在同一屏：上方是名次、組別報酬、更新時間與註記，下面是四格面板。手機改為直向排列，可以捲動。頁面每 60 秒重新讀取 `data/leaderboard.json`，不重新載入整個網頁。

每位面板顯示名次、名稱、組別、比賽權益（`equity_with_pending_usdt`，標成含掛單試算）與 `return_pct_with_pending`、較小的實際報酬、帳戶總估值（`total_eq_usdt`，沒有這個欄位就顯示「—」）、交易標的、持倉、委託與停損/停利。獲利的限價掛單以灰色「試算 +x，不計入」標出。`stats` 的已平倉筆數大於 0 時顯示勝率數字；沒有統計或已平倉為 0 時，勝率統計各欄都是「—」。`status` 為「未入金」、「未設定」或「錯誤」時只顯示狀態。`env` 為 `demo` 時顯示「模擬盤」。

## 競賽分組

| 組別 | 機器人 |
| --- | --- |
| 穩健組 | Crypto防禦派、Crypto保守派 |
| 進攻組 | Crypto激進份子、Crypto狂熱份子 |

## 本地預覽

在儲存庫根目錄：

```bash
python3 -m http.server 4173
```

開啟 <http://127.0.0.1:4173/>。頁面用相對路徑讀取 `data/leaderboard.json`。

```bash
node --test
```

## 資料檔

網站只抓取這個相對路徑，沒有後端，也不連線到交易所：

```text
data/leaderboard.json
```

目前提交的檔案是範例。它帶有 `"sample": true` 與 `SAMPLE DATA` 註記，頁面會顯示「範例資料」。閘道機上的排程覆寫並推上 `main` 之後，正式檔不要留 `sample`，徽章就會消失。

報酬率是百分數本身：`-0.02` 表示 -0.02%，`18.64` 表示 +18.64%。正式檔的數字是字串。`generated_at`（舊檔可用 `updated_at`）使用帶 `+08:00` 的 ISO 8601。

含掛單試算把尚未成交的限價掛單當作已在掛單價成交，再以現價估算；只計入虧損，獲利以 0 計。條件單不計入。已成交部位照常計算未實現損益。`est_pnl` 是已經截成不大於 0 的數字，`est_pnl_raw` 保留截斷前的原值。

頁面接受閘道直接寫出的形狀：頂層有 `env`、`generated_at`、`rank_by`、`ranking`，以及 `groups` 物件（「穩健組」、「進攻組」）。每位機器人的持倉在 `positions`，限價掛單在 `open_orders`，條件單在 `open_algo_orders`。`ranking` 裡的 `open_orders` 只是筆數。頁面不依賴委託編號或帳號識別，這些應在推上 GitHub 之前拿掉。權益金額、`pending_pnl_usdt`、`markPx`、`upl` 可以留在檔案裡，畫面不顯示。

舊檔仍可讀：頂層 `bots` 陣列，`funded: false` 視為未入金，只有 `return_pct` 時名次與兩個報酬率都用它。

```json
{
  "env": "demo",
  "generated_at": "2026-10-22T14:40:00+08:00",
  "rank_by": "return_pct_with_pending",
  "ranking": [
    {
      "rank": "1",
      "bot": "Crypto防禦派",
      "group": "穩健組",
      "status": "ok",
      "return_pct_actual": "-0.02",
      "return_pct_with_pending": "-0.02",
      "open_orders": "1",
      "open_algo_orders": "0"
    }
  ],
  "groups": {
    "穩健組": {
      "return_pct_actual": "-0.02",
      "return_pct_with_pending": "-0.02",
      "bots": [
        {
          "bot": "Crypto防禦派",
          "group": "穩健組",
          "status": "ok",
          "return_pct_actual": "-0.02",
          "return_pct_with_pending": "-0.02",
          "instruments": ["BTC-USDT"],
          "positions": [
            { "instId": "BTC-USDT-SWAP", "posSide": "long", "pos": "0.01", "avgPx": "83000" }
          ],
          "open_orders": [
            {
              "instId": "BTC-USDT",
              "side": "buy",
              "ordType": "limit",
              "px": "80000",
              "sz": "0.01",
              "est_pnl": "0",
              "est_pnl_raw": "12.5"
            }
          ],
          "open_algo_orders": []
        }
      ]
    }
  }
}
```

持倉的 `posSide` 為 `long`、`short` 或 `net`。條件單用 `slTriggerPx` 或 `tpTriggerPx`，沒有 `est_pnl`。

擁有者機器上的排程覆寫 `data/leaderboard.json` 後推上 `main`：

```bash
git add data/leaderboard.json
git commit -m "Update leaderboard"
git push origin main
```

推上預設分支 `main` 後，`.github/workflows/pages.yml` 會用 `actions/deploy-pages` 發布。網站位址是 https://zhengxun-wu.github.io/CryptoTracker/ 。儲存庫的 Pages 來源要選 GitHub Actions；這個 workflow 會建立 `github-pages` 環境並部署。

## 安全性

這個儲存庫沒有登入、沒有伺服器、沒有金鑰，也不會向外連線。排行榜資料是已消毒、可公開提交的 JSON。
