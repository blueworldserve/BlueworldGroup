"""
Brute-force protection for the CMS login, on top of the per-IP limit in core/limiter.py.

Two counters, both over a sliding window:
  - per (IP + email): 5 failures  -> that visitor is locked out of that account for the rest of the window
  - per email alone:  20 failures -> catches an attacker rotating through many IPs against one account

Keyed this way, someone spamming a real admin's email from their own IP cannot lock the
admin out (the admin comes from a different IP and the per-email ceiling is much higher).

Counters live in this process's memory. With one API worker that is exact; with several
workers each keeps its own count, so the real ceiling is (limit x workers). Move to Redis
if you ever scale out.
"""
import time
from collections import defaultdict, deque

WINDOW_SECONDS = 15 * 60
MAX_PER_IP_AND_EMAIL = 5
MAX_PER_EMAIL = 20

_by_ip_email: dict[tuple[str, str], deque] = defaultdict(deque)
_by_email: dict[str, deque] = defaultdict(deque)


def _prune(bucket: deque, now: float) -> None:
    while bucket and now - bucket[0] > WINDOW_SECONDS:
        bucket.popleft()


def is_locked(ip: str, email: str) -> bool:
    now = time.monotonic()
    email = email.strip().lower()
    a = _by_ip_email[(ip, email)]
    b = _by_email[email]
    _prune(a, now)
    _prune(b, now)
    return len(a) >= MAX_PER_IP_AND_EMAIL or len(b) >= MAX_PER_EMAIL


def register_failure(ip: str, email: str) -> None:
    now = time.monotonic()
    email = email.strip().lower()
    _by_ip_email[(ip, email)].append(now)
    _by_email[email].append(now)


def clear(ip: str, email: str) -> None:
    email = email.strip().lower()
    _by_ip_email.pop((ip, email), None)
    # the per-email counter is left alone on purpose: one success must not erase an attack in progress
