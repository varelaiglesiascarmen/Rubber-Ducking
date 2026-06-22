import time
from collections import defaultdict


class RateLimiter:
    def __init__(self, max_calls: int = 5, window: int = 60):
        self._buckets: dict[str, list[float]] = defaultdict(list)
        self.max_calls = max_calls
        self.window = window

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        self._buckets[key] = [t for t in self._buckets[key] if now - t < self.window]
        if len(self._buckets[key]) >= self.max_calls:
            return False
        self._buckets[key].append(now)
        return True
