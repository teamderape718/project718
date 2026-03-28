export const PRICE_MATRIX: Record<string, Record<string, number>> = {
  "Toyota Corolla": { "2008": 5800, "2009-2013": 8500, "2014-2016": 13200 },
  "Toyota RAV4": { "2006-2008": 7500, "2009-2012": 10800, "2013-2014": 15500 },
  "Honda Civic": { "2008-2011": 6200, "2012-2015": 9800, "2016": 15000 },
  "Honda CRV": { "2007-2011": 9500, "2012-2014": 14000 },
};

/** Parse "YYYY-YYYY" or "YYYY" into inclusive year range. */
function parseRangeKey(key: string): { start: number; end: number } | null {
  const single = /^(\d{4})$/.exec(key);
  if (single) {
    const y = Number(single[1]);
    return { start: y, end: y };
  }
  const range = /^(\d{4})-(\d{4})$/.exec(key);
  if (range) {
    return { start: Number(range[1]), end: Number(range[2]) };
  }
  return null;
}

function medianForModelYearKeys(
  modelRanges: Record<string, number>,
  year: number
): number | null {
  for (const [rangeKey, median] of Object.entries(modelRanges)) {
    const r = parseRangeKey(rangeKey);
    if (r && year >= r.start && year <= r.end) return median;
  }
  return null;
}

/**
 * Normalize free-text model (e.g. "toyota corolla le") to a PRICE_MATRIX key when possible.
 */
export function normalizeModelKey(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s.includes("corolla")) return "Toyota Corolla";
  if (s.includes("rav4") || s.includes("rav 4")) return "Toyota RAV4";
  if (s.includes("civic")) return "Honda Civic";
  if (s.includes("cr-v") || s.includes("crv") || s.includes("cr v")) return "Honda CRV";
  return null;
}

export function getMedianForModelYear(model: string, year: number): number | null {
  const key = normalizeModelKey(model);
  if (!key) return null;
  const ranges = PRICE_MATRIX[key];
  if (!ranges) return null;
  return medianForModelYearKeys(ranges, year);
}

export function isHotDeal(price: number, median: number): boolean {
  return price < median * 0.85;
}
