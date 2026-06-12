from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./richbot.db"
    dart_api_key: str = ""
    anthropic_api_key: str = ""
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_admin_email: str = "admin@richbot.local"
    # Market hours KST: Mon-Fri 09:00-15:35
    scheduler_interval_minutes: int = 15

    model_config = {"env_file": "../.env", "extra": "ignore"}


settings = Settings()
