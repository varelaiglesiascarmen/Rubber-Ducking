from crewai import Agent, Task
from core.helpers import safe_code_block


def create_auditor_agent(llm) -> Agent:
    return Agent(
        role="Syntax Auditor",
        goal="Analyze code syntax and detect errors, anti-patterns, and code smells",
        backstory="Expert code reviewer specialized in static analysis and pattern detection",
        llm=llm,
        allow_delegation=False,
        verbose=True
    )


def create_audit_task(agent: Agent, code: str) -> Task:
    return Task(
        description=f"""Analyze the following code for syntax errors, anti-patterns,
and code quality issues. Provide a detailed report.

{safe_code_block("typescript", code)}

Provide recommendations for improvement.""",
        agent=agent,
        expected_output="A detailed audit report with errors, warnings, and suggestions"
    )