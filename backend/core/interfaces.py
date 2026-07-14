from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable


@runtime_checkable
class AgentPipeline(Protocol):
    async def run(self, client_id: str, code: str, stack: str = "angular", objective: str = "signal") -> dict: ...


class WSManager(ABC):
    @abstractmethod
    async def stream_agent_status(self, client_id: str, agent: str, status: str, message: str = ""): ...

    @abstractmethod
    async def stream_agent_output(self, client_id: str, agent: str, output: str, finished: bool = False): ...

    @abstractmethod
    async def send_json(self, client_id: str, data: dict): ...
