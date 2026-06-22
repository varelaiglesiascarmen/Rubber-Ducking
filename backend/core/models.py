from pydantic import BaseModel


class CodeInput(BaseModel):
    code: str
    language: str = "typescript"


class AgentStatus(BaseModel):
    agent: str
    status: str
    message: str = ""


class AgentOutput(BaseModel):
    agent: str
    output: str
    tokens: int = 0
    finished: bool = False


class RefactoringResult(BaseModel):
    original: str
    refactored: str
    report: str
    is_valid: bool
    diff: str = ""
