import asyncio
import time

from fastapi import WebSocket

from core.config import settings
from core.interfaces import WSManager


class ConnectionManager(WSManager):
    def __init__(self):
        self.active: dict[str, tuple[WebSocket, float]] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task | None = None

    async def connect(self, client_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            if len(self.active) >= settings.ws_max_connections:
                await ws.send_json({"type": "error", "message": "Max connections reached"})
                await ws.close(code=1008)
                return
            self.active[client_id] = (ws, time.time())

    async def disconnect(self, client_id: str) -> None:
        async with self._lock:
            self.active.pop(client_id, None)

    async def update_activity(self, client_id: str) -> None:
        async with self._lock:
            entry = self.active.get(client_id)
            if entry:
                ws, _ = entry
                self.active[client_id] = (ws, time.time())

    async def send_json(self, client_id: str, data: dict) -> None:
        entry = self.active.get(client_id)
        if entry:
            ws, _ = entry
            try:
                await ws.send_json(data)
            except Exception:
                await self.disconnect(client_id)

    async def broadcast(self, data: dict) -> None:
        for client_id in list(self.active.keys()):
            await self.send_json(client_id, data)

    async def stream_agent_status(
        self, client_id: str, agent: str, status: str, message: str = ""
    ) -> None:
        await self.send_json(client_id, {
            "type": "agent_status",
            "agent": agent,
            "status": status,
            "message": message
        })

    async def stream_agent_output(
        self, client_id: str, agent: str, output: str, finished: bool = False
    ) -> None:
        await self.send_json(client_id, {
            "type": "agent_output",
            "agent": agent,
            "output": output,
            "finished": finished
        })

    def start_cleanup(self) -> None:
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    def stop_cleanup(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            self._cleanup_task = None

    async def _cleanup_loop(self) -> None:
        try:
            while True:
                await asyncio.sleep(settings.ws_cleanup_interval)
                now = time.time()
                async with self._lock:
                    stale = [
                        cid for cid, (_, ts) in self.active.items()
                        if now - ts > settings.ws_inactivity_timeout
                    ]
                for cid in stale:
                    await self.disconnect(cid)
        except asyncio.CancelledError:
            pass


manager = ConnectionManager()