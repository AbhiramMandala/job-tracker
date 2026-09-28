"""SerpApi HTTP client. The ONLY module allowed to call SerpApi.

Docs: engine=google_jobs, GET https://serpapi.com/search.json with
q (required), location, gl, hl, next_page_token, engine, api_key.
"""

import logging
import time

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://serpapi.com/search.json"
TIMEOUT_SECONDS = 15.0
MAX_ATTEMPTS = 2  # initial try + one retry (retry only timeout/5xx)


class SerpApiError(Exception):
    """Typed SerpApi failure. `kind` selects user message + retry policy.

    kinds: config (no key), auth (bad key), rate_limit (429),
    timeout, http (other 4xx/5xx), parse (bad payload shape).
    """

    def __init__(self, kind: str, message: str, http_status: int = 0):
        super().__init__(message)
        self.kind = kind
        self.http_status = http_status


def _classify_error(status: int, body: dict) -> SerpApiError:
    upstream = ""
    if isinstance(body, dict):
        upstream = str(body.get("error") or "")[:200]
    if status in (401, 403) or "api_key" in upstream.lower() or "api key" in upstream.lower():
        return SerpApiError("auth", "SerpApi authentication failed.", status)
    if status == 429:
        return SerpApiError("rate_limit", "SerpApi rate limit reached.", status)
    return SerpApiError("http", f"SerpApi request failed (HTTP {status}).", status)


class SerpApiClient:
    def __init__(
        self,
        api_key: str,
        timeout: float = TIMEOUT_SECONDS,
        transport: httpx.BaseTransport | None = None,
    ):
        self._api_key = api_key
        self._timeout = timeout
        self._transport = transport

    def _params(
        self,
        q: str,
        location: str,
        gl: str = "in",
        hl: str = "en",
        next_page_token: str = "",
    ) -> dict:
        params = {
            "engine": "google_jobs",
            "q": q,
            "location": location,
            "gl": gl,
            "hl": hl,
            "api_key": self._api_key,
        }
        if next_page_token:
            params["next_page_token"] = next_page_token
        return params

    def google_jobs(
        self,
        q: str,
        location: str,
        gl: str = "in",
        hl: str = "en",
        next_page_token: str = "",
    ) -> dict:
        """Fetch one raw Google Jobs page. Returns the decoded JSON dict.

        Raises SerpApiError on every failure mode. Never logs the key.
        """
        if not self._api_key:
            raise SerpApiError("config", "SERPAPI_KEY is not configured.")
        params = self._params(q, location, gl, hl, next_page_token)
        return self._execute("google_jobs", params, q)

    def google_search(
        self,
        q: str,
        gl: str = "in",
        hl: str = "en",
    ) -> dict:
        """Fetch one raw Google organic-search response. Same contract."""
        if not self._api_key:
            raise SerpApiError("config", "SERPAPI_KEY is not configured.")
        params = {
            "engine": "google",
            "q": q,
            "gl": gl,
            "hl": hl,
            "api_key": self._api_key,
        }
        return self._execute("google", params, q)

    def google_news(
        self,
        q: str,
        gl: str = "in",
        hl: str = "en",
    ) -> dict:
        """Fetch one raw Google News response. Same retry/error contract."""
        if not self._api_key:
            raise SerpApiError("config", "SERPAPI_KEY is not configured.")
        params = {
            "engine": "google_news",
            "q": q,
            "gl": gl,
            "hl": hl,
            "api_key": self._api_key,
        }
        return self._execute("google_news", params, q)

    def _execute(self, engine: str, params: dict, q: str) -> dict:
        last_error: SerpApiError | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            started = time.monotonic()
            try:
                with httpx.Client(
                    timeout=self._timeout, transport=self._transport
                ) as http:
                    response = http.get(BASE_URL, params=params)
            except httpx.TimeoutException:
                last_error = SerpApiError("timeout", "SerpApi request timed out.")
                logger.warning("serpapi timeout attempt=%d engine=%s q=%r", attempt, engine, q)
                continue  # retry timeouts
            except httpx.HTTPError as exc:
                raise SerpApiError("http", f"SerpApi transport error: {type(exc).__name__}.")
            elapsed_ms = int((time.monotonic() - started) * 1000)
            if response.status_code == 200:
                try:
                    body = response.json()
                except ValueError:
                    raise SerpApiError("parse", "SerpApi returned invalid JSON.", 200)
                if not isinstance(body, dict):
                    raise SerpApiError("parse", "SerpApi returned an unexpected shape.", 200)
                if isinstance(body.get("error"), str) and body["error"]:
                    raise _classify_error(200, body)
                logger.info("serpapi ok engine=%s q=%r ms=%d", engine, q, elapsed_ms)
                return body
            if 500 <= response.status_code < 600 and attempt < MAX_ATTEMPTS:
                logger.warning(
                    "serpapi 5xx attempt=%d engine=%s status=%d q=%r",
                    attempt, engine, response.status_code, q,
                )
                last_error = _classify_error(response.status_code, {})
                continue  # retry 5xx once
            try:
                body = response.json()
            except ValueError:
                body = {}
            raise _classify_error(response.status_code, body if isinstance(body, dict) else {})
        raise last_error or SerpApiError("http", "SerpApi request failed.")
