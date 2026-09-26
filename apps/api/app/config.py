from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "NyayaPath"
    app_env: str = "development"
    app_debug: bool = True
    api_port: int = 8000
    web_base_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"
    max_upload_size_mb: int = 25
    supabase_url: str = ""
    next_public_supabase_url: str = ""
    next_public_supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_db_url: str = ""
    gemini_api_key: str = ""
    openai_api_key: str = ""
    sarvam_api_key: str = ""
    primary_llm_provider: str = "gemini"
    primary_llm_model: str = "gemini-2.5-flash"
    secondary_llm_provider: str = "gemini"
    secondary_llm_model: str = "gemini-2.5-flash"
    small_llm_provider: str = "gemini"
    small_llm_model: str = "gemini-2.0-flash-lite"
    embedding_provider: str = "gemini"
    embedding_model: str = "text-embedding-004"
    enable_voice_input: bool = False
    enable_pii_redaction: bool = False
    enable_telemetry: bool = False

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def effective_supabase_url(self) -> str:
        return self.supabase_url or self.next_public_supabase_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
