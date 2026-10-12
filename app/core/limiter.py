from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from core import config


def client_ip(request: Request) -> str:
    """Key used for rate limiting.

    Behind a reverse proxy (Railway, Render, Cloudflare...) `request.client.host`
    is the PROXY's address, so every visitor would share one bucket. When
    TRUSTED_PROXY_COUNT > 0 we read the real client IP from X-Forwarded-For,
    counting from the right (the only part our own proxies wrote — the left side
    can be forged by the visitor). With 0 we never trust the header.
    """
    n = config.TRUSTED_PROXY_COUNT
    if n > 0:
        xff = request.headers.get("x-forwarded-for", "")
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        if len(hops) >= n:
            return hops[-n]
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)