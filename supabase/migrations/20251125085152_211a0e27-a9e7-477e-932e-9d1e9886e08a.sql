-- Create sleep_logs table
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  duration_minutes int,
  efficiency int,
  score int,
  deep_minutes int,
  rem_minutes int,
  light_minutes int,
  wake_minutes int,
  start_time timestamptz,
  end_time timestamptz,
  raw jsonb,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- Enable RLS
alter table public.sleep_logs enable row level security;

-- RLS Policies
create policy "Users can view own sleep logs"
on public.sleep_logs for select
using (auth.uid() = user_id);

create policy "Users can insert own sleep logs"
on public.sleep_logs for insert
with check (auth.uid() = user_id);

create policy "Users can update own sleep logs"
on public.sleep_logs for update
using (auth.uid() = user_id);

create policy "Admins can manage all sleep logs"
on public.sleep_logs for all
using (is_admin(auth.uid()));