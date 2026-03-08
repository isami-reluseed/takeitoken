import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createAuthService } from "./auth.mjs";
import { loadConfig } from "./config.mjs";
import { openDatabase } from "./db.mjs";
import { createKaiaService } from "./kaia.mjs";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(text);
}

async function readJsonBody(request) {
  const chunks = [];
  let totalSize = 0;

  for await (const chunk of request) {
    totalSize += chunk.length;
    if (totalSize > 1_000_000) {
      throw new Error("REQUEST_BODY_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const bodyText = Buffer.concat(chunks).toString("utf8");
  if (!bodyText.trim()) {
    return {};
  }

  return JSON.parse(bodyText);
}

function getAuthToken(request) {
  const value = request.headers.authorization;
  if (!value || !value.startsWith("Bearer ")) {
    return null;
  }
  return value.slice("Bearer ".length).trim();
}

function toPublicCampaign(config, campaign) {
  return {
    campaignName: campaign.campaign_name,
    claimStartAt: campaign.claim_start_at,
    claimEndAt: campaign.claim_end_at,
    coinAmount: campaign.coin_amount,
    nft: {
      name: campaign.nft_name,
      description: campaign.nft_description,
      imageUrl: config.nftImageUrl,
    },
    termsUrl: campaign.terms_url,
  };
}

async function serveStaticFile(config, requestPath, response) {
  const publicRoot = path.resolve(path.join(config.projectRoot, "public"));
  const normalizedRelativePath =
    requestPath === "/"
      ? "index.html"
      : decodeURIComponent(requestPath).replace(/^\/+/, "");

  const resolvedPath = path.resolve(publicRoot, normalizedRelativePath);

  if (!resolvedPath.startsWith(`${publicRoot}${path.sep}`) && resolvedPath !== publicRoot) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileBuffer = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    response.statusCode = 200;
    response.setHeader(
      "content-type",
      CONTENT_TYPES[extension] ?? "application/octet-stream",
    );
    response.setHeader("cache-control", "no-store");
    response.end(fileBuffer);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "Not Found");
      return;
    }
    sendText(response, 500, "Static file error");
  }
}

export async function startServer(overrides = {}) {
  const config = loadConfig(process.cwd(), overrides);
  const database = openDatabase(config);
  const authService = createAuthService(config);
  const kaiaService = createKaiaService(config);

  const server = http.createServer(async (request, response) => {
    try {
      const baseUrl = `http://${request.headers.host ?? `${config.host}:${config.port}`}`;
      const url = new URL(request.url ?? "/", baseUrl);
      const pathname = url.pathname;
      const method = (request.method ?? "GET").toUpperCase();

      if (method === "GET" && pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          mode: {
            lineAuth: config.lineAuthMode,
            kaiaMint: config.kaiaMintMode,
            network: config.kaiaNetwork,
            chainId: config.kaiaChainId,
          },
        });
        return;
      }

      if (method === "GET" && pathname === "/api/config/public") {
        sendJson(response, 200, {
          liffId: config.liffId,
          lineAuthMode: config.lineAuthMode,
          kaiaNetwork: config.kaiaNetwork,
          kaiaChainId: config.kaiaChainId,
        });
        return;
      }

      if (method === "GET" && pathname === "/api/campaign") {
        const campaign = database.getCampaign();
        sendJson(response, 200, toPublicCampaign(config, campaign));
        return;
      }

      if (method === "POST" && pathname === "/api/auth/line") {
        const body = await readJsonBody(request);
        const identity = await authService.resolveLineIdentity({
          idToken: body.idToken,
          profile: body.profile,
        });

        database.upsertUserOnAuth({
          lineUserId: identity.lineUserId,
          displayName: identity.displayName,
        });

        const token = authService.issueSession({
          lineUserId: identity.lineUserId,
          displayName: identity.displayName,
        });

        const me = database.getMyPage({
          lineUserId: identity.lineUserId,
          fallbackDisplayName: identity.displayName,
        });

        sendJson(response, 200, {
          token,
          profile: {
            lineUserId: identity.lineUserId,
            lineDisplayName: identity.displayName,
          },
          me,
        });
        return;
      }

      if (method === "GET" && pathname === "/api/me") {
        const token = getAuthToken(request);
        const session = authService.verifySession(token);
        if (!session) {
          sendJson(response, 401, { message: "Unauthorized" });
          return;
        }

        const me = database.getMyPage({
          lineUserId: session.lineUserId,
          fallbackDisplayName: session.displayName,
        });

        sendJson(response, 200, me);
        return;
      }

      if (method === "POST" && pathname === "/api/claim") {
        const token = getAuthToken(request);
        const session = authService.verifySession(token);
        if (!session) {
          sendJson(response, 401, { message: "Unauthorized" });
          return;
        }


        const campaign = database.getCampaign();
        const now = Date.now();
        const startAt = Date.parse(campaign.claim_start_at);
        const endAt = Date.parse(campaign.claim_end_at);

        if (Number.isFinite(startAt) && now < startAt) {
          sendJson(response, 403, { message: "配布開始前です。" });
          return;
        }

        if (Number.isFinite(endAt) && now > endAt) {
          sendJson(response, 403, { message: "配布期間が終了しました。" });
          return;
        }

        const reservation = database.reserveClaim({
          lineUserId: session.lineUserId,
          displayName: session.displayName,
          coinAmount: campaign.coin_amount,
        });

        if (reservation.status !== "reserved") {
          const me = database.getMyPage({
            lineUserId: session.lineUserId,
            fallbackDisplayName: session.displayName,
          });
          sendJson(response, 409, {
            message: "すでに受け取り済みです。",
            me,
          });
          return;
        }

        try {
          const mintResult = await kaiaService.mintReward({
            lineUserId: session.lineUserId,
            walletAddress: reservation.walletAddress,
            coinAmount: campaign.coin_amount,
          });

          database.completeClaim({
            claimId: reservation.claimId,
            mintResult,
          });

          const me = database.getMyPage({
            lineUserId: session.lineUserId,
            fallbackDisplayName: session.displayName,
          });

          sendJson(response, 200, {
            message: "取得が完了しました。",
            claim: {
              claimId: reservation.claimId,
              nftTokenId: mintResult.nftTokenId,
              coinAmount: campaign.coin_amount,
            },
            me,
          });
        } catch (error) {
          database.failClaim({
            claimId: reservation.claimId,
            errorReason: String(error.message ?? error),
          });

          sendJson(response, 502, {
            message: "付与処理に失敗しました。時間をおいて再試行してください。",
          });
        }

        return;
      }

      if (pathname.startsWith("/api/")) {
        sendJson(response, 404, { message: "API Not Found" });
        return;
      }

      await serveStaticFile(config, pathname, response);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { message: "Invalid JSON" });
        return;
      }

      if (error?.message === "REQUEST_BODY_TOO_LARGE") {
        sendJson(response, 413, { message: "Request body too large" });
        return;
      }

      sendJson(response, 500, {
        message: "Internal Server Error",
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });

  server.on("close", () => {
    database.close();
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;

  if (!overrides.silent) {
    // eslint-disable-next-line no-console
    console.log(
      `[takeitoken-poc] listening on http://${config.host}:${port} (LINE=${config.lineAuthMode}, KAIA=${config.kaiaMintMode})`,
    );
  }

  return {
    server,
    port,
    config,
  };
}

const isEntryPoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntryPoint) {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}

