-- Audit log: captures INSERT/UPDATE/DELETE on core tables with full before/after JSONB rows.
-- Writes are service-role only (via the trigger); users can only SELECT their own events.
-- Cascade deletes (e.g. auth.users deletion) run without a session so auth.uid() returns NULL;
-- those rows use a sentinel actor UUID and are readable by service-role for forensics.

CREATE TABLE public.audit_events (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID,                        -- NULL coalesced to sentinel on write; never raw NULL
  table_name  TEXT NOT NULL,
  row_id      UUID,
  operation   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  before_data JSONB,                       -- NULL on INSERT
  after_data  JSONB,                       -- NULL on DELETE
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor_occurred ON audit_events (actor_id, occurred_at DESC);
CREATE INDEX idx_audit_table_row      ON audit_events (table_name, row_id);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Users may only read their own audit events. No user-facing INSERT/UPDATE/DELETE.
CREATE POLICY "Users read own audit events"
  ON audit_events FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- DOCUMENTATION-ONLY: service_role bypasses RLS unconditionally in Supabase, so this
-- policy is technically a no-op at runtime. It exists to make the access-control
-- intent explicit in schema review and to survive any future global RLS hardening
-- that might disable the bypass behavior.
CREATE POLICY "Service role reads cascade audit events"
  ON audit_events FOR SELECT TO service_role
  USING (true);

-- Trigger function — runs as SECURITY DEFINER so it can always write to audit_events.
-- COALESCE ensures cascade deletes (auth.uid() = NULL) use the sentinel UUID rather than NULL,
-- keeping the actor_id index useful and the RLS semantics clean.
CREATE FUNCTION public.fn_audit_event() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_events (actor_id, table_name, row_id, operation, before_data, after_data)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach audit trigger to core tables.
-- Note: payments table does not exist yet. When added, its migration creates the audit trigger.
CREATE TRIGGER audit_seasons
  AFTER INSERT OR UPDATE OR DELETE ON seasons
  FOR EACH ROW EXECUTE FUNCTION fn_audit_event();

CREATE TRIGGER audit_installments
  AFTER INSERT OR UPDATE OR DELETE ON installments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_event();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_audit_event();

CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION fn_audit_event();

CREATE TRIGGER audit_farms
  AFTER INSERT OR UPDATE OR DELETE ON farms
  FOR EACH ROW EXECUTE FUNCTION fn_audit_event();
