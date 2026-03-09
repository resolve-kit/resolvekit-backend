function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const rawDashboardBaseUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
const rawFeedbackIssuesUrl =
  process.env.NEXT_PUBLIC_FEEDBACK_ISSUES_URL ?? "https://github.com/Nights-Are-Late/resolvekit-ios-sdk/issues";
const rawIosSdkRepoUrl =
  process.env.NEXT_PUBLIC_IOS_SDK_REPO_URL ?? "https://github.com/Nights-Are-Late/resolvekit-ios-sdk";
const rawNextjsSdkRepoUrl =
  process.env.NEXT_PUBLIC_NEXTJS_SDK_REPO_URL ?? "https://github.com/Nights-Are-Late/resolvekit-nextjs-sdk";
const rawNextjsSdkNpmUrl =
  process.env.NEXT_PUBLIC_NEXTJS_SDK_NPM_URL ?? "https://www.npmjs.com/package/@resolvekit/nextjs";

export const dashboardBaseUrl = trimTrailingSlash(rawDashboardBaseUrl);
export const dashboardLoginUrl = `${dashboardBaseUrl}/login`;
export const dashboardRegisterUrl = `${dashboardBaseUrl}/login?mode=register`;
export const feedbackIssuesUrl = rawFeedbackIssuesUrl;
export const iosSdkRepoUrl = rawIosSdkRepoUrl;
export const nextjsSdkRepoUrl = rawNextjsSdkRepoUrl;
export const nextjsSdkNpmUrl = rawNextjsSdkNpmUrl;
