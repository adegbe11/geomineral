-- Live progress per evidence source while an analysis runs.
ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS progress text;
