from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    qdrant_url: str = "http://localhost:6333"
    collection_name: str = "papers"
    embed_model: str = "all-MiniLM-L6-v2"
    embed_dimension: int = 384
    data_dir: Path = Path("data")
    images_scale: float = 2.0

    @property
    def images_dir(self) -> Path:
        return self.data_dir / "images"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "papers.db"

    model_config = {"env_prefix": "OWL_"}


settings = Settings()
