import asyncio
from concurrent.futures import ThreadPoolExecutor

from crewai import LLM
from core.config import settings
from core.websocket_manager import manager
from core.interfaces import AgentPipeline
from agents.auditor import create_auditor_agent, create_audit_task
from agents.programmer import create_programmer_agent, create_refactoring_task
from agents.validator import create_validator_agent, create_validation_task

_executor = ThreadPoolExecutor(max_workers=settings.max_workers)


def shutdown_executor() -> None:
    _executor.shutdown(wait=True)


def get_llm() -> LLM:
    return LLM(
        model=f"groq/{settings.groq_model}",
        api_key=settings.groq_api_key,
        temperature=0.3,
        timeout=settings.groq_timeout * 1000
    )


def _run_agent(
    llm: LLM,
    agent_factory,
    task_factory,
    *task_args
) -> str:
    agent = agent_factory(llm)
    task = task_factory(agent, *task_args)
    return str(task.execute())


async def _run_stage(
    client_id: str,
    loop: asyncio.AbstractEventLoop,
    stage_name: str,
    llm: LLM,
    agent_factory,
    task_factory,
    *task_args
) -> str:
    await manager.stream_agent_status(
        client_id, stage_name, "running", f"Starting {stage_name}..."
    )

    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(
                _executor,
                _run_agent,
                llm,
                agent_factory,
                task_factory,
                *task_args
            ),
            timeout=settings.agent_timeout
        )

        await manager.stream_agent_status(
            client_id, stage_name, "completed", f"{stage_name} done"
        )
        await manager.stream_agent_output(
            client_id, stage_name, result, finished=True
        )
        return result

    except asyncio.TimeoutError:
        await manager.stream_agent_status(
            client_id, stage_name, "error",
            f"{stage_name} timed out after {settings.agent_timeout}s"
        )
        raise
    except Exception as e:
        await manager.stream_agent_status(
            client_id, stage_name, "error", str(e)
        )
        raise


class CrewAgentPipeline:
    async def run(self, client_id: str, code: str) -> dict:
        return await run_pipeline(client_id, code)


async def run_pipeline(client_id: str, code: str) -> dict:
    llm = get_llm()
    loop = asyncio.get_event_loop()

    audit_result = await _run_stage(
        client_id, loop, "auditor", llm,
        create_auditor_agent, create_audit_task, code
    )

    refactored_result = await _run_stage(
        client_id, loop, "programmer", llm,
        create_programmer_agent, create_refactoring_task, code, audit_result
    )

    validation_result = await _run_stage(
        client_id, loop, "validator", llm,
        create_validator_agent, create_validation_task, code, refactored_result
    )

    return {
        "audit": audit_result,
        "refactored": refactored_result,
        "validation": validation_result
    }