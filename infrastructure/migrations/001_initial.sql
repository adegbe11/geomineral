CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE users (id varchar(36) PRIMARY KEY, email varchar(254) NOT NULL UNIQUE, password_hash text NOT NULL, is_admin boolean NOT NULL DEFAULT false);
CREATE TABLE sessions (token_hash varchar(64) PRIMARY KEY, user_id varchar(36) NOT NULL REFERENCES users(id), expires_at double precision NOT NULL);
CREATE INDEX ix_sessions_user_id ON sessions(user_id);
CREATE TABLE analysis_runs (id varchar(36) PRIMARY KEY, user_id varchar(36) REFERENCES users(id), guest_hash varchar(64), status varchar(20) NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','complete','failed')), request_json text NOT NULL, result_json text, created_at varchar(40) NOT NULL, error text, claimed_at double precision);
CREATE INDEX ix_analysis_runs_user_id ON analysis_runs(user_id);
CREATE INDEX ix_analysis_runs_queue ON analysis_runs(status, created_at);
CREATE TABLE projects (id varchar(36) PRIMARY KEY, owner_id varchar(36) NOT NULL REFERENCES users(id), name varchar(120) NOT NULL, payload text NOT NULL, created_at varchar(40) NOT NULL);
CREATE INDEX ix_projects_owner_id ON projects(owner_id);
CREATE TABLE field_records (id varchar(36) PRIMARY KEY, project_id varchar(36) NOT NULL REFERENCES projects(id), payload text NOT NULL, created_at varchar(40) NOT NULL);
CREATE INDEX ix_field_records_project_id ON field_records(project_id);
CREATE UNIQUE INDEX unique_sample_id ON field_records(project_id, ((payload::jsonb)->>'title')) WHERE (payload::jsonb)->>'kind' = 'sample';
CREATE TABLE dataset_states (id varchar(80) PRIMARY KEY, enabled boolean NOT NULL DEFAULT true);

-- Stored, indexed geometry is derived from the same validated JSON persisted by the API.
ALTER TABLE projects ADD COLUMN location geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(((payload::jsonb)->'location'->>'lng')::double precision, ((payload::jsonb)->'location'->>'lat')::double precision),4326)) STORED;
CREATE INDEX ix_projects_location ON projects USING gist(location);
CREATE TABLE project_polygons (project_id varchar(36) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE, geometry geometry(Polygon,4326) NOT NULL CHECK(ST_IsValid(geometry)));
CREATE INDEX ix_project_polygons_geometry ON project_polygons USING gist(geometry);
CREATE FUNCTION sync_project_polygon() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE points jsonb; ring jsonb;
BEGIN
  points := NEW.payload::jsonb->'polygon';
  IF jsonb_typeof(points) = 'array' AND jsonb_array_length(points) >= 3 THEN
    ring := points || jsonb_build_array(points->0);
    INSERT INTO project_polygons(project_id, geometry)
      VALUES (NEW.id, ST_SetSRID(ST_GeomFromGeoJSON(jsonb_build_object('type','Polygon','coordinates',jsonb_build_array(ring))::text),4326))
      ON CONFLICT(project_id) DO UPDATE SET geometry=EXCLUDED.geometry;
  ELSE
    DELETE FROM project_polygons WHERE project_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_project_polygon AFTER INSERT OR UPDATE OF payload ON projects FOR EACH ROW EXECUTE FUNCTION sync_project_polygon();

CREATE TABLE data_sources (
  id text PRIMARY KEY, provider_name text NOT NULL, provider_type text NOT NULL,
  country_code varchar(3), region text, dataset_name text NOT NULL, description text,
  source_url text NOT NULL, api_url text, licence text NOT NULL,
  commercial_use_allowed boolean NOT NULL DEFAULT false, attribution_required boolean NOT NULL DEFAULT true,
  resolution text, data_format text, last_updated timestamptz, retrieval_method text,
  status text NOT NULL DEFAULT 'disabled', priority integer NOT NULL DEFAULT 0, notes text
);
INSERT INTO data_sources(id,provider_name,provider_type,dataset_name,source_url,api_url,licence,commercial_use_allowed,resolution,retrieval_method,status,notes)
VALUES ('macrostrat','Macrostrat','geology','Integrated geological maps','https://macrostrat.org','https://macrostrat.org/api/v2/geologic_units/map','CC BY 4.0',true,'Varies by original source map','Live API','enabled','Original citations retained in snapshots'),
('usgs-mrds','U.S. Geological Survey','occurrences','Mineral Resources Data System','https://mrdata.usgs.gov/mrds/','https://energy.usgs.gov/arcgis/rest/services/MRData/Mineral_Resource_Data_System/MapServer/3/query','USGS public-domain data; linked third-party documents retain their rights',true,'Point accuracy varies','Live API','enabled','Historical compilation, not current mine status');

CREATE TABLE source_licences (id bigserial PRIMARY KEY, source_id text NOT NULL REFERENCES data_sources(id), licence text NOT NULL, permitted_uses text NOT NULL, reviewed_at timestamptz, reviewed_by varchar(36) REFERENCES users(id));
CREATE TABLE audit_logs (id bigserial PRIMARY KEY, actor_id varchar(36), action text NOT NULL, entity_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION audit_dataset_state() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
INSERT INTO audit_logs(action,entity_id) VALUES ('provider-enabled=' || NEW.enabled::text, NEW.id); RETURN NEW;
END $$;
CREATE TRIGGER audit_dataset_state AFTER INSERT OR UPDATE ON dataset_states FOR EACH ROW EXECUTE FUNCTION audit_dataset_state();

-- Use geography for earth-distance and area, never square degrees:
-- SELECT ST_Area(geometry::geography) FROM project_polygons WHERE project_id = :id;
-- SELECT id FROM projects WHERE owner_id = :owner AND ST_DWithin(location::geography, :point::geography, :radius_m);
