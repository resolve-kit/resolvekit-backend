import subprocess


BLOCKED_TRACKED_PATHS = {
    ".claude-flow/agents/store.json",
    ".claude-flow/hive-mind/state.json",
    ".claude-flow/tasks/store.json",
    ".claude/memory.db",
    ".swarm/hnsw.index",
    ".swarm/hnsw.metadata.json",
    ".swarm/memory.db",
    ".swarm/model-router-state.json",
    ".swarm/schema.sql",
    "deep_research.txt",
    "plan.txt",
    "spec.md",
    "vectors.db",
}


def test_local_agent_state_and_scratch_files_are_not_tracked() -> None:
    tracked = subprocess.check_output(["git", "ls-files"], text=True).splitlines()

    assert BLOCKED_TRACKED_PATHS.isdisjoint(tracked)


def test_internal_planning_notes_are_not_tracked() -> None:
    tracked = subprocess.check_output(["git", "ls-files"], text=True).splitlines()

    assert not any(path.startswith("docs/plans/") for path in tracked)
