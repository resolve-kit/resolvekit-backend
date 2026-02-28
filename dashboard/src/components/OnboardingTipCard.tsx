import { Link } from "react-router-dom";

import { useOnboarding } from "../context/OnboardingContext";

interface OnboardingTipCardProps {
  tipId: string;
  fallbackRoute: string;
}

export default function OnboardingTipCard({ tipId, fallbackRoute }: OnboardingTipCardProps) {
  const { state } = useOnboarding();

  if (!state || !state.should_show) return null;

  const tip = state.optional_tips.find((item) => item.id === tipId);
  if (!tip) return null;

  return (
    <div className="mb-4 rounded-xl border border-accent-dim bg-accent-subtle px-4 py-3 animate-fade-in-up">
      <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Optional operator tip</p>
      <p className="mt-1 text-sm font-semibold text-strong">{tip.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-subtle">{tip.description}</p>
      <Link to={tip.route || fallbackRoute} className="mt-2 inline-block text-xs text-accent transition-colors hover:text-accent-hover">
        Open suggested page
      </Link>
    </div>
  );
}
