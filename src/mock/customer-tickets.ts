export type Ticket = {
  id: string;
  status: "open" | "closed";
  title: string;
};

/**
 * Mock API for persona-based support tickets shown in the Customer Info card.
 */
export async function getTicketsForPersona(
  personaLabel?: string
): Promise<Ticket[]> {
  switch (personaLabel) {
    case "Angry customer":
      return [
        {
          id: "TKT-4521",
          status: "open",
          title: "Billing dispute for recent invoice",
        },
        {
          id: "TKT-4309",
          status: "closed",
          title: "Equipment breakdown during rental",
        },
        {
          id: "TKT-4610",
          status: "open",
          title: "Escalated call with branch manager",
        },
      ];
    case "Confused customer":
      return [
        {
          id: "TKT-3891",
          status: "open",
          title: "Clarification on rental coverage",
        },
        {
          id: "TKT-3920",
          status: "closed",
          title: "Onboarding walkthrough for Total Control",
        },
      ];
    case "Neutral customer":
      return [
        {
          id: "TKT-4105",
          status: "closed",
          title: "Standard reservation created for upcoming project",
        },
        {
          id: "TKT-4122",
          status: "open",
          title: "Pending quote approval from estimator",
        },
      ];
    case "Happy customer":
      return [
        {
          id: "TKT-5102",
          status: "closed",
          title: "Recent successful project support",
        },
        {
          id: "TKT-5120",
          status: "closed",
          title: "Referral discount applied to new contract",
        },
      ];
    default:
      return [
        {
          id: "TKT-3001",
          status: "closed",
          title: "Onboarding call completed",
        },
      ];
  }
}

