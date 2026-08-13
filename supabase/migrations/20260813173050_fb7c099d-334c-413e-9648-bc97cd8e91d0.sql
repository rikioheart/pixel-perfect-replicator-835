UPDATE auth.users
SET email_confirmed_at = now()
WHERE email IN ('bureau@lavoixduchien.fr','membre@lavoixduchien.fr');

INSERT INTO public.profiles (id, first_name, last_name, display_name, email, membership_type, membership_status)
SELECT id, 'Camille', 'Bureau', 'Camille Bureau', email, 'PROFESSIONNEL', 'ACTIVE'
FROM auth.users WHERE email = 'bureau@lavoixduchien.fr'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, display_name, email, membership_type, membership_status)
SELECT id, 'Lucas', 'Membre', 'Lucas Membre', email, 'PARTICULIER', 'ACTIVE'
FROM auth.users WHERE email = 'membre@lavoixduchien.fr'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'bureau@lavoixduchien.fr'
  AND r.code = 'ADMIN_BUREAU'
ON CONFLICT (user_id, role_id) DO NOTHING;