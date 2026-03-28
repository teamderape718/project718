import type { Page } from "playwright";
import { delay } from "./timing.js";

const REVEAL_SELECTORS = [
  'button:has-text("Afficher le numéro")',
  'button:has-text("Afficher")',
  'a:has-text("Afficher le numéro")',
  'a:has-text("numéro")',
  '[data-testid*="phone"]',
  'button:has-text("Reveal")',
  'a:has-text("Reveal")',
] as const;

/** Normalize to E.164 +1XXXXXXXXXX for Canada/US, or null. */
export function normalizePhoneToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && raw.trim().startsWith("+")) {
    const d = raw.replace(/\D/g, "");
    if (d.length >= 10) return `+${d}`;
  }
  return null;
}

export async function tryRevealPhoneOnPage(page: Page): Promise<void> {
  for (const sel of REVEAL_SELECTORS) {
    const loc = page.locator(sel).first();
    try {
      if (await loc.isVisible({ timeout: 1200 })) {
        await loc.click();
        await delay(900);
        return;
      }
    } catch {
      /* next */
    }
  }
}

export async function extractPhoneFromListingPage(page: Page): Promise<string | null> {
  await tryRevealPhoneOnPage(page);

  const telLinks = page.locator('a[href^="tel:"]');
  const n = await telLinks.count();
  for (let i = 0; i < n; i++) {
    const href = await telLinks.nth(i).getAttribute("href");
    if (!href) continue;
    const m = href.match(/tel:\s*([+\d\s().-]+)/i);
    if (m) {
      const e164 = normalizePhoneToE164(m[1]);
      if (e164) return e164;
    }
  }

  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
  const patterns = [
    /(\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    const s = bodyText.slice(0, 80_000);
    while ((match = re.exec(s)) !== null) {
      const joined = (match[1] ?? "") + match[2] + match[3] + match[4];
      const e164 = normalizePhoneToE164(joined);
      if (e164 && e164.length >= 12) return e164;
    }
  }

  return null;
}
