"""Ephemeral-Postgres fixtures for record-store tests (ADR-0080).

One Docker container per pytest session; each test gets its own freshly
created database inside it. Record-store tests skip loudly when Docker (or
psycopg) is unavailable — the rest of the Python suite runs without them,
mirroring the real-data skipIf philosophy.
"""

from __future__ import annotations

import shutil
import subprocess
import time
import uuid

import pytest

try:
    import psycopg
except ImportError:  # keep non-DB tests runnable without the driver
    psycopg = None

POSTGRES_IMAGE = "postgres:17-alpine"


@pytest.fixture(scope="session")
def pg_server():
    """DSN of a session-scoped throwaway Postgres server in Docker."""
    if psycopg is None:
        pytest.skip("psycopg not installed (pip install -r ingestion/requirements.txt)")
    docker = shutil.which("docker")
    if docker is None:
        pytest.skip("Docker unavailable — record-store tests need it (ADR-0080)")
    probe = subprocess.run([docker, "info"], capture_output=True, timeout=60)
    if probe.returncode != 0:
        pytest.skip("Docker daemon not running — record-store tests need it")

    # First run pulls the image; generous timeout for that case only.
    started = subprocess.run(
        [docker, "run", "-d", "--rm",
         "-e", "POSTGRES_PASSWORD=pw",
         "-p", "127.0.0.1:0:5432", POSTGRES_IMAGE],
        capture_output=True, text=True, timeout=600,
    )
    if started.returncode != 0:
        pytest.skip(f"docker run failed: {started.stderr.strip()}")
    container = started.stdout.strip()
    try:
        port = None
        for _ in range(120):
            out = subprocess.run([docker, "port", container, "5432/tcp"],
                                 capture_output=True, text=True)
            mapped = out.stdout.strip().splitlines()
            if out.returncode == 0 and mapped:
                port = mapped[0].rsplit(":", 1)[1]
                break
            time.sleep(0.5)
        if port is None:
            raise RuntimeError("could not resolve mapped Postgres port")
        dsn = f"postgresql://postgres:pw@127.0.0.1:{port}/postgres"
        deadline = time.monotonic() + 120
        while True:
            try:
                psycopg.connect(dsn, connect_timeout=3).close()
                break
            except psycopg.OperationalError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(1)
        yield dsn
    finally:
        subprocess.run([docker, "stop", container], capture_output=True)


@pytest.fixture()
def pg_dsn(pg_server):
    """DSN of a fresh database for one test."""
    name = "t_" + uuid.uuid4().hex[:12]
    with psycopg.connect(pg_server, autocommit=True) as conn:
        conn.execute(f"CREATE DATABASE {name}")
    yield pg_server.rsplit("/", 1)[0] + "/" + name
    with psycopg.connect(pg_server, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE {name} WITH (FORCE)")
