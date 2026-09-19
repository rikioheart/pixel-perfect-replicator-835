ALTER TABLE public.help_requests
  ADD CONSTRAINT help_requests_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.job_sheets
  ADD CONSTRAINT job_sheets_member_id_profiles_fkey
  FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
