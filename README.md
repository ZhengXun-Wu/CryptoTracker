# CryptoTracker

加密貨幣交易機器人競賽的唯讀排行榜。登入之後，每位機器人只顯示三件事：目前交易的標的、損益比，以及持單（持倉、委託、停損／停利策略單）。

首頁是依損益比排序的總排行，下面是穩健組與進攻組的分組戰況，各組有合計損益比與平均損益比。畫面有名次、組別顏色，以及最後更新時間（台北時間）。

## 競賽分組

| 組別 | 機器人 |
| --- | --- |
| 穩健組 | Crypto防禦派、Crypto保守派 |
| 進攻組 | Crypto激進份子、Crypto狂熱份子 |

每位機器人使用自己的 OKX 子帳號。目前是 OKX 模擬盤，每位起始資金 5000 USDT。日後改實盤時起始資金會不同，由 JSON 的 `starting_capital_usdt` 帶入；這個數字只參與上游計算，網站不顯示權益、盈虧金額或起始資金。

`env` 為 `demo` 時，頁首顯示「模擬盤」。`live` 時顯示「實盤」。

## 本地啟動

```bash
cp .env.example .env.local && npm install && npm run dev
```

開啟 <http://localhost:3000>，密碼是 `.env.local` 裡的 `SITE_PASSWORD`（範例檔為 `change-me`）。尚未指定資料來源時，登入後看到的是 `data/example-leaderboard.json`，頁面會標示「範例資料」。

```bash
npm test
npm run typecheck
npm run build && npm start
```

## 環境變數

變數只放在環境裡，不進 git。範本是 `.env.example`。Next.js 開發時讀 `.env.local`。

| 變數 | 用途 |
| --- | --- |
| `SITE_PASSWORD` | 觀看排行榜的密碼。正式環境至少 8 碼，且不可使用範例值。 |
| `SESSION_SECRET` | 簽章 session cookie。正式環境至少 16 碼。 |
| `SESSION_HOURS` | 登入有效時數，預設 12。 |
| `DATA_SOURCE` | `file`（預設）或 `okx`。 |
| `LEADERBOARD_SOURCE` | 選填。本機 JSON 路徑，或 `http`／`https` 網址。 |
| `INGEST_STORE_PATH` | 推送快照路徑，預設 `data/live-leaderboard.json`。 |
| `INGEST_TOKEN` | 有設定才開啟 `POST /api/ingest`。正式環境至少 16 碼。 |
| `POLL_MS` | 瀏覽器重新整理間隔，預設 15000，範圍 5000–300000。 |
| `OKX_SIMULATED` | 僅 `DATA_SOURCE=okx`。`1` 為模擬盤（預設），`0` 標成實盤。 |
| `OKX_<BOT>_API_KEY` | 伺服器端子帳號金鑰。見下方預留介面。 |
| `OKX_<BOT>_SECRET_KEY` | 同上。 |
| `OKX_<BOT>_PASSPHRASE` | 同上。 |

`<BOT>` 為 `DEFENSE`、`CONSERVATIVE`、`AGGRESSIVE`、`FANATIC`。這些變數不要加 `NEXT_PUBLIC_` 前綴。

## 資料來源

`DATA_SOURCE=file` 時的讀取順序：

1. 設定了 `LEADERBOARD_SOURCE`：讀該檔案或網址。指定的來源讀不到時，頁面顯示錯誤，不會改顯示範例資料。
2. 否則，若推送快照檔存在：讀快照。
3. 否則：讀內建範例，並標示「範例資料」。

數字在 JSON 裡是字串。缺少欄位時照樣排出能排的名次。`return_pct` 用百分數，`"12.34"` 表示 +12.34%。

排名依損益比由高到低。狀態是 `未入金`、`未設定`、錯誤，或沒有損益比的機器人排在最後。未入金與未設定不顯示損益比數字，也不計入組別合計與平均。合計損益比是組內有效選手損益比的加總，平均損益比是這些選手的算術平均。快照的 `generated_at` 距現在超過 5 分鐘，且不是範例資料時，顯示「更新延遲」。

### 推送快照

在閘道那一台機器上，用寫入權杖把 `okxgw leaderboard --json` 的輸出推過來。權杖用 `openssl rand -base64 32` 產生，只放在兩邊的環境變數。

```bash
okxgw leaderboard --json | curl --fail-with-body --silent --show-error \
  --max-time 30 \
  -X POST \
  -H "Authorization: Bearer ${INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @- \
  "${TRACKER_URL}/api/ingest"
```

也可以用 `X-Ingest-Token` 標頭。成功時回應 `{"ok":true,"bots":4}`。未設定權杖時端點關閉。

每一分鐘推一次的 cron：

```cron
* * * * * okxgw leaderboard --json | curl --fail-with-body --silent --show-error --max-time 30 -X POST -H "Authorization: Bearer ${INGEST_TOKEN}" -H "Content-Type: application/json" --data-binary @- "${TRACKER_URL}/api/ingest"
```

不方便開 HTTP 時，可以把同一份 JSON 寫進檔案，並設定 `LEADERBOARD_SOURCE`：

```bash
okxgw leaderboard --json > /var/lib/cryptotracker/leaderboard.json
```

或讓閘道自己提供網址：

```bash
LEADERBOARD_SOURCE=https://gateway.example/leaderboard.json
```

### JSON 形狀

完整、已標成範例的檔案在 `data/example-leaderboard.json`。結構如下，數字皆為字串，多出來的欄位會被忽略。

```json
{
  "env": "demo",
  "generated_at": "2026-10-22T06:40:00Z",
  "ranking": [
    { "rank": 1, "bot": "Crypto激進份子", "group": "進攻組", "return_pct": "18.64", "equity_usdt": "5932.00" }
  ],
  "groups": {
    "穩健組": {
      "bots": [
        {
          "bot": "Crypto防禦派",
          "code": "defense",
          "group": "穩健組",
          "env": "demo",
          "as_of": "2026-10-22T06:39:40Z",
          "starting_capital_usdt": "5000",
          "status": "ok",
          "equity_usdt": "5157.50",
          "pnl_usdt": "157.50",
          "return_pct": "3.15",
          "holdings": [],
          "positions": [{ "instId": "BTC-USDT-SWAP", "posSide": "long", "pos": "0.02", "avgPx": "63110" }],
          "open_orders": [],
          "algo_orders": [{ "instId": "BTC-USDT-SWAP", "ordType": "conditional", "sz": "0.02", "slTriggerPx": "60800", "state": "live" }],
          "instruments": ["BTC-USDT-SWAP"],
          "rank": 3
        }
      ]
    }
  }
}
```

`status` 為 `ok`、`未入金`、`未設定` 或錯誤。持倉認 `instId`、`posSide`、`pos`、`avgPx`。委託認 `side`、`ordType`、`px`、`sz`、`state`。策略單另外認 `slTriggerPx`、`tpTriggerPx`。`state` 已成交或已取消的單不會出現在持單裡。

## OKX 唯讀介面（預留）

`DATA_SOURCE=okx` 會走 `src/lib/sources/okx.ts`。它只檢查伺服器環境變數裡有沒有一組完整金鑰，不連線、不下單。未設定金鑰的機器人顯示「未設定」；金鑰齊了的顯示「尚未接通」，並排在有效名次之後。

以後若接上 OKX，只允許這些 GET：

- `/api/v5/account/balance`
- `/api/v5/account/positions`
- `/api/v5/trade/orders-pending`
- `/api/v5/trade/orders-algo-pending`

模擬盤沿用 OKX 的模擬交易標頭。金鑰留在伺服器行程內，不進瀏覽器、不進排行榜 JSON。

## Docker

正式環境會拒絕 `change-me` 這類預設密碼。先複製並改好 `.env`：

```bash
cp .env.example .env
docker compose up --build
```

服務聽 3000。推送快照寫在容器的 `data/live-leaderboard.json`。要在重啟後保留，可把該檔掛進容器；不要把整個 `data/` 目錄蓋掉，否則內建範例會一併被遮住。

## Vercel

專案是 Next.js，用預設的建置即可。在專案設定放入與 `.env.example` 相同的變數，並換成正式密碼與 `SESSION_SECRET`。

Vercel 的檔案系統不適合當持久推送目的地。請把 `LEADERBOARD_SOURCE` 指到閘道提供的 HTTPS JSON。單一主機或 Docker 才適合用 `POST /api/ingest` 寫本地快照。

## 安全性

- 觀看要登入。Cookie 是 HttpOnly、SameSite=Lax；正式環境另加 Secure。請用 HTTPS 對外。
- 連續密碼錯誤會暫時拒絕，約 10 分鐘內 8 次。
- 程式沒有下單、改單或撤單路徑。
- OKX 金鑰、網站密碼、session 密鑰與推送權杖只存在環境變數。`.gitignore` 排除 `.env`、`.env.local` 與推送快照。
- 排行榜 API 與頁面需要 session。推送端點不使用 session，只接受權杖，且未設定權杖時關閉。
- 回應給瀏覽器的資料只有名次、組別、損益比、交易標的與持單。
