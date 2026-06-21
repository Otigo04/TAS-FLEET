-- Migration to make pschein_valid_until and district nullable in public.drivers table
alter table public.drivers alter column pschein_valid_until drop not null;
alter table public.drivers alter column district drop not null;
