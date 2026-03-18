import type { TranscriptEntry } from "@/types/call-records";

export const NEW_CUSTOMER_NAME = "Rahul Mehta";
export const NEW_CUSTOMER_LOCATION =
  "2450 Oak Ridge Drive, Austin, TX 78758";

export const NEW_CUSTOMER_EQUIPMENT: string[] = [
  "3.5-Ton Mini Excavator",
  "Small Skid Steer",
  "Standard Bucket Attachment",
];

export const EQUIPMENT_DETAILS: Record<
  string,
  { name: string; description: string }
> = {
  "High-level overview: earthmoving, aerial, and material handling fleet": {
    name: "High-level overview: earthmoving, aerial, and material handling fleet",
    description:
      "Examples: Mini Excavators, Skid Steers, Boom Lifts, Scissor Lifts, Telehandlers, and Forklifts commonly rented from United Rentals.",
  },
  "3.5-Ton or similar mini excavator for footings and trenching.": {
    name: "3.5-Ton or similar mini excavator for footings and trenching.",
    description:
      "Examples: Mini Excavators such as 3.5‑Ton or 4‑Ton models commonly rented for trenching and footing work.",
  },
  "Compact skid steer or track loader for moving spoil and materials.": {
    name: "Compact skid steer or track loader for moving spoil and materials.",
    description:
      "Examples: Small Skid Steers and Compact Track Loaders used for moving soil, gravel, and palletized materials.",
  },
  "3.5-Ton Mini Excavator": {
    name: "3.5-Ton Mini Excavator",
    description:
      "Compact excavator for precise digging in tight spaces; ideal for trenching and light utility work.",
  },
  "Small Skid Steer": {
    name: "Small Skid Steer",
    description:
      "Small, maneuverable loader for grading, moving material, and cleanup on tight jobsites.",
  },
  "Standard Bucket Attachment": {
    name: "Standard Bucket Attachment",
    description:
      "General-purpose bucket for scooping, lifting, and moving loose materials like soil or gravel.",
  },
};

export type FirstTimeCallerSuggestionStage =
  | "initial"
  | "after_needs"
  | "after_details"
  | "wrap_up";

export type FirstTimeCallerSuggestionState = {
  intentSummary: string;
  equipmentToOffer: string[];
  clarifyingQuestions: string[];
  safetyNotes: string[];
  crossSell: string[];
  recommendedBundle: string;
  riskReminders: string[];
};

function countCustomerTurns(entries: TranscriptEntry[]): number {
  return entries.filter((e) => e.speaker === "customer").length;
}

export function getFirstTimeCallerStage(
  entries: TranscriptEntry[]
): FirstTimeCallerSuggestionStage {
  const turns = countCustomerTurns(entries);
  if (turns <= 1) return "initial";
  if (turns === 2) return "after_needs";
  if (turns === 3) return "after_details";
  return "wrap_up";
}

export function buildFirstTimeCallerTranscript(
  now: Date = new Date()
): TranscriptEntry[] {
  const later = (seconds: number) =>
    new Date(now.getTime() + seconds * 1000);

  return [
    {
      speaker: "agent",
      text: "Hello, this is Sarah from United Rentals. How can I assist you today?",
      timestamp: now,
    },
    {
      speaker: "customer",
      text: `Hi, I’m ${NEW_CUSTOMER_NAME}, I’m starting some foundation work for a small commercial building and I’m not sure what rental equipment I’ll need or what you provide.`,
      timestamp: later(2),
    },
    {
      speaker: "agent",
      text: "Great, thanks for calling us first. We can help with earthmoving, material handling, and concrete tools. Can you tell me a bit more about the site and what stage of construction you’re in so I can recommend the right equipment?",
      timestamp: later(6),
    },
    {
      speaker: "customer",
      text: "We’re clearing the lot and then digging footings, so we’ll need to move soil and maybe pour concrete in a pretty tight space.",
      timestamp: later(10),
    },
    {
      speaker: "agent",
      text: "Understood. We work with a lot of contractors on that kind of work. Before we go further, can I get your full name and exact jobsite address so I can check availability at the closest branch?",
      timestamp: later(14),
    },
    {
      speaker: "customer",
      text: `Sure, it’s ${NEW_CUSTOMER_NAME}, and the jobsite is ${NEW_CUSTOMER_LOCATION}.`,
      timestamp: later(18),
    },
    {
      speaker: "agent",
      text:
        "Perfect, thanks. Based on that site, I’d suggest a 3.5-Ton Mini Excavator for the footings and a Small Skid Steer for moving material around the pad. Does that match what you’re looking for?",
      timestamp: later(22),
    },
    {
      speaker: "customer",
      text: "Yes, that sounds right. I’d like to go ahead and reserve a mini excavator and a skid steer for next week.",
      timestamp: later(26),
    },
    {
      speaker: "agent",
      text: `Great, I’ll set up a reservation for a 3.5-Ton Mini Excavator and a Small Skid Steer delivering to ${NEW_CUSTOMER_LOCATION} next week. Do you need any other equipments we provide scissor lifts too?`,
      timestamp: later(30),
    },
    {
      speaker: "customer",
      text: "Let’s add a standard bucket for the excavator for now, that should be enough. Thanks for walking me through it.",
      timestamp: later(34),
    },
    {
      speaker: "agent",
      text:
        "You're very welcome! Keep an eye out for that email in the next few minutes. We appreciate your business—have a great day!",
      timestamp: later(38),
    },
  ];
}

export function buildFirstTimeCallerSuggestionState(
  entries: TranscriptEntry[]
): FirstTimeCallerSuggestionState {
  const stage = getFirstTimeCallerStage(entries);

  if (stage === "initial") {
    return {
      intentSummary:
        "New customer calling to understand what equipment United Rentals can provide for a small commercial foundation project.",
      equipmentToOffer: [
        "High-level overview: earthmoving, aerial, and material handling fleet",
      ],
      clarifyingQuestions: [
        "Ask what type of structure they’re building and approximate footprint.",
        "Ask when they plan to start excavation and how long the work should last.",
        "Ask whether they have any existing rental accounts with United Rentals.",
      ],
      safetyNotes: [
        "Remind them that operators must be trained on earthmoving equipment.",
      ],
      crossSell: [
        "Mention that United Rentals can also support power, lighting, and site services later in the project.",
      ],
      recommendedBundle: "Intro construction consultation (no specific units yet).",
      riskReminders: [
        "Keep the explanation simple so a first-time caller isn’t overwhelmed.",
      ],
    };
  }

  if (stage === "after_needs") {
    return {
      intentSummary:
        "Customer needs to clear a lot and dig footings in a tight space.",
      equipmentToOffer: [
        "3.5-Ton or similar mini excavator for footings and trenching.",
        "Compact skid steer or track loader for moving spoil and materials.",
      ],
      clarifyingQuestions: [
        "Ask about ground conditions (rocky, clay, slopes) to size the machines.",
        "Ask about site access: width of gates, overhead lines, and obstacles.",
        "Confirm if they will pour concrete themselves or use a subcontractor.",
      ],
      safetyNotes: [
        "Remind them to call for underground utility locates before digging.",
        "Flag that workers around excavations should follow trench safety best practices.",
      ],
      crossSell: [
        "Suggest power and light (small generator, light tower) if work extends into evenings.",
      ],
      recommendedBundle: "Small sitework starter bundle (mini excavator + skid steer).",
      riskReminders: [
        "Confirm the site is suitable for tracked vs. wheeled machines.",
        "Note any local noise or access restrictions that might affect delivery.",
      ],
    };
  }

  if (stage === "after_details") {
    return {
      intentSummary: `Customer ${NEW_CUSTOMER_NAME} has provided full jobsite address at ${NEW_CUSTOMER_LOCATION} and is ready for specific recommendations.`,
      equipmentToOffer: [...NEW_CUSTOMER_EQUIPMENT],
      clarifyingQuestions: [
        "Confirm exact start date and how many days they expect to need the equipment.",
        "Ask if they prefer delivery or if they plan to pick up from the branch.",
      ],
      safetyNotes: [
        "Remind them to review safe operation manuals before first use.",
        "Confirm that only trained operators will run the equipment.",
      ],
      crossSell: [
        "Mention concrete tools, trench boxes, and compaction equipment as future-phase rentals.",
      ],
      recommendedBundle:
        "Foundation work bundle (mini excavator + skid steer + bucket attachment).",
      riskReminders: [
        "Ensure the jobsite can accept a delivery truck at the provided address.",
        "Confirm they understand fuel and cleaning responsibilities on return.",
      ],
    };
  }

  return {
    intentSummary:
      "Customer is satisfied with the recommendations and ready to place an order for the foundation phase.",
    equipmentToOffer: [...NEW_CUSTOMER_EQUIPMENT],
    clarifyingQuestions: [
      "Confirm the final start date and total rental duration.",
      "Ask if they want to lock in tentative dates for future phases (framing, interior).",
    ],
    safetyNotes: [
      "Remind them to do a walk-around inspection on delivery and note any damage.",
    ],
    crossSell: [
      "Position United Rentals as the partner for future equipment on this project (aerial lifts, generators, etc.).",
    ],
    recommendedBundle:
      "Confirmed order: mini excavator + skid steer + standard bucket attachment.",
    riskReminders: [
      "Set expectation on how to request extensions or additional equipment mid-project.",
    ],
  };
}

