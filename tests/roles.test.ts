import { describe, expect, it } from "vitest";

import { canAccessAdminArea, canAccessSubscriberArea, isApplicationRole } from "../lib/auth/roles";

describe("application role authorization", () => {
  it("accepts only persisted application roles", () => {
    expect(isApplicationRole("subscriber")).toBe(true);
    expect(isApplicationRole("admin")).toBe(true);
    expect(isApplicationRole("public")).toBe(false);
    expect(isApplicationRole("administrator")).toBe(false);
  });

  it("allows authenticated profiles into the subscriber area", () => {
    expect(canAccessSubscriberArea("subscriber")).toBe(true);
    expect(canAccessSubscriberArea("admin")).toBe(true);
  });

  it("restricts the administrator area to administrators", () => {
    expect(canAccessAdminArea("admin")).toBe(true);
    expect(canAccessAdminArea("subscriber")).toBe(false);
  });
});
