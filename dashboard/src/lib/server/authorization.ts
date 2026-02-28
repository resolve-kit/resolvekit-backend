export const ORG_ROLE_OWNER = "owner";
export const ORG_ROLE_ADMIN = "admin";
export const ORG_ROLE_MEMBER = "member";

export const ORG_ADMIN_ROLES = new Set<string>([ORG_ROLE_OWNER, ORG_ROLE_ADMIN]);

export function requireOrgAdmin(role: string): void {
  if (!ORG_ADMIN_ROLES.has(role)) {
    throw new Error("Insufficient organization permissions");
  }
}
