import type { ScrapedListing } from "../scrapers/types.js";

const MECHANICAL_BLOCK = [
  "moteur sauté",
  "moteur saute",
  "transmission glisse",
  "besoin de réparations",
  "besoin de reparations",
  "mécanique à faire",
  "mecanique a faire",
  "pour pièces",
  "pour pieces",
];

const RUST_BLOCK = [
  "perforation",
  "trous",
  "plancher fini",
  "frame pourri",
  "dentelle",
];

const DEALER_BLOCK = ["commercial", "dealer", "marchand", "concessionnaire"];

const AUTO_KEYWORDS = ["auto", "automatique", "automatic"];

const MAX_KM = 200_000;

export type FilterFailureReason =
  | "mileage"
  | "transmission"
  | "mechanical"
  | "rust"
  | "seller";

export type MandatoryFilterResult =
  | { ok: true }
  | { ok: false; reason: FilterFailureReason };

function normText(s: string): string {
  return s.toLowerCase();
}

export function passesMileage(mileageKm: number | null): boolean {
  if (mileageKm == null) return false;
  return mileageKm <= MAX_KM && mileageKm >= 0;
}

export function passesTransmission(
  transmissionText: string | null,
  description: string
): boolean {
  const blob = normText(
    [transmissionText ?? "", description].filter(Boolean).join(" ")
  );
  return AUTO_KEYWORDS.some((k) => blob.includes(k));
}

export function passesMechanical(description: string): boolean {
  const d = normText(description);
  return !MECHANICAL_BLOCK.some((phrase) => d.includes(phrase));
}

export function passesRust(description: string): boolean {
  const d = normText(description);
  return !RUST_BLOCK.some((phrase) => d.includes(phrase));
}

export function passesSellerText(title: string, description: string): boolean {
  const blob = normText(`${title} ${description}`);
  return !DEALER_BLOCK.some((w) => blob.includes(w));
}

export function passesSellerListingCount(count: number | undefined): boolean {
  if (count == null) return true;
  return count <= 3;
}

export function runMandatoryFiveFilters(
  listing: ScrapedListing
): MandatoryFilterResult {
  if (!passesMileage(listing.mileageKm)) {
    return { ok: false, reason: "mileage" };
  }
  if (!passesTransmission(listing.transmissionText, listing.description)) {
    return { ok: false, reason: "transmission" };
  }
  if (!passesMechanical(listing.description)) {
    return { ok: false, reason: "mechanical" };
  }
  if (!passesRust(listing.description)) {
    return { ok: false, reason: "rust" };
  }
  if (!passesSellerText(listing.title, listing.description)) {
    return { ok: false, reason: "seller" };
  }
  if (!passesSellerListingCount(listing.sellerListingCount)) {
    return { ok: false, reason: "seller" };
  }
  return { ok: true };
}
