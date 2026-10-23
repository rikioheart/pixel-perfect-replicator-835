ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS external_url text;
COMMENT ON COLUMN public.forms.external_url IS 'Lien externe (ex. Google Forms) : les réponses restent chez le service externe, aucune synchronisation.';
CREATE OR REPLACE FUNCTION public.forms_external_url_check() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.external_url IS NOT NULL AND NEW.external_url !~* '^https://' THEN
    RAISE EXCEPTION 'Le lien externe doit commencer par https://';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS forms_external_url_check ON public.forms;
CREATE TRIGGER forms_external_url_check BEFORE INSERT OR UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.forms_external_url_check();