import importlib


def test_agent_package_entrypoint_exists() -> None:
    module = importlib.import_module("agent.main")
    assert hasattr(module, "app")


def test_knowledge_bases_package_entrypoint_exists() -> None:
    module = importlib.import_module("knowledge_bases.main")
    assert hasattr(module, "app")
