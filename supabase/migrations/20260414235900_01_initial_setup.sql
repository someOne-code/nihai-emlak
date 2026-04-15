-- Phase 1 / Task 1: initial extensions and enum types
-- This migration is the base for upcoming domain tables.

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'listing_type'
  ) then
    create type public.listing_type as enum ('sale', 'rent');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'listing_status'
  ) then
    create type public.listing_status as enum ('active', 'passive');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'reservation_status'
  ) then
    create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled', 'expired');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
  ) then
    create type public.order_status as enum ('pending', 'completed', 'cancelled', 'failed', 'conflict');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'payment_status'
  ) then
    create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'conflict');
  end if;
end $$;
