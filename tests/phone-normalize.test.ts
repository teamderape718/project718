import { describe, expect, it } from "vitest";
import { normalizeToE164 } from "../src/utils/phone.js";

describe("normalizeToE164", () => {
  it("formats 10-digit NA numbers", () => {
    expect(normalizeToE164("5145551234")).toBe("+15145551234");
    expect(normalizeToE164("(514) 555-1234")).toBe("+15145551234");
  });

  it("formats 11-digit starting with 1", () => {
    expect(normalizeToE164("15145551234")).toBe("+15145551234");
    expect(normalizeToE164("+1 514 555 1234")).toBe("+15145551234");
  });

  it("returns null for empty or invalid", () => {
    expect(normalizeToE164("")).toBeNull();
    expect(normalizeToE164("123")).toBeNull();
    expect(normalizeToE164(null)).toBeNull();
  });
});
