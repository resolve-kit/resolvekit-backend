function normalizePublicUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

const configuredIosSdkRepoUrl = normalizePublicUrl(process.env.NEXT_PUBLIC_IOS_SDK_REPO_URL ?? "");

export const iosSdkRepoUrl = configuredIosSdkRepoUrl;
