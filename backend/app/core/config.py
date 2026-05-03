from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    dart_api_key: str = ""
    cors_origins: str = "http://localhost:3000"
    rate_limit_per_minute: int = 10
    app_env: str = "development"  # development | production

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
