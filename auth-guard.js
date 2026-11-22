import { auth } from "./firebase.js";
import { toolboxRequest } from "./toolbox-api.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const RETURN_KEY = "toolboxhub_return_to";
const TOOL_IDS = new Set([
  "qr", "image-resizer", "json-formatter", "color-palette",
  "username-generator", "password-generator", "text-case-converter",
  "word-counter", "pfp-maker"
]);

function showRewardToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed", left: "50%", bottom: "22px", transform: "translateX(-50%)",
    zIndex: "99999", background: "#19182b", color: "#f5d76e",
    border: "1px solid #514879", borderRadius: "12px", padding: "12px 16px",
    boxShadow: "0 8px 28px #0008", font: "600 14px system-ui", maxWidth: "90vw",
    textAlign: "center"
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const returnPath = window.location.pathname + window.location.search + window.location.hash;
    sessionStorage.setItem(RETURN_KEY, returnPath);
    window.location.replace("../index.html?auth=required");
    return;
  }

  document.documentElement.classList.add("toolbox-auth-ready");
  const file = window.location.pathname.split("/").pop() || "";
  const toolId = file.replace(/\.html$/i, "");
  if (TOOL_IDS.has(toolId)) {
    try {
      const result = await toolboxRequest(user, { action: "claim", toolId });
      if (result?.success) {
        showRewardToast(`You earned ${result.reward} coins! Return to ToolBoxHub to see your balance.`);
      }
    } catch (error) {
      if (!String(error.message).toLowerCase().includes("already claimed")) {
        console.warn("Daily reward was not claimed:", error.message);
      }
    }
  }
});
