import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "toolbox-64694";
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "POST required" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return respond({ error: "Please sign in first." }, 401);

  let firebaseUid: string;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: PROJECT_ID,
    });
    if (typeof payload.sub !== "string" || !payload.sub) {
      return respond({ error: "Invalid account token." }, 401);
    }
    firebaseUid = payload.sub;
  } catch (_error) {
    return respond({ error: "Your sign-in has expired. Please sign in again." }, 401);
  }

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "balance") {
      const [{ data: wallet, error: walletError }, { data: premium, error: premiumError }] = await Promise.all([
        admin.from("toolbox_wallets").select("coins").eq("firebase_uid", firebaseUid).maybeSingle(),
        admin.from("toolbox_premium_access").select("product_id, expires_at").eq("firebase_uid", firebaseUid),
      ]);
      if (walletError) throw walletError;
      if (premiumError) throw premiumError;
      return respond({ coins: wallet?.coins ?? 0, premium: premium ?? [] });
    }

    if (action === "claim") {
      const { data, error } = await admin.rpc("toolbox_claim_reward", {
        p_firebase_uid: firebaseUid,
        p_tool_id: body?.toolId,
      });
      if (error) {
        if (error.message?.includes("Already claimed")) return respond({ error: "Already claimed today." }, 409);
        if (error.message?.includes("Invalid tool")) return respond({ error: "Invalid tool." }, 400);
        throw error;
      }
      return respond(data);
    }

    if (action === "purchase") {
      const { data, error } = await admin.rpc("toolbox_purchase_premium", {
        p_firebase_uid: firebaseUid,
        p_product_id: body?.productId,
      });
      if (error) {
        if (error.message?.includes("Not enough coins")) return respond({ error: "Not enough coins." }, 400);
        if (error.message?.includes("Invalid product")) return respond({ error: "Invalid product." }, 400);
        throw error;
      }
      return respond(data);
    }

    return respond({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("ToolBoxHub backend error:", error);
    return respond({ error: "Server error. Please try again." }, 500);
  }
});
