import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "../api/client";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  route: string;
  is_complete: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
}

export interface OnboardingTip {
  id: string;
  title: string;
  description: string;
  route: string;
}

export interface OnboardingState {
  organization_id: string;
  is_complete: boolean;
  should_show: boolean;
  can_reset: boolean;
  target_app_id: string | null;
  target_app_name: string | null;
  required_steps: OnboardingStep[];
  optional_tips: OnboardingTip[];
}

interface OnboardingContextValue {
  state: OnboardingState | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setState(null);
      return;
    }

    setIsLoading(true);
    try {
      const payload = await api<OnboardingState>("/v1/organizations/onboarding");
      setState(payload);
    } catch {
      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(async () => {
    const payload = await api<OnboardingState>("/v1/organizations/onboarding/reset", {
      method: "POST",
    });
    setState(payload);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<OnboardingContextValue>(
    () => ({ state, isLoading, refresh, reset }),
    [state, isLoading, refresh, reset],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
