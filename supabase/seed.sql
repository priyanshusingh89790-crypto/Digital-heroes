-- Safe local development seed. This creates no auth users and has no credentials.
insert into public.charities (name, slug, short_description, description, website_url, is_featured, is_active)
values
  ('Mind', 'mind', 'Making sure nobody faces a mental health problem alone.', 'Mind provides advice and support to empower anyone experiencing a mental health problem.', 'https://www.mind.org.uk', true, true),
  ('Shelter', 'shelter', 'Defending the right to a safe home.', 'Shelter helps millions of people every year struggling with bad housing or homelessness.', 'https://www.shelter.org.uk', false, true),
  ('The Trussell Trust', 'trussell-trust', 'Working toward a UK without the need for food banks.', 'The Trussell Trust supports a nationwide network of food banks and campaigns for change.', 'https://www.trusselltrust.org', false, true)
on conflict (slug) do update set name = excluded.name, short_description = excluded.short_description, description = excluded.description, website_url = excluded.website_url, is_featured = excluded.is_featured, is_active = excluded.is_active;

insert into public.charity_events (charity_id, title, description, starts_at, location)
select id, 'Digital Heroes community day', 'A sample event for local development.', now() + interval '30 days', 'Online'
from public.charities where slug = 'mind'
and not exists (select 1 from public.charity_events where title = 'Digital Heroes community day');
