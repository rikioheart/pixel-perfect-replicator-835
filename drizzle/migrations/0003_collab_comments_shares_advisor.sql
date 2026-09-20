-- 1. Commentaires génériques
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project','task','event','document','activity')),
  entity_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_entity_idx ON public.comments (entity_type, entity_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY comments_update ON public.comments FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY comments_delete ON public.comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_bureau(auth.uid()));

-- 2. Conseils IA pour le Bureau
CREATE TABLE public.team_advices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  situation TEXT NOT NULL,
  summary TEXT,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_advices TO authenticated;
GRANT ALL ON public.team_advices TO service_role;
ALTER TABLE public.team_advices ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_advices_select ON public.team_advices FOR SELECT TO authenticated USING (public.is_bureau(auth.uid()));
CREATE POLICY team_advices_write ON public.team_advices FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY team_advices_delete ON public.team_advices FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));

-- 3. Liens de partage externes
CREATE TABLE public.public_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project','event','document')),
  entity_id UUID NOT NULL,
  label TEXT,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX public_shares_entity_idx ON public.public_shares (entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_shares TO authenticated;
GRANT ALL ON public.public_shares TO service_role;
ALTER TABLE public.public_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_shares_select ON public.public_shares FOR SELECT TO authenticated USING (true);
CREATE POLICY public_shares_insert ON public.public_shares FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()) OR created_by = auth.uid());
CREATE POLICY public_shares_update ON public.public_shares FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid()) OR created_by = auth.uid());
CREATE POLICY public_shares_delete ON public.public_shares FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()) OR created_by = auth.uid());