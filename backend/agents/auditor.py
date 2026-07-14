from crewai import Agent, Task
from core.helpers import safe_code_block

_STACK_LABELS = {
    "angular": "Angular",
    "react": "React",
    "vue": "Vue",
}

_OBJECTIVE_FOCUS = {
    "signal": "refactoring to Signals",
    "hooks": "refactoring to Hooks",
    "setup": "refactoring to Script Setup",
    "optimize": "performance optimization",
    "standalone": "standalone migration",
    "server": "Server Components migration",
    "composition": "Composition API migration",
}


def create_auditor_agent(llm) -> Agent:
    return Agent(
        role="Syntax Auditor",
        goal="Analyze code syntax and detect errors, anti-patterns, and code smells",
        backstory="Expert code reviewer specialized in static analysis and pattern detection",
        llm=llm,
        allow_delegation=False,
        verbose=True
    )


def create_audit_task(agent: Agent, code: str, stack: str = "angular", objective: str = "signal") -> Task:
    stack_label = _STACK_LABELS.get(stack, "TypeScript")
    focus = _OBJECTIVE_FOCUS.get(objective, objective)
    return Task(
        description=f"""Analyze the following {stack_label} code for syntax errors, anti-patterns,
and code quality issues. The target objective is {focus}.
Provide a detailed report focusing on issues relevant to {stack_label} development.

{safe_code_block("typescript", code)}

Provide recommendations for improvement.""",
        agent=agent,
        expected_output="A detailed audit report with errors, warnings, and suggestions"
    )