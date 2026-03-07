import crypto from "node:crypto";

function base64urlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function sign(value, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function secureEquals(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

async function verifyLineIdToken(config, idToken) {
  if (!idToken) {
    throw new Error("LINE id_token is required.");
  }

  const params = new URLSearchParams();
  params.set("id_token", idToken);
  params.set("client_id", config.lineLoginChannelId);

  // TODO: In production, monitor LINE verify API failures and add retry/backoff.
  const response = await fetch(config.lineIdTokenVerifyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error("LINE id_token verification failed.");
  }

  const payload = await response.json();
  if (!payload.sub) {
    throw new Error("LINE verification response does not contain sub.");
  }

  return {
    lineUserId: payload.sub,
    displayName: payload.name ?? "LINE User",
  };
}

export function createAuthService(config) {
  return {
    issueSession({ lineUserId, displayName }) {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        lineUserId,
        displayName,
        iat: now,
        exp: now + config.sessionTtlSeconds,
      };

      const payloadJson = JSON.stringify(payload);
      const payloadEncoded = base64urlEncode(payloadJson);
      const signature = sign(payloadEncoded, config.sessionSigningSecret);
      return `${payloadEncoded}.${signature}`;
    },

    verifySession(token) {
      if (!token || !token.includes(".")) {
        return null;
      }

      const [payloadEncoded, signature] = token.split(".");
      const expected = sign(payloadEncoded, config.sessionSigningSecret);
      if (!secureEquals(expected, signature)) {
        return null;
      }

      let payload;
      try {
        payload = JSON.parse(base64urlDecode(payloadEncoded));
      } catch {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (!payload.exp || payload.exp < now) {
        return null;
      }

      if (!payload.lineUserId || !payload.displayName) {
        return null;
      }

      return payload;
    },

    async resolveLineIdentity({ idToken, profile }) {
      if (config.lineAuthMode === "dummy") {
        return {
          lineUserId: profile?.lineUserId ?? config.dummyLineUserId,
          displayName: profile?.displayName ?? config.dummyLineDisplayName,
        };
      }

      return verifyLineIdToken(config, idToken);
    },
  };
}
