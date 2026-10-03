# Database

## Runtime tables

| Table | Purpose | Access |
| --- | --- | --- |
| users | Account identity, scrypt hash, operator-managed role | Auth service |
| sessions | Hashed random bearer cookies and expiry | Auth service |
| analysis_runs | Queue state, request and immutable result snapshot | Owner or guest session |
| projects | Owner, name, private project payload | Owner only |
| field_records | Sample or observation payload with location/time | Parent project owner |
| dataset_states | Administrator provider enable/disable switch | Public read, admin write |

JSON is serialized in text columns for compatibility with local SQLite. Production migrations add indexed PostGIS geometry and a unique per-project sample ID index. Core tables are intentionally small; future drilling, assays, teams and subscriptions are not empty placeholder implementations.

## PostgreSQL extensions

`001_initial.sql` installs PostGIS, core tables, source catalogue, licence-review records, dataset change audit events and spatial indexes. `projects.location` is a generated `geometry(Point,4326)` column derived from the stored payload. `project_polygons` is maintained by a trigger from validated polygon input. Geometry is not accepted from arbitrary uploaded GeoJSON in this release.

`data_sources` includes provenance/licensing fields from the master brief. `dataset_states` controls adapter execution; editing registry metadata alone does not create an adapter. `source_licences` is for operator review records. Trigger audit events record provider state changes; application logs include actor IDs. A unified, actor-rich audit trail is a prelaunch hardening item.

Apply migrations using `DATABASE_URL=postgresql+psycopg://… python scripts/migrate.py`. Migrations run under an advisory lock, in one transaction, and record their filenames in `schema_migrations`. Runtime production startup does not create schema. Migration credentials require extension and DDL privileges; the application role should have only the needed table/sequence DML privileges.

The SQLite development schema is automatically created by SQLAlchemy. It is not a substitute for PostGIS migration testing. Back up production data before migrations; rollback uses a tested backup/restore procedure, not guessed down-migrations.

## Spatial queries

Always constrain private data by account ownership:

```sql
SELECT id, ST_Distance(location::geography, ST_SetSRID(ST_Point(:lng, :lat),4326)::geography)
FROM projects
WHERE owner_id = :owner_id
AND ST_DWithin(location::geography, ST_SetSRID(ST_Point(:lng, :lat),4326)::geography, :radius_m);

SELECT ST_Area(p.geometry::geography)
FROM project_polygons p JOIN projects r ON r.id=p.project_id
WHERE r.owner_id=:owner_id AND r.id=:project_id;
```

Database row-level security is not yet enabled. Authorization is enforced at every project/report/record API boundary and tested against cross-account access. A privileged database connection is never exposed to clients.
