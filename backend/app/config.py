from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenRouter (OpenAI-compatible)
    openrouter_api_key: str = ""
    llm_model: str = "google/gemini-3-flash-preview"
    embedding_model: str = "openai/text-embedding-3-small"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Paths
    pdf_path: str = "../data/product_catalog_01.pdf"
    chroma_dir: str = "./data/chroma"

    # Retrieval
    retrieval_k: int = 8

    # App
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
