-- HALA.S — grant administrator access.
--
-- Prerequisite: create the administrator in Supabase Dashboard →
-- Authentication → Users → "Add user" (email + strong password, confirm
-- email). Passwords are never stored in SQL or in this repository.
--
-- Then: replace the email below and run this file in the SQL editor.
-- Running it again for the same email is safe (it updates the role row).

do $$
declare
  v_email text := 'admin@example.com';   -- ← replace with the administrator email
  v_user_id uuid;
begin
  select id
    into v_user_id
    from auth.users
   where lower(email) = lower(btrim(v_email))
   limit 1;

  if v_user_id is null then
    raise exception
      'No auth user exists for %. Create the user in Authentication → Users first, then run this script again.',
      v_email;
  end if;

  insert into public.user_roles (user_id, role, display_name)
  values (v_user_id, 'admin', split_part(v_email, '@', 1))
  on conflict (user_id)
  do update set role = 'admin';

  raise notice 'Administrator access granted to % (%)', v_email, v_user_id;
end;
$$;

-- Verify:
select ur.user_id, u.email, ur.role, ur.created_at
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
 order by ur.created_at;

-- To revoke access:
-- delete from public.user_roles where user_id = (
--   select id from auth.users where lower(email) = lower('admin@example.com')
-- );
