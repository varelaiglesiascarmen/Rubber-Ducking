import difflib
from crewai import Agent, Task
from core.helpers import safe_code_block


def compute_diff(original: str, refactored: str) -> str:
    return "".join(difflib.unified_diff(
        original.splitlines(keepends=True),
        refactored.splitlines(keepends=True),
        fromfile="original",
        tofile="refactored"
    ))


def create_validator_agent(llm) -> Agent:
    return Agent(
        role="AST Validator",
        goal="Validate refactored code using AST analysis and best practices",
        backstory="Expert in TypeScript AST and Angular best practices, ensuring refactored code is correct",
        llm=llm,
        allow_delegation=False,
        verbose=True
    )


def create_validation_task(agent: Agent, original: str, refactored: str) -> Task:
    diff = compute_diff(original, refactored)
    return Task(
        description=f"""Validate the refactored code and provide a final report.

Original code:
{safe_code_block("typescript", original)}

Refactored code:
{safe_code_block("typescript", refactored)}

Diff:
```
{diff}
```

Check for:
1. Syntax correctness
2. Proper Signals usage (signal, computed, effect, input, output)
3. Missing imports
4. Type safety
5. Breaking changes

Provide a validation report with: is_valid (boolean), issues (list), and recommendations.""",
        agent=agent,
        expected_output="Validation report with is_valid flag, issues list, and recommendations"
    )