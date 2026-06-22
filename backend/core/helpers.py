def safe_code_block(label: str, code: str, max_len: int = 8000) -> str:
    truncated = code[:max_len]
    escaped = truncated.replace("{", "{{").replace("}", "}}")
    return f"```{label}\n{escaped}\n```"
