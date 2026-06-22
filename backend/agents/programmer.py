from crewai import Agent, Task
from core.helpers import safe_code_block


def create_programmer_agent(llm) -> Agent:
    return Agent(
        role="Signal Refactoring Engineer",
        goal="Refactor legacy Angular code to use modern Signals pattern",
        backstory="Senior Angular architect specialized in migrating applications to Signals-based reactivity",
        llm=llm,
        allow_delegation=False,
        verbose=True
    )


def create_refactoring_task(agent: Agent, code: str, audit_report: str) -> Task:
    return Task(
        description=f"""Refactor the following Angular/TypeScript code to use Signals
instead of traditional change detection patterns.

Apply these rules:
1. Replace BehaviorSubject/Subject with signal()
2. Replace async pipes with computed() or toSignal()
3. Replace ngOnChanges with effect() or computed()
4. Replace @Input() with signal inputs (input())
5. Replace @Output() with output()
6. Remove NgZone where possible
7. Use linkedSignal() for dependent state

Original code:
{safe_code_block("typescript", code)}

Audit report to consider:
{audit_report}

Return ONLY the refactored code, no explanations.""",
        agent=agent,
        expected_output="Complete refactored code using Angular Signals pattern"
    )