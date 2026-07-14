import asyncio
import time


class RateLimiter:
    def __init__(self, max_calls: int = 5, window: int = 60):
        self._buckets: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()
        self.max_calls = max_calls
        self.window = window

    async def is_allowed(self, key: str) -> bool:
        async with self._lock:
            now = time.monotonic()
            bucket = self._buckets.get(key)
            if bucket is None:
                self._buckets[key] = [now]
                return True

            bucket[:] = [t for t in bucket if now - t < self.window]

            if not bucket:
                del self._buckets[key]
                self._buckets[key] = [now]
                return True

            if len(bucket) >= self.max_calls:
                return False

            bucket.append(now)
            return True
