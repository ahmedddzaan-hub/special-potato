import { supabase } from "./supabase.js";

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

  try {
    const response = await fetch(
      "https://nqmfoanobabkvdpuvmse.supabase.co/functions/v1/toolboxhub",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": "sb_publishable_PuiuUdMLfsTLAkAaCNpQ9A_ffgCw_1l"
        },
        body: JSON.stringify(body)
      }
    );

    const raw = await response.text();

    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(
        `ToolBoxHub returned an invalid response (${response.status}).`
      );
    }

    console.log("ToolBoxHub response:", response.status, data);

    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.details ||
        `ToolBoxHub request failed (${response.status}).`
      );
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;

  } catch (error) {
    console.error("ToolBoxHub request failed:", error);

    throw new Error(
      error?.message ||
      "Could not connect to ToolBoxHub."
    );
  }
}
