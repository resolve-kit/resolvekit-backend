# Next.js SDK Dashboard Integration

**Date:** 2026-03-08
**Branch to create:** `feat/nextjs-sdk-integration`
**Working directory:** `/Users/t0405/Developer/resolvekit-backend`

## Context

The dashboard currently uses `@resolvekit/sdk` v0.1.1, which exposes the API key client-side via `NEXT_PUBLIC_RESOLVEKIT_KEY`. Replace it with `@resolvekit/nextjs` (at `/Users/t0405/Developer/resolvekit-nextjs-sdk`) which provides:

- Server-side token proxy — API key stays server-only
- `ResolveKitRuntime` for explicit runtime control
- `createBrowserToolsPack` — auto-discovers and interacts with page elements (navigation, highlighting, clicking)
- `ResolveKitWidget`, `ResolveKitDevtools`, `ResolveKitAction` components

**Local dev** uses `file:../../resolvekit-nextjs-sdk`. **Production** swaps to `"^1.0.0"` from npm.

---

## Step 1 — Build the New SDK

```bash
cd /Users/t0405/Developer/resolvekit-nextjs-sdk
npm install
npm run build
```

Verify these files exist before continuing:
- `dist/react/index.js`
- `dist/server/index.js`
- `dist/client/index.js`

---

## Step 2 — Update `dashboard/package.json`

**File:** `dashboard/package.json`

```diff
- "@resolvekit/sdk": "0.1.1",
+ "@resolvekit/nextjs": "file:../../resolvekit-nextjs-sdk",
```

Then install:

```bash
cd /Users/t0405/Developer/resolvekit-backend/dashboard
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because the SDK peer dep declares `"next": ">=14.2.0 <16"` but the dashboard uses `^16.1.6`. The flag skips the version range check; runtime compatibility is fine.

---

## Step 3 — Create Server Token Endpoint

**New file:** `dashboard/src/app/api/resolvekit/token/route.ts`

```ts
import { createResolveKitClientTokenHandler } from "@resolvekit/nextjs/server";

const handler = createResolveKitClientTokenHandler({
  agentBaseUrl: process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL ?? "http://localhost:8000",
  resolveApiKey: () => process.env.RESOLVEKIT_KEY ?? null,
});

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
```

`RESOLVEKIT_KEY` has no `NEXT_PUBLIC_` prefix — it is never bundled to the browser.

---

## Step 4 — Rewrite `ResolveKitCopilotProvider.tsx`

**File:** `dashboard/src/components/ResolveKitCopilotProvider.tsx`

Full rewrite — replace the entire file with the following:

```tsx
"use client";

import { type RefObject, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import {
  ResolveKitRuntime,
  createBrowserToolsPack,
  createClientTokenAuthProvider,
  type ResolveKitConfiguration,
  type ResolveKitFunctionDefinition,
} from "@resolvekit/nextjs/client";
import { ResolveKitProvider, ResolveKitWidget, ResolveKitDevtools } from "@resolvekit/nextjs/react";

const RESOLVEKIT_ENABLED = process.env.NEXT_PUBLIC_RESOLVEKIT_ENABLED === "true";
const RESOLVEKIT_AGENT_BASE_URL =
  process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL ?? "http://localhost:8000";
const AUTO_OPEN_KEY = "resolvekit_copilot_auto_open_dismissed";
const SDK_VERSION = "1.0.0";

type OnboardingState = {
  target_app_id: string | null;
  is_complete: boolean;
};

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login";
}

function buildFunctions(
  runtimeRef: RefObject<ResolveKitRuntime | null>,
): ResolveKitFunctionDefinition[] {
  return [
    {
      name: "create_app_workspace",
      description: "Create a new app workspace in the dashboard.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "App display name" },
          bundleId: { type: "string", description: "Optional bundle identifier" },
        },
        required: ["name"],
      },
      requiresApproval: true,
      async invoke({ name, bundleId }: { name: string; bundleId?: string }) {
        return api("/v1/apps", {
          method: "POST",
          body: JSON.stringify({ name, bundle_id: bundleId ?? null }),
        });
      },
    },
    {
      name: "set_widget_appearance",
      description: "Set copilot widget appearance mode to light, dark, or system.",
      parametersSchema: {
        type: "object",
        properties: {
          mode: { type: "string", description: "Appearance mode: light | dark | system" },
        },
        required: ["mode"],
      },
      requiresApproval: true,
      async invoke({ mode }: { mode: string }) {
        runtimeRef.current?.setAppearance(mode as "light" | "dark" | "system");
        return { mode };
      },
    },
  ];
}

export default function ResolveKitCopilotProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const appRoute = useMatch("/apps/:appId/*");
  const [boundAppId, setBoundAppId] = useState<string | null>(null);

  // Refs so the stable runtime/functions can always read latest values
  const navigateRef = useRef(navigate);
  const boundAppIdRef = useRef(boundAppId);
  const pathnameRef = useRef(location.pathname);
  const runtimeRef = useRef<ResolveKitRuntime | null>(null);

  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { boundAppIdRef.current = boundAppId; }, [boundAppId]);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);

  // Resolve boundAppId from URL or onboarding API
  useEffect(() => {
    if (!RESOLVEKIT_ENABLED || isAuthRoute(location.pathname)) {
      setBoundAppId(null);
      return;
    }
    if (appRoute?.params.appId) {
      setBoundAppId(appRoute.params.appId);
      return;
    }
    let cancelled = false;
    api<OnboardingState>("/v1/organizations/onboarding")
      .then((state) => {
        if (!cancelled) setBoundAppId(state.target_app_id ?? null);
      })
      .catch(() => {
        if (!cancelled) setBoundAppId(null);
      });
    return () => { cancelled = true; };
  }, [appRoute?.params.appId, location.pathname]);

  // Stable runtime — created once per mount, refs keep context fresh
  const runtime = useMemo(() => {
    const rt = new ResolveKitRuntime({
      baseUrl: RESOLVEKIT_AGENT_BASE_URL,
      authProvider: createClientTokenAuthProvider({ endpoint: "/api/resolvekit/token" }),
      sdkVersion: SDK_VERSION,
      llmContextProvider: () => ({
        dashboard_app_id: boundAppIdRef.current ?? null,
        current_path: pathnameRef.current,
      }),
      functions: buildFunctions(runtimeRef),
      functionPacks: [
        createBrowserToolsPack({
          discoveryMode: "open",
          navigationAdapter: {
            push: (href) => navigateRef.current(href),
            replace: (href) => navigateRef.current(href, { replace: true }),
          },
        }),
      ],
    } satisfies ResolveKitConfiguration);
    runtimeRef.current = rt;
    return rt;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh session context when app or path changes (no new session)
  useEffect(() => {
    void runtime.refreshSessionContext();
  }, [boundAppId, location.pathname, runtime]);

  // Auto-open widget once per browser session
  const shouldDefaultOpen = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (localStorage.getItem(AUTO_OPEN_KEY) === "1") return false;
    localStorage.setItem(AUTO_OPEN_KEY, "1");
    return true;
  }, []);

  if (!RESOLVEKIT_ENABLED || isAuthRoute(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <ResolveKitProvider runtime={runtime} autoStart>
      {children}
      <ResolveKitWidget position="bottom-right" defaultOpen={shouldDefaultOpen} />
      {process.env.NODE_ENV === "development" && (
        <ResolveKitDevtools position="bottom-left" />
      )}
    </ResolveKitProvider>
  );
}
```

---

## Step 5 — Update Environment Variables

**File:** `.env.example`

```diff
- NEXT_PUBLIC_RESOLVEKIT_KEY=iaa_your_key_here
- RESOLVEKIT_WEB_SDK_PATH=../resolvekit-web-sdk
+ RESOLVEKIT_KEY=iaa_your_key_here
```

**File:** `.env` (local dev, if it exists — do not commit)

```diff
- NEXT_PUBLIC_RESOLVEKIT_KEY=iaa_your_key_here
+ RESOLVEKIT_KEY=iaa_your_key_here
```

---

## Step 6 — Add `ResolveKitAction` Annotations

`Button` extends `ButtonHTMLAttributes` and spreads `...props`, so `as={Button}` passes `data-resolvekit-*` attributes through cleanly.

Add this import to each page file that needs annotations:
```ts
import { ResolveKitAction } from "@resolvekit/nextjs/react";
```

### `dashboard/src/dashboard_pages/Apps.tsx`

Find the "New App" button (currently has `data-resolvekit-id="create-app-btn"`) and replace with:

```tsx
<ResolveKitAction
  as={Button}
  actionId="create-app-btn"
  actionRole="action"
  description="Open form to create a new app workspace"
  variant="primary"
  onClick={() => setShowCreate(true)}
>
  New App
</ResolveKitAction>
```

Also wrap the "Create" submit button inside the create form:

```tsx
<ResolveKitAction
  as={Button}
  actionId="create-app-submit"
  actionRole="action"
  description="Submit the create app form with the entered name and bundle ID"
  variant="primary"
  size="sm"
  onClick={createApp}
  loading={isCreating}
>
  Create
</ResolveKitAction>
```

### `dashboard/src/dashboard_pages/ApiKeys.tsx`

Find the "Generate Key" button (may already have `data-resolvekit-id="generate-api-key-btn"`) and replace with:

```tsx
<ResolveKitAction
  as={Button}
  actionId="generate-api-key-btn"
  actionRole="action"
  description="Generate a new API key for this app"
  variant="primary"
  onClick={createKey}
  loading={isGenerating}
>
  Generate Key
</ResolveKitAction>
```

### `dashboard/src/dashboard_pages/Playbooks.tsx`

Find the "New Playbook" button and replace with:

```tsx
<ResolveKitAction
  as={Button}
  actionId="new-playbook-btn"
  actionRole="action"
  description="Open form to create a new playbook"
  variant="primary"
  onClick={startCreate}
>
  New Playbook
</ResolveKitAction>
```

### `dashboard/src/dashboard_pages/AgentPrompt.tsx`

Find the "Save Settings" submit button and replace with:

```tsx
<ResolveKitAction
  as={Button}
  actionId="save-agent-prompt-btn"
  actionRole="action"
  description="Save agent system prompt and scope mode settings"
  type="submit"
  variant="primary"
  loading={isSaving}
  disabled={!isDirty}
>
  Save Settings
</ResolveKitAction>
```

### `dashboard/src/dashboard_pages/LlmConfig.tsx`

Find the "Save" / "Save LLM Config" submit button and replace with:

```tsx
<ResolveKitAction
  as={Button}
  actionId="save-llm-config-btn"
  actionRole="action"
  description="Save LLM model and provider configuration"
  type="submit"
  variant="primary"
>
  Save
</ResolveKitAction>
```

### `dashboard/src/dashboard_pages/KnowledgeBases.tsx`

Find the primary "Add Knowledge Base" / "New" button and replace with:

```tsx
<ResolveKitAction
  as={Button}
  actionId="add-knowledge-base-btn"
  actionRole="action"
  description="Open form to add a new knowledge base"
  variant="primary"
  onClick={...}
>
  Add Knowledge Base
</ResolveKitAction>
```

> **Skip:** `Functions.tsx` — no add/create button (functions registered by mobile SDK).
> **Skip:** `AppSidebar.tsx` — already has `data-resolvekit-id` on all nav buttons, no changes needed.

---

## Verification Checklist

Run these in order after implementation:

1. **SDK dist exists:**
   ```bash
   ls /Users/t0405/Developer/resolvekit-nextjs-sdk/dist/react/index.js
   ```

2. **Dashboard builds:**
   ```bash
   npm --prefix /Users/t0405/Developer/resolvekit-backend/dashboard run build
   ```
   Peer dep warning about Next.js version is expected and non-fatal.

3. **TypeScript clean:**
   ```bash
   cd /Users/t0405/Developer/resolvekit-backend/dashboard && npx tsc --noEmit
   ```

4. **Token endpoint reachable** (with app running):
   ```bash
   curl -X POST http://localhost:3000/api/resolvekit/token
   # Expected: 500 "Server API key is not configured" (no key set) or token JSON — NOT a 404
   ```

5. **No API key in browser:** With app running and `NEXT_PUBLIC_RESOLVEKIT_ENABLED=true`, open DevTools → Network. Confirm no requests include the raw API key value. Only `POST /api/resolvekit/token` should appear.

6. **Widget visible:** With `NEXT_PUBLIC_RESOLVEKIT_ENABLED=true` and a valid `RESOLVEKIT_KEY`, the widget appears bottom-right.

7. **Navigation works:** Ask widget "go to LLM config" — URL updates without full page reload (React Router navigation, not `window.location`).

8. **Appearance function:** Ask widget "switch to dark mode" — widget UI updates.

9. **Auth guard:** `/login` route — no widget rendered.

10. **Devtools visible:** In `NODE_ENV=development`, `ResolveKitDevtools` toggle appears bottom-left showing discovered page actions.

---

## Files Changed

| File | Action |
|------|--------|
| `dashboard/package.json` | Swap `@resolvekit/sdk` → `@resolvekit/nextjs: file:...` |
| `dashboard/src/app/api/resolvekit/token/route.ts` | **Create** — server token endpoint |
| `dashboard/src/components/ResolveKitCopilotProvider.tsx` | **Full rewrite** |
| `.env.example` | Remove `NEXT_PUBLIC_RESOLVEKIT_KEY`, add `RESOLVEKIT_KEY` |
| `.env` | Same as .env.example change (local only, don't commit) |
| `dashboard/src/dashboard_pages/Apps.tsx` | Add `ResolveKitAction` to "New App" + "Create" buttons |
| `dashboard/src/dashboard_pages/ApiKeys.tsx` | Add `ResolveKitAction` to "Generate Key" button |
| `dashboard/src/dashboard_pages/Playbooks.tsx` | Add `ResolveKitAction` to "New Playbook" button |
| `dashboard/src/dashboard_pages/AgentPrompt.tsx` | Add `ResolveKitAction` to "Save Settings" button |
| `dashboard/src/dashboard_pages/LlmConfig.tsx` | Add `ResolveKitAction` to "Save" button |
| `dashboard/src/dashboard_pages/KnowledgeBases.tsx` | Add `ResolveKitAction` to primary add button |
