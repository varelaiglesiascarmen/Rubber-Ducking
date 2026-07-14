import asyncio

import pytest

from core.rate_limiter import RateLimiter


class TestRateLimiter:
    def setup_method(self):
        self.rl = RateLimiter(max_calls=3, window=60)

    @pytest.mark.asyncio
    async def test_allows_within_limit(self):
        assert await self.rl.is_allowed("a")
        assert await self.rl.is_allowed("a")
        assert await self.rl.is_allowed("a")

    @pytest.mark.asyncio
    async def test_denies_over_limit(self):
        await self.rl.is_allowed("a")
        await self.rl.is_allowed("a")
        await self.rl.is_allowed("a")
        assert not await self.rl.is_allowed("a")

    @pytest.mark.asyncio
    async def test_different_keys_independent(self):
        for _ in range(5):
            await self.rl.is_allowed("x")
        assert await self.rl.is_allowed("y")

    @pytest.mark.asyncio
    async def test_expires_after_window(self):
        self.rl = RateLimiter(max_calls=1, window=0.1)
        await self.rl.is_allowed("a")
        assert not await self.rl.is_allowed("a")
        await asyncio.sleep(0.15)
        assert await self.rl.is_allowed("a")

    @pytest.mark.asyncio
    async def test_concurrent_access(self):
        async def hammer(key: str):
            results = []
            for _ in range(5):
                results.append(await self.rl.is_allowed(key))
            return results

        results = await asyncio.gather(
            hammer("shared"),
            hammer("shared"),
            hammer("shared"),
        )
        total_allowed = sum(sum(r) for r in results)
        assert total_allowed == 3, f"Expected 3 allowed, got {total_allowed}"

    @pytest.mark.asyncio
    async def test_cleanup_expired_key(self):
        self.rl = RateLimiter(max_calls=5, window=0.05)
        await self.rl.is_allowed("temp")
        assert "temp" in self.rl._buckets
        await asyncio.sleep(0.1)
        await self.rl.is_allowed("temp")
        assert len(self.rl._buckets["temp"]) == 1
