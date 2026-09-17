-- Array containment alone permits duplicate values. Keep validation in the
-- database so independently submitted draw/entry payloads cannot bypass it.

create or replace function public.is_valid_draw_numbers(candidate smallint[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select cardinality(candidate) = 5
    and cardinality(array(select distinct value from unnest(candidate) as value)) = 5
    and coalesce((select bool_and(value between 1 and 45) from unnest(candidate) as value), false);
$$;

alter table public.draws drop constraint draws_numbers_check;
alter table public.draws add constraint draws_numbers_check check (numbers is null or public.is_valid_draw_numbers(numbers));

alter table public.draw_entries drop constraint draw_entries_selected_numbers_check;
alter table public.draw_entries add constraint draw_entries_selected_numbers_check check (public.is_valid_draw_numbers(selected_numbers));
