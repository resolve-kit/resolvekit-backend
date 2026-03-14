# ResolveKit Resolution Cost Scenarios

Date: March 14, 2026

## Purpose

This report estimates what a real ResolveKit resolution session costs when it includes knowledge-base retrieval, prompt assembly, tool execution, event streaming, and final resolution delivery.

The goal is not to estimate total company opex. The goal is to estimate per-resolution delivery cost under realistic operating flows.

## Headline Takeaways

- A realistic ResolveKit resolution on `Gemini 2.5 Flash-Lite` lands in a roughly `$0.0020` to `$0.0068` fully loaded range per resolved issue in the scenarios below.
- The same flows on a premium model comparable to the now-retired `Gemini 3 Pro Preview` land in a roughly `$0.0234` to `$0.0600` fully loaded range.
- As of March 14, 2026, Google marks `Gemini 3 Pro Preview` as shut down on March 9, 2026. This report therefore uses `Gemini 3.1 Pro Preview` as the current premium comparison point.
- Prompt caching matters more for the premium model than for Flash-Lite because the repeated prefix is much more expensive.
- The practical conclusion is simple: Flash-Lite is cheap enough to run by default, while the premium model should be reserved for complex edge cases that genuinely need stronger reasoning or multimodal interpretation.

## What A Resolution Session Looks Like

This is the runtime shape being modeled:

1. The app sends a user message into the active ResolveKit session.
2. The orchestrator loads routing state, session history, app context, and assigned KB references.
3. ResolveKit queries the KB service over HTTP and pulls the top relevant chunks, including multimodal chunks when available.
4. The model receives the enriched prompt, decides whether it can answer directly, and may request a tool call.
5. The client or backend returns tool results, such as account status, billing state, or action confirmation.
6. The model produces the final response, and the turn is persisted and emitted over the session event stream.

This flow matches the current backend shape documented in:

- [KB Service Capabilities](../backend/kb-service-capabilities.md)
- [Orchestrator Flow](../backend/orchestrator-flow.md)
- [SDK Capabilities Reference](../backend/sdk-capabilities-reference.md)

## Pricing Inputs Used

All prices below are USD and were checked against the official Gemini API pricing page on March 14, 2026.

| Model | Input tokens | Output tokens | Cached input tokens | Cache storage |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.10 / 1M` | `$0.40 / 1M` | `$0.01 / 1M` | `$1.00 / 1M tokens / hour` |
| Gemini 3.1 Pro Preview | `$2.00 / 1M` | `$12.00 / 1M` | `$0.20 / 1M` | `$4.50 / 1M tokens / hour` |

Important note:

- Google’s pricing page explicitly shows `Gemini 3 Pro Preview` as shut down on March 9, 2026.
- The nearest active premium comparator on the same page is `Gemini 3.1 Pro Preview`.

## Modeling Assumptions

- `Cacheable prefix` means the repeated part of the prompt: system instructions, app policy, stable app state, KB formatting instructions, and earlier session context that stays constant across turns.
- `Variable input` means the parts that change per turn: the current user message, fresh KB snippets, tool payloads, and any image or screenshot tokens.
- `Infra` is a conservative non-model delivery buffer covering KB search round-trips, trace/event writes, network overhead, object storage where relevant, and tool-result plumbing.
- Prompt caching is modeled only for the repeated prefix. Fresh user messages and fresh tool payloads are still billed normally.
- Screenshot-heavy scenarios assume the image tokens are embedded in the variable input for the turn that needs them.

## Scenario 1: FAQ Policy Clarification

Business case:

- A user asks whether a subscription downgrade keeps premium features until the end of the billing cycle.
- ResolveKit should answer from the KB without escalating to a human.

Emulated resolution flow:

1. User asks the downgrade policy question in-app.
2. ResolveKit runs one KB search and retrieves the policy page plus two supporting FAQ snippets.
3. The model answers the question, asks one short follow-up about billing date, and confirms the outcome.
4. No external action tool is required.
5. Resolution is complete in three turns.

Modeled session shape:

- Cacheable prefix: `3,500` tokens
- Session length: `4` minutes
- Turns: `3`
- Variable input per turn: `1,820`, `980`, `760`
- Output per turn: `220`, `160`, `120`
- Infra buffer: `$0.0008`

| Model | No cache, model only | With cache + storage, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.001606` | `$0.001209` | `$0.002406` | `$0.002009` |
| Gemini 3.1 Pro Preview | `$0.034120` | `$0.022570` | `$0.034920` | `$0.023370` |

Readout:

- Flash-Lite resolves this scenario for about `0.20 cents` fully loaded with caching.
- The premium model is about `11.6x` more expensive in the cached case.

## Scenario 2: Login Recovery With Account Lookup

Business case:

- A user cannot log in after changing devices and needs a password reset path.
- The assistant must both explain the issue and trigger the right action.

Emulated resolution flow:

1. User says the app is rejecting the password after a device change.
2. ResolveKit fetches KB snippets for login recovery and MFA troubleshooting.
3. The model calls an account-status tool to check lock state and email verification.
4. The tool response shows the account is valid but the reset flow is required.
5. ResolveKit triggers a reset-link action and confirms the next step to the user.

Modeled session shape:

- Cacheable prefix: `4,200` tokens
- Session length: `6` minutes
- Turns: `4`
- Variable input per turn: `2,640`, `1,820`, `1,280`, `920`
- Output per turn: `260`, `200`, `150`, `100`
- Infra buffer: `$0.0015`

| Model | No cache, model only | With cache + storage, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.002630` | `$0.001916` | `$0.004130` | `$0.003416` |
| Gemini 3.1 Pro Preview | `$0.055440` | `$0.034650` | `$0.056940` | `$0.036150` |

Readout:

- Flash-Lite resolves this action-oriented scenario for about `0.34 cents` fully loaded with caching.
- The premium model is still roughly `10.6x` the cost in the cached case.

## Scenario 3: Feature Setup With Guided Web Navigation

Business case:

- A user wants to enable a feature in the web app but cannot find the right settings path.
- The assistant must pull setup guidance from the KB, understand the current web-app context, direct the user to the correct section, and confirm completion.

Emulated resolution flow:

1. User asks how to enable a feature inside the web app.
2. ResolveKit fetches the relevant setup and settings instructions from the KB.
3. The model reads the current page and user state exposed through the web SDK.
4. ResolveKit guides the user into the correct settings area and highlights the next action.
5. The system confirms the setting is enabled and closes the loop.

Modeled session shape:

- Cacheable prefix: `4,600` tokens
- Session length: `8` minutes
- Turns: `5`
- Variable input per turn: `3,180`, `2,140`, `1,780`, `1,320`, `960`
- Output per turn: `300`, `220`, `180`, `140`, `90`
- Infra buffer: `$0.0022`

| Model | No cache, model only | With cache + storage, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.003610` | `$0.002567` | `$0.005810` | `$0.004767` |
| Gemini 3.1 Pro Preview | `$0.075920` | `$0.045560` | `$0.078120` | `$0.047760` |

Readout:

- Flash-Lite handles a real guided-navigation workflow with confirmation for about `0.48 cents` fully loaded with caching.
- The premium model remains about `10.0x` the cost in the cached case.

## Scenario 4: Technical Sync Issue With Screenshot

Business case:

- A user reports that sync appears stuck and attaches a screenshot from the settings page.
- The assistant must interpret the screenshot, retrieve troubleshooting steps, inspect system status, and guide remediation.

Emulated resolution flow:

1. User reports that sync has stalled and attaches a screenshot.
2. ResolveKit fetches KB steps for sync troubleshooting and known failure states.
3. The model interprets the screenshot, identifying the on-screen error state.
4. ResolveKit calls status and log-summary tools to check backend health and account state.
5. The model proposes a remediation, asks the user to retry once, and confirms the issue is cleared.

Modeled session shape:

- Cacheable prefix: `5,200` tokens
- Session length: `10` minutes
- Turns: `5`
- Variable input per turn: `4,990`, `2,590`, `2,020`, `1,680`, `1,260`
- Output per turn: `360`, `240`, `200`, `160`, `120`
- Infra buffer: `$0.0035`

| Model | No cache, model only | With cache + storage, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.004286` | `$0.003281` | `$0.007786` | `$0.006781` |
| Gemini 3.1 Pro Preview | `$0.090040` | `$0.056500` | `$0.093540` | `$0.060000` |

Readout:

- This is the heaviest scenario in the set and Flash-Lite still stays below `0.68 cents` fully loaded with caching.
- The premium model is about `8.8x` more expensive in the cached case.

## Caching Impact

Caching helps in both model tiers, but it matters far more in the premium tier because the repeated prompt prefix is much more expensive.

| Scenario | Flash-Lite savings vs no-cache | Gemini 3.1 Pro Preview savings vs no-cache |
| --- | ---: | ---: |
| FAQ policy clarification | `16.5%` | `33.1%` |
| Login recovery with account lookup | `17.3%` | `36.5%` |
| Feature setup with guided web navigation | `18.0%` | `38.9%` |
| Technical sync issue with screenshot | `12.9%` | `35.9%` |

## Blended Portfolio View

To get a rough operating view, assume monthly volume is split like this:

- `35%` FAQ and policy clarifications
- `30%` login recovery and account access issues
- `20%` feature setup and guided navigation flows
- `15%` heavier technical troubleshooting

Weighted average per resolved issue:

| Model | Model-only, no cache | Model-only, with cache | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.002716` | `$0.002004` | `$0.004411` | `$0.003699` |
| Gemini 3.1 Pro Preview | `$0.057264` | `$0.035881` | `$0.058959` | `$0.037576` |

Illustrative monthly delivery cost at blended mix and cached operation:

| Monthly resolved issues | Gemini 2.5 Flash-Lite | Gemini 3.1 Pro Preview |
| --- | ---: | ---: |
| `10,000` | `$36.99` | `$375.76` |
| `50,000` | `$184.93` | `$1,878.83` |
| `100,000` | `$369.86` | `$3,757.65` |

## Interpretation

- Flash-Lite is cheap enough to operate as the default resolution model for common support and workflow cases.
- The premium tier is still economically reasonable in absolute dollars, but it is about `10x` the cost of Flash-Lite on the blended cached view.
- That cost gap suggests a good operating model: default to Flash-Lite, then route only harder cases into the premium tier.
- Caching is worth implementing either way, but it is strategically most important when a premium model is involved.
- The cost bottleneck in ResolveKit is not raw token spend. The bigger commercial question is how much value the product captures per resolved issue.

## Important Limits

- These are modeled costs, not production billing exports.
- The report does not include fixed engineering payroll, support, sales, or company overhead.
- KB indexing cost is not included here because it is not paid per live resolution. This report is about runtime delivery cost once the KB already exists.
- Prices for Gemini models can change. Recheck the official pricing page before using the numbers in external materials.

## Sources

- Gemini API pricing: <https://ai.google.dev/gemini-api/docs/pricing>
- KB capabilities: [docs/backend/kb-service-capabilities.md](../backend/kb-service-capabilities.md)
- Orchestrator lifecycle: [docs/backend/orchestrator-flow.md](../backend/orchestrator-flow.md)
- SDK runtime and tool flow: [docs/backend/sdk-capabilities-reference.md](../backend/sdk-capabilities-reference.md)
