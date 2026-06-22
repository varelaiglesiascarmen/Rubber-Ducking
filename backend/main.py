import json
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from core.websocket_manager import manager
from core.rate_limiter import RateLimiter
from agents.crew import CrewAgentPipeline, shutdown_executor

pipeline = CrewAgentPipeline()
rate_limiter = RateLimiter(max_calls=5, window=60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.start_cleanup()
    yield
    manager.stop_cleanup()
    shutdown_executor()


app = FastAPI(
    title="Rubber-Ducking w/ BillAI",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return JSONResponse({
        "status": "ok",
        "version": "1.0.0",
        "groq_configured": bool(settings.groq_api_key),
        "active_connections": len(manager.active)
    })


@app.websocket("/ws/agents")
async def agent_websocket(ws: WebSocket):
    client_id = str(uuid.uuid4())
    await manager.connect(client_id, ws)

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)

            if data.get("type") == "analyze":
                if not rate_limiter.is_allowed(client_id):
                    await manager.send_json(client_id, {
                        "type": "error",
                        "message": "Rate limit exceeded. Max 5 analyses per minute."
                    })
                    continue

                code = data.get("code", "")
                await manager.stream_agent_status(
                    client_id, "system", "running", "Pipeline started"
                )

                result = await pipeline.run(client_id, code)

                await manager.send_json(client_id, {
                    "type": "pipeline_complete",
                    "result": result
                })

            elif data.get("type") == "ping":
                await manager.send_json(client_id, {"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        await manager.send_json(client_id, {
            "type": "error",
            "message": str(e)
        })
        manager.disconnect(client_id)
