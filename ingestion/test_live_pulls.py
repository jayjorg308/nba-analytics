"""Tests for live_pulls' upstream retry contract (2026-10-16).

stats.nba.com answers some requests with an HTTP 500 and an empty body,
intermittently, which nba_api raises as a JSONDecodeError from inside the
endpoint's constructor. fetch() retries transient failures after each of
RETRY_DELAYS and then raises UpstreamUnavailable; anything else is a defect
and propagates at once. No network: the endpoint classes are fakes.
"""

from __future__ import annotations

import inspect
import json

import pytest
import requests

import live_pulls as lp


def fake_endpoint(outcomes: list):
    """An nba_api-shaped endpoint class: each construction consumes the next
    outcome, raising it if it is an exception, else serving it as the dict."""

    class Endpoint:
        endpoint = "fakeendpoint"
        calls = 0

        def __init__(self, **params):
            type(self).calls += 1
            outcome = outcomes.pop(0)
            if isinstance(outcome, BaseException):
                raise outcome
            self._dict = outcome

        def get_dict(self):
            return self._dict

    return Endpoint


def empty_body() -> json.JSONDecodeError:
    # What nba_api raises for the 500's empty body.
    return json.JSONDecodeError("Expecting value", "", 0)


@pytest.fixture
def sleeps(monkeypatch):
    waited: list[float] = []
    monkeypatch.setattr(lp.time, "sleep", waited.append)
    return waited


def test_fetch_retries_transient_failures_then_returns(sleeps):
    endpoint = fake_endpoint([empty_body(), requests.exceptions.Timeout(), {"ok": 1}])
    assert lp.fetch(endpoint, player_id=7) == {"ok": 1}
    assert endpoint.calls == 3
    assert sleeps == list(lp.RETRY_DELAYS[:2])


def test_fetch_gives_up_with_upstream_unavailable(sleeps):
    endpoint = fake_endpoint([empty_body() for _ in range(len(lp.RETRY_DELAYS) + 1)])
    with pytest.raises(lp.UpstreamUnavailable) as info:
        lp.fetch(endpoint, player_id=7, date_to_nullable="04/01/2026")
    message = str(info.value)
    assert "fakeendpoint" in message and "player_id=7" in message
    assert "date_to_nullable=04/01/2026" in message
    assert f"{len(lp.RETRY_DELAYS) + 1} attempts" in message
    assert isinstance(info.value.__cause__, json.JSONDecodeError)
    assert sleeps == list(lp.RETRY_DELAYS)


def test_fetch_never_retries_a_defect(sleeps):
    endpoint = fake_endpoint([KeyError("resultSets")])
    with pytest.raises(KeyError):
        lp.fetch(endpoint)
    assert endpoint.calls == 1
    assert sleeps == []


def test_every_pull_goes_through_fetch():
    # A pull that calls an endpoint directly would skip the retries: the only
    # .get_dict() in the module is the one inside fetch().
    assert inspect.getsource(lp).count(".get_dict()") == 1
    assert ".get_dict()" in inspect.getsource(lp.fetch)
