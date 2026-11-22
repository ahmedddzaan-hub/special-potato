
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const validTools = [
  "qr",
  "image-resizer",
  "json-formatter",
  "color-palette",
  "username-generator",
  "password-generator",
  "text-case-converter",
  "word-counter",
  "pfp-maker",
];

const validProducts = [
  "pfp-maker-pro",
  "qr-maker-pro",
  "background-remover",
  "pdf-pro",
  "ai-logo-maker",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "POST required." }, 405);
  }

  try {
    // Authenticate with Supabase, not Firebase.
    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return respond({ error: "Please sign in first." }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return respond({
        error: "Your session has expired. Please sign in again.",
      }, 401);
    }

    const body = await req.json();
    const action = body?.action;

    // WALLET BALANCE
    if (action === "balance") {
      const [
        { data: wallet, error: walletError },
        { data: premium, error: premiumError },
      ] = await Promise.all([
        admin
          .from("wallets")
          .select("coins")
          .eq("user_id", user.id)
          .maybeSingle(),

        admin
          .from("premium_purchases")
          .select("product_id, expires_at")
          .eq("user_id", user.id)
          .order("expires_at", { ascending: false }),
      ]);

      if (walletError) throw walletError;
      if (premiumError) throw premiumError;

      return respond({
        coins: wallet?.coins ?? 0,
        premium: premium ?? [],
      });
    }

    // CLAIM DAILY TOOL REWARD
    if (
      action === "claim" ||
      action === "claim_reward" ||
      action === "claim_tool_reward"
    ) {
      const toolId = body?.toolId ?? body?.tool_id;

      if (!validTools.includes(toolId)) {
        return respond({ error: "Invalid tool." }, 400);
      }

      // 95% chance of 12 coins, 5% chance of 15 coins.
      const reward = Math.random() < 0.05 ? 15 : 12;

      const { data, error } = await admin.rpc("claim_tool_reward", {
        p_user_id: user.id,
        p_tool_id: toolId,
        p_reward: reward,
      });

      if (error) {
        if (
          error.code === "23505" ||
          error.message?.toLowerCase().includes("duplicate")
        ) {
          return respond({ error: "Already claimed today." }, 409);
        }

        if (error.message?.includes("Invalid tool")) {
          return respond({ error: "Invalid tool." }, 400);
        }

        throw error;
      }

      return respond(data);
    }

    // PURCHASE PREMIUM
    if (
      action === "purchase" ||
      action === "purchase_premium" ||
      action === "purchase_toolbox_premium"
    ) {
      const productId = body?.productId ?? body?.product_id;

      if (!validProducts.includes(productId)) {
        return respond({ error: "Invalid product." }, 400);
      }

      const { data, error } = await admin.rpc(
        "purchase_toolbox_premium",
        {
          p_user_id: user.id,
          p_product_id: productId,
        }
      );

      if (error) {
        if (error.message?.includes("Not enough coins")) {
          return respond({ error: "Not enough coins." }, 400);
        }

        if (error.message?.includes("Invalid product")) {
          return respond({ error: "Invalid product." }, 400);
        }

        throw error;
      }

      return respond(data);
    }

    return respond({ error: "Unknown action." }, 400);

  } catch (error) {
    console.error("ToolBoxHub backend error:", error);

    return respond({
      error: "Server error. Please try again.",
    }, 500);
  }
});
