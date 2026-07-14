from unittest.mock import AsyncMock

import pytest

from core.websocket_manager import ConnectionManager


class TestConnectionManager:
    def setup_method(self):
        self.mgr = ConnectionManager()

    def _make_mock_ws(self) -> AsyncMock:
        ws = AsyncMock()
        ws.accept = AsyncMock()
        ws.close = AsyncMock()
        ws.send_json = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_initial_state(self):
        assert len(self.mgr.active) == 0

    @pytest.mark.asyncio
    async def test_connect_adds_client(self):
        ws = self._make_mock_ws()
        await self.mgr.connect("c1", ws)
        assert "c1" in self.mgr.active
        ws.accept.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_disconnect_removes_client(self):
        ws = self._make_mock_ws()
        await self.mgr.connect("c1", ws)
        await self.mgr.disconnect("c1")
        assert "c1" not in self.mgr.active
        ws.close.assert_awaited_once_with(code=1000)

    @pytest.mark.asyncio
    async def test_send_json_to_connected_client(self):
        ws = self._make_mock_ws()
        await self.mgr.connect("c1", ws)
        await self.mgr.send_json("c1", {"type": "ping"})
        ws.send_json.assert_awaited_once_with({"type": "ping"})

    @pytest.mark.asyncio
    async def test_send_json_to_nonexistent_client(self):
        await self.mgr.send_json("ghost", {"type": "ping"})

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all(self):
        ws1 = self._make_mock_ws()
        ws2 = self._make_mock_ws()
        await self.mgr.connect("c1", ws1)
        await self.mgr.connect("c2", ws2)
        await self.mgr.broadcast({"type": "notification"})
        ws1.send_json.assert_awaited_once_with({"type": "notification"})
        ws2.send_json.assert_awaited_once_with({"type": "notification"})

    @pytest.mark.asyncio
    async def test_max_connections_rejected(self):
        original_max = self.mgr.active
        for i in range(10):
            ws = self._make_mock_ws()
            await self.mgr.connect(f"c{i}", ws)

        extra_ws = self._make_mock_ws()
        await self.mgr.connect("extra", extra_ws)
        extra_ws.close.assert_awaited_once_with(code=1008)

    @pytest.mark.asyncio
    async def test_stream_agent_status(self):
        ws = self._make_mock_ws()
        await self.mgr.connect("c1", ws)
        await self.mgr.stream_agent_status("c1", "auditor", "running", "Started")
        ws.send_json.assert_awaited_once_with({
            "type": "agent_status",
            "agent": "auditor",
            "status": "running",
            "message": "Started"
        })

    @pytest.mark.asyncio
    async def test_stream_agent_output(self):
        ws = self._make_mock_ws()
        await self.mgr.connect("c1", ws)
        await self.mgr.stream_agent_output("c1", "auditor", "output text", finished=True)
        ws.send_json.assert_awaited_once_with({
            "type": "agent_output",
            "agent": "auditor",
            "output": "output text",
            "finished": True
        })

    @pytest.mark.asyncio
    async def test_cleanup_loop_structure(self):
        assert hasattr(self.mgr, "_cleanup_loop")
        assert self.mgr._cleanup_task is None

    @pytest.mark.asyncio
    async def test_start_stop_cleanup(self):
        self.mgr.start_cleanup()
        assert self.mgr._cleanup_task is not None
        self.mgr.stop_cleanup()
        assert self.mgr._cleanup_task is None
