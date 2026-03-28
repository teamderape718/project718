import { describe, expect, it } from "vitest";
import {
  getMedianForModelYear,
  isHotDeal,
  normalizeModelKey,
} from "../src/constants/price-matrix.js";

describe("price-matrix", () => {
  it("resolves year ranges for Corolla", () => {
    expect(getMedianForModelYear("Toyota Corolla 2010", 2010)).toBe(8500);
    expect(getMedianForModelYear("corolla", 2015)).toBe(13200);
    expect(getMedianForModelYear("corolla", 2008)).toBe(5800);
  });

  it("resolves RAV4 and Civic", () => {
    expect(getMedianForModelYear("RAV4", 2010)).toBe(10800);
    expect(getMedianForModelYear("Honda Civic", 2016)).toBe(15000);
  });

  it("returns null for unknown model", () => {
    expect(getMedianForModelYear("Ford F-150", 2015)).toBeNull();
  });

  it("isHotDeal when 15%+ below median", () => {
    expect(isHotDeal(7000, 8500)).toBe(true);
    expect(isHotDeal(7225, 8500)).toBe(false);
  });

  it("normalizeModelKey maps aliases", () => {
    expect(normalizeModelKey("2014 Honda CR-V Touring")).toBe("Honda CRV");
  });
});
