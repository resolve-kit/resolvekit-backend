"use client";

import { ErrorPage } from "@/components/ui/ErrorPage";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPage
      variant="server-error"
      action={
        <button
          onClick={reset}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_-16px_rgba(13,88,214,0.65)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
        >
          Try again
        </button>
      }
    />
  );
}
