create schema if not exists payload;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'payload'
      and t.typname = 'enum_users_role'
  ) then
    create type payload.enum_users_role as enum ('admin');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'payload'
      and t.typname = 'enum_blog_posts_status'
  ) then
    create type payload.enum_blog_posts_status as enum ('draft', 'published');
  end if;
end $$;

create table if not exists payload.users (
  id serial primary key,
  full_name varchar,
  role payload.enum_users_role not null default 'admin',
  updated_at timestamptz(3) not null default now(),
  created_at timestamptz(3) not null default now(),
  email varchar not null,
  reset_password_token varchar,
  reset_password_expiration timestamptz(3),
  salt varchar,
  hash varchar,
  login_attempts numeric default 0,
  lock_until timestamptz(3)
);

create unique index if not exists users_email_idx on payload.users (email);
create index if not exists users_updated_at_idx on payload.users (updated_at);
create index if not exists users_created_at_idx on payload.users (created_at);

create table if not exists payload.users_sessions (
  _order integer not null,
  _parent_id integer not null references payload.users(id) on delete cascade,
  id varchar primary key,
  created_at timestamptz(3),
  expires_at timestamptz(3) not null
);

create index if not exists users_sessions_order_idx on payload.users_sessions (_order);
create index if not exists users_sessions_parent_id_idx on payload.users_sessions (_parent_id);

create table if not exists payload.blog_categories (
  id serial primary key,
  title varchar not null,
  slug varchar not null,
  description varchar,
  is_active boolean default true,
  sort_order numeric default 0,
  updated_at timestamptz(3) not null default now(),
  created_at timestamptz(3) not null default now()
);

create unique index if not exists blog_categories_slug_idx on payload.blog_categories (slug);
create index if not exists blog_categories_updated_at_idx on payload.blog_categories (updated_at);
create index if not exists blog_categories_created_at_idx on payload.blog_categories (created_at);

create table if not exists payload.blog_posts (
  id serial primary key,
  title varchar not null,
  slug varchar not null,
  excerpt varchar,
  content varchar not null,
  category_id integer references payload.blog_categories(id) on delete set null,
  status payload.enum_blog_posts_status default 'draft',
  published_at timestamptz(3),
  cover_image_url varchar,
  seo_title varchar,
  seo_description varchar,
  updated_at timestamptz(3) not null default now(),
  created_at timestamptz(3) not null default now()
);

create unique index if not exists blog_posts_slug_idx on payload.blog_posts (slug);
create index if not exists blog_posts_category_idx on payload.blog_posts (category_id);
create index if not exists blog_posts_updated_at_idx on payload.blog_posts (updated_at);
create index if not exists blog_posts_created_at_idx on payload.blog_posts (created_at);

create table if not exists payload.consultants (
  id serial primary key,
  full_name varchar not null,
  slug varchar not null,
  title varchar,
  photo_url varchar,
  short_bio varchar,
  phone varchar,
  email varchar,
  whatsapp_url varchar,
  linkedin_url varchar,
  is_published boolean default false,
  sort_order numeric default 0,
  updated_at timestamptz(3) not null default now(),
  created_at timestamptz(3) not null default now()
);

create unique index if not exists consultants_slug_idx on payload.consultants (slug);
create index if not exists consultants_updated_at_idx on payload.consultants (updated_at);
create index if not exists consultants_created_at_idx on payload.consultants (created_at);

create table if not exists payload.payload_kv (
  id serial primary key,
  key varchar not null,
  data jsonb not null
);

create unique index if not exists payload_kv_key_idx on payload.payload_kv (key);

create table if not exists payload.payload_locked_documents (
  id serial primary key,
  global_slug varchar,
  updated_at timestamptz(3) not null default now(),
  created_at timestamptz(3) not null default now()
);

create index if not exists payload_locked_documents_global_slug_idx on payload.payload_locked_documents (global_slug);
create index if not exists payload_locked_documents_updated_at_idx on payload.payload_locked_documents (updated_at);
create index if not exists payload_locked_documents_created_at_idx on payload.payload_locked_documents (created_at);

create table if not exists payload.payload_locked_documents_rels (
  id serial primary key,
  "order" integer,
  parent_id integer not null references payload.payload_locked_documents(id) on delete cascade,
  path varchar not null,
  users_id integer references payload.users(id) on delete cascade,
  blog_categories_id integer references payload.blog_categories(id) on delete cascade,
  blog_posts_id integer references payload.blog_posts(id) on delete cascade,
  consultants_id integer references payload.consultants(id) on delete cascade
);

create index if not exists payload_locked_documents_rels_order_idx on payload.payload_locked_documents_rels ("order");
create index if not exists payload_locked_documents_rels_parent_idx on payload.payload_locked_documents_rels (parent_id);
create index if not exists payload_locked_documents_rels_path_idx on payload.payload_locked_documents_rels (path);
create index if not exists payload_locked_documents_rels_users_id_idx on payload.payload_locked_documents_rels (users_id);
create index if not exists payload_locked_documents_rels_blog_categories_id_idx on payload.payload_locked_documents_rels (blog_categories_id);
create index if not exists payload_locked_documents_rels_blog_posts_id_idx on payload.payload_locked_documents_rels (blog_posts_id);
create index if not exists payload_locked_documents_rels_consultants_id_idx on payload.payload_locked_documents_rels (consultants_id);

create table if not exists payload.payload_preferences (
  id serial primary key,
  key varchar,
  value jsonb,
  updated_at timestamptz(3) not null default now(),
  created_at timestamptz(3) not null default now()
);

create index if not exists payload_preferences_key_idx on payload.payload_preferences (key);
create index if not exists payload_preferences_updated_at_idx on payload.payload_preferences (updated_at);
create index if not exists payload_preferences_created_at_idx on payload.payload_preferences (created_at);

create table if not exists payload.payload_preferences_rels (
  id serial primary key,
  "order" integer,
  parent_id integer not null references payload.payload_preferences(id) on delete cascade,
  path varchar not null,
  users_id integer references payload.users(id) on delete cascade
);

create index if not exists payload_preferences_rels_order_idx on payload.payload_preferences_rels ("order");
create index if not exists payload_preferences_rels_parent_idx on payload.payload_preferences_rels (parent_id);
create index if not exists payload_preferences_rels_path_idx on payload.payload_preferences_rels (path);
create index if not exists payload_preferences_rels_users_id_idx on payload.payload_preferences_rels (users_id);

create table if not exists payload.payload_migrations (
  id serial primary key,
  name varchar,
  batch numeric,
  updated_at timestamptz(3) not null default now(),
  created_at timestamptz(3) not null default now()
);

create index if not exists payload_migrations_updated_at_idx on payload.payload_migrations (updated_at);
create index if not exists payload_migrations_created_at_idx on payload.payload_migrations (created_at);
