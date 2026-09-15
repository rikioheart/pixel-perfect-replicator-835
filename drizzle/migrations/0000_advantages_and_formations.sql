-- Avantages adhérents
CREATE TABLE public.advantages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'CODE_PROMO',
  promo_code TEXT,
  partner_name TEXT,
  conditions TEXT,
  valid_from DATE,
  valid_until DATE,
  quantity INTEGER,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advantages TO authenticated;
GRANT ALL ON public.advantages TO service_role;
ALTER TABLE public.advantages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advantages_select" ON public.advantages FOR SELECT TO authenticated USING (true);
CREATE POLICY "advantages_insert" ON public.advantages FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "advantages_update" ON public.advantages FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "advantages_delete" ON public.advantages FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()));

CREATE TABLE public.advantage_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advantage_id UUID NOT NULL REFERENCES public.advantages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advantage_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.advantage_claims TO authenticated;
GRANT ALL ON public.advantage_claims TO service_role;
ALTER TABLE public.advantage_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims_select" ON public.advantage_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_bureau(auth.uid()));
CREATE POLICY "claims_insert" ON public.advantage_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "claims_delete" ON public.advantage_claims FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_bureau(auth.uid()));

-- Formations / lives / webinaires
CREATE TABLE public.formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  format TEXT NOT NULL DEFAULT 'FORMATION',
  speaker_name TEXT,
  date DATE,
  start_time TEXT,
  duration_minutes INTEGER,
  location TEXT,
  live_link TEXT,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formations TO authenticated;
GRANT ALL ON public.formations TO service_role;
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formations_select" ON public.formations FOR SELECT TO authenticated USING (true);
CREATE POLICY "formations_insert" ON public.formations FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()) OR public.is_professional(auth.uid()));
CREATE POLICY "formations_update" ON public.formations FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "formations_delete" ON public.formations FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()));

CREATE TABLE public.formation_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (formation_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.formation_registrations TO authenticated;
GRANT ALL ON public.formation_registrations TO service_role;
ALTER TABLE public.formation_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formation_reg_select" ON public.formation_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "formation_reg_insert" ON public.formation_registrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "formation_reg_delete" ON public.formation_registrations FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_bureau(auth.uid()));
