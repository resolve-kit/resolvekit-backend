function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const rawDashboardBaseUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";

export const dashboardBaseUrl = trimTrailingSlash(rawDashboardBaseUrl);
export const dashboardLoginUrl = `${dashboardBaseUrl}/login`;
