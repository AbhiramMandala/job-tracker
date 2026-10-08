"""SerpApiClient tests. HTTP is mocked; no key, no network."""

import httpx
import pytest

from app.services.serpapi_client import SerpApiClient, SerpApiError
from tests._fixtures import EMPTY


def _client(handler, api_key="test-key"):
    return SerpApiClient(api_key=api_key, transport=httpx.MockTransport(handler))


def _ok(body, status=200):
    def handler(request):
        assert "api_key" in str(request.url)  # key is sent server-side
        return httpx.Response(status, json=body)

    return handler


def test_success_returns_body():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=EMPTY)

    body = _client(handler).google_jobs("python", "Hyderabad, India")
    assert body["jobs_results"] == []
    assert len(calls) == 1


def test_missing_key_raises_config_without_request():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=EMPTY)

    with pytest.raises(SerpApiError) as exc:
        _client(handler, api_key="").google_jobs("python", "Hyderabad, India")
    assert exc.value.kind == "config"
    assert calls == []


def test_auth_error_does_not_retry():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(401, json={"error": "Invalid API key"})

    with pytest.raises(SerpApiError) as exc:
        _client(handler).google_jobs("python", "Hyderabad, India")
    assert exc.value.kind == "auth"
    assert len(calls) == 1


def test_rate_limit_does_not_retry():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(429, json={"error": "Too many requests"})

    with pytest.raises(SerpApiError) as exc:
        _client(handler).google_jobs("python", "Hyderabad, India")
    assert exc.value.kind == "rate_limit"
    assert len(calls) == 1


def test_5xx_retried_once_then_succeeds():
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(503, json={})
        return httpx.Response(200, json=EMPTY)

    body = _client(handler).google_jobs("python", "Hyderabad, India")
    assert body == EMPTY
    assert len(calls) == 2


def test_5xx_twice_raises_http():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(500, json={})

    with pytest.raises(SerpApiError) as exc:
        _client(handler).google_jobs("python", "Hyderabad, India")
    assert exc.value.kind == "http"
    assert len(calls) == 2


def test_timeout_retried_then_raises():
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.ConnectTimeout("boom")

    with pytest.raises(SerpApiError) as exc:
        _client(handler, ).google_jobs("python", "Hyderabad, India")
    assert exc.value.kind == "timeout"
    assert len(calls) == 2


def test_invalid_json_raises_parse():
    def handler(request):
        return httpx.Response(200, content=b"not json")

    with pytest.raises(SerpApiError) as exc:
        _client(handler).google_jobs("python", "Hyderabad, India")
    assert exc.value.kind == "parse"
