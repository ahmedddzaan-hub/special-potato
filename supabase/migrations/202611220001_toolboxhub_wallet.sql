-- ToolBoxHub wallet backend for Firebase-authenticated accounts.
-- Firebase UIDs are strings, so these tables intentionally do not reference auth.users.

create table if not exists public.toolbox_wallets (
  firebase_uid text primary key,
  coins integer not null default 0 check (coins >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.toolbox_reward_claims (
  id bigint generated always as identity primary key,
  firebase_uid text not null,
  tool_id text not null,
  reward_date date not null default ((now() at time zone 'utc')::date),
  coins_awarded integer not null check (coins_awarded in (12, 15)),
  created_at timestamptz not null default now(),
  unique (firebase_uid, tool_id, reward_date)
);

create table if not exists public.toolbox_premium_access (
  firebase_uid text not null,
  product_id text not null,
  expires_at timestamptz not null,
  primary key (firebase_uid, product_id)
);

create table if not exists public.toolbox_premium_purchases (
  id bigint generated always as identity primary key,
  firebase_uid text not null,
  product_id text not null,
  coins_spent integer not null,
  expires_at timestamptz not null,
  purchased_at timestamptz not null default now()
);

alter table public.toolbox_wallets enable row level security;
alter table public.toolbox_reward_claims enable row level security;
alter table public.toolbox_premium_access enable row level security;
alter table public.toolbox_premium_purchases enable row level security;

revoke all on public.toolbox_wallets from anon, authenticated;
revoke all on public.toolbox_reward_claims from anon, authenticated;
revoke all on public.toolbox_premium_access from anon, authenticated;
revoke all on public.toolbox_premium_purchases from anon, authenticated;

create or replace function public.toolbox_claim_reward(p_firebase_uid text, p_tool_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  allowed_tools text[] := array['qr','image-resizer','json-formatter','color-palette','username-generator','password-generator','text-case-converter','word-counter','pfp-maker'];
  awarded integer;
  new_total integer;
  inserted_count integer;
begin
  if p_firebase_uid is null or length(p_firebase_uid) = 0 then raise exception 'Invalid account'; end if;
  if not (p_tool_id = any(allowed_tools)) then raise exception 'Invalid tool'; end if;
  insert into public.toolbox_wallets(firebase_uid) values (p_firebase_uid) on conflict (firebase_uid) do nothing;
  awarded := case when random() < 0.05 then 15 else 12 end;
  insert into public.toolbox_reward_claims(firebase_uid, tool_id, reward_date, coins_awarded)
  values (p_firebase_uid, p_tool_id, (now() at time zone 'utc')::date, awarded)
  on conflict (firebase_uid, tool_id, reward_date) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then raise exception 'Already claimed today'; end if;
  update public.toolbox_wallets set coins = coins + awarded, updated_at = now()
  where firebase_uid = p_firebase_uid returning coins into new_total;
  return jsonb_build_object('success', true, 'reward', awarded, 'totalCoins', new_total);
end;
$$;

create or replace function public.toolbox_purchase_premium(p_firebase_uid text, p_product_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  price integer;
  current_coins integer;
  previous_expiry timestamptz;
  new_expiry timestamptz;
  remaining integer;
begin
  price := case p_product_id
    when 'pfp-maker-pro' then 150 when 'qr-maker-pro' then 100
    when 'background-remover' then 200 when 'pdf-pro' then 180
    when 'ai-logo-maker' then 250 else null end;
  if price is null then raise exception 'Invalid product'; end if;
  if p_firebase_uid is null or length(p_firebase_uid) = 0 then raise exception 'Invalid account'; end if;
  insert into public.toolbox_wallets(firebase_uid) values (p_firebase_uid) on conflict (firebase_uid) do nothing;
  select coins into current_coins from public.toolbox_wallets where firebase_uid = p_firebase_uid for update;
  if current_coins < price then raise exception 'Not enough coins'; end if;
  select expires_at into previous_expiry from public.toolbox_premium_access
  where firebase_uid = p_firebase_uid and product_id = p_product_id for update;
  new_expiry := greatest(now(), coalesce(previous_expiry, now())) + interval '5 days';
  remaining := current_coins - price;
  update public.toolbox_wallets set coins = remaining, updated_at = now() where firebase_uid = p_firebase_uid;
  insert into public.toolbox_premium_access(firebase_uid, product_id, expires_at)
  values (p_firebase_uid, p_product_id, new_expiry)
  on conflict (firebase_uid, product_id) do update set expires_at = excluded.expires_at;
  insert into public.toolbox_premium_purchases(firebase_uid, product_id, coins_spent, expires_at)
  values (p_firebase_uid, p_product_id, price, new_expiry);
  return jsonb_build_object('success', true, 'remainingCoins', remaining,
    'productId', p_product_id, 'expiresAt', extract(epoch from new_expiry) * 1000);
end;
$$;

revoke all on function public.toolbox_claim_reward(text, text) from public, anon, authenticated;
revoke all on function public.toolbox_purchase_premium(text, text) from public, anon, authenticated;
grant execute on function public.toolbox_claim_reward(text, text) to service_role;
grant execute on function public.toolbox_purchase_premium(text, text) to service_role;
