\set ON_ERROR_STOP on

do $$
declare
  missing_tables text[];
begin
  select coalesce(array_agg(required.table_name order by required.table_name), '{}')
    into missing_tables
  from (
    values
      ('blog_categories'),
      ('blog_posts'),
      ('consultants'),
      ('payload_kv'),
      ('payload_locked_documents'),
      ('payload_locked_documents_rels'),
      ('payload_migrations'),
      ('payload_preferences'),
      ('payload_preferences_rels'),
      ('users'),
      ('users_sessions')
  ) as required(table_name)
  where not exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'payload'
      and t.table_name = required.table_name
  );

  if array_length(missing_tables, 1) is not null then
    raise exception 'Payload content schema is missing tables: %', missing_tables;
  end if;
end $$;

insert into payload.blog_categories (title, slug, description, is_active, sort_order)
values ('Smoke Category', 'smoke-category', null, true, 0)
on conflict (slug) do update
set title = excluded.title
returning id;

insert into payload.blog_posts (title, slug, content, status)
values ('Smoke Post', 'smoke-post', 'Smoke content', 'published')
on conflict (slug) do update
set title = excluded.title
returning id;

insert into payload.consultants (full_name, slug, is_published, sort_order)
values ('Smoke Consultant', 'smoke-consultant', true, 0)
on conflict (slug) do update
set full_name = excluded.full_name
returning id;
