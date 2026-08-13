WITH bureau_user AS (
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (
    gen_random_uuid(), 'authenticated', 'authenticated', 'bureau@lavoixduchien.fr',
    crypt('Bureau2026!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false
  ) RETURNING id, email
),
member_user AS (
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (
    gen_random_uuid(), 'authenticated', 'authenticated', 'membre@lavoixduchien.fr',
    crypt('Membre2026!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false
  ) RETURNING id, email
),
bureau_profile AS (
  INSERT INTO public.profiles (id, first_name, last_name, display_name, email, membership_type, membership_status, public_visibility, city, department)
  SELECT id, 'Camille', 'Bureau', 'Camille Bureau', email, 'PROFESSIONNEL', 'ACTIVE', true, 'Nargis', 'Loiret'
  FROM bureau_user RETURNING id
),
member_profile AS (
  INSERT INTO public.profiles (id, first_name, last_name, display_name, email, membership_type, membership_status, public_visibility, city, department)
  SELECT id, 'Lucas', 'Membre', 'Lucas Membre', email, 'PARTICULIER', 'ACTIVE', true, 'Nargis', 'Loiret'
  FROM member_user RETURNING id
)
INSERT INTO public.user_roles (user_id, role_id)
SELECT bp.id, r.id FROM bureau_profile bp, public.roles r WHERE r.code = 'ADMIN_BUREAU';