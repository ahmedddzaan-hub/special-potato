import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return respond(
      {
        error: "POST required.",
      },
      405
    );
  }

  try {
    // ----------------------------------------
    // GET USER JWT
    // ----------------------------------------

    const authorization =
      req.headers.get("Authorization") ?? "";

    const token =
      authorization.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return respond(
        {
          error: "Please sign in first.",
        },
        401
      );
    }

    // ----------------------------------------
    // VERIFY USER
    // ----------------------------------------

    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error(
        "Authentication error:",
        authError
      );

      return respond(
        {
          error:
            "Your session is invalid. Please sign in again.",
        },
        401
      );
    }

    // ----------------------------------------
    // ADMIN CLIENT
    // ----------------------------------------

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        global: {
          headers: {
            // IMPORTANT:
            // Keep the user's JWT as Authorization
            // so auth.uid() inside the SQL function
            // identifies the signed-in user.
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const body = await req.json();
    const action = body?.action;

    // ----------------------------------------
    // BALANCE
    // ----------------------------------------

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
          .select(
            "product_id, expires_at"
          )
          .eq("user_id", user.id)
          .gt(
            "expires_at",
            new Date().toISOString()
          )
          .order("expires_at", {
            ascending: false,
          }),
      ]);

      if (walletError) {
        throw walletError;
      }

      if (premiumError) {
        throw premiumError;
      }

      return respond({
        coins: Number(wallet?.coins ?? 0),
        premium: premium ?? [],
      });
    }

    // ----------------------------------------
    // TOOL REWARD
    // ----------------------------------------

    if (
      [
        "claim",
        "claim_reward",
        "claim_tool_reward",
      ].includes(action)
    ) {
      const toolId =
        body?.toolId ??
        body?.tool_id;

      if (!validTools.includes(toolId)) {
        return respond(
          {
            error: "Invalid tool.",
          },
          400
        );
      }

      /*
       * DO NOT calculate the reward here.
       *
       * The SQL function handles:
       *
       * 96% = 12 coins
       * 4%  = 15 coins
       *
       * The SQL function also updates the
       * user's wallet.
       */

      const {
        data,
        error,
      } = await admin.rpc(
        "claim_tool_reward",
        {
          p_user_id: user.id,
          p_tool_id: toolId,
          p_reward: 0,
        }
      );

      if (error) {
        console.error(
          "Reward RPC error:",
          error
        );

        if (
          error.message?.includes(
            "Unauthorized"
          )
        ) {
          return respond(
            {
              error: "Unauthorized.",
            },
            401
          );
        }

        if (
          error.message?.includes(
            "Invalid tool"
          )
        ) {
          return respond(
            {
              error: "Invalid tool.",
            },
            400
          );
        }

        throw error;
      }

      return respond(data);
    }

    // ----------------------------------------
    // PREMIUM PURCHASE
    // ----------------------------------------

    if (
      [
        "purchase",
        "purchase_premium",
        "purchase_toolbox_premium",
      ].includes(action)
    ) {
      const productId =
        body?.productId ??
        body?.product_id;

      if (
        !validProducts.includes(productId)
      ) {
        return respond(
          {
            error: "Invalid product.",
          },
          400
        );
      }

      const {
        data,
        error,
      } = await admin.rpc(
        "purchase_toolbox_premium",
        {
          p_user_id: user.id,
          p_product_id: productId,
        }
      );

      if (error) {
        console.error(
          "Premium purchase error:",
          error
        );

        if (
          error.message?.includes(
            "Not enough coins"
          )
        ) {
          return respond(
            {
              error:
                "Not enough coins.",
            },
            400
          );
        }

        if (
          error.message?.includes(
            "Invalid product"
          )
        ) {
          return respond(
            {
              error:
                "Invalid product.",
            },
            400
          );
        }

        throw error;
      }

      return respond(data);
    }

    // ----------------------------------------
    // UNKNOWN ACTION
    // ----------------------------------------

    return respond(
      {
        error: "Unknown action.",
      },
      400
    );

  } catch (error) {
    console.error(
      "ToolBoxHub backend error:",
      error
    );

    return respond(
      {
        error:
          "Server error. Please try again.",

        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
});
