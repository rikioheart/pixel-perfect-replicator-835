CREATE OR REPLACE VIEW public.public_professionals AS
SELECT
  p.id,
  p.display_name,
  p.first_name,
  p.city,
  p.department,
  p.bio,
  d.company_name,
  d.professional_category,
  d.description,
  d.website_url,
  d.social_links
FROM public.profiles p
JOIN public.pro_details d ON d.profile_id = p.id
WHERE p.public_visibility = true
  AND p.membership_status = 'ACTIVE';

GRANT SELECT ON public.public_professionals TO anon;
GRANT SELECT ON public.public_professionals TO authenticated;
GRANT SELECT ON public.public_professionals TO service_role;