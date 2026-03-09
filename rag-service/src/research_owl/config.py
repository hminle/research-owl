from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    data_dir: Path = Path("data")
    images_scale: float = 2.0

    ai_gateway_api_key: str = ""
    ai_gateway_base_url: str = "https://ai-gateway.vercel.sh/v1"
    llm_model: str = "openai/gpt-4o-mini"
    vision_model: str = "openai/gpt-4o"
    embed_model: str = "openai/text-embedding-3-small"
    embed_dimension: int = 1536

    qdrant_url: str = "http://localhost:6333"

    @property
    def images_dir(self) -> Path:
        return self.data_dir / "images"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "papers.db"

    @property
    def parsed_dir(self) -> Path:
        return self.data_dir / "parsed"

    model_config = {"env_prefix": "OWL_"}


settings = Settings()
