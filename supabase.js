import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  "https://nqmfoanobabkvdpuvmse.supabase.co",
  "sb_publishable_PuiuUdMLfsTLAkAaCNpQ9A_ffgCw_1l",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
