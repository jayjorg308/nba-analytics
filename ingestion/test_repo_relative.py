"""repo_relative: the one spelling of a raw artifact's path in _meta and in
the record store's snapshot catalog (a UNIQUE, repo-relative key).

The season loop runs from its own clone, which reaches the shared raw layer
through a directory junction (docs/plans/jazz-first-site.md, operations).
Resolving the path follows that link out of the clone, the relative form
fails, and the fallback writes an absolute, machine-specific path into
production's catalog and every published payload's provenance. Links are
therefore never followed.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

import derive_creation as dc
import derive_payload as dp

HELPERS = [pytest.param(dp.repo_relative, id="derive_payload"),
           pytest.param(dc.repo_relative, id="derive_creation")]


@pytest.mark.parametrize("repo_relative", HELPERS)
def test_path_under_the_repo_is_relative(repo_relative, tmp_path, monkeypatch):
    raw = tmp_path / "data" / "raw"
    raw.mkdir(parents=True)
    (raw / "x.json").write_text("{}", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    assert repo_relative(raw / "x.json") == "data/raw/x.json"
    assert repo_relative(Path("data/raw/x.json")) == "data/raw/x.json"


@pytest.mark.parametrize("repo_relative", HELPERS)
def test_a_linked_data_directory_is_not_followed(repo_relative, tmp_path, monkeypatch):
    shared = tmp_path / "dev-checkout" / "data"
    (shared / "raw").mkdir(parents=True)
    (shared / "raw" / "x.json").write_text("{}", encoding="utf-8")
    clone = tmp_path / "loop-clone"
    clone.mkdir()
    try:
        if os.name == "nt":
            import _winapi  # the junction the loop clone actually uses
            _winapi.CreateJunction(str(shared), str(clone / "data"))
        else:
            os.symlink(shared, clone / "data", target_is_directory=True)
    except (OSError, ImportError, AttributeError) as exc:
        pytest.skip(f"cannot create a directory link here: {exc}")
    monkeypatch.chdir(clone)
    assert repo_relative(clone / "data" / "raw" / "x.json") == "data/raw/x.json"
