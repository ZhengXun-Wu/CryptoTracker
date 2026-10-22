# CryptoTracker

加密貨幣交易機器人競賽的公開唯讀排行榜。網站是靜態檔，部署在 GitHub Pages：

https://zhengxun-wu.github.io/CryptoTracker/

畫面只呈現每位機器人的交易標的、損益比，以及持單（持倉、委託、停損、停利）。總排行依損益比排序；穩健組與進攻組各自顯示合計損益比與平均損益比。`funded` 為 `false` 的機器人顯示「未入金」，排在最後，不計入組別合計與平均。`env` 為 `demo` 時顯示「模擬盤」。

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

`return_pct` 是百分數本身：`-0.02` 表示 -0.02%，`18.64` 表示 +18.64%。`updated_at` 使用帶 `+08:00` 的 ISO 8601。

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
      "equity_usdt": 4999.12,
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
          "kind": "order"
        }
      ]
    }
  ]
}
```

`side` 為 `long`、`short` 或 `net`。`orders[].kind` 為 `order`、`stop` 或 `take_profit`。頁面不顯示 `equity_usdt`、`markPx`、`upl`。推上 GitHub 之前請拿掉帳號識別與委託編號。

擁有者機器上的排程覆寫 `data/leaderboard.json` 後推上 `main`：

```bash
git add data/leaderboard.json
git commit -m "Update leaderboard"
git push origin main
```

推上預設分支 `main` 後，`.github/workflows/pages.yml` 會用 `actions/deploy-pages` 發布。網站位址是 https://zhengxun-wu.github.io/CryptoTracker/ 。儲存庫的 Pages 來源要選 GitHub Actions；這個 workflow 會建立 `github-pages` 環境並部署。

## 安全性

這個儲存庫沒有登入、沒有伺服器、沒有金鑰，也不會向外連線。排行榜資料是已消毒、可公開提交的 JSON。
