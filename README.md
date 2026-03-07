# TAKEI TOKEN POC (LIFF + Kairos Testnet)

`app_spec_poc_min.md` に沿った最小POC実装です。

## 実装済み（POC）

- Kaia Kairos Testnet 固定（`KAIA_NETWORK=kairos`, `KAIA_CHAIN_ID=1001` を強制）
- LINE内完結のLIFFアプリUI
- 外部会員登録なし（LINEログインのみ）
- 単一キャンペーン固定（`app_settings` 1件運用）
- 1人1回のみ受け取り可能（DB制約 + API排他）
- 管理画面なし
- ウォレットアドレスは画面非表示
- NFT 1枚 + 10,000 TAKEI TOKEN 同時付与（POCではダミーmint）

## 画面

- コイン代表画像: `public/assets/TAKEI_COIN.png`（添付画像をこのパスに配置）
- 受け取り画面（規約同意 + 受け取り）
- 付与中モーダル
- 完了画面
- マイページ（1画面）

## API

- `GET /api/health`
- `GET /api/config/public`
- `GET /api/campaign`
- `POST /api/auth/line`
- `GET /api/me`
- `POST /api/claim`

## 起動方法

1. `.env.example` を `.env` にコピー
2. そのままダミー実行する場合は `LINE_AUTH_MODE=dummy` と `KAIA_MINT_MODE=dummy` のまま利用
3. 起動:

```bash
node src/server.mjs
```

4. ブラウザで `http://127.0.0.1:3000` を開く

## DB

- スキーマ: `db/schema.sql`
- SQLiteファイル: `data/poc.sqlite`

## 本接続が必要な箇所

- `docs/prod_connection_checklist.md` を参照
