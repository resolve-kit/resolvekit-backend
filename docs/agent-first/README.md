# Agent-First Harness Notes

This repository follows an agent-first operating model:

- `AGENTS.md` is a short map, not an encyclopedia.
- Detailed knowledge lives in versioned markdown under `docs/`.
- Execution plans are first-class artifacts in `docs/exec-plans/`.
- CI enforces documentation shape and discoverability with `scripts/check_agent_docs.sh`.

Practical outcomes:

- Agents can find architecture and constraints without oversized prompts.
- Humans review intent and outcomes instead of repeating repository context.
- Drift is visible early because doc checks run in CI.
