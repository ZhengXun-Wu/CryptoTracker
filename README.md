# CryptoTracker

加密貨幣交易機器人競賽的公開唯讀排行榜。網站是靜態檔，部署在 GitHub Pages：

https://zhengxun-wu.github.io/CryptoTracker/

畫面只呈現每位機器人的交易標的、報酬率，以及持單（持倉、委託、停損、停利）。名次與組別合計、平均都依「權益金含掛單試算」（`return_pct_with_pending`）排序與加總；卡片上較小的「實際」是 `return_pct_actual`。舊檔若只有 `return_pct`，名次、試算與實際都用這個欄位。`funded` 為 `false` 的機器人顯示「未入金」，排在最後，不計入組別合計與平均。`env` 為 `demo` 時顯示「模擬盤」。尚未成交的限價委託若帶 `est_pnl`，會顯示在該筆委託旁邊；停損與停利沒有這個數字。

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

報酬率是百分數本身：`-0.02` 表示 -0.02%，`18.64` 表示 +18.64%。`updated_at` 使用帶 `+08:00` 的 ISO 8601。

每位已入金機器人可以同時帶：

- `return_pct_actual`、`equity_actual_usdt`：實際權益與報酬。
- `pending_pnl_usdt`：把尚未成交的限價掛單當作已在掛單價成交，再以現價估算的損益。條件單不計入。
- `equity_with_pending_usdt`、`return_pct_with_pending`：實際權益加上上述掛單損益後的權益與報酬。
- `orders[].est_pnl`：該筆限價掛單的試算損益。條件單省略這個欄位。

`return_pct` 與 `equity_usdt` 仍可讀。沒有 `return_pct_with_pending` 時，排名改用 `return_pct`；沒有 `return_pct_actual` 時，「實際」也改用 `return_pct`。頁面顯示試算報酬、實際報酬與 `est_pnl`，不顯示權益金額、`pending_pnl_usdt`、`markPx` 或 `upl`。

```json
{
  "updated_at": "2026-10-22T14:40:00+08:00",
  "env": "demo",
  "groups": [
    { "name": "穩健組", "bots": ["Crypto防禦派", "Crypto保守派"] },
    { "name": "進攻組", "bots": ["Crypto激進份子", "Crypto狂熱份子"] }
  ],
  "bots": [
    {
      "name": "Crypto防禦派",
      "group": "穩健組",
      "funded": true,
      "return_pct": -0.02,
      "return_pct_actual": -0.02,
      "return_pct_with_pending": 1.25,
      "equity_usdt": 4999.12,
      "equity_actual_usdt": 4999.12,
      "pending_pnl_usdt": 63.5,
      "equity_with_pending_usdt": 5062.62,
      "instruments": ["BTC-USDT"],
      "positions": [
        {
          "instId": "BTC-USDT-SWAP",
          "side": "long",
          "size": "0.01",
          "avgPx": "83000",
          "markPx": "83100",
          "upl": "1.0"
        }
      ],
      "orders": [
        {
          "instId": "BTC-USDT",
          "side": "buy",
          "ordType": "limit",
          "sz": "0.01",
          "px": "80000",
          "kind": "order",
          "est_pnl": 63.5
        }
      ]
    }
  ]
}
```

`side` 為 `long`、`short` 或 `net`。`orders[].kind` 為 `order`、`stop` 或 `take_profit`。推上 GitHub 之前請拿掉帳號識別與委託編號。

擁有者機器上的排程覆寫 `data/leaderboard.json` 後推上 `main`：

```bash
git add data/leaderboard.json
git commit -m "Update leaderboard"
git push origin main
```

推上預設分支 `main` 後，`.github/workflows/pages.yml` 會用 `actions/deploy-pages` 發布。網站位址是 https://zhengxun-wu.github.io/CryptoTracker/ 。儲存庫的 Pages 來源要選 GitHub Actions；這個 workflow 會建立 `github-pages` 環境並部署。

## 安全性

這個儲存庫沒有登入、沒有伺服器、沒有金鑰，也不會向外連線。排行榜資料是已消毒、可公開提交的 JSON。
