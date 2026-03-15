# ResolveKit Resolution Cost Scenarios

Date: March 14, 2026

## Purpose

This report estimates what a real ResolveKit resolution session costs when it includes knowledge-base retrieval, prompt assembly, tool execution, event streaming, and final resolution delivery.

The goal is not to estimate total company opex. The goal is to estimate per-resolution delivery cost under realistic operating flows.

## Headline Takeaways

- A realistic ResolveKit resolution on `Gemini 2.5 Flash-Lite` lands in a roughly `$0.0015` to `$0.0054` fully loaded range per resolved issue in the scenarios below (corrected from previous `$0.0020`–`$0.0068`).
- Prompt caching saves **30–39% of fully loaded cost** per scenario. The previous version of this report understated savings (12–18%) due to a calculation error: the stated cached rate of `$0.01/1M` was not applied correctly. The corrected figures use the actual `$0.01/1M` rate.
- Infrastructure (KB vector search, DB reads, event writes, compute buffer) accounts for **55–64% of fully loaded cached cost** — it becomes the dominant cost term once inference is aggressively cached.
- The practical conclusion: Flash-Lite is cheap enough to run by default, caching is worth implementing for its 30–39% savings, and the infrastructure layer is the larger cost variable at scale.

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

Important note:

- The previous version of this report stated `$0.01/1M` for cached tokens but produced savings figures (12–18%) consistent with a rate of ~`$0.062/1M`. This was a calculation error. All tables below now correctly apply `$0.01/1M` to cached tokens.

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

| Model | No cache, model only | With cache, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.001606` | `$0.000661` | `$0.002406` | `$0.001461` |

Cost breakdown (cached):

| Component | Cost | Share |
| --- | ---: | ---: |
| Inference (10,500 cached + 3,560 non-cached input; 500 output) | `$0.000661` | 45% |
| Infrastructure | `$0.000800` | 55% |
| **Total** | **`$0.001461`** | 100% |

Readout:

- Flash-Lite resolves this scenario for about `0.15 cents` fully loaded with caching (corrected from `0.20 cents`).
- Cache saves **39%** of fully loaded cost (was 16.5%).

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

| Model | No cache, model only | With cache, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.002630` | `$0.001118` | `$0.004130` | `$0.002618` |

Cost breakdown (cached):

| Component | Cost | Share |
| --- | ---: | ---: |
| Inference (16,800 cached + 6,660 non-cached input; 710 output) | `$0.001118` | 43% |
| Infrastructure | `$0.001500` | 57% |
| **Total** | **`$0.002618`** | 100% |

Readout:

- Flash-Lite resolves this action-oriented scenario for about `0.26 cents` fully loaded with caching (corrected from `0.34 cents`).
- Cache saves **37%** of fully loaded cost (was 17.3%).

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

| Model | No cache, model only | With cache, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.003610` | `$0.001540` | `$0.005810` | `$0.003740` |

Cost breakdown (cached):

| Component | Cost | Share |
| --- | ---: | ---: |
| Inference (23,000 cached + 9,380 non-cached input; 930 output) | `$0.001540` | 41% |
| Infrastructure | `$0.002200` | 59% |
| **Total** | **`$0.003740`** | 100% |

Readout:

- Flash-Lite handles a real guided-navigation workflow with confirmation for about `0.37 cents` fully loaded with caching (corrected from `0.48 cents`).
- Cache saves **36%** of fully loaded cost (was 18.0%).

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

| Model | No cache, model only | With cache, model only | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.004286` | `$0.001946` | `$0.007786` | `$0.005446` |

Cost breakdown (cached):

| Component | Cost | Share |
| --- | ---: | ---: |
| Inference (26,000 cached + 12,540 non-cached input; 1,080 output) | `$0.001946` | 36% |
| Infrastructure | `$0.003500` | 64% |
| **Total** | **`$0.005446`** | 100% |

Readout:

- This is the heaviest scenario in the set and Flash-Lite still stays below `0.55 cents` fully loaded with caching (corrected from `0.68 cents`).
- Cache saves **31%** of fully loaded cost (was 12.9%).

## Caching Impact

Caching meaningfully reduces per-resolution cost. The static app context (system prompt, function definitions, app metadata) repeats across every session, keeping 67–75% of input tokens in cache.

| Scenario | Cache saves (fully loaded) | Cached tokens / total input |
| --- | ---: | ---: |
| FAQ policy clarification | `39%` | 10,500 / 14,060 (74.7%) |
| Login recovery with account lookup | `37%` | 16,800 / 23,460 (71.6%) |
| Feature setup with guided web navigation | `36%` | 23,000 / 32,380 (71.0%) |
| Technical sync issue with screenshot | `31%` | 26,000 / 38,540 (67.5%) |

Note: The prior version of this table used an effective cached rate of ~`$0.062/1M` despite the stated `$0.01/1M`. The corrected figures apply the actual `$0.01/1M` rate.

## Infrastructure Cost Breakdown

The infra buffer covers KB vector search, DB reads and writes, event stream writes, compute overhead, and object storage. It does not benefit from prompt caching.

| Scenario | Inference (cached) | Infrastructure | Total (cached) | Infra share |
| --- | ---: | ---: | ---: | ---: |
| FAQ policy clarification | `$0.000661` | `$0.000800` | `$0.001461` | 55% |
| Login recovery with account lookup | `$0.001118` | `$0.001500` | `$0.002618` | 57% |
| Feature setup with guided web navigation | `$0.001540` | `$0.002200` | `$0.003740` | 59% |
| Technical sync issue with screenshot | `$0.001946` | `$0.003500` | `$0.005446` | 64% |
| Blended | `~$0.001167` | `~$0.001695` | `~$0.002862` | ~59% |

Infrastructure's high share in the cached case reflects aggressive caching squeezing inference cost until the fixed delivery overhead becomes the dominant term. At scale, infra cost per resolution falls as fixed infrastructure is amortized over more sessions.

## Blended Portfolio View

To get a rough operating view, assume monthly volume is split like this:

- `35%` FAQ and policy clarifications
- `30%` login recovery and account access issues
- `20%` feature setup and guided navigation flows
- `15%` heavier technical troubleshooting

Weighted average per resolved issue:

| Model | Model-only, no cache | Model-only, with cache | Fully loaded, no cache | Fully loaded, with cache |
| --- | ---: | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite | `$0.002716` | `$0.001167` | `$0.004411` | `$0.002862` |

Illustrative monthly delivery cost at blended mix:

| Monthly resolved issues | Cached | No cache |
| --- | ---: | ---: |
| `10,000` | `$29` | `$44` |
| `50,000` | `$143` | `$221` |
| `100,000` | `$286` | `$441` |

## Interpretation

- Flash-Lite is cheap enough to operate as the default resolution model for all common support and workflow cases.
- Caching saves **~35% on the blended view**, not ~16% as previously stated. It is worth implementing — the savings are material, not a rounding error.
- Infrastructure (KB search, DB, events, compute) is the **larger cost component (~59%)** once caching is working correctly. At scale, reducing infrastructure cost per resolution through batching, connection pooling, and efficient KB retrieval has more impact than further model optimization.
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
