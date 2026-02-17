from app.config import Settings


def test_settings_defaults_without_env_file() -> None:
    settings = Settings(_env_file=None)

    assert settings.retrieval_k == 8
    assert settings.chroma_dir == "./data/chroma"
    assert settings.log_level == "INFO"


def test_settings_support_overrides() -> None:
    settings = Settings(_env_file=None, retrieval_k=3, log_level="DEBUG")

    assert settings.retrieval_k == 3
    assert settings.log_level == "DEBUG"
