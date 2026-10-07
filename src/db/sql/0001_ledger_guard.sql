-- Append-only guard for points_ledger (PRD §8).
--
-- UPDATE is always rejected. DELETE is rejected unless the current transaction has set
--   SET LOCAL schoolpawa.erasure = 'on';
-- which only src/server/privacy.ts does, when a guardian exercises the right to erasure or the
-- retention job removes an inactive profile. Rankings are always recomputed from this table.

CREATE OR REPLACE FUNCTION points_ledger_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'points_ledger is append-only (UPDATE rejected)';
  END IF;
  IF TG_OP = 'DELETE' AND coalesce(current_setting('schoolpawa.erasure', true), '') <> 'on' THEN
    RAISE EXCEPTION 'points_ledger is append-only (DELETE allowed only for lawful erasure)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS points_ledger_guard ON points_ledger;
CREATE TRIGGER points_ledger_guard
  BEFORE UPDATE OR DELETE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION points_ledger_guard();

-- Audit log is append-only too (retention purge runs with the same erasure flag).
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR coalesce(current_setting('schoolpawa.erasure', true), '') <> 'on' THEN
    RAISE EXCEPTION 'audit_log is append-only';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_guard ON audit_log;
CREATE TRIGGER audit_log_guard
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_guard();
