import crypto from "node:crypto";

function pseudoTxHash(seed) {
  const digest = crypto.createHash("sha256").update(seed).digest("hex");
  return `0x${digest}`;
}

export function createKaiaService(config) {
  return {
    async mintReward({ lineUserId, walletAddress, coinAmount }) {
      if (config.kaiaMintMode === "dummy") {
        const nonce = crypto.randomUUID();
        const nftTokenId = String(
          Number.parseInt(
            crypto.createHash("sha256").update(`${lineUserId}:${nonce}`).digest("hex").slice(0, 12),
            16,
          ),
        );

        return {
          nftTokenId,
          nftTxHash: pseudoTxHash(`nft:${lineUserId}:${walletAddress}:${nonce}`),
          coinTxHash: pseudoTxHash(`coin:${lineUserId}:${walletAddress}:${coinAmount}:${nonce}`),
        };
      }

      // TODO: Replace with real KIP-17/KIP-7 mint implementation via Kaia RPC and operator signer.
      throw new Error("KAIA_LIVE_MINT_NOT_IMPLEMENTED");
    },
  };
}
