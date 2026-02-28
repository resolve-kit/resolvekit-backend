import crypto from "crypto";

const ORG_PUBLIC_ID_MIN = 3;
const ORG_PUBLIC_ID_MAX = 32;
const ORG_PUBLIC_ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function defaultOrganizationName(developerName: string): string {
  const normalized = developerName.trim();
  return normalized ? `${normalized}'s Organization` : "My Organization";
}

function normalizeOrganizationPublicId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateOrganizationPublicId(value: string): string {
  const normalized = normalizeOrganizationPublicId(value);
  if (normalized.length < ORG_PUBLIC_ID_MIN) {
    throw new Error(`Organization ID must be at least ${ORG_PUBLIC_ID_MIN} characters`);
  }
  if (normalized.length > ORG_PUBLIC_ID_MAX) {
    throw new Error(`Organization ID must be at most ${ORG_PUBLIC_ID_MAX} characters`);
  }
  if (!ORG_PUBLIC_ID_RE.test(normalized)) {
    throw new Error("Organization ID may only contain lowercase letters, numbers, and hyphens");
  }
  return normalized;
}

export function organizationPublicIdFromName(name: string): string {
  const candidate = normalizeOrganizationPublicId(name);
  if (candidate.length < ORG_PUBLIC_ID_MIN) {
    return "org";
  }
  const trimmed = candidate.slice(0, ORG_PUBLIC_ID_MAX).replace(/-+$/g, "");
  return trimmed || "org";
}

export function randomOrganizationPublicId(baseName: string): string {
  const base = organizationPublicIdFromName(baseName);
  const suffix = crypto.randomBytes(3).toString("hex");
  const allowedBaseLen = Math.max(ORG_PUBLIC_ID_MIN, ORG_PUBLIC_ID_MAX - suffix.length - 1);
  const trimmed = (base.slice(0, allowedBaseLen).replace(/-+$/g, "") || "org");
  return `${trimmed}-${suffix}`;
}
