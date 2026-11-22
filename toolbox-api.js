
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
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const { data, error } = await supabase.functions.invoke(
    "toolboxhub",
    {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  );

  if (error) {
    console.error("ToolBoxHub function error:", error);
    throw new Error(
      data?.error || error.message || "Request failed."
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
