import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PRESENTATION_ACCESS_COOKIE_NAME,
  hasValidPresentationAccessCookie,
  isPresentationAccessConfigured,
  sanitizePresentationReturnPath,
} from "@/lib/presentation-access";
import { dashboardLoginUrl } from "@/lib/urls";

import { submitPresentationAccess } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ResolveKit | Enter Access Code",
  description: "Protected access screen for the ResolveKit investor presentation.",
};

export default async function PresentationAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizePresentationReturnPath(params.next);
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(PRESENTATION_ACCESS_COOKIE_NAME)?.value;

  if (await hasValidPresentationAccessCookie(cookieValue)) {
    redirect(nextPath);
  }

  const isConfigured = isPresentationAccessConfigured();
  const showInvalidPassword = params.error === "invalid";
  const showConfigError = params.error === "config" || !isConfigured;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f0e7_0%,#efe6d9_55%,#ede7df_100%)] text-[#171412]">
      <div className="mx-auto flex min-h-screen max-w-[1180px] items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.08fr)_420px] lg:gap-8">
          <Card className="border-[#d6c7b4] bg-[linear-gradient(145deg,rgba(255,251,245,0.98),rgba(243,235,224,0.96))] p-8 sm:p-10">
            <h1
              className="mt-2 max-w-3xl text-5xl font-semibold leading-[0.94] tracking-[-0.04em] text-[#171412] sm:text-7xl lg:text-[5.6rem]"
              style={{ fontFamily: "\"Iowan Old Style\", \"Palatino Linotype\", \"Book Antiqua\", serif" }}
            >
              AI Support Agent that can solve on-device problems
            </h1>
          </Card>

          <Card className="border-[#d7ccbb] bg-[rgba(255,251,245,0.96)] p-6 sm:p-7">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#b08b52]">Access required</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#1e2d4a]">Enter password</h2>
            <p className="mt-3 text-base leading-relaxed text-[#5b5249]">
              Enter password to see more.
            </p>

            <form action={submitPresentationAccess} className="mt-6 space-y-4">
              <input type="hidden" name="next" value={nextPath} />
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[#2b261f]">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-2xl border border-[#d4c6b3] bg-white px-4 py-3 text-base text-[#171412] outline-none transition focus:border-[#1e2d4a] focus:ring-2 focus:ring-[#1e2d4a]/10"
                  placeholder="Enter access code"
                />
              </div>

              {showInvalidPassword ? (
                <p className="rounded-2xl border border-[#dcb4a8] bg-[#fff3ef] px-4 py-3 text-sm text-[#8d3e2a]">
                  That password was not accepted.
                </p>
              ) : null}

              {showConfigError ? (
                <p className="rounded-2xl border border-[#d9c7ab] bg-[#fff8ea] px-4 py-3 text-sm text-[#785a2a]">
                  Presentation access is not configured yet. Set `PRESENTATION_SLUG` and `PRESENTATION_PASSWORD`.
                </p>
              ) : null}

              <Button type="submit" className="w-full bg-[#171412] text-white hover:bg-[#2b241d] hover:text-white">
                Continue
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 text-sm text-[#6b6157]">
              <span>Need the main site instead?</span>
              <Link href={dashboardLoginUrl} className="font-medium text-[#1e2d4a] underline-offset-4 hover:underline">
                Open dashboard
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
