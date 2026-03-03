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

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
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
