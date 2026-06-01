alter table public.drivers
add column if not exists notes text[] not null default '{}';
