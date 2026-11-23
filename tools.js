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

async function getSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error("Please sign in first.");
  }

  return session;
}

export async function getUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("Please sign in first.");
  }

  return user;
}

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

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      "Invalid response from ToolBoxHub."
    );
  }

  console.log(
    "ToolBoxHub:",
    response.status,
    data
  );

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.details ||
      `Request failed (${response.status}).`
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function getWallet() {
  return request({
    action: "balance"
  });
}

export async function getCoins() {
  const wallet = await getWallet();

  return Number(
    wallet?.coins ?? 0
  );
}

export async function claimReward(toolId) {
  if (!TOOLS[toolId]) {
    throw new Error(
      "Invalid ToolBoxHub tool."
    );
  }

  return request({
    action: "claim",
    toolId
  });
}

export async function refreshWallet() {
  try {
    const wallet = await getWallet();

    const coins = Number(
      wallet?.coins ?? 0
    );

    // Update any wallet counters that exist.
    const ids = [
      "coinBalance",
      "coins",
      "walletCoins",
      "walletBalance"
    ];

    ids.forEach(id => {
      const element =
        document.getElementById(id);

      if (element) {
        element.textContent =
          `${coins} coins`;
      }
    });

    return coins;

  } catch (error) {
    console.error(
      "Wallet refresh failed:",
      error
    );

    return null;
  }
}

export function showToolMessage(
  message,
  type = "info"
) {
  let box =
    document.getElementById(
      "toolMessage"
    );

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

  if (type === "success") {
    box.style.borderColor =
      "#36d399";
  } else if (type === "error") {
    box.style.borderColor =
      "#ff6b6b";
  } else {
    box.style.borderColor =
      "#6c63ff";
  }

  box.textContent = message;
}

export async function completeTool(toolId) {
  if (!TOOLS[toolId]) {
    throw new Error(
      "Invalid ToolBoxHub tool."
    );
  }

  showToolMessage(
    `${TOOLS[toolId]} completed. Checking reward...`
  );

  try {
    const result =
      await claimReward(toolId);

    // IMPORTANT:
    // Use the total returned directly from
    // the database instead of relying only
    // on a separate wallet refresh.
    const reward = Number(
      result?.reward ??
      result?.coinsAwarded ??
      0
    );

    const totalCoins = Number(
      result?.totalCoins ??
      0
    );

    // Update wallet UI immediately.
    const ids = [
      "coinBalance",
      "coins",
      "walletCoins",
      "walletBalance"
    ];

    ids.forEach(id => {
      const element =
        document.getElementById(id);

      if (element) {
        element.textContent =
          `${totalCoins} coins`;
      }
    });

    // Also verify the wallet from the server.
    await refreshWallet();

    if (reward <= 0) {
      showToolMessage(
        "Tool completed, but no reward was returned.",
        "error"
      );

      return {
        success: false,
        reward: 0,
        data: result
      };
    }

    showToolMessage(
      `✓ You earned ${reward} coins!`,
      "success"
    );

    return {
      success: true,
      reward,
      totalCoins,
      data: result
    };

  } catch (error) {
    console.error(
      "Reward error:",
      error
    );

    const message =
      error?.message ||
      "Reward failed.";

    showToolMessage(
      `✓ Tool completed, but reward could not be added: ${message}`,
      "error"
    );

    return {
      success: false,
      error: message
    };
  }
}

export async function runTool(
  toolId,
  operation
) {
  try {
    await getUser();

    showToolMessage(
      `Using ${TOOLS[toolId]}...`
    );

    await operation();

    return await completeTool(
      toolId
    );

  } catch (error) {
    console.error(
      `${toolId} failed:`,
      error
    );

    showToolMessage(
      error?.message ||
      "The tool could not complete.",
      "error"
    );

    return {
      success: false,
      error: error?.message
    };
  }
}

export async function requireLogin() {
  return getUser();
}

export async function initializeToolPage() {
  try {
    await getUser();

    // Don't display a "Wallet: Loading"
    // message on individual tools.
    // The homepage handles the wallet display.

    return true;

  } catch {
    showToolMessage(
      "Please sign in to use this tool.",
      "error"
    );

    return false;
  }
}

export async function purchasePremium(
  productId
) {
  return request({
    action: "purchase",
    productId
  });
}

export async function hasPremium(
  productId
) {
  const wallet =
    await getWallet();

  const premium =
    wallet?.premium || [];

  return premium.some(
    item =>
      item.product_id === productId
  );
}

window.ToolBoxHub = {
  tools: TOOLS,
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
