"""Apply numbered PostgreSQL migrations transactionally. Never runs on API startup."""
import os
from pathlib import Path
import psycopg

url = os.environ['DATABASE_URL'].replace('postgresql+psycopg://', 'postgresql://')
with psycopg.connect(url) as connection:
    connection.execute('SELECT pg_advisory_xact_lock(76423001)')
    connection.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    for file in sorted((Path(__file__).resolve().parents[1] / 'infrastructure' / 'migrations').glob('*.sql')):
        if connection.execute('SELECT 1 FROM schema_migrations WHERE version = %s', (file.name,)).fetchone():
            continue
        connection.execute(file.read_text(encoding='utf-8'))
        connection.execute('INSERT INTO schema_migrations(version) VALUES (%s)', (file.name,))
        print(f'Applied {file.name}')
