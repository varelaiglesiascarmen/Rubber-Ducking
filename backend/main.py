import asyncio
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
            raw = await asyncio.wait_for(
                ws.receive_text(), timeout=settings.ws_receive_timeout
            )
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_json(client_id, {
                    "type": "error",
                    "message": "Invalid JSON received"
                })
                continue

            if data.get("type") == "analyze":
                if not await rate_limiter.is_allowed(client_id):
                    await manager.send_json(client_id, {
                        "type": "error",
                        "message": "Rate limit exceeded. Max 5 analyses per minute."
                    })
                    continue

                code = data.get("code", "")
                stack = data.get("stack", "angular")
                objective = data.get("objective", "signal")

                if not code.strip():
                    await manager.send_json(client_id, {
                        "type": "error",
                        "message": "Code is required"
                    })
                    continue

                if len(code) > 50_000:
                    await manager.send_json(client_id, {
                        "type": "error",
                        "message": "Code too large. Maximum 50KB allowed."
                    })
                    continue

                await manager.stream_agent_status(
                    client_id, "system", "running", "Pipeline started"
                )

                result = await pipeline.run(client_id, code, stack, objective)

                await manager.send_json(client_id, {
                    "type": "pipeline_complete",
                    "result": result
                })

            elif data.get("type") == "ping":
                await manager.send_json(client_id, {"type": "pong"})

    except WebSocketDisconnect:
        await manager.disconnect(client_id)
    except asyncio.TimeoutError:
        await manager.send_json(client_id, {
            "type": "error",
            "message": "Request timed out"
        })
        await manager.disconnect(client_id)
    except Exception as e:
        msg = str(e).splitlines()[0] if str(e) else "Internal error"
        await manager.send_json(client_id, {
            "type": "error",
            "message": msg
        })
        await manager.disconnect(client_id)
