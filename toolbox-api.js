import { supabase } from "./supabase.js";

const FUNCTION_URL =
  "https://nqmfoanobabkvdpuvmse.supabase.co/functions/v1/toolboxhub";

export async function toolboxRequest(user, body) {
  if (!user) {
    throw new Error("Please sign in first.");
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  let response;

  try {
    response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": "sb_publishable_PuiuUdMLfsTLAkAaCNpQ9A_ffgCw_1l"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error("ToolBoxHub network error:", error);
    throw new Error(
      "Could not connect to ToolBoxHub. Check your internet connection."
    );
  }

  const raw = await response.text();

  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    console.error("Invalid backend response:", raw);
    throw new Error("ToolBoxHub returned an invalid response.");
  }

  console.log("ToolBoxHub response:", response.status, data);

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.details ||
      `ToolBoxHub request failed (${response.status}).`
    );
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function getToolboxUser() {
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

export async function getToolboxBalance(user) {
  return toolboxRequest(user, {
    action: "balance"
  });
}

export async function claimToolReward(user, toolId) {
  return toolboxRequest(user, {
    action: "claim",
    toolId
  });
}
