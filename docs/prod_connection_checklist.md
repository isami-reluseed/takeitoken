# 本接続が必要な箇所一覧

このPOCは `dummy` モードで動作します。実運用接続時は以下を置き換えてください。

## 1. LINE認証（LIFF）

1. `LINE_AUTH_MODE` を `line` に変更
2. `LIFF_ID`, `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET` を実値設定
3. `POST /api/auth/line` で実際の `id_token` を受け取り、LINE verify APIで検証
4. 既存公式アカウントと同一Provider配下のLINE Loginチャネルを使用

関連ファイル:
- `src/config.mjs`
- `src/auth.mjs`
- `.env.example`

## 2. Kaia mint処理（Kairos Testnet）

1. `KAIA_MINT_MODE` を `kairos` に変更
2. `KAIA_OPERATOR_PRIVATE_KEY`, `KIP17_CONTRACT_ADDRESS`, `KIP7_CONTRACT_ADDRESS` を実値設定
3. `src/kaia.mjs` の `KAIA_LIVE_MINT_NOT_IMPLEMENTED` 部分を実RPC送信に置き換え
4. NFT mint（KIP-17相当）と TTK mint（KIP-7相当）を同一claim内で実行

関連ファイル:
- `src/config.mjs`
- `src/kaia.mjs`
- `.env.example`

## 3. Secrets管理

1. `.env` 直置きではなくSecrets Manager/KMSに移行
2. 秘密鍵・チャネルシークレットをログ出力しない

関連ファイル:
- `src/config.mjs`
- 運用環境のデプロイ設定

## 4. 可観測性（運用）

1. claim成功/失敗、LINE認証失敗を構造化ログ化
2. 失敗アラートと再実行導線を追加

関連ファイル:
- `src/server.mjs`
- `src/db.mjs`

## 5. キャンペーン期間運用

1. `CLAIM_START_AT`, `CLAIM_END_AT` の実期間設定
2. `TERMS_URL` を本番規約URLへ差し替え

関連ファイル:
- `.env.example`
- `src/config.mjs`
