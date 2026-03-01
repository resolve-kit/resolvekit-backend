# Playbook SDK — Dashboard Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Embed the `@playbook/sdk` floating chat widget into the dashboard so the AI assistant can navigate all dashboard pages, read context, and highlight UI elements.

**Architecture:** A `PlaybookIntegration` component is inserted *inside* `BrowserRouter` in `DashboardApp`, wrapping the existing `Routes`. It uses `useNavigate`, `useLocation`, and `useMatch` hooks to build the four registered functions and passes them into `PlaybookProvider`. `data-playbook-id` attributes are added to the top nav links, sidebar nav buttons, and key page CTAs so the AI can highlight them.

**Tech Stack:** Next.js 14 (App Router shell, SPA inside), React Router 6, `@playbook/sdk` from `github:nedasvi/playbook-web-sdk`, TypeScript.

---

## Key files

| File | Role |
|---|---|
| `dashboard/package.json` | Add SDK dependency |
| `dashboard/.env.example` (root `.env.example`) | Add new env vars |
| `dashboard/src/dashboard-app.tsx` | Wire `PlaybookIntegration` inside `BrowserRouter` |
| `dashboard/src/components/PlaybookIntegration.tsx` | **New** — `PlaybookProvider` + 4 functions |
| `dashboard/src/components/Layout.tsx` | Add `data-playbook-id` to top nav links |
| `dashboard/src/components/AppSidebar.tsx` | Add `data-playbook-id` to sidebar nav buttons |
| `dashboard/src/dashboard_pages/Apps.tsx` | Add `data-playbook-id` to apps list + create button |
| `dashboard/src/dashboard_pages/KnowledgeBases.tsx` | Add `data-playbook-id` to KB list |
| `dashboard/src/dashboard_pages/OrganizationAdmin.tsx` | Add `data-playbook-id` to org settings |

---

## Task 1: Install the SDK and add env vars

**Files:**
- Modify: `dashboard/package.json`
- Modify: `.env.example` (repo root)

**Step 1: Install from GitHub**

```bash
cd /path/to/playbook_backend/dashboard
npm install github:nedasvi/playbook-web-sdk
```

Expected: `package.json` gains `"@playbook/sdk": "github:nedasvi/playbook-web-sdk"` in dependencies.

**Step 2: Add env vars to root `.env.example`**

Add these two lines in the `# Frontend` section:

```
NEXT_PUBLIC_PLAYBOOK_KEY=iaa_your_key_here
NEXT_PUBLIC_AGENT_BASE_URL=http://localhost:8000
```

`NEXT_PUBLIC_AGENT_BASE_URL` points the SDK at the agent service (port 8000), not the dashboard API (port 3002).

**Step 3: Add same vars to your local `.env`** (don't commit the real key)

```
NEXT_PUBLIC_PLAYBOOK_KEY=iaa_<your real key>
NEXT_PUBLIC_AGENT_BASE_URL=http://localhost:8000
```

**Step 4: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json .env.example
git commit -m "chore: add @playbook/sdk dependency and env vars"
```

---

## Task 2: Create PlaybookIntegration component

**Files:**
- Create: `dashboard/src/components/PlaybookIntegration.tsx`

This component must live *inside* `BrowserRouter` so it can use React Router hooks. The functions are memoised so they don't re-sync on every render.

```tsx
// dashboard/src/components/PlaybookIntegration.tsx
import { useMemo, type ReactNode } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { PlaybookProvider } from "@playbook/sdk/react";
import { fn } from "@playbook/sdk";
import { api } from "../api/client";

interface App {
  id: string;
  name: string;
  bundle_id: string | null;
}

const PLAYBOOK_KEY = process.env.NEXT_PUBLIC_PLAYBOOK_KEY ?? "";
const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? "http://localhost:8000";

export default function PlaybookIntegration({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const appMatch = useMatch("/apps/:appId/*");

  const functions = useMemo(
    () => [
      fn(
        async function navigate_to({ path }: { path: string }) {
          navigate(path);
          return { navigated: true, path };
        },
        {
          name: "navigate_to",
          description:
            "Navigate to any page in the dashboard. " +
            "Top-level paths: /apps, /knowledge-bases, /organization. " +
            "Per-app paths: /apps/{appId}/agent, /apps/{appId}/llm, /apps/{appId}/chat-theme, " +
            "/apps/{appId}/limits, /apps/{appId}/playbooks, /apps/{appId}/knowledge-bases, " +
            "/apps/{appId}/functions, /apps/{appId}/sessions, /apps/{appId}/api-keys, " +
            "/apps/{appId}/languages, /apps/{appId}/audit.",
          parameters: {
            path: {
              type: "string" as const,
              description: "The route path to navigate to, e.g. /apps or /apps/abc123/functions",
            },
          },
        }
      ),
      fn(
        async function get_current_page() {
          return { path: location.pathname };
        },
        {
          name: "get_current_page",
          description:
            "Get the current page path the user is viewing in the dashboard. " +
            "Use this before navigating so you know where the user already is.",
          parameters: {},
        }
      ),
      fn(
        async function get_current_app() {
          if (!appMatch?.params.appId) {
            return { appId: null, message: "Not currently viewing an app page." };
          }
          const appId = appMatch.params.appId;
          try {
            const app = await api<App>(`/v1/apps/${appId}`);
            return { appId, name: app.name };
          } catch {
            return { appId };
          }
        },
        {
          name: "get_current_app",
          description:
            "Get the app currently being configured. Returns the app ID and name if the user is on an app-specific page.",
          parameters: {},
        }
      ),
      fn(
        async function get_apps() {
          const apps = await api<App[]>("/v1/apps");
          return apps.map((a) => ({ id: a.id, name: a.name }));
        },
        {
          name: "get_apps",
          description:
            "List all apps configured in this organisation. " +
            "Use this to find an app's ID before navigating to its pages.",
          parameters: {},
        }
      ),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, location.pathname, appMatch?.params.appId]
  );

  if (!PLAYBOOK_KEY) return <>{children}</>;

  return (
    <PlaybookProvider
      apiKey={PLAYBOOK_KEY}
      baseURL={AGENT_BASE_URL}
      functions={functions}
      position="bottom-right"
    >
      {children}
    </PlaybookProvider>
  );
}
```

**Step 1: Create the file** with the content above.

**Step 2: Verify TypeScript compiles** (no build required, just check for red squiggles or run):

```bash
cd dashboard
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing ones unrelated to this file).

**Step 3: Commit**

```bash
git add dashboard/src/components/PlaybookIntegration.tsx
git commit -m "feat: add PlaybookIntegration component with 4 registered functions"
```

---

## Task 3: Wire PlaybookIntegration into DashboardApp

**Files:**
- Modify: `dashboard/src/dashboard-app.tsx`

**Step 1: Import and wrap Routes**

Current `DashboardApp`:
```tsx
export function DashboardApp() {
  return (
    <BrowserRouter>
      <Routes>
        ...
      </Routes>
    </BrowserRouter>
  );
}
```

Updated `DashboardApp`:
```tsx
import PlaybookIntegration from "./components/PlaybookIntegration";

export function DashboardApp() {
  return (
    <BrowserRouter>
      <PlaybookIntegration>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/apps" element={<Apps />} />
            <Route path="/knowledge-bases" element={<KnowledgeBases />} />
            <Route path="/organization" element={<OrganizationAdmin />} />
            <Route path="/apps/:appId/agent" element={<AgentPrompt />} />
            <Route path="/apps/:appId/knowledge-bases" element={<AppKnowledgeBases />} />
            <Route path="/apps/:appId/llm" element={<LlmConfig />} />
            <Route path="/apps/:appId/chat-theme" element={<ChatTheme />} />
            <Route path="/apps/:appId/limits" element={<LimitsConfig />} />
            <Route path="/apps/:appId/functions" element={<Functions />} />
            <Route path="/apps/:appId/sessions" element={<Sessions />} />
            <Route path="/apps/:appId/api-keys" element={<ApiKeys />} />
            <Route path="/apps/:appId/languages" element={<Languages />} />
            <Route path="/apps/:appId/playbooks" element={<Playbooks />} />
            <Route path="/apps/:appId/audit" element={<AuditLog />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </PlaybookIntegration>
    </BrowserRouter>
  );
}
```

**Step 2: Run the dashboard dev server and verify the launcher appears**

```bash
cd dashboard
npm run dev
```

Open `http://localhost:3000`, log in, and confirm the chat launcher button appears in the bottom-right corner.

**Step 3: Commit**

```bash
git add dashboard/src/dashboard-app.tsx
git commit -m "feat: mount PlaybookIntegration inside BrowserRouter"
```

---

## Task 4: Add data-playbook-id to Layout top nav

**Files:**
- Modify: `dashboard/src/components/Layout.tsx`

The top nav renders three links via `.map()` over `["/apps", "/knowledge-bases", "/organization"]`. The links need `data-playbook-id` matching the path.

**Step 1: Find the desktop nav map** — it looks like this:

```tsx
{["/apps", "/knowledge-bases", "/organization"].map((path) => {
  ...
  return (
    <Link key={path} to={path} className={...}>
      {label}
    </Link>
  );
})}
```

**Step 2: Add `data-playbook-id`** to the `Link`:

```tsx
{["/apps", "/knowledge-bases", "/organization"].map((path) => {
  const label =
    path === "/apps" ? "Apps" : path === "/knowledge-bases" ? "Knowledge Bases" : "Organization";
  const active = location.pathname.startsWith(path);
  const playbookId =
    path === "/apps" ? "nav-apps" :
    path === "/knowledge-bases" ? "nav-knowledge-bases" : "nav-organization";
  return (
    <Link
      key={path}
      to={path}
      data-playbook-id={playbookId}
      className={...}
    >
      {label}
    </Link>
  );
})}
```

There are **two** `.map()` blocks in `Layout.tsx` — one for desktop, one for mobile. Apply `data-playbook-id` to both, using the same IDs.

**Step 3: Verify in browser** — open DevTools, inspect the nav links, confirm `data-playbook-id` attributes are present.

**Step 4: Commit**

```bash
git add dashboard/src/components/Layout.tsx
git commit -m "feat: add data-playbook-id to top nav links"
```

---

## Task 5: Add data-playbook-id to AppSidebar nav buttons

**Files:**
- Modify: `dashboard/src/components/AppSidebar.tsx`

The sidebar renders buttons via the `renderNavButton` helper. Add `data-playbook-id` based on the item slug.

**Step 1: Update `renderNavButton`** to accept and forward a `data-playbook-id`:

```tsx
function renderNavButton(
  item: NavItem,
  options?: {
    depth?: 0 | 1;
    activeOverride?: boolean;
    dirtyOverride?: boolean;
    missingOverride?: boolean;
    onClickOverride?: () => void;
    playbookId?: string;   // ← add this
  },
) {
  const depth = options?.depth ?? 0;
  const active = options?.activeOverride ?? isRouteActive(item.slug);
  const missing = options?.missingOverride ?? isRouteMissing(item.slug);
  const dirty = options?.dirtyOverride ?? isRouteDirty(item.slug);
  const status: "missing" | "dirty" | null = missing ? "missing" : dirty ? "dirty" : null;
  const playbookId = options?.playbookId ?? `sidebar-${item.slug}`;  // ← default to sidebar-{slug}

  return (
    <button
      key={`${item.slug}-${depth}-${item.label}`}
      type="button"
      data-playbook-id={playbookId}                                   // ← add this
      onClick={options?.onClickOverride ?? (() => navigate(pathFor(item.slug)))}
      className={navButtonClass(active, depth)}
    >
      <span>{item.label}</span>
      {renderStatusDot(status)}
    </button>
  );
}
```

This gives every sidebar button a `data-playbook-id` of `sidebar-llm`, `sidebar-agent`, `sidebar-api-keys`, `sidebar-chat-theme`, etc. No callers need to change — the default covers all cases.

**Step 2: Verify in browser** — open an app page, inspect sidebar buttons for `data-playbook-id` attributes.

**Step 3: Commit**

```bash
git add dashboard/src/components/AppSidebar.tsx
git commit -m "feat: add data-playbook-id to AppSidebar nav buttons"
```

---

## Task 6: Add data-playbook-id to Apps, KnowledgeBases, OrganizationAdmin pages

**Files:**
- Modify: `dashboard/src/dashboard_pages/Apps.tsx`
- Modify: `dashboard/src/dashboard_pages/KnowledgeBases.tsx`
- Modify: `dashboard/src/dashboard_pages/OrganizationAdmin.tsx`

### Apps.tsx

Find the "Create App" / primary action button and the apps list container. Add:

```tsx
// On the create app button (look for the Button that opens the create dialog):
<Button data-playbook-id="create-app-btn" ...>New App</Button>

// On the apps list container (SectionCard or the wrapping div):
<div data-playbook-id="apps-list" ...>
  {apps.map(app => (
    <div key={app.id} data-playbook-id={`app-card-${app.id}`} ...>
```

Exact elements depend on what's in the file. Read `Apps.tsx` first, then add the attributes to the most prominent interactive elements (create button, each app card/row).

### KnowledgeBases.tsx

Read the file first, then add:
- `data-playbook-id="create-kb-btn"` on the create knowledge base button
- `data-playbook-id="kb-list"` on the list container
- `data-playbook-id={`kb-card-${kb.id}`}` on each KB card

### OrganizationAdmin.tsx

Read the file first, then add:
- `data-playbook-id="org-settings-form"` on the settings form/card
- `data-playbook-id="org-members-list"` on the members section (if present)

**Step 1: Read each file, identify the key interactive elements.**

**Step 2: Add `data-playbook-id` attributes to the identified elements in all three files.**

**Step 3: Verify in browser** — open each page, inspect the DOM for attributes.

**Step 4: Commit**

```bash
git add dashboard/src/dashboard_pages/Apps.tsx \
        dashboard/src/dashboard_pages/KnowledgeBases.tsx \
        dashboard/src/dashboard_pages/OrganizationAdmin.tsx
git commit -m "feat: add data-playbook-id to Apps, KnowledgeBases, OrganizationAdmin pages"
```

---

## Task 7: Smoke test the full integration

**Step 1: Start the full stack**

```bash
# from repo root
docker compose up -d
```

**Step 2: Open the dashboard** at `http://localhost:3000`, log in.

**Step 3: Confirm widget appears** — bottom-right launcher button visible.

**Step 4: Click the launcher** — chat panel opens, session starts (check network tab for `/v1/sessions` request).

**Step 5: Test navigation** — ask the assistant: *"Go to the Knowledge Bases page"*. Confirm it navigates to `/knowledge-bases`.

**Step 6: Test app navigation** — on an app page, ask: *"Go to the API Keys section"*. Confirm it navigates to `/apps/{appId}/api-keys`.

**Step 7: Test highlighting** — ask: *"Highlight the Knowledge Bases nav link"*. Confirm the `nav-knowledge-bases` element gets a pulsing border overlay.

**Step 8: Test get_apps** — ask: *"What apps do I have?"*. Confirm the assistant lists app names.

**Step 9: Build check**

```bash
cd dashboard
npm run build
```

Expected: clean build, no TypeScript errors.

**Step 10: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: sdk integration smoke test fixups"
```
