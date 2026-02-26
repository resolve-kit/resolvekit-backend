import { Link, useLocation } from "react-router-dom";

import { Button } from "./ui";
import { useOnboarding } from "../context/OnboardingContext";

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
          <li key={step.id} className="rounded-lg border border-border bg-canvas/50 px-3 py-2">
            <div className="flex items-start gap-2">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  step.is_complete
                    ? "bg-success-subtle text-success border border-success-dim"
                    : "bg-surface-2 text-subtle border border-border"
                }`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-strong">{step.title}</p>
                <p className="mt-0.5 text-[11px] text-subtle">{step.description}</p>
                {step.blocked_reason && (
                  <p className="mt-1 text-[11px] text-warning">{step.blocked_reason}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {step.is_complete ? (
                    <span className="text-[11px] text-success">Completed</span>
                  ) : step.is_blocked ? (
                    <span className="text-[11px] text-warning">Blocked</span>
                  ) : (
                    <Link
                      to={step.route}
                      className={`text-[11px] ${isActive ? "text-accent" : "text-subtle hover:text-body"}`}
                    >
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
    <div className="rounded-lg border border-border bg-canvas/50 p-3">
      <p className="text-xs font-medium text-strong">SDK mini-checklist</p>
      <ul className="mt-1.5 space-y-1 text-[11px] text-subtle">
        <li>1. Add `playbook-ios-sdk` package to your iOS app.</li>
        <li>2. Configure runtime with backend base URL + app API key provider.</li>
        <li>3. Register `@Playbook` functions in runtime configuration.</li>
        <li>4. Launch app once and verify active functions appear in dashboard.</li>
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href="https://github.com/nedasvi/playbook-ios-sdk/blob/main/README.md"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-accent hover:text-accent-hover"
        >
          iOS SDK README
        </a>
        <a
          href="https://github.com/nedasvi/playbook_backend/blob/main/SDK_INTEGRATION.md"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-accent hover:text-accent-hover"
        >
          Backend SDK integration
        </a>
      </div>
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
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Setup Guide</p>
          <p className="text-sm font-semibold text-strong mt-0.5">
            {state.target_app_name ? `${state.target_app_name} onboarding` : "First app onboarding"}
          </p>
          <p className="text-[11px] text-subtle mt-1">
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
          className="text-[11px] text-subtle hover:text-body transition-colors"
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
    return <section className="xl:hidden mb-4">{content}</section>;
  }

  return (
    <aside className="hidden xl:block w-72 flex-shrink-0">
      <div className="sticky top-[calc(var(--nav-height)+1.5rem)]">{content}</div>
    </aside>
  );
}
