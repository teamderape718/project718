import { describe, expect, it } from "vitest";
import {
  passesMechanical,
  passesMileage,
  passesRust,
  passesSellerListingCount,
  passesSellerText,
  passesTransmission,
  runMandatoryFiveFilters,
} from "../src/filters/mandatory-five.js";
import type { ScrapedListing } from "../src/scrapers/types.js";

function baseListing(over: Partial<ScrapedListing> = {}): ScrapedListing {
  return {
    source: "kijiji",
    url: "https://example.com",
    title: "2012 Toyota Corolla",
    priceCad: 5000,
    year: 2012,
    mileageKm: 150_000,
    transmissionText: "automatique",
    description: "Bon état",
    modelHint: "Corolla",
    ...over,
  };
}

describe("mandatory-five", () => {
  it("rejects high mileage", () => {
    expect(passesMileage(250_000)).toBe(false);
    expect(passesMileage(200_000)).toBe(true);
    expect(passesMileage(null)).toBe(false);
  });

  it("requires automatic", () => {
    expect(passesTransmission("automatique", "")).toBe(true);
    expect(passesTransmission(null, "Transmission automatique")).toBe(true);
    expect(passesTransmission("manuel", "")).toBe(false);
  });

  it("blocks mechanical phrases", () => {
    expect(passesMechanical("rien à signaler")).toBe(true);
    expect(passesMechanical("moteur sauté, à éviter")).toBe(false);
  });

  it("blocks severe rust phrases", () => {
    expect(passesRust("un peu de rouille surface")).toBe(true);
    expect(passesRust("perforation plancher")).toBe(false);
  });

  it("blocks dealer keywords in text", () => {
    expect(passesSellerText("belle auto", "particulier")).toBe(true);
    expect(passesSellerText("Chez Marchand Auto", "")).toBe(false);
  });

  it("enforces seller listing count when provided", () => {
    expect(passesSellerListingCount(undefined)).toBe(true);
    expect(passesSellerListingCount(3)).toBe(true);
    expect(passesSellerListingCount(4)).toBe(false);
  });

  it("runMandatoryFiveFilters passes clean listing", () => {
    const r = runMandatoryFiveFilters(baseListing());
    expect(r).toEqual({ ok: true });
  });
});
