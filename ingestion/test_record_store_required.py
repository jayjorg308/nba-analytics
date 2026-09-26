"""NBA_REQUIRE_RECORD_STORE: the record-store tests skip loudly where Docker
is absent, except where they must run. The season loop's live gate sets it
(season_update.GATE_ENV); a publish must never ride on skipped checks.
"""

from __future__ import annotations

import pytest

from conftest import REQUIRE_ENV, record_store_unavailable


def test_an_unavailable_store_skips_by_default(monkeypatch):
    monkeypatch.delenv(REQUIRE_ENV, raising=False)
    with pytest.raises(pytest.skip.Exception):
        record_store_unavailable("Docker daemon not running")


def test_an_unavailable_store_fails_when_required(monkeypatch):
    monkeypatch.setenv(REQUIRE_ENV, "1")
    with pytest.raises(pytest.fail.Exception, match="must run, not skip"):
        record_store_unavailable("Docker daemon not running")


def test_only_the_value_1_requires(monkeypatch):
    monkeypatch.setenv(REQUIRE_ENV, "0")
    with pytest.raises(pytest.skip.Exception):
        record_store_unavailable("Docker daemon not running")
