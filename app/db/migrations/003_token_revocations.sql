BEGIN;

CREATE TABLE IF NOT EXISTS public.token_revocations (
    jti text PRIMARY KEY,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_revocations_expires_at_idx
    ON public.token_revocations (expires_at);

ALTER TABLE public.token_revocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS token_revocations_app_policy ON public.token_revocations;
CREATE POLICY token_revocations_app_policy ON public.token_revocations
    FOR ALL TO classoverflow_app
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON TABLE public.token_revocations TO classoverflow_app;

COMMIT;
