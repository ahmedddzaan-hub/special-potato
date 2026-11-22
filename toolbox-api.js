import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://nqmfoanobabkvdpuvmse.supabase.co",
  "sb_publishable_PuiuUdMLfsTLAkAaCNpQ9A_ffgCw_1l",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export async function toolboxRequest(user, body) {
  if (!user) throw new Error("Please sign in first.");
  const idToken = await user.getIdToken();
  const { data, error } = await supabase.functions.invoke("toolboxhub", {
    body,
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (error) {
    const message = data?.error || error.message || "Request failed.";
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
