-- Run this once in the Supabase project's SQL Editor (Dashboard > SQL Editor > New query).
-- Creates the Area/Task/Note tables, restricts each row to its owning user (RLS),
-- and turns on Realtime so changes sync live across devices/tabs.

create extension if not exists pgcrypto;

create table if not exists areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'bg-purple-100',
  sort_order integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area_id uuid references areas(id) on delete cascade,
  title text not null,
  due_date date,
  priority text not null default 'medium',
  progress integer not null default 0,
  is_completed boolean not null default false,
  subtasks jsonb not null default '[]'::jsonb,
  estimated_hours numeric,
  calendar_event_id text,
  doc_url text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  color text not null default 'bg-yellow-100',
  is_done boolean not null default false,
  calendar_reminder_id text,
  calendar_reminder_link text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table areas enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;

create policy "Users manage their own areas" on areas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own notes" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table areas;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table notes;
