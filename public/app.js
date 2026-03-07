const state = {
  token: null,
  appConfig: null,
  campaign: null,
  me: null,
  view: "claim",
};

const REQUEST_TIMEOUT_MS = 15000;
const COIN_IMAGE_URL = "/assets/TAKEI_COIN.png";
const COIN_IMAGE_FALLBACK_URL = "/assets/TAKEI_COIN.png";

const elements = {
  message: document.querySelector("#status-message"),
  claimView: document.querySelector("#claim-view"),
  completeView: document.querySelector("#complete-view"),
  mypageView: document.querySelector("#mypage-view"),
  termsCheckbox: document.querySelector("#terms-checkbox"),
  claimButton: document.querySelector("#claim-button"),
  processingModal: document.querySelector("#processing-modal"),
  toMypageButton: document.querySelector("#to-mypage-button"),
  backLineButton: document.querySelector("#back-line-button"),
};

function setMessage(text, { error = false } = {}) {
  if (!text) {
    elements.message.hidden = true;
    elements.message.textContent = "";
    elements.message.classList.remove("error");
    return;
  }

  elements.message.hidden = false;
  elements.message.textContent = text;
  elements.message.classList.toggle("error", error);
}

function setProcessing(isLoading) {
  elements.processingModal.hidden = !isLoading;
  elements.claimButton.disabled =
    isLoading || !elements.termsCheckbox.checked || state.me?.claimed;
}

function setView(view) {
  state.view = view;
  elements.claimView.hidden = view !== "claim";
  elements.completeView.hidden = view !== "complete";
  elements.mypageView.hidden = view !== "mypage";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ja-JP");
}

function setupCoinImages() {
  const coinImages = document.querySelectorAll(".coin-image");
  for (const image of coinImages) {
    image.src = COIN_IMAGE_URL;
    image.addEventListener(
      "error",
      () => {
        image.src = COIN_IMAGE_FALLBACK_URL;
      },
      { once: true },
    );
  }
}

function hydrateCampaign(campaign) {
  const descriptionElement = document.querySelector("#claim-nft-description");

  document.querySelector("#claim-nft-image").src = campaign.nft.imageUrl;
  document.querySelector("#complete-nft-image").src = campaign.nft.imageUrl;
  const mypageNftImage = document.querySelector("#mypage-nft-image");
  if (mypageNftImage) {
    mypageNftImage.src = campaign.nft.imageUrl;
  }
  document.querySelector("#claim-nft-name").textContent = campaign.nft.name;

  descriptionElement.textContent = campaign.nft.description ?? "";
  descriptionElement.hidden = !campaign.nft.description;

  document.querySelector("#claim-summary").textContent = `NFT 1\u679A + ${campaign.coinAmount.toLocaleString("ja-JP")} TAKEI TOKEN \u3092\u53D7\u3051\u53D6\u308C\u307E\u3059`;
  document.querySelector("#complete-coin-text").textContent = `${campaign.coinAmount.toLocaleString("ja-JP")} TAKEI TOKEN \u53D7\u3051\u53D6\u308A\u6E08\u307F`;
  document.querySelector("#terms-link").href = campaign.termsUrl;
}

function renderMypage(me) {
  document.querySelector("#mypage-display-name").textContent = me.lineDisplayName;
  document.querySelector("#mypage-status").textContent = me.statusText;
  document.querySelector("#mypage-coin-balance").textContent = `${Number(me.coinBalance).toLocaleString("ja-JP")} TTK`;
  document.querySelector("#mypage-claimed-at").textContent = formatDate(me.claimedAt);
  document.querySelector("#mypage-nft-name").textContent = me.nft.name;
}

async function api(path, options = {}) {
  const headers = {
    ...(options.headers ?? {}),
  };

  if (options.body && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  if (state.token) {
    headers.authorization = `Bearer ${state.token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("\u901A\u4FE1\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F\u3002\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u3092\u78BA\u8A8D\u3057\u3066\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(payload?.message ?? `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function trySessionReuse() {
  const existingToken = localStorage.getItem("takeitoken_session_token");
  if (!existingToken) {
    return false;
  }

  state.token = existingToken;

  try {
    state.me = await api("/api/me");
    return true;
  } catch {
    localStorage.removeItem("takeitoken_session_token");
    state.token = null;
    return false;
  }
}

async function authenticateWithDummy() {
  const params = new URLSearchParams(window.location.search);
  const lineUserId = params.get("lineUserId") ?? undefined;
  const displayName = params.get("displayName") ?? undefined;

  const authResponse = await api("/api/auth/line", {
    method: "POST",
    body: JSON.stringify({
      profile: {
        lineUserId,
        displayName,
      },
    }),
  });

  state.token = authResponse.token;
  localStorage.setItem("takeitoken_session_token", state.token);
  state.me = authResponse.me;
}

async function authenticateWithLine() {
  if (!window.liff) {
    throw new Error("LIFF SDK\u304C\u8AAD\u307F\u8FBC\u307E\u308C\u3066\u3044\u307E\u305B\u3093\u3002");
  }

  if (!state.appConfig.liffId || state.appConfig.liffId.startsWith("TODO_")) {
    throw new Error("LIFF_ID \u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002env \u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  }

  await window.liff.init({ liffId: state.appConfig.liffId });

  if (!window.liff.isLoggedIn()) {
    window.liff.login({ redirectUri: window.location.href });
    return false;
  }

  const idToken = window.liff.getIDToken();
  const profile = await window.liff.getProfile();

  const authResponse = await api("/api/auth/line", {
    method: "POST",
    body: JSON.stringify({
      idToken,
      profile: {
        lineUserId: profile.userId,
        displayName: profile.displayName,
      },
    }),
  });

  state.token = authResponse.token;
  localStorage.setItem("takeitoken_session_token", state.token);
  state.me = authResponse.me;
  return true;
}

async function bootstrapAuth() {
  if (await trySessionReuse()) {
    return true;
  }

  if (state.appConfig.lineAuthMode === "line") {
    return authenticateWithLine();
  }

  await authenticateWithDummy();
  return true;
}

async function refreshMypage() {
  state.me = await api("/api/me");
  renderMypage(state.me);
}

async function handleClaim() {
  if (!elements.termsCheckbox.checked) {
    setMessage("\u5229\u7528\u898F\u7D04\u306B\u540C\u610F\u3057\u3066\u304F\u3060\u3055\u3044\u3002", { error: true });
    return;
  }

  setMessage("");
  setProcessing(true);

  try {
    const result = await api("/api/claim", {
      method: "POST",
      body: JSON.stringify({ termsAgreed: true }),
    });

    state.me = result.me;
    renderMypage(state.me);
    setView("complete");
    setMessage(result.message);
  } catch (error) {
    if (error.status === 409 && error.payload?.me) {
      state.me = error.payload.me;
      renderMypage(state.me);
      setView("mypage");
      setMessage("\u3059\u3067\u306B\u53D7\u3051\u53D6\u308A\u6E08\u307F\u3067\u3059\u3002", { error: true });
    } else {
      setMessage(error.message, { error: true });
    }
  } finally {
    setProcessing(false);
  }
}

function registerEvents() {
  elements.termsCheckbox.addEventListener("change", () => {
    elements.claimButton.disabled = !elements.termsCheckbox.checked || state.me?.claimed;
  });

  elements.claimButton.addEventListener("click", handleClaim);

  elements.toMypageButton.addEventListener("click", () => {
    setView("mypage");
  });

  elements.backLineButton.addEventListener("click", () => {
    if (window.liff && window.liff.isInClient()) {
      window.liff.closeWindow();
      return;
    }
    window.location.href = "https://line.me";
  });
}

async function init() {
  registerEvents();

  try {
    setupCoinImages();

    const [appConfig, campaign] = await Promise.all([
      api("/api/config/public"),
      api("/api/campaign"),
    ]);

    state.appConfig = appConfig;
    state.campaign = campaign;

    hydrateCampaign(campaign);

    const authenticated = await bootstrapAuth();
    if (!authenticated) {
      return;
    }

    await refreshMypage();

    if (state.me.claimed) {
      setView("mypage");
    } else {
      setView("claim");
    }

    elements.claimButton.disabled = !elements.termsCheckbox.checked;
  } catch (error) {
    setMessage(error.message ?? "\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002", { error: true });
  }
}

init();