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
    <div className="mb-4 rounded-xl border border-accent-dim bg-accent-subtle/60 px-4 py-3 animate-fade-in-up">
      <p className="text-[10px] uppercase tracking-widest text-accent">Optional Tip</p>
      <p className="text-sm font-semibold text-strong mt-1">{tip.title}</p>
      <p className="text-xs text-subtle mt-1">{tip.description}</p>
      <Link
        to={tip.route || fallbackRoute}
        className="inline-block mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
      >
        Open suggested page
      </Link>
    </div>
  );
}
