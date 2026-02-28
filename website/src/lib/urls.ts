function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const rawDashboardBaseUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
const rawFeedbackIssuesUrl =
  process.env.NEXT_PUBLIC_FEEDBACK_ISSUES_URL ?? "https://github.com/nedasvi/playbook-ios-sdk/issues";

export const dashboardBaseUrl = trimTrailingSlash(rawDashboardBaseUrl);
export const dashboardLoginUrl = `${dashboardBaseUrl}/login`;
export const dashboardRegisterUrl = `${dashboardBaseUrl}/login?mode=register`;
export const feedbackIssuesUrl = rawFeedbackIssuesUrl;
