CREATE FUNCTION prevent_protected_shared_upwork_job_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_protected THEN
    RAISE EXCEPTION 'Cannot delete protected shared Upwork job';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_protected_shared_upwork_job_delete
BEFORE DELETE ON shared_upwork_jobs
FOR EACH ROW EXECUTE FUNCTION prevent_protected_shared_upwork_job_delete();
