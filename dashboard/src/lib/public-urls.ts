function normalizePublicUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

const configuredIosSdkRepoUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_IOS_SDK_REPO_URL ?? "");
const configuredAndroidSdkRepoUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_ANDROID_SDK_REPO_URL ?? "");
const configuredIosSampleDmgUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_IOS_SAMPLE_DMG_URL ?? "");
const configuredAndroidSampleDebugApkUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_ANDROID_SAMPLE_DEBUG_APK_URL ?? "");
const configuredAndroidSampleReleaseApkUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_ANDROID_SAMPLE_RELEASE_APK_URL ?? "");

export const iosSdkRepoUrl = configuredIosSdkRepoUrl;
export const androidSdkRepoUrl = configuredAndroidSdkRepoUrl;
export const iosSampleDmgUrl = configuredIosSampleDmgUrl;
export const androidSampleDebugApkUrl = configuredAndroidSampleDebugApkUrl;
export const androidSampleReleaseApkUrl = configuredAndroidSampleReleaseApkUrl;
