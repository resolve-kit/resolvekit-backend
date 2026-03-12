# Presentation Access Design

**Goal:** Protect all investor presentation content, including demo videos, behind a password-only access flow and an opaque public path.

**Design:**
- Keep the actual presentation implementation at the internal Next route `/presentation`.
- Expose it only through an env-backed opaque slug such as `/${PRESENTATION_SLUG}`.
- Protect both the page and video files with middleware and an `HttpOnly` cookie.
- Show a branded password page at `/enter`.
- Validate the submitted password against `PRESENTATION_PASSWORD` from env.
- On success, set a cookie scoped to the presentation paths and redirect to the opaque slug.
- Block direct access to `/presentation` and `/presentation/*` so the internal route is not usable as a public shortcut.

**Security notes:**
- The password is not committed to git.
- Client-side gating is not used because it would not protect the video files.
- The cookie stores a derived token, not the raw password.
