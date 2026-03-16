export type ProductOption = {
  id: string;
  name: string;
  category: string;
  dailyRateUsd: number;
  weeklyRateUsd: number;
  availabilityNote?: string;
  upsells?: string[];
};

/**
 * Demo-only product catalog for AI Assistance selling suggestions.
 * Keep this static so the prototype is deterministic for demos.
 */
export const DEMO_PRODUCT_CATALOG: ProductOption[] = [
  {
    id: "prod-core-drill-01",
    name: "Concrete Core Drill (handheld)",
    category: "Drilling",
    dailyRateUsd: 129,
    weeklyRateUsd: 429,
    availabilityNote: "Usually available same-day at most branches",
    upsells: ["Diamond core bit set", "Water suppression kit", "Vacuum base plate"],
  },
  {
    id: "prod-hammer-drill-01",
    name: "Rotary Hammer Drill (SDS-Max)",
    category: "Drilling",
    dailyRateUsd: 79,
    weeklyRateUsd: 259,
    availabilityNote: "Limited stock — reserve early for Mondays",
    upsells: ["SDS-Max bit set", "Dust extraction attachment"],
  },
  {
    id: "prod-magnetic-drill-01",
    name: "Magnetic Drill Press",
    category: "Metalworking",
    dailyRateUsd: 149,
    weeklyRateUsd: 499,
    availabilityNote: "Call ahead for availability",
    upsells: ["Annular cutters (set)", "Clamp kit"],
  },
  {
    id: "prod-air-compressor-01",
    name: "Towable Air Compressor (185 CFM)",
    category: "Air",
    dailyRateUsd: 189,
    weeklyRateUsd: 649,
    availabilityNote: "Popular on jobsites — book for delivery",
    upsells: ["Air hose bundle", "Pneumatic tool kit"],
  },
  {
    id: "prod-generator-01",
    name: "Portable Generator (5–7 kW)",
    category: "Power",
    dailyRateUsd: 99,
    weeklyRateUsd: 329,
    availabilityNote: "Often available for pickup",
    upsells: ["Extension cord bundle", "Fuel canister"],
  },
  {
    id: "prod-light-tower-01",
    name: "LED Light Tower (towable)",
    category: "Site services",
    dailyRateUsd: 179,
    weeklyRateUsd: 599,
    availabilityNote: "Delivery recommended due to size",
    upsells: ["Extra fuel service", "Security fencing"],
  },
];

