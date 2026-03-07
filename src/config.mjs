import fs from "node:fs";
import path from "node:path";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toAbsolutePath(projectRoot, value, fallback) {
  const raw = value ?? fallback;
  if (path.isAbsolute(raw)) {
    return raw;
  }
  return path.join(projectRoot, raw);
}

export function loadConfig(projectRoot = process.cwd(), overrides = {}) {
  const envFilePath = path.join(projectRoot, ".env");
  const fromDotEnv = readDotEnv(envFilePath);
  const env = {
    ...fromDotEnv,
    ...process.env,
  };

  const now = new Date();
  const defaultClaimStartAt = new Date(now.getTime() - ONE_DAY_MS).toISOString();
  const defaultClaimEndAt = new Date(now.getTime() + 365 * ONE_DAY_MS).toISOString();

  const config = {
    projectRoot,
    port: toInt(env.PORT, 3000),
    host: env.HOST ?? "127.0.0.1",
    dbPath: toAbsolutePath(projectRoot, env.DB_PATH, "./data/poc.sqlite"),
    schemaPath: toAbsolutePath(projectRoot, env.DB_SCHEMA_PATH, "./db/schema.sql"),
    sessionSigningSecret:
      env.SESSION_SIGNING_SECRET ?? "dev-only-change-me-in-production",
    sessionTtlSeconds: toInt(env.SESSION_TTL_SECONDS, 60 * 60 * 12),
    internalWalletSalt: env.INTERNAL_WALLET_SALT ?? "dev-wallet-salt",

    // TODO: Set real values from LINE Developers when LINE_AUTH_MODE is switched to "line".
    lineAuthMode: (env.LINE_AUTH_MODE ?? "dummy").toLowerCase(),
    liffId: env.LIFF_ID ?? "TODO_SET_LIFF_ID",
    lineLoginChannelId: env.LINE_LOGIN_CHANNEL_ID ?? "TODO_SET_LINE_LOGIN_CHANNEL_ID",
    lineLoginChannelSecret:
      env.LINE_LOGIN_CHANNEL_SECRET ?? "TODO_SET_LINE_LOGIN_CHANNEL_SECRET",
    lineIdTokenVerifyUrl:
      env.LINE_ID_TOKEN_VERIFY_URL ?? "https://api.line.me/oauth2/v2.1/verify",
    dummyLineUserId: env.DUMMY_LINE_USER_ID ?? "U1234567890DUMMY",
    dummyLineDisplayName: env.DUMMY_LINE_DISPLAY_NAME ?? "TAKEI POC User",

    // TODO: Set real Kaia values when KAIA_MINT_MODE is switched to "kairos".
    kaiaNetwork: (env.KAIA_NETWORK ?? "kairos").toLowerCase(),
    kaiaChainId: toInt(env.KAIA_CHAIN_ID, 1001),
    kaiaRpcUrl:
      env.KAIA_RPC_URL ?? "https://public-en-kairos.node.kaia.io",
    kaiaMintMode: (env.KAIA_MINT_MODE ?? "dummy").toLowerCase(),
    kaiaOperatorPrivateKey:
      env.KAIA_OPERATOR_PRIVATE_KEY ?? "TODO_SET_KAIA_OPERATOR_PRIVATE_KEY",
    kip17ContractAddress:
      env.KIP17_CONTRACT_ADDRESS ?? "TODO_SET_KIP17_CONTRACT_ADDRESS",
    kip7ContractAddress:
      env.KIP7_CONTRACT_ADDRESS ?? "TODO_SET_KIP7_CONTRACT_ADDRESS",

    campaignName: env.CAMPAIGN_NAME ?? "TAKEI TOKEN POC Campaign",
    claimStartAt: env.CLAIM_START_AT ?? defaultClaimStartAt,
    claimEndAt: env.CLAIM_END_AT ?? defaultClaimEndAt,
    coinAmount: toInt(env.COIN_AMOUNT, 10_000),
    nftName: env.NFT_NAME ?? "TAKEI TOKEN",
    nftDescription:
      env.NFT_DESCRIPTION ??
      "",
    nftImageUrl: env.NFT_IMAGE_URL ?? "/assets/nft-placeholder.svg",
    termsUrl: env.TERMS_URL ?? "https://example.com/terms",
  };

  const merged = {
    ...config,
    ...overrides,
  };

  if (merged.kaiaNetwork !== "kairos") {
    throw new Error("KAIA_NETWORK must be 'kairos'. Mainnet is not allowed in this POC.");
  }

  if (merged.kaiaChainId !== 1001) {
    throw new Error("KAIA_CHAIN_ID must be 1001 (Kairos Testnet).");
  }

  if (!merged.kaiaRpcUrl.includes("kairos")) {
    throw new Error("KAIA_RPC_URL must point to Kairos Testnet.");
  }

  if (!["dummy", "line"].includes(merged.lineAuthMode)) {
    throw new Error("LINE_AUTH_MODE must be one of: dummy, line");
  }

  if (!["dummy", "kairos"].includes(merged.kaiaMintMode)) {
    throw new Error("KAIA_MINT_MODE must be one of: dummy, kairos");
  }

  return merged;
}
