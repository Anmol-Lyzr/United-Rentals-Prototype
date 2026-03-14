// Unified demo data for Dashboard, Analytics, Reports, and Integrations.
// This file is the single source of truth for all mock catalog-style data
// that powers the non-API pages in the prototype.

// ───────────────────────────────────────────────────────────────────────────────
// Dashboard & Analytics demo metrics
// ───────────────────────────────────────────────────────────────────────────────

export type DashboardAgentSnapshot = {
  name: string;
  label: string;
  value: number;
};

export type DemoVolumePoint = {
  /** ISO date string (YYYY-MM-DD) for the day bucket */
  date: string;
  /** Total calls for the day */
  total: number;
  /** Calls resolved without follow-up */
  resolved: number;
  /** Calls that required follow-up */
  followUp: number;
  /** Other / uncategorised calls */
  other: number;
};

export type DemoAnalyticsSnapshot = {
  totalConversations: number;
  aiResolutionRate: number;
  avgHandleMinutes: number;
  sentimentScore: number;
  volume: DemoVolumePoint[];
};

export type DemoChannelStat = {
  label: "Voice" | "Billing" | "Troubleshooting";
  total: number;
  aiResolution: number;
  avgMinutes: number;
  sentiment: number;
};

export type DemoSlaBreakdown = {
  within: number;
  atRisk: number;
  breached: number;
};

// Stable demo agent snapshots shown on the Dashboard and Analytics pages.
export const dashboardAgentSnapshots: DashboardAgentSnapshot[] = [
  {
    name: "ISR Voice Support Co-Pilot",
    label: "Primary call handling",
    value: 94,
  },
  {
    name: "Billing Assist Co-Pilot",
    label: "Invoices & disputes",
    value: 89,
  },
  {
    name: "Troubleshooting Co-Pilot",
    label: "Equipment issues",
    value: 92,
  },
];

// Demo analytics metrics used when there is not yet enough real call history.
// This keeps the dashboard/analytics views looking alive even in a fresh session.
export const demoAnalyticsSnapshot: DemoAnalyticsSnapshot = {
  totalConversations: 128,
  aiResolutionRate: 92,
  avgHandleMinutes: 4.3,
  sentimentScore: 4.6,
  volume: [
    { date: "2026-03-08", total: 14, resolved: 11, followUp: 2, other: 1 },
    { date: "2026-03-09", total: 18, resolved: 15, followUp: 2, other: 1 },
    { date: "2026-03-10", total: 21, resolved: 17, followUp: 3, other: 1 },
    { date: "2026-03-11", total: 19, resolved: 15, followUp: 3, other: 1 },
    { date: "2026-03-12", total: 22, resolved: 18, followUp: 3, other: 1 },
    { date: "2026-03-13", total: 17, resolved: 13, followUp: 3, other: 1 },
    { date: "2026-03-14", total: 17, resolved: 13, followUp: 3, other: 1 },
  ],
};

// Channel-level demo metrics that keep Analytics channel cards populated,
// even when there is limited or no real call history.
export const demoChannelStats: DemoChannelStat[] = [
  {
    label: "Voice",
    total: 128,
    aiResolution: 92,
    avgMinutes: 4.3,
    sentiment: 4.7,
  },
  {
    label: "Billing",
    total: 46,
    aiResolution: 88,
    avgMinutes: 5.1,
    sentiment: 4.2,
  },
  {
    label: "Troubleshooting",
    total: 36,
    aiResolution: 86,
    avgMinutes: 5.4,
    sentiment: 4.0,
  },
];

export const demoSlaBreakdown: DemoSlaBreakdown = {
  within: 92,
  atRisk: 5,
  breached: 3,
};

// Convenience async helper so existing code can continue to treat this as an API.
export async function getDashboardAgents(): Promise<DashboardAgentSnapshot[]> {
  return dashboardAgentSnapshots;
}

// ───────────────────────────────────────────────────────────────────────────────
// Reports demo data
// ───────────────────────────────────────────────────────────────────────────────

export type DemoReport = {
  id: string;
  name: string;
  cadence: "Daily" | "Weekly" | "Monthly";
  status: "Ready";
  generatedAt: string;
};

export type DemoReportTemplate = {
  name: string;
  description: string;
  cadence: "Daily" | "Weekly" | "Monthly";
  format: string;
};

// Templates that power the \"Generate\" cards on the Reports page.
export const reportTemplates: DemoReportTemplate[] = [
  {
    name: "Daily Call Summary",
    description: "Overview of all support calls assisted by the Co-Pilot.",
    cadence: "Daily",
    format: "PDF",
  },
  {
    name: "Weekly Channel Performance",
    description:
      "Compare call volume and AI resolution across core call types.",
    cadence: "Weekly",
    format: "Excel",
  },
  {
    name: "Customer Satisfaction Snapshot",
    description:
      "CSAT distribution for calls handled with the ISR Co-Pilot.",
    cadence: "Monthly",
    format: "PDF",
  },
];

// Optional seed reports so the \"Recent reports\" table is not empty on first load.
export const demoReportsSeed: DemoReport[] = [
  {
    id: "daily-summary-2026-03-13",
    name: "Daily Call Summary",
    cadence: "Daily",
    status: "Ready",
    generatedAt: "Mar 13, 4:45 PM",
  },
  {
    id: "weekly-channel-2026-03-10",
    name: "Weekly Channel Performance",
    cadence: "Weekly",
    status: "Ready",
    generatedAt: "Mar 10, 9:15 AM",
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// Integrations demo data
// ───────────────────────────────────────────────────────────────────────────────

export type DemoIntegration = {
  name: string;
  category: "CRM" | "Communication" | "Voice" | "Helpdesk" | "Analytics";
  status: "Connected" | "Available";
};

export const demoIntegrations: DemoIntegration[] = [
  {
    name: "Salesforce",
    category: "CRM",
    status: "Connected",
  },
  {
    name: "Slack",
    category: "Communication",
    status: "Connected",
  },
  {
    name: "Twilio",
    category: "Voice",
    status: "Available",
  },
  {
    name: "Zendesk",
    category: "Helpdesk",
    status: "Available",
  },
  {
    name: "HubSpot",
    category: "CRM",
    status: "Available",
  },
  {
    name: "Google Analytics",
    category: "Analytics",
    status: "Connected",
  },
];

export async function getIntegrations(): Promise<DemoIntegration[]> {
  return demoIntegrations;
}

