from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str = ""
    groq_model: str = "llama3-70b-8192"
    groq_timeout: int = Field(default=60, ge=1)
    agent_timeout: int = Field(default=120, ge=1)
    ws_max_connections: int = Field(default=10, ge=1)
    ws_inactivity_timeout: int = Field(default=300, ge=10)
    ws_cleanup_interval: int = Field(default=30, ge=5)
    ws_receive_timeout: int = Field(default=120, ge=10)
    max_workers: int = Field(default=4, ge=1)
    cors_allowed_origins: list[str] = ["http://localhost:8080", "http://localhost:4200"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()