const DEFAULT_MAX_BUCKETS = 10_000;

type BucketState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, BucketState>();

function bucketKey(bucket: string, key: string): string {
  return `${bucket}:${key}`;
}

function maybePruneBuckets(): void {
  if (buckets.size <= DEFAULT_MAX_BUCKETS) return;
  const now = Date.now();
  for (const [key, state] of buckets) {
    if (state.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function isValidIp(value: string): boolean {
  if (!value) return false;
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every((octet) => {
      const n = Number(octet);
      return n >= 0 && n <= 255 && String(n) === octet;
    });
  }
  // IPv6 (including compressed forms)
  if (/^[0-9a-fA-F:]+$/.test(value) && value.includes(":")) return true;
  return false;
}

export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  // Only trust X-Forwarded-For if the deployment uses a reverse proxy that
  // strips/rewrites it. We take the *last* value written by a trusted upstream
  // (rightmost entry added by a proxy we control), not the leftmost which can
  // be injected by the client.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // The rightmost IP is the one added by the nearest trusted proxy.
    const entries = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = entries.length - 1; i >= 0; i--) {
      const candidate = entries[i];
      if (candidate && isValidIp(candidate)) return candidate;
    }
  }
  return "unknown";
}

export function isRateLimited(params: {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
}): boolean {
  const now = Date.now();
  const scopedKey = bucketKey(params.bucket, params.key);
  const existing = buckets.get(scopedKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(scopedKey, { count: 1, resetAt: now + params.windowMs });
    maybePruneBuckets();
    return false;
  }

  existing.count += 1;
  buckets.set(scopedKey, existing);
  maybePruneBuckets();
  return existing.count > params.limit;
}
