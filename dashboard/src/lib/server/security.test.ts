import { afterEach, describe, expect, it, vi } from "vitest";

import { assertDashboardSecurityConfig } from "./security";
import { decryptWithFernet, encryptWithFernet } from "./fernet";

describe("dashboard security config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows development startup with a derived local Fernet key", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RK_JWT_SECRET", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    vi.stubEnv("RK_ENCRYPTION_KEY", "change-me-generate-with-python-fernet");

    expect(() => assertDashboardSecurityConfig()).not.toThrow();
  });

  it("still requires an explicit Fernet key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RK_JWT_SECRET", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    vi.stubEnv("RK_ENCRYPTION_KEY", "change-me-generate-with-python-fernet");

    expect(() => assertDashboardSecurityConfig()).toThrowError("RK_ENCRYPTION_KEY must be a valid Fernet key");
  });

  it("round-trips encrypted values with the derived development fallback key", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RK_JWT_SECRET", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    vi.stubEnv("RK_ENCRYPTION_KEY", "change-me-generate-with-python-fernet");

    const token = encryptWithFernet("local-secret");

    expect(decryptWithFernet(token)).toBe("local-secret");
  });
});
