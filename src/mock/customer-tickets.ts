export type Ticket = {
  id: string;
  status: "open" | "closed";
  title: string;
  summary: string;
  generatedAt?: string;
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
          summary:
            "Customer disputes environmental/service fees on the latest invoice and requests a manager review. Pending billing verification and callback.",
          generatedAt: "Mar 10, 2025",
        },
        {
          id: "TKT-4309",
          status: "closed",
          title: "Equipment breakdown during rental",
          summary:
            "Reported equipment downtime mid-rental; replacement arranged and confirmed delivered. Ticket closed after customer confirmed resolution.",
          generatedAt: "Mar 3, 2025",
        },
        {
          id: "TKT-4610",
          status: "open",
          title: "Escalated call with branch manager",
          summary:
            "Escalation requested due to repeated billing questions. Branch manager callback scheduled; awaiting outcome notes.",
          generatedAt: "Mar 11, 2025",
        },
        {
          id: "TKT-4588",
          status: "closed",
          title: "Delivery delay complaint",
          summary:
            "Delivery window missed; credit applied and dispatch process reviewed. Ticket closed after follow-up.",
          generatedAt: "Feb 24, 2025",
        },
      ];
    case "Confused customer":
      return [
        {
          id: "TKT-3891",
          status: "open",
          title: "Clarification on rental coverage",
          summary:
            "Customer unsure what RPP covers and how charges apply. Follow-up email requested with coverage sheet and pricing.",
          generatedAt: "Mar 5, 2025",
        },
        {
          id: "TKT-3920",
          status: "closed",
          title: "Onboarding walkthrough for Total Control",
          summary:
            "Assisted with Total Control login and navigation; confirmed invoice visibility after reset. Ticket closed.",
          generatedAt: "Mar 11, 2025",
        },
        {
          id: "TKT-3955",
          status: "closed",
          title: "Equipment reservation steps",
          summary:
            "Provided step-by-step guidance on creating a reservation and delivery preferences. Customer confirmed booking.",
          generatedAt: "Feb 27, 2025",
        },
        {
          id: "TKT-3980",
          status: "closed",
          title: "Invoice breakdown request",
          summary:
            "Sent itemized invoice and explained line items. Customer acknowledged and ticket was closed.",
          generatedAt: "Feb 20, 2025",
        },
      ];
    case "Neutral customer":
      return [
        {
          id: "TKT-4105",
          status: "closed",
          title: "Standard reservation created for upcoming project",
          summary:
            "Reservation created with tentative dates; awaiting customer approval on quote. Ticket closed after quote sent.",
          generatedAt: "Mar 12, 2025",
        },
        {
          id: "TKT-4122",
          status: "open",
          title: "Pending quote approval from estimator",
          summary:
            "Estimator reviewing quote and pricing options. ISR to follow up within 24 hours for approval status.",
          generatedAt: "Mar 6, 2025",
        },
        {
          id: "TKT-4140",
          status: "closed",
          title: "Contract renewal inquiry",
          summary:
            "Discussed renewal options and updated terms. Documentation shared and ticket closed.",
          generatedAt: "Feb 28, 2025",
        },
        {
          id: "TKT-4165",
          status: "closed",
          title: "Delivery window change",
          summary:
            "Delivery rescheduled and dispatch confirmed new window. Ticket closed after confirmation.",
          generatedAt: "Feb 21, 2025",
        },
      ];
    case "Happy customer":
      return [
        {
          id: "TKT-5102",
          status: "closed",
          title: "Recent successful project support",
          summary:
            "Confirmed equipment met job needs and captured positive feedback. Ticket closed with notes for account team.",
          generatedAt: "Mar 7, 2025",
        },
        {
          id: "TKT-5120",
          status: "closed",
          title: "Referral discount applied to new contract",
          summary:
            "Referral discount applied and contract updated. Ticket closed after customer confirmation.",
          generatedAt: "Mar 13, 2025",
        },
        {
          id: "TKT-5145",
          status: "closed",
          title: "Additional equipment quote",
          summary:
            "Generated quote for additional equipment; customer requested delivery options. Ticket closed after quote sent.",
          generatedAt: "Mar 1, 2025",
        },
        {
          id: "TKT-5170",
          status: "closed",
          title: "Total Control training follow-up",
          summary:
            "Follow-up training completed; user confirmed comfort with reporting and invoice downloads. Ticket closed.",
          generatedAt: "Feb 22, 2025",
        },
      ];
    default:
      return [
        {
          id: "TKT-3001",
          status: "closed",
          title: "Onboarding call completed",
          summary:
            "Completed onboarding overview and confirmed contact details. Ticket closed.",
          generatedAt: "Mar 1, 2025",
        },
        {
          id: "TKT-3002",
          status: "closed",
          title: "Account support",
          summary:
            "General account assistance and profile updates completed. Ticket closed.",
          generatedAt: "Feb 15, 2025",
        },
      ];
  }
}

