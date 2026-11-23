
import { supabase } from "./supabase.js";

const FUNCTION_URL =
  "https://nqmfoanobabkvdpuvmse.supabase.co/functions/v1/toolboxhub";

const ANON_KEY =
  "sb_publishable_PuiuUdMLfsTLAkAaCNpQ9A_ffgCw_1l";

export const TOOLS = {
  qr: "QR Code Generator",
  "image-resizer": "Image Resizer",
  "json-formatter": "JSON Formatter",
  "color-palette": "Color Palette",
  "username-generator": "Username Generator",
  "password-generator": "Password Generator",
  "text-case-converter": "Text Case Converter",
  "word-counter": "Word Counter",
  "pfp-maker": "PFP Maker"
};

// Remove old wallet loading labels.
function removeWalletLoading() {
  if (!document.body) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(node => {
    if (/wallet\s*:\s*loading\.{0,3}/i.test(node.textContent)) {
      node.textContent = node.textContent.replace(
        /wallet\s*:\s*loading\.{0,3}/gi,
        ""
      );
    }
  });
}

if (document.body) {
  removeWalletLoading();

  const observer = new MutationObserver(removeWalletLoading);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// Authentication
export async function getSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    throw new Error("Could not restore your login session. Please try signing in again.");
  }

  if (!session?.access_token || !session?.user) {
    throw new Error("Please sign in first.");
  }

  return session;
}

// FIX: Use the restored session instead of making
// an additional getUser() network request.
export async function getUser() {
  const session = await getSession();
  return session.user;
}

// Backend request
export async function request(body) {
  const session = await getSession();

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": ANON_KEY
    },
    body: JSON.stringify(body)
  });

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Invalid server response.");
  }

  console.log("ToolBoxHub response:", response.status, data);

  if (!response.ok || data?.error) {
    throw new Error(
      data?.error ||
      data?.details ||
      `Request failed (${response.status}).`
    );
  }

  return data;
}

// Wallet
export async function getWallet() {
  return request({ action: "balance" });
}

export async function getCoins() {
  const wallet = await getWallet();
  return Number(wallet?.coins ?? 0);
}

function updateWalletElements(coins) {
  const ids = [
    "coinBalance",
    "coins",
    "walletCoins",
    "walletBalance"
  ];

  ids.forEach(id => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = `${coins} coins`;
    }
  });
}

export async function refreshWallet() {
  try {
    const wallet = await getWallet();
    const coins = Number(wallet?.coins ?? 0);

    updateWalletElements(coins);
    removeWalletLoading();

    return coins;
  } catch (error) {
    console.error("Wallet refresh failed:", error);
    return null;
  }
}

// Rewards
export async function claimReward(toolId) {
  if (!TOOLS[toolId]) {
    throw new Error("Invalid ToolBoxHub tool.");
  }

  return request({
    action: "claim",
    toolId
  });
}

// Messages
export function showToolMessage(message, type = "info") {
  let box = document.getElementById("toolMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "toolMessage";

    box.style.cssText = `
      margin-top:15px;
      padding:12px 15px;
      border-radius:10px;
      background:#12151c;
      border:1px solid #292e39;
      color:#fff;
      font-size:14px;
    `;

    document.body.appendChild(box);
  }

  box.style.borderColor =
    type === "success" ? "#36d399" :
    type === "error" ? "#ff6b6b" :
    "#6c63ff";

  box.textContent = message;
}

// Complete a tool and claim its reward.
export async function completeTool(toolId) {
  if (!TOOLS[toolId]) {
    throw new Error("Invalid tool.");
  }

  showToolMessage("Checking your reward...");

  try {
    const result = await claimReward(toolId);

    const reward = Number(
      result?.reward ??
      result?.coinsAwarded ??
      0
    );

    const totalCoins = Number(result?.totalCoins);

    if (!Number.isFinite(reward) || reward <= 0) {
      throw new Error("No valid reward was returned.");
    }

    if (Number.isFinite(totalCoins)) {
      updateWalletElements(totalCoins);
    }

    const refreshedCoins = await refreshWallet();

    showToolMessage(
      `✓ You earned ${reward} coins!` +
      (
        refreshedCoins !== null
          ? ` Wallet: ${refreshedCoins} coins.`
          : ""
      ),
      "success"
    );

    return {
      success: true,
      reward,
      totalCoins: refreshedCoins ?? totalCoins,
      data: result
    };

  } catch (error) {
    console.error("Reward error:", error);

    showToolMessage(
      `Tool completed, but reward failed: ${error.message}`,
      "error"
    );

    return {
      success: false,
      error: error.message
    };
  }
}

// Run a tool operation.
export async function runTool(toolId, operation) {
  try {
    if (!TOOLS[toolId]) {
      throw new Error("Invalid ToolBoxHub tool.");
    }

    if (typeof operation !== "function") {
      throw new Error("Invalid tool operation.");
    }

    await getUser();

    showToolMessage(`Using ${TOOLS[toolId]}...`);

    await operation();

    return await completeTool(toolId);

  } catch (error) {
    console.error(`${toolId} failed:`, error);

    showToolMessage(
      error?.message || "The tool could not complete.",
      "error"
    );

    return {
      success: false,
      error: error.message
    };
  }
}

// Login protection
export async function requireLogin() {
  return getUser();
}

export async function initializeToolPage() {
  try {
    const user = await getUser();

    if (!user) {
      throw new Error("Please sign in first.");
    }

    removeWalletLoading();

    // Wallet errors must not invalidate a login session.
    await refreshWallet();

    return true;

  } catch (error) {
    console.error("Tool page authentication failed:", error);

    showToolMessage(
      "Please sign in to use this tool.",
      "error"
    );

    return false;
  }
}

// Premium
export async function purchasePremium(productId) {
  return request({
    action: "purchase",
    productId
  });
}

export async function hasPremium(productId) {
  const wallet = await getWallet();

  return (wallet?.premium || []).some(
    item => item.product_id === productId
  );
}

// Global access
window.ToolBoxHub = {
  tools: TOOLS,
  getSession,
  getUser,
  request,
  getWallet,
  getCoins,
  claimReward,
  refreshWallet,
  completeTool,
  runTool,
  requireLogin,
  initializeToolPage,
  purchasePremium,
  hasPremium,
  showToolMessage
};
