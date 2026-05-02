from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    dart_api_key: str = ""
    cors_origins: str = "http://localhost:3000"
    rate_limit_per_minute: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
