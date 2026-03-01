-- Chat history persistence for Chat Coach
create table if not exists public.chat_history (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.chat_history enable row level security;

create policy "Users can read own chat history"
  on public.chat_history
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own chat history"
  on public.chat_history
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own chat history"
  on public.chat_history
  for update
  using (auth.uid() = user_id);
