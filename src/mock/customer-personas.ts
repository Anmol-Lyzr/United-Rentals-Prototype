export type PersonaCustomerProfile = {
  name: string;
  account?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  memberSince?: string | null;
  tier?: string;
  status?: "active" | "inactive";
  personaLabel?: string;
};

const PERSONA_CUSTOMERS: Record<string, PersonaCustomerProfile> = {
  "angry customer": {
    name: "Jennifer Park",
    account: "UR-20078",
    email: "jennifer.park@northwoodbuilders.com",
    phone: "+1 (555) 014-2289",
    location: "Columbus East #0834",
    memberSince: "Customer since 2019",
    tier: "National Account",
    status: "active",
    personaLabel: "Angry customer",
  },
  "confused customer": {
    name: "David Chen",
    account: "UR-30155",
    email: "david.chen@cedarconstruction.com",
    phone: "+1 (555) 017-4432",
    location: "Portland NW #0291",
    memberSince: "Customer since 2021",
    tier: "Standard",
    status: "active",
    personaLabel: "Confused customer",
  },
  "neutral customer": {
    name: "Marcus Rivera",
    account: "UR-10042",
    email: "marcus.rivera@riveracontracting.com",
    phone: "+1 (555) 019-8841",
    location: "Austin South #1247",
    memberSince: "Customer since 2017",
    tier: "Premium",
    status: "active",
    personaLabel: "Neutral customer",
  },
  "happy customer": {
    name: "Sarah Lopez",
    account: "UR-45210",
    email: "sarah.lopez@brightwaypainting.com",
    phone: "+1 (555) 018-3307",
    location: "Denver Central #0912",
    memberSince: "Customer since 2015",
    tier: "Premium Plus",
    status: "active",
    personaLabel: "Happy customer",
  },
};

export function getCustomerInfoForPersona(
  personaLabel?: string
): PersonaCustomerProfile | null {
  if (!personaLabel) return null;
  const key = personaLabel.trim().toLowerCase();
  return PERSONA_CUSTOMERS[key] ?? null;
}

