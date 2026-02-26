from scripts.export_openapi import export_openapi


def test_openapi_export_targets_renamed_files() -> None:
    written = export_openapi()
    names = {path.name for path in written}
    assert names == {"agent.openapi.json", "knowledge_bases.openapi.json"}
