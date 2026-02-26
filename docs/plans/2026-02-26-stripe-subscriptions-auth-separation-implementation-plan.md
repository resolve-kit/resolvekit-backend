# Split Auth/Billing + Stripe Subscriptions Architecture (OSS-Safe)

## Summary
Build a **separate hosted control-plane** for login and Stripe billing, while keeping `agent` + `dashboard` open-source capable with **local basic auth mode**.
Hosted mode uses control-plane JWTs (JWKS-verified by `agent`), org-level monthly session plans, and per-plan enforcement (`hard_stop` or `overage`).
OSS packaging keeps only adapters/contracts in public code; private implementation lives in `private/` directories in the same repo.

## Approaches Considered
1. **Dedicated control-plane service (chosen)**
- Pros: strongest boundary, easiest open-source split, Stripe/auth isolated operationally.
- Cons: adds cross-service sync and token trust complexity.

2. Separate module inside `agent`
- Pros: fewer moving parts.
- Cons: boundary is weak; hard to OSS without operating login/billing in main backend.

3. External auth only + ad-hoc billing worker
- Pros: less custom auth code.
- Cons: fragmented ownership and weaker product control for org plans/features.

## Public Interface / API / Type Changes

### `agent` (OSS) changes
1. **Auth mode config**
- Add env vars in `agent/config.py`:
  - `IAA_AUTH_MODE=local|external` (default `local`)
  - `IAA_EXTERNAL_JWKS_URL`
  - `IAA_EXTERNAL_ISSUER`
  - `IAA_EXTERNAL_AUDIENCE`
  - `IAA_CONTROL_PLANE_SYNC_TOKEN`
  - `IAA_BILLING_MODE=disabled|external` (default `disabled`)

2. **Token validation path**
- Update `agent/middleware/auth.py`:
  - `local`: keep existing JWT validation.
  - `external`: verify JWT with JWKS, claims: `iss`, `aud`, `sub`, `org_external_id`, `role`, `email`, `name`, `exp`.

3. **Auth routers behavior**
- Update `agent/routers/auth.py`:
  - `local` mode: unchanged.
  - `external` mode: `/v1/auth/*` returns `404` or `409` with message "managed by control-plane".

4. **Billing/entitlement cache + usage accounting**
- New models/tables under `agent/models/`:
  - `organization_billing_state`:
    - `organization_id`, `plan_code`, `monthly_session_limit`, `enforcement_mode`, `unlocked_features[]`, `period_start`, `period_end`, `status`, `updated_at`.
  - `organization_usage_period`:
    - `organization_id`, `period_start`, `period_end`, `session_count`, `overage_count`.
  - `billing_usage_event_outbox`:
    - `id`, `organization_id`, `app_id`, `event_type`, `quantity`, `occurred_at`, `idempotency_key`, `dispatch_status`, `attempts`, `last_error`.

5. **Internal sync endpoints (adapter contract only)**
- New internal router in `agent`:
  - `POST /internal/control-plane/orgs/{org_external_id}/identity-sync`
  - `POST /internal/control-plane/orgs/{org_external_id}/billing-sync`
- Authenticated by `IAA_CONTROL_PLANE_SYNC_TOKEN`.

6. **Session creation enforcement**
- Update `agent/routers/sessions.py`:
  - On **new** session creation (`reused_active_session == False`):
    - load org billing state by `app.organization_id`
    - increment period usage
    - if `enforcement_mode=hard_stop` and `session_count > monthly_session_limit`, reject with `402` + structured error.
    - if `overage`, allow and increment `overage_count`.
    - enqueue usage outbox event.

7. **Feature unlock propagation**
- Merge `organization_billing_state.unlocked_features` into session entitlements (e.g., `feature:<slug>`), so existing eligibility logic in `agent/services/compatibility_service.py` works unchanged.

### Dashboard changes
1. Add `VITE_AUTH_MODE=local|hosted` and `VITE_CONTROL_PLANE_BASE_URL`.
2. In hosted mode:
- `dashboard/src/pages/Login.tsx` becomes redirect/init-code exchange flow.
- Add "Manage Subscription" link to control-plane portal (no Stripe UI in main dashboard).
3. In local mode:
- Keep current `/v1/auth/*` login/signup behavior.

### Private control-plane (same repo, private dir)
Create:
- `private/control_plane/` (FastAPI)
- `private/control_plane_portal/` (web UI for hosted login + billing)

Control-plane APIs:
- Auth: `POST /v1/auth/signup`, `POST /v1/auth/login`, password reset, email verify.
- JWKS: `GET /.well-known/jwks.json`.
- Billing:
  - `POST /v1/billing/checkout-session`
  - `POST /v1/billing/customer-portal-session`
  - `POST /v1/billing/webhooks/stripe`
  - `POST /internal/usage-events/batch` (from agent outbox worker).

## Stripe + Subscription Design

1. **Billing unit**: organization.
2. **Plan model**:
- recurring base monthly price
- included monthly sessions
- `enforcement_mode` per plan: `hard_stop` or `overage`
- unlocked features list.
3. **Overage plans**:
- attach metered overage Stripe price and submit usage events from control-plane aggregation.
4. **Hard-stop plans**:
- no overage price; `agent` blocks new sessions after limit.
5. **Monthly session counting rule**:
- count only **new** sessions (`create_session` that did not reuse active session).

## Repo Boundary (single repo, private dirs)
1. Public/OSS:
- `agent/`, `dashboard/`, `shared/contracts/` (interface contracts only).
2. Private:
- `private/control_plane/`
- `private/control_plane_portal/`
3. Add OSS export guard:
- `scripts/export_oss.sh` excludes `private/**`, validates no private imports from public modules.

## Migration Plan (One-time backfill + forced reset)
1. Add identity linkage fields:
- `organizations.external_id` (nullable unique)
- `developer_accounts.external_subject` (nullable unique)
- `developer_accounts.auth_source` (`local|external`)
- allow `hashed_password` null for external accounts.
2. Backfill script:
- export orgs/users from `agent`
- import into control-plane
- create/reset credentials in control-plane
- sync external IDs back into `agent`
- mark hosted orgs/users as `auth_source=external`
- force password reset email via control-plane.
3. Cutover:
- set `IAA_AUTH_MODE=external` in hosted env only.

## Implementation Tasks

### Task 1: Contracts and flags in OSS
- Modify config/auth middleware/routers.
- Add auth mode tests and env matrix tests.

### Task 2: Billing state + usage accounting in `agent`
- Add models + Alembic migration.
- Add enforcement logic in session create path.
- Add outbox writer.

### Task 3: Control-plane sync adapters (OSS side)
- Add internal sync routers + token auth.
- Add idempotency handling and optimistic upsert semantics.

### Task 4: Hosted control-plane private service
- Implement auth, JWKS, org membership source-of-truth.
- Implement Stripe checkout/portal/webhooks and plan catalog.
- Implement usage ingestion endpoint and Stripe usage reporting.

### Task 5: Dashboard dual-mode auth UX
- Local mode unchanged.
- Hosted mode redirect/code exchange; remove signup from dashboard in hosted mode.
- Add subscription portal link and read-only plan badge.

### Task 6: Migration + rollout safeguards
- Backfill scripts.
- Dry-run checks + replay-safe execution.
- staged cutover flags and rollback path (`external -> local` toggle).

## Test Cases and Scenarios

1. **Local OSS auth regression**
- signup/login/me still pass with `IAA_AUTH_MODE=local`.

2. **Hosted auth verification**
- valid external JWT accepted; invalid issuer/audience/signature rejected.

3. **Hard-stop enforcement**
- org on hard-stop plan hits limit; next new session returns 402; active reused session still works.

4. **Overage enforcement**
- org on overage plan exceeds limit; session allowed; overage counter and outbox event increase.

5. **Feature unlock gating**
- unlocked feature entitlement allows required function; absent feature blocks function eligibility.

6. **Billing sync idempotency**
- repeated `billing-sync` payload updates same state without duplicates.

7. **Outbox reliability**
- failed dispatch retries; idempotency key prevents double billing ingestion.

8. **Stripe webhook idempotency (private)**
- repeated webhook events produce single subscription state transition.

9. **Migration integrity**
- each `developer_account` maps to external subject; forced-reset state recorded.

10. **Dashboard mode split**
- local mode uses `/v1/auth/*`; hosted mode redirects to control-plane and uses external JWT.

## Assumptions and Defaults
- Default OSS behavior remains `local` auth and `billing disabled`.
- Hosted deployments run control-plane; main dashboard/backend do not own Stripe or hosted login.
- Monthly session metric = successful creation of a **new** session only.
- `hard_stop`/`overage` is plan-level, not org override.
- Control-plane portal is the only place for checkout, invoices, and plan changes.
- Private implementation remains in `private/**`; OSS contains only adapters/contracts.
