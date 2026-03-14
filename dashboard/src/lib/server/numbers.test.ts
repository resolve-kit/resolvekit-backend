import { describe, expect, it } from "vitest";

import { coerceDbNumber } from "./numbers";

describe("coerceDbNumber", () => {
  it("accepts bigint aggregates from Prisma raw queries", () => {
    expect(coerceDbNumber(49n)).toBe(49);
    expect(coerceDbNumber(155834n)).toBe(155834);
  });

  it("keeps number and string values working", () => {
    expect(coerceDbNumber(12)).toBe(12);
    expect(coerceDbNumber("34")).toBe(34);
    expect(coerceDbNumber(null)).toBe(0);
  });
});
