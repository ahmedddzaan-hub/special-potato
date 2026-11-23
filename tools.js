// ======================================================
// ToolBoxHub - Shared Tools System
// One file for ALL tools, rewards, wallet + premium
// ======================================================

import { supabase } from "./supabase.js";

const TOOLBOX_FUNCTION =
  "https://nqmfoanobabkvdpuvmse.supabase.co/functions/v1/toolboxhub";

const SUPABASE_ANON_KEY =
  "sb_publishable_PuiuUdMLfsTLAkAaCNpQ9A_ffgCw_1l";


// ======================================================
// TOOL CONFIG
// ======================================================

export const TOOLS = {

  qr: {
    name: "QR Code Generator",
    reward: true
  },

  "image-resizer": {
    name: "Image Resizer",
    reward: true
  },

  "json-formatter": {
    name: "JSON Formatter",
    reward: true
  },

  "color-palette": {
    name: "Color Palette",
    reward: true
  },

  "username-generator": {
    name: "Username Generator",
    reward: true
  },

  "password-generator": {
    name: "Password Generator",
    reward: true
  },

  "text-case-converter": {
    name: "Text Case Converter",
    reward: true
  },

  "word-counter": {
    name: "Word Counter",
    reward: true
  },

  "pfp-maker": {
    name: "PFP Maker",
    reward: true
  }

};


// ======================================================
// GET CURRENT USER
// ======================================================

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


// ======================================================
// GET SESSION
// ======================================================

async function getSession() {

  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  return session;
}


// ======================================================
// MAIN BACKEND REQUEST
// ======================================================

export async function request(body) {

  const session = await getSession();

  let response;

  try {

    response = await fetch(
      TOOLBOX_FUNCTION,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${session.access_token}`,
          "apikey":
            SUPABASE_ANON_KEY
        },

        body: JSON.stringify(body)
      }
    );

  } catch (error) {

    console.error(
      "ToolBoxHub connection error:",
      error
    );

    throw new Error(
      "Could not connect to ToolBoxHub."
    );
  }


  const raw =
    await response.text();

  let data = {};

  try {

    data =
      raw ? JSON.parse(raw) : {};

  } catch {

    console.error(
      "Invalid ToolBoxHub response:",
      raw
    );

    throw new Error(
      "ToolBoxHub returned an invalid response."
    );
  }


  console.log(
    "ToolBoxHub:",
    response.status,
    data
  );


  if (!response.ok) {

    throw new Error(
      data.error ||
      data.details ||
      `Request failed (${response.status}).`
    );
  }


  if (data.error) {
    throw new Error(data.error);
  }


  return data;
}


// ======================================================
// WALLET
// ======================================================

export async function getWallet() {

  return request({
    action: "balance"
  });

}


// ======================================================
// CLAIM REWARD
// ======================================================

export async function claimReward(toolId) {

  if (!TOOLS[toolId]) {

    throw new Error(
      "Unknown ToolBoxHub tool."
    );

  }

  return request({
    action: "claim",
    toolId: toolId
  });

}


// ======================================================
// REWARD AFTER SUCCESSFUL TOOL USE
// ======================================================
//
// IMPORTANT:
//
// This function should ONLY be called AFTER
// the actual tool operation succeeds.
//
// Clicking a tool card does NOT call this.
//
// ======================================================

export async function rewardAfterUse(toolId) {

  try {

    const result =
      await claimReward(toolId);

    console.log(
      `Reward completed for ${toolId}:`,
      result
    );

    return {
      success: true,
      reward:
        result.reward ??
        result.coinsAwarded ??
        12,
      data: result
    };

  } catch (error) {

    console.error(
      `Reward failed for ${toolId}:`,
      error
    );

    return {
      success: false,
      error: error.message
    };

  }

}


// ======================================================
// GET WALLET COINS
// ======================================================

export async function getCoins() {

  const wallet =
    await getWallet();

  return Number(
    wallet?.coins ?? 0
  );

}


// ======================================================
// REFRESH WALLET ELEMENTS
// ======================================================
//
// Any page can have:
//
// <span id="coinBalance"></span>
//
// and this function will update it.
//
// ======================================================

export async function refreshWallet() {

  try {

    const wallet =
      await getWallet();

    const coins =
      Number(wallet?.coins ?? 0);


    const elements = [

      document.getElementById(
        "coinBalance"
      ),

      document.getElementById(
        "coins"
      ),

      document.getElementById(
        "walletCoins"
      ),

      document.getElementById(
        "walletBalance"
      )

    ];


    elements.forEach(element => {

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


// ======================================================
// SHOW MESSAGE
// ======================================================

export function showToolMessage(
  message,
  type = "info"
) {

  let box =
    document.getElementById(
      "toolMessage"
    );


  if (!box) {

    box =
      document.createElement(
        "div"
      );

    box.id =
      "toolMessage";

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


  box.textContent =
    message;

}


// ======================================================
// COMPLETE TOOL
// ======================================================
//
// This is the MAIN function.
//
// Usage:
//
// await completeTool("qr");
//
// ONLY call this after the tool successfully
// completed its job.
//
// ======================================================

export async function completeTool(
  toolId
) {

  if (!TOOLS[toolId]) {

    showToolMessage(
      "Invalid ToolBoxHub tool.",
      "error"
    );

    return {
      success: false
    };

  }


  showToolMessage(
    `${TOOLS[toolId].name} completed. Checking reward...`
  );


  const result =
    await rewardAfterUse(
      toolId
    );


  if (result.success) {

    await refreshWallet();


    showToolMessage(
      `✓ Tool used successfully. You earned ${result.reward} coins!`,
      "success"
    );

  } else {

    const message =
      result.error || "Reward unavailable.";


    if (
      message
        .toLowerCase()
        .includes("already claimed")
    ) {

      showToolMessage(
        "✓ Tool completed. You already claimed today's reward.",
        "info"
      );

    } else {

      showToolMessage(
        `✓ Tool completed, but the reward could not be added: ${message}`,
        "error"
      );

    }

  }


  return result;

}


// ======================================================
// TOOL START HELPER
// ======================================================
//
// Optional helper for tools.
//
// Example:
//
// await runTool("qr", async () => {
//
//    // generate QR
//
// });
//
// If the function finishes without throwing,
// the reward is automatically processed.
//
// ======================================================

export async function runTool(
  toolId,
  operation
) {

  if (!TOOLS[toolId]) {

    throw new Error(
      "Invalid ToolBoxHub tool."
    );

  }


  try {

    showToolMessage(
      `Using ${TOOLS[toolId].name}...`
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
      error.message ||
      "The tool could not complete.",
      "error"
    );


    return {
      success: false,
      error: error.message
    };

  }

}


// ======================================================
// LOGIN CHECK
// ======================================================

export async function requireLogin() {

  try {

    return await getUser();

  } catch (error) {

    showToolMessage(
      "Please sign in to use this tool.",
      "error"
    );

    throw error;

  }

}


// ======================================================
// INITIAL WALLET LOAD
// ======================================================

export async function initializeToolPage() {

  try {

    await requireLogin();

    await refreshWallet();

    return true;

  } catch {

    return false;

  }

}


// ======================================================
// PREMIUM PURCHASE
// ======================================================

export async function purchasePremium(
  productId
) {

  return request({
    action: "purchase",
    productId
  });

}


// ======================================================
// PREMIUM CHECK
// ======================================================

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


// ======================================================
// TOOLBOXHUB GLOBAL API
// ======================================================
//
// This also makes the system accessible from
// normal <script> code if needed.
//
// ======================================================

window.ToolBoxHub = {

  tools: TOOLS,

  getUser,

  request,

  getWallet,

  getCoins,

  refreshWallet,

  claimReward,

  rewardAfterUse,

  completeTool,

  runTool,

  requireLogin,

  initializeToolPage,

  purchasePremium,

  hasPremium,

  showToolMessage

};
