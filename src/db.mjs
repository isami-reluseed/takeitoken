import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function nowIso() {
  return new Date().toISOString();
}

function deriveWalletAddress(lineUserId, salt) {
  const digest = crypto
    .createHash("sha256")
    .update(`${salt}:${lineUserId}`)
    .digest("hex");
  return `0x${digest.slice(0, 40)}`;
}

function ensureParentDirectory(filePath) {
  const parent = path.dirname(filePath);
  fs.mkdirSync(parent, { recursive: true });
}

export function openDatabase(config) {
  ensureParentDirectory(config.dbPath);

  const db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA foreign_keys = ON;");

  const schemaSql = fs.readFileSync(config.schemaPath, "utf8");
  db.exec(schemaSql);

  const selectCampaign = db.prepare(
    "SELECT campaign_name, claim_start_at, claim_end_at, coin_amount, nft_name, nft_description, terms_url FROM app_settings WHERE campaign_name = ?",
  );

  const upsertCampaign = db.prepare(`
    INSERT INTO app_settings (
      campaign_name,
      claim_start_at,
      claim_end_at,
      coin_amount,
      nft_name,
      nft_description,
      terms_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_name) DO UPDATE SET
      claim_start_at = excluded.claim_start_at,
      claim_end_at = excluded.claim_end_at,
      coin_amount = excluded.coin_amount,
      nft_name = excluded.nft_name,
      nft_description = excluded.nft_description,
      terms_url = excluded.terms_url
  `);

  upsertCampaign.run(
    config.campaignName,
    config.claimStartAt,
    config.claimEndAt,
    config.coinAmount,
    config.nftName,
    config.nftDescription,
    config.termsUrl,
  );

  const selectUser = db.prepare(
    "SELECT line_user_id, line_display_name, wallet_address, claimed_flg, claimed_at, created_at, updated_at FROM users WHERE line_user_id = ?",
  );

  const insertUser = db.prepare(`
    INSERT INTO users (
      line_user_id,
      line_display_name,
      wallet_address,
      claimed_flg,
      claimed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, 0, NULL, ?, ?)
  `);

  const updateUserDisplayName = db.prepare(
    "UPDATE users SET line_display_name = ?, updated_at = ? WHERE line_user_id = ?",
  );

  const setUserClaimed = db.prepare(
    "UPDATE users SET claimed_flg = 1, claimed_at = ?, updated_at = ? WHERE line_user_id = ?",
  );

  const clearUserClaimed = db.prepare(
    "UPDATE users SET claimed_flg = 0, claimed_at = NULL, updated_at = ? WHERE line_user_id = ?",
  );

  const findOpenClaim = db.prepare(
    "SELECT claim_id, status FROM claim_logs WHERE line_user_id = ? AND status IN ('PENDING', 'SUCCESS') LIMIT 1",
  );

  const insertPendingClaim = db.prepare(`
    INSERT INTO claim_logs (
      claim_id,
      line_user_id,
      wallet_address,
      nft_token_id,
      coin_amount,
      nft_tx_hash,
      coin_tx_hash,
      status,
      error_reason,
      created_at
    ) VALUES (?, ?, ?, NULL, ?, NULL, NULL, 'PENDING', NULL, ?)
  `);

  const updateClaimSuccess = db.prepare(
    "UPDATE claim_logs SET nft_token_id = ?, nft_tx_hash = ?, coin_tx_hash = ?, status = 'SUCCESS', error_reason = NULL WHERE claim_id = ?",
  );

  const updateClaimFailure = db.prepare(
    "UPDATE claim_logs SET status = 'FAILED', error_reason = ? WHERE claim_id = ?",
  );

  const findClaimById = db.prepare(
    "SELECT claim_id, line_user_id, status FROM claim_logs WHERE claim_id = ?",
  );

  const sumCoinBalance = db.prepare(
    "SELECT COALESCE(SUM(coin_amount), 0) AS coin_balance FROM claim_logs WHERE line_user_id = ? AND status = 'SUCCESS'",
  );

  const findLatestSuccessClaim = db.prepare(
    "SELECT claim_id, nft_token_id, nft_tx_hash, created_at FROM claim_logs WHERE line_user_id = ? AND status = 'SUCCESS' ORDER BY created_at DESC LIMIT 1",
  );

  function ensureUser(lineUserId, displayName) {
    const existing = selectUser.get(lineUserId);
    if (existing) {
      updateUserDisplayName.run(displayName, nowIso(), lineUserId);
      return selectUser.get(lineUserId);
    }

    const createdAt = nowIso();
    insertUser.run(
      lineUserId,
      displayName,
      deriveWalletAddress(lineUserId, config.internalWalletSalt),
      createdAt,
      createdAt,
    );
    return selectUser.get(lineUserId);
  }

  return {
    close() {
      db.close();
    },

    getCampaign() {
      const campaign = selectCampaign.get(config.campaignName);
      if (campaign) {
        return campaign;
      }

      return {
        campaign_name: config.campaignName,
        claim_start_at: config.claimStartAt,
        claim_end_at: config.claimEndAt,
        coin_amount: config.coinAmount,
        nft_name: config.nftName,
        nft_description: config.nftDescription,
        terms_url: config.termsUrl,
      };
    },

    upsertUserOnAuth({ lineUserId, displayName }) {
      return ensureUser(lineUserId, displayName);
    },

    getMyPage({ lineUserId, fallbackDisplayName }) {
      const user = selectUser.get(lineUserId);
      const balanceRow = sumCoinBalance.get(lineUserId);
      const latestClaim = findLatestSuccessClaim.get(lineUserId);
      const campaign = this.getCampaign();

      return {
        lineDisplayName:
          user?.line_display_name ?? fallbackDisplayName ?? "LINE User",
        claimed: Number(user?.claimed_flg ?? 0) === 1,
        claimedAt: user?.claimed_at ?? null,
        coinBalance: Number(balanceRow?.coin_balance ?? 0),
        statusText: Number(user?.claimed_flg ?? 0) === 1 ? "受け取り済み" : "未受け取り",
        nft: {
          name: campaign.nft_name,
          description: campaign.nft_description,
          imageUrl: config.nftImageUrl,
          tokenId: latestClaim?.nft_token_id ?? null,
        },
        blockchain: {
          takenId: latestClaim?.nft_tx_hash ?? null,
        },
      };
    },

    reserveClaim({ lineUserId, displayName, coinAmount }) {
      const reservedAt = nowIso();
      const claimId = crypto.randomUUID();

      db.exec("BEGIN IMMEDIATE");
      try {
        const user = ensureUser(lineUserId, displayName);

        const openClaim = findOpenClaim.get(lineUserId);
        if (Number(user.claimed_flg) === 1 || openClaim) {
          db.exec("ROLLBACK");
          return {
            status: "already_claimed",
            reason: openClaim?.status ?? "SUCCESS",
          };
        }

        setUserClaimed.run(reservedAt, reservedAt, lineUserId);
        insertPendingClaim.run(
          claimId,
          lineUserId,
          user.wallet_address,
          coinAmount,
          reservedAt,
        );

        db.exec("COMMIT");
        return {
          status: "reserved",
          claimId,
          walletAddress: user.wallet_address,
          reservedAt,
        };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    completeClaim({ claimId, mintResult }) {
      const claim = findClaimById.get(claimId);
      if (!claim) {
        throw new Error("CLAIM_NOT_FOUND");
      }

      if (claim.status !== "PENDING") {
        throw new Error("CLAIM_NOT_PENDING");
      }

      updateClaimSuccess.run(
        mintResult.nftTokenId,
        mintResult.nftTxHash,
        mintResult.coinTxHash,
        claimId,
      );
    },

    failClaim({ claimId, errorReason }) {
      const claim = findClaimById.get(claimId);
      if (!claim) {
        return;
      }

      db.exec("BEGIN IMMEDIATE");
      try {
        updateClaimFailure.run(errorReason, claimId);
        clearUserClaimed.run(nowIso(), claim.line_user_id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
