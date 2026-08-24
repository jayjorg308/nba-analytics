"""Record-store plumbing (ADR-0080): connection + migration runner.

The record store is Postgres — Neon in production, an ephemeral Docker
container in tests (conftest.py). DSN resolution: an explicit --db-url
argument, else the NBA_DB_URL environment variable. Migrations are plain SQL
files under db/migrations, applied in filename order exactly once each,
tracked in schema_migration.

Named record_store (not db) so the module can never be shadowed by the
repo-root db/ directory on sys.path.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg

REPO_ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"


def _dotenv_dsn() -> str | None:
    """Read NBA_DB_URL from the repo-root .env (gitignored; see .env.example).

    A deliberate five-line parser instead of a python-dotenv dependency: one
    file, one key, KEY=VALUE lines, # comments. Quotes are not stripped —
    don't quote the value.
    """
    env_file = REPO_ROOT / ".env"
    if not env_file.exists():
        return None
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("NBA_DB_URL="):
            return line.split("=", 1)[1].strip() or None
    return None


def resolve_dsn(cli_arg: str | None = None) -> str:
    """--db-url beats the NBA_DB_URL environment variable beats .env."""
    dsn = cli_arg or os.environ.get("NBA_DB_URL") or _dotenv_dsn()
    if not dsn:
        sys.exit(
            "record-store: no DSN — pass --db-url, set NBA_DB_URL, or copy "
            ".env.example to .env and fill in the Neon connection string"
        )
    if "YOUR-NEON-HOST" in dsn:
        sys.exit(
            "record-store: the DSN is still the placeholder — replace "
            "YOUR-NEON-HOST (and USER:PASSWORD) in .env with the real Neon "
            "connection string from the Neon console"
        )
    return dsn


def connect(dsn: str) -> psycopg.Connection:
    return psycopg.connect(dsn)


def apply_migrations(conn: psycopg.Connection) -> list[str]:
    """Apply pending db/migrations/*.sql in name order; return what ran."""
    ran: list[str] = []
    with conn.cursor() as cur:
        cur.execute(
            "CREATE TABLE IF NOT EXISTS schema_migration ("
            " name text PRIMARY KEY,"
            " applied_at timestamptz NOT NULL DEFAULT now())"
        )
        cur.execute("SELECT name FROM schema_migration")
        applied = {row[0] for row in cur.fetchall()}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in applied:
                continue
            cur.execute(path.read_text(encoding="utf-8"))
            cur.execute("INSERT INTO schema_migration (name) VALUES (%s)", (path.name,))
            ran.append(path.name)
    conn.commit()
    return ran
