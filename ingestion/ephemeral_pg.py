"""A throwaway Dockerized Postgres for tools that need a scratch record
store — the DB-engine replay proof runs against one so the production store
(Neon) is never touched by historical-frontier loads. Mirrors the pytest
fixtures in conftest.py, minus the pytest-skip semantics: here an absent
Docker is a hard failure, because the caller asked for a database.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import time

IMAGE = "postgres:17-alpine"


def start(timeout: float = 600) -> tuple[str, str]:
    """Start a container; return (dsn, container_id). Caller must stop()."""
    docker = shutil.which("docker")
    if docker is None:
        sys.exit("ephemeral-pg: Docker unavailable — the DB engine needs it "
                 "for a scratch store")
    probe = subprocess.run([docker, "info"], capture_output=True, timeout=60)
    if probe.returncode != 0:
        sys.exit("ephemeral-pg: Docker daemon not running")
    started = subprocess.run(
        [docker, "run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=pw",
         "-p", "127.0.0.1:0:5432", IMAGE],
        capture_output=True, text=True, timeout=timeout,
    )
    if started.returncode != 0:
        sys.exit(f"ephemeral-pg: docker run failed: {started.stderr.strip()}")
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
        import psycopg  # deferred so file-engine paths never require it

        deadline = time.monotonic() + 120
        while True:
            try:
                psycopg.connect(dsn, connect_timeout=3).close()
                return dsn, container
            except psycopg.OperationalError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(1)
    except BaseException:
        stop(container)
        raise


def stop(container: str) -> None:
    docker = shutil.which("docker")
    if docker:
        subprocess.run([docker, "stop", container], capture_output=True)
