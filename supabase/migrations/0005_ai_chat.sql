create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_id_idx on public.ai_conversations(user_id);
create index if not exists ai_messages_conversation_id_idx on public.ai_messages(conversation_id);
create index if not exists ai_messages_user_id_idx on public.ai_messages(user_id);
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
drop policy if exists "Users can view own AI conversations" on public.ai_conversations;
create policy "Users can view own AI conversations" on public.ai_conversations for select using (auth.uid() = user_id);
drop policy if exists "Users can create own AI conversations" on public.ai_conversations;
create policy "Users can create own AI conversations" on public.ai_conversations for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own AI conversations" on public.ai_conversations;
create policy "Users can delete own AI conversations" on public.ai_conversations for delete using (auth.uid() = user_id);
drop policy if exists "Users can view own AI messages" on public.ai_messages;
create policy "Users can view own AI messages" on public.ai_messages for select using (auth.uid() = user_id);
drop policy if exists "Users can create own AI messages" on public.ai_messages;
create policy "Users can create own AI messages" on public.ai_messages for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own AI messages" on public.ai_messages;
create policy "Users can delete own AI messages" on public.ai_messages for delete using (auth.uid() = user_id);
