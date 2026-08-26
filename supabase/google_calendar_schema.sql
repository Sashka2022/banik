-- Run this in the Supabase SQL Editor (in addition to schema.sql, which you already ran).
-- Stores Google Calendar OAuth tokens server-side only — no policies are granted to the
-- anon/authenticated roles, so even the owning user's browser can never read these tokens
-- directly; only Edge Functions (using the service_role key) can touch this table.

create table if not exists google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  connected_at timestamptz not null default now()
);

alter table google_calendar_connections enable row level security;
-- Intentionally no policies: default-deny for anon/authenticated. Service role bypasses RLS.

-- Short-lived, single-use rows correlating an OAuth "state" value to the user who started
-- the connect flow (Google's redirect back doesn't carry our Supabase session).
create table if not exists google_oauth_states (
  state uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table google_oauth_states enable row level security;
-- Intentionally no policies here either — only Edge Functions touch this table.
