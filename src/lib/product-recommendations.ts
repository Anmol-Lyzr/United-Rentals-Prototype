import type { TranscriptEntry } from "@/types/call-records";
import { DEMO_PRODUCT_CATALOG, type ProductOption } from "@/mock/product-catalog";

type ProductMatch = {
  product: ProductOption;
  score: number;
  matchedKeywords: string[];
};

const KEYWORDS: { keywords: string[]; productIds: string[] }[] = [
  {
    keywords: ["core drill", "coring", "concrete core", "hole in concrete"],
    productIds: ["prod-core-drill-01"],
  },
  {
    keywords: ["hammer drill", "rotary hammer", "sds", "drilling machine", "drill machine", "drilling"],
    productIds: ["prod-hammer-drill-01"],
  },
  {
    keywords: ["mag drill", "magnetic drill", "drill press", "steel drilling"],
    productIds: ["prod-magnetic-drill-01"],
  },
  {
    keywords: ["air compressor", "compressor", "pneumatic", "jackhammer"],
    productIds: ["prod-air-compressor-01"],
  },
  {
    keywords: ["generator", "power on site", "temporary power"],
    productIds: ["prod-generator-01"],
  },
  {
    keywords: ["light tower", "site lighting", "night shift", "work lights"],
    productIds: ["prod-light-tower-01"],
  },
];

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTextAgainstKeywords(text: string, keywords: string[]): { score: number; matched: string[] } {
  if (!text) return { score: 0, matched: [] };
  const matched = keywords.filter((k) => text.includes(k));
  return { score: matched.length, matched };
}

/**
 * Demo-only: recommend products based on recent customer transcript entries.
 * This does not affect the resolution agent; it only augments the UI for selling demos.
 */
export function recommendProductsFromTranscript(
  transcriptEntries: TranscriptEntry[],
  opts?: { maxProducts?: number; lookbackCustomerTurns?: number }
): ProductOption[] {
  const maxProducts = opts?.maxProducts ?? 3;
  const lookback = opts?.lookbackCustomerTurns ?? 6;

  const recentCustomer = [...transcriptEntries]
    .reverse()
    .filter((e) => e.speaker === "customer")
    .slice(0, lookback)
    .map((e) => e.text)
    .reverse()
    .join(" ");

  const normalized = normalize(recentCustomer);
  if (!normalized) return [];

  const matchesById = new Map<string, ProductMatch>();

  for (const rule of KEYWORDS) {
    const { score, matched } = scoreTextAgainstKeywords(normalized, rule.keywords);
    if (score <= 0) continue;
    for (const id of rule.productIds) {
      const product = DEMO_PRODUCT_CATALOG.find((p) => p.id === id);
      if (!product) continue;
      const existing = matchesById.get(id);
      if (!existing) {
        matchesById.set(id, { product, score, matchedKeywords: matched });
      } else {
        existing.score += score;
        existing.matchedKeywords = Array.from(new Set([...existing.matchedKeywords, ...matched]));
      }
    }
  }

  return [...matchesById.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxProducts)
    .map((m) => m.product);
}

