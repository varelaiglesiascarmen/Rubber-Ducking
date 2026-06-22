import time

from core.rate_limiter import RateLimiter


class TestRateLimiter:
    def setup_method(self):
        self.rl = RateLimiter(max_calls=3, window=60)

    def test_allows_within_limit(self):
        assert self.rl.is_allowed("a")
        assert self.rl.is_allowed("a")
        assert self.rl.is_allowed("a")

    def test_denies_over_limit(self):
        self.rl.is_allowed("a")
        self.rl.is_allowed("a")
        self.rl.is_allowed("a")
        assert not self.rl.is_allowed("a")

    def test_different_keys_independent(self):
        for _ in range(5):
            self.rl.is_allowed("x")
        assert self.rl.is_allowed("y")

    def test_expires_after_window(self):
        self.rl = RateLimiter(max_calls=1, window=0.1)
        self.rl.is_allowed("a")
        assert not self.rl.is_allowed("a")
        time.sleep(0.15)
        assert self.rl.is_allowed("a")