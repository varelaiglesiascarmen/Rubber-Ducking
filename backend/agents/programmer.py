from crewai import Agent, Task
from core.helpers import safe_code_block

_STACK_LABELS = {
    "angular": "Angular",
    "react": "React",
    "vue": "Vue",
}

_STACK_OBJECTIVE_RULES = {
    ("angular", "signal"): [
        "Replace BehaviorSubject/Subject with signal()",
        "Replace async pipes with computed() or toSignal()",
        "Replace ngOnChanges with effect() or computed()",
        "Replace @Input() with signal inputs (input())",
        "Replace @Output() with output()",
        "Remove NgZone where possible",
        "Use linkedSignal() for dependent state",
    ],
    ("angular", "optimize"): [
        "Optimize change detection (OnPush strategy)",
        "Implement lazy loading for feature modules",
        "Use trackBy in ngFor loops",
        "Remove unnecessary pipes and subscriptions",
        "Optimize bundle size with tree-shakeable providers",
    ],
    ("angular", "standalone"): [
        "Convert NgModules to standalone components",
        "Replace module imports with standalone component imports",
        "Remove @NgModule decorators where possible",
        "Use provideRouter instead of RouterModule.forRoot",
        "Migrate to standalone bootstrap",
    ],
    ("react", "hooks"): [
        "Convert class components to functional components",
        "Replace lifecycle methods with useEffect, useLayoutEffect",
        "Replace this.state/this.setState with useState",
        "Replace higher-order components with custom hooks",
        "Use useReducer for complex state logic",
        "Implement useMemo and useCallback for optimization",
    ],
    ("react", "optimize"): [
        "Implement React.memo for expensive components",
        "Optimize re-renders with useMemo and useCallback",
        "Implement code splitting with React.lazy and Suspense",
        "Optimize bundle size with dynamic imports",
        "Use proper key props in lists",
    ],
    ("react", "server"): [
        "Convert client components to Server Components where possible",
        "Use 'use client' directive only when needed",
        "Move data fetching to server components",
        "Implement streaming with Suspense boundaries",
        "Use server actions for mutations",
    ],
    ("vue", "setup"): [
        "Convert Options API to Composition API",
        "Replace data() with ref() and reactive()",
        "Replace computed properties with computed()",
        "Replace methods with standalone functions",
        "Replace watch with watch() or watchEffect()",
        "Use <script setup> syntax",
    ],
    ("vue", "optimize"): [
        "Optimize reactivity with shallowRef and shallowReactive",
        "Implement lazy loading for components",
        "Use v-memo for expensive list rendering",
        "Optimize watchers with immediate and deep options",
        "Reduce bundle size with tree-shaking",
    ],
    ("vue", "composition"): [
        "Full migration to Composition API patterns",
        "Organize composables for reusable logic",
        "Replace mixins with composable functions",
        "Use provide/inject with Composition API",
        "Migrate all components to <script setup>",
    ],
}


def create_programmer_agent(llm) -> Agent:
    return Agent(
        role="Refactoring Engineer",
        goal="Refactor code following modern framework patterns",
        backstory="Senior software architect specialized in modernizing codebases across Angular, React, and Vue",
        llm=llm,
        allow_delegation=False,
        verbose=True
    )


def create_refactoring_task(agent: Agent, code: str, audit_report: str, stack: str = "angular", objective: str = "signal") -> Task:
    stack_label = _STACK_LABELS.get(stack, "TypeScript")
    rules = _STACK_OBJECTIVE_RULES.get((stack, objective), [
        "Apply best practices for the target framework",
        "Improve code quality and maintainability",
    ])
    rules_text = "\n".join(f"{i+1}. {r}" for i, r in enumerate(rules))

    return Task(
        description=f"""Refactor the following {stack_label}/TypeScript code according to the objective '{objective}'.

Apply these rules:
{rules_text}

Original code:
{safe_code_block("typescript", code)}

Audit report to consider:
{audit_report}

Return ONLY the refactored code, no explanations.""",
        agent=agent,
        expected_output=f"Complete refactored code for {stack_label} with objective '{objective}'"
    )