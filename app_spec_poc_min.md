反映しました。
今回は**Kairos Testnet限定のPOC**、**既存LINE公式アカウント利用**、**管理画面なし**、**単一配布キャンペーン固定**、**履歴画面なし**、**ウォレットアドレス非表示**、**1人1回のみ**まで削っています。

## `app_spec_poc_min.md`

# 1. 概要

本アプリは、**LINE内で完結する記念NFT + 記念コイン配布のPOC**とする。
ブロックチェーン基盤は **Kaia Kairos Testnet** を使用し、Mainnet対応は行わない。Kaia公式では、Kairosはテスト・開発用、Mainnetは本番用として整理されており、Kairos用のPublic RPCも提供されている。 ([Kaia Docs][1])

ユーザーは**会員登録不要**で、**LINEログインのみ**で利用する。
追加アプリのインストールや外部ウォレット接続は不要とし、LINE内ブラウザで開く **LIFFアプリ**として提供する。LIFFアプリはLINE LoginチャネルまたはLINEミニアプリチャネルに追加できる。 ([LINE Developers][2])

# 2. 目的

イベント参加者に対して、以下をLINE内で簡単に配布・表示できることを確認する。

* 同一デザインの記念NFT 1枚
* 10,000 TAKEI TOKEN
* LINEログインのみで受け取り可能
* マイページで受け取り済み状態と保有コイン数を確認可能

本POCでは、**金銭的価値のない記念品配布体験の検証**を目的とし、売買、譲渡、消費は対象外とする。

# 3. スコープ

## 3.1 今回やること

* LINEログイン
* LIFF内での受け取り画面表示
* NFT 1枚の付与
* 10,000 TAKEI TOKEN の付与
* 受け取り済み判定
* マイページ1画面表示
* NFT画像表示
* コイン残高表示
* 受け取り日時表示

## 3.2 今回やらないこと

* Mainnet対応
* 複数イベント対応
* 管理画面
* 履歴一覧画面
* CSV出力
* コイン消費
* 1on1連携
* NFT/コイン購入
* ユーザー間譲渡
* 売買
* 外部ウォレット接続
* ウォレットアドレス表示
* Push通知の作り込み
* NFTのイベント別デザイン切り替え

# 4. 採用方針

## 4.1 LINE側

* 既存のLINE公式アカウントを利用する
* LIFFアプリとして実装する
* 認証はLINE Loginを使う
* Messaging APIとの連携が必要な場合は、**既存公式アカウントと同じProvider配下**にLINE Loginチャネルを作成する

LINE公式では、同じユーザーでもProviderが異なるとユーザーIDが異なり、Messaging APIチャネルとLINE Loginチャネルを連携する場合は同じProviderで作成するよう案内している。 ([LINE Developers][3])

## 4.2 ブロックチェーン側

* ネットワークは Kaia Kairos Testnet のみ
* Public RPCを利用する
* ユーザー用ウォレットは内部的に発行・管理する
* ユーザーに秘密鍵やアドレスを見せない
* NFTはKIP-17相当
* コインはKIP-7相当
* 発行主体は運営サーバー
* ガス代は運営負担

KairosとMainnetはChain IDとRPCが別で、KairosのPublic RPCは `https://public-en-kairos.node.kaia.io` として案内されている。 ([Kaia Docs][1])

# 5. 資産仕様

## 5.1 NFT

* 用途: 記念品
* 規格: KIP-17相当
* デザイン: 全ユーザー共通
* メタデータ: 全ユーザー共通
* 受け取り数: 1ユーザー1枚
* 売買不可
* 譲渡不可
* approve不可
* 金銭的価値なし
* mint権限は運営のみ

## 5.2 コイン

* 名称: `TAKEI TOKEN`
* シンボル: `TTK`
* 規格: KIP-7相当
* 小数桁: `0`
* 初期付与量: `10,000`
* 売買不可
* 譲渡不可
* approve不可
* 金銭的価値なし
* mint権限は運営のみ

# 6. キャンペーン仕様

今回は**単一キャンペーン固定**とする。
イベント管理機能は持たず、受け取り可能な配布は1種類のみとする。

* 配布内容: `NFT 1枚 + 10,000 TTK`
* 対象: URLを開いてLINEログインした全員
* 受け取り回数: 1人1回のみ
* 配布方式: 固定URLから受け取り
* 対象人数の目安: 約100人

## 6.1 注意

今回はPOCのため、**参加者限定の厳密判定は実装しない**。
そのため、URLまたはQRコードを知っている人は受け取れる設計とする。

# 7. 画面仕様

## 7.1 受け取り画面

表示項目:

* NFT画像
* NFT名称
* NFT説明文
* `NFT 1枚 + 10,000 TAKEI TOKEN を受け取れます` の文言
* 利用規約同意チェック
* `受け取る` ボタン

## 7.2 付与中モーダル

表示項目:

* 処理中メッセージ
* 反映に少し時間がかかる場合がある旨の文言

## 7.3 完了画面

表示項目:

* `取得が完了しました`
* NFT画像
* `10,000 TAKEI TOKEN 受け取り済み`
* `マイページを見る` ボタン
* `LINEに戻る` ボタン

## 7.4 マイページ

POCでは**1画面のみ**とし、タブ分割しない。

表示項目:

* LINE表示名
* 受け取ったNFT画像
* NFT名称
* コイン残高
* 受け取り日時
* `受け取り済み` 状態表示
* `更新` ボタン

表示しない項目:

* ウォレットアドレス
* Txハッシュ
* 詳細履歴
* ブロックチェーン専門用語

# 8. ユーザーフロー

1. ユーザーがQRまたはLINE公式アカウント内リンクからLIFFを開く
2. 未認証の場合、LINEログイン同意画面を表示する
3. 受け取り画面を表示する
4. ユーザーが規約同意のうえ `受け取る` を押す
5. サーバーがLINEユーザーIDを確認する
6. サーバーが受け取り済みか確認する
7. 未受け取りなら、内部ウォレットを取得または作成する
8. サーバーがNFTをmintする
9. サーバーが10,000 TTKをmintする
10. DBに受け取り結果を保存する
11. 完了画面を表示する
12. マイページで受け取り済み状態を表示する

# 9. データ設計

## 9.1 users

* `line_user_id`
* `line_display_name`
* `wallet_address`
* `claimed_flg`
* `claimed_at`
* `created_at`
* `updated_at`

## 9.2 claim_logs

* `claim_id`
* `line_user_id`
* `wallet_address`
* `nft_token_id`
* `coin_amount`
* `nft_tx_hash`
* `coin_tx_hash`
* `status`
* `created_at`

## 9.3 app_settings

* `campaign_name`
* `claim_start_at`
* `claim_end_at`
* `coin_amount`
* `nft_name`
* `nft_description`
* `terms_url`

# 10. API・処理仕様

## 10.1 必須処理

* LINEログイン情報の検証
* ユーザー取得/作成
* 受け取り済み判定
* NFT mint
* TTK mint
* DB保存
* マイページ表示用データ取得

## 10.2 冪等性

`受け取る` ボタンの多重押下に備え、同一LINEユーザーに対しては**二重発行しない**こと。

# 11. 管理機能

今回は**管理画面なし**とする。

必要最低限の運用は以下で代替する。

* DBを直接確認
* 必要なら簡易確認APIを用意
* 必要なら手動再実行スクリプトまたは内部APIを用意

# 12. 非機能要件

## 12.1 性能

* 想定人数: 100人程度
* 小規模同時アクセスに耐えること
* 受け取りボタン押下後、即時に処理中表示へ遷移すること

## 12.2 セキュリティ

* LINEの認証情報はサーバー側で検証する
* 秘密鍵はSecrets管理を使う
* 受け取りAPIは認証済みユーザーのみ利用可能とする
* 二重受け取り防止を行う

## 12.3 可観測性

* 付与成功ログ
* 付与失敗ログ
* LINE認証失敗ログ
* 受け取り済み判定ログ

# 13. 実装優先順位

## Phase 1

* LINE Login
* LIFF起動
* 受け取り画面
* NFT mint
* TTK mint
* 受け取り済み判定
* マイページ1画面

## 今回不要

* Mainnet化
* 管理画面
* 複数イベント化
* コイン利用機能
* 詳細履歴
* 外部通知の強化

# 14. Claude Code向けの前提

Claude Codeは以下を前提に実装すること。

* POC専用
* Kairos Testnet専用
* 既存LINE公式アカウント利用
* 既存公式アカウントと同一Provider前提
* LIFFアプリとして実装
* 外部会員登録なし
* ユーザーにウォレットを意識させない
* 画面は最小限
* 単一キャンペーン固定
* 管理画面なし
* ユーザー1人1回のみ受け取り可能

---

[1]: https://docs.kaia.io/build/get-started/foundation-setup/?utm_source=chatgpt.com "Foundation Setup - Kaia Docs"
[2]: https://developers.line.biz/ja/docs/liff/getting-started/?utm_source=chatgpt.com "チャネルを作成する - LINE Developers"
[3]: https://developers.line.biz/en/docs/messaging-api/getting-user-ids/?utm_source=chatgpt.com "Get user IDs - LINE Developers"
[4]: https://developers.line.biz/en/docs/liff/getting-started/?utm_source=chatgpt.com "Create a channel - LINE Developers"
[5]: https://developers.line.biz/en/docs/liff/registering-liff-apps/?utm_source=chatgpt.com "Adding a LIFF app to your channel - LINE Developers"
[6]: https://docs.kaia.io/build/wallets/wallet-config/configure-wallet-for-kaia-networks/?utm_source=chatgpt.com "How to configure your wallet for Kaia Networks"
[7]: https://docs.kaia.io/references/public-en/?utm_source=chatgpt.com "Public JSON RPC Endpoints"
