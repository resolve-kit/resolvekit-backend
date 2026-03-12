import { describe, expect, it } from "vitest";

import { getClientIp } from "./rate-limit";

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://dashboard.example.test/login", { headers });
}

describe("getClientIp", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "198.51.100.10, 203.0.113.99",
      "x-real-ip": "203.0.113.5",
    });

    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("falls back to the nearest forwarded IP when x-real-ip is absent", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "198.51.100.10, 203.0.113.99",
    });

    expect(getClientIp(request)).toBe("203.0.113.99");
  });
});
