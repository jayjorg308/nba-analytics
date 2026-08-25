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


def scope_key(source: str, *, player_id: int | None = None, season: str | None = None,
              season_type: str | None = None, game_id: str | None = None) -> str:
    """The source_head key: source plus the dimensions this source is scoped
    by, empty for the rest (0006_source_head.sql)."""
    return ":".join([source, str(player_id or ""), season or "",
                     season_type or "", game_id or ""])


def set_head(cur, key: str, snapshot_id: int, run_id: int) -> None:
    """Record that a scope's current state now equals this snapshot's content
    — called by every load that asserts the scope, in the same transaction."""
    cur.execute(
        "INSERT INTO source_head (scope_key, snapshot_id, run_id, updated_at)"
        " VALUES (%s, %s, %s, now()) ON CONFLICT (scope_key) DO UPDATE SET"
        " snapshot_id = EXCLUDED.snapshot_id, run_id = EXCLUDED.run_id,"
        " updated_at = now()",
        (key, snapshot_id, run_id),
    )


def get_head(cur, key: str) -> tuple[int, str, str, str | None]:
    """(snapshot_id, path, pull_date, season_type) of a scope's head; exits
    loudly when the scope has never been loaded."""
    cur.execute(
        "SELECT h.snapshot_id, s.path, s.pull_date, s.season_type"
        " FROM source_head h JOIN snapshot s USING (snapshot_id)"
        " WHERE h.scope_key = %s",
        (key,),
    )
    row = cur.fetchone()
    if row is None:
        sys.exit(f"record-store: no source head for scope {key!r} — "
                 f"load the scope first (its loader records the head)")
    return row


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
