import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";

describe("api client auth headers", () => {
  const fetchMock = vi.fn();
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    },
  };

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", localStorageMock);
    localStorageMock.clear();
    localStorageMock.setItem("token", "browser-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorageMock.clear();
  });

  it("does not send bearer auth on session-cookie-bound auth routes", async () => {
    await api("/v1/auth/me");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it("still sends bearer auth on non-auth routes", async () => {
    await api("/v1/apps");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer browser-token");
  });
});
