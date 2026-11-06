CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tabelas com updated_at
CREATE TRIGGER set_timestamp_food BEFORE UPDATE ON food
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_profile BEFORE UPDATE ON profile
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_icr_window BEFORE UPDATE ON profile_icr_window
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();