# ToolBoxHub coin backend setup

This version keeps Firebase Authentication (email + Google) and uses Supabase only for the trusted wallet backend. Firebase UIDs are verified by the Edge Function and stored as text IDs; they are not Supabase Auth users.

## 1. Run the database migration once

In Supabase Dashboard → SQL Editor, open `supabase/migrations/202611220001_toolboxhub_wallet.sql` from this repository, copy its full contents, paste into a new SQL query, and run it. It creates separate `toolbox_*` tables and does not overwrite the earlier `wallets`, `reward_claims`, or `premium_purchases` tables.

## 2. Add the Edge Function secret

In Supabase Dashboard → Edge Functions → Secrets, add:

- `FIREBASE_PROJECT_ID` = `toolbox-64694`

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically. Never put the service-role key in this repository or in browser code.

## 3. Allow the function to verify Firebase tokens itself

The function is configured with `verify_jwt = false` because Firebase ID tokens are not Supabase Auth tokens. The function independently verifies each Firebase token against Google's published Firebase signing keys and checks the project issuer and audience. Do not remove that verification from `index.ts`.

## 4. Set up GitHub deployment (one time)

Create a Supabase access token in your Supabase account settings. In the GitHub repository, open Settings → Secrets and variables → Actions → New repository secret:

- Name: `SUPABASE_ACCESS_TOKEN`
- Value: your Supabase access token

After the secret is saved, changes under `supabase/functions/` deploy the `toolboxhub` function automatically when pushed to `main`.

## 5. Current functionality

- Firebase email and Google sign-in remain unchanged.
- A signed-in user earns 12 coins, with a 5% chance of 15, once per eligible tool per UTC day, when opening an eligible tool.
- The wallet balance loads from Supabase.
- The five premium products can be purchased securely for the listed coin prices, with access recorded for five days.
- Pro-only controls inside the individual tools (and the separate PDF, background remover, and AI logo tools) still need to be implemented before the shop should be advertised as fully feature-complete.

The browser uses only the Supabase publishable key. The service-role key stays server-side.
