import { Link, useLocation } from "react-router-dom";

import { Button } from "./ui";
import { useOnboarding } from "../context/OnboardingContext";
import { iosSdkRepoUrl } from "../lib/public-urls";

interface OnboardingGuideRailProps {
  variant: "mobile" | "desktop";
}

function StepList() {
  const { state } = useOnboarding();
  const location = useLocation();

  if (!state) return null;

  return (
    <ol className="space-y-2.5">
      {state.required_steps.map((step, idx) => {
        const isActive = location.pathname === step.route;
        return (
          <li key={step.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <div className="flex items-start gap-2">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  step.is_complete
                    ? "border border-success-dim bg-success-subtle text-success"
                    : "border border-border bg-surface text-subtle"
                }`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-strong">{step.title}</p>
                <p className="mt-0.5 text-[11px] text-subtle">{step.description}</p>
                {step.blocked_reason && <p className="mt-1 text-[11px] text-warning">{step.blocked_reason}</p>}
                <div className="mt-2 flex items-center gap-2">
                  {step.is_complete ? (
                    <span className="text-[11px] text-success">Completed</span>
                  ) : step.is_blocked ? (
                    <span className="text-[11px] text-warning">Blocked</span>
                  ) : (
                    <Link to={step.route} className={`text-[11px] ${isActive ? "text-accent" : "text-subtle hover:text-body"}`}>
                      Open step
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SDKChecklist() {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <p className="text-xs font-semibold text-strong">SDK checklist</p>
      <ul className="mt-1.5 space-y-1 text-[11px] text-subtle">
        <li>1. Add `resolvekit-ios-sdk` from GitHub to your iOS app.</li>
        <li>2. Configure backend base URL + app API key provider.</li>
        <li>3. Register `@ResolveKit` functions in runtime configuration.</li>
        <li>4. Validate active functions in dashboard.</li>
      </ul>
      {iosSdkRepoUrl ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={iosSdkRepoUrl!}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-accent hover:text-accent-hover"
          >
            ResolveKit iOS SDK on GitHub
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default function OnboardingGuideRail({ variant }: OnboardingGuideRailProps) {
  const { state, isLoading, refresh, reset } = useOnboarding();

  if (isLoading && !state) {
    return variant === "desktop" ? <aside className="hidden xl:block w-72" /> : null;
  }

  if (!state || !state.should_show) {
    return null;
  }

  const completedCount = state.required_steps.filter((step) => step.is_complete).length;
  const totalCount = state.required_steps.length;

  const content = (
    <div className="glass-panel rounded-2xl border border-border/70 p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Setup guide</p>
          <p className="mt-0.5 text-sm font-semibold text-strong">
            {state.target_app_name ? `${state.target_app_name} onboarding` : "First app onboarding"}
          </p>
          <p className="mt-1 text-[11px] text-subtle">
            Progress: {completedCount}/{totalCount} required steps complete
          </p>
        </div>
      </div>

      <StepList />

      <div className="mt-3">
        <SDKChecklist />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          className="text-[11px] text-subtle transition-colors hover:text-body"
        >
          Refresh status
        </button>
        {state.can_reset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void reset();
            }}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );

  if (variant === "mobile") {
    return <section className="mb-4 xl:hidden">{content}</section>;
  }

  return (
    <aside className="hidden w-72 flex-shrink-0 xl:block">
      <div className="sticky top-[calc(var(--nav-height)+1.5rem)]">{content}</div>
    </aside>
  );
}
