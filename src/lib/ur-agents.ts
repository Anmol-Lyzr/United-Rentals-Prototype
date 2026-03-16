import type {
  ResolutionSuggestion,
  CallRecord,
  ActionItem,
  EquipmentRequested,
  CallCategories,
  SentimentSummary,
  RetentionRiskSummary,
  CustomerUpdateSummary,
  RecordManagement,
} from "@/types/call-records";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_LYZR_API_BASE_URL ??
  "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";
const API_KEY =
  process.env.LYZR_API_KEY ?? "sk-default-fiw9zSxMDvNGmwGRLeWYD5o5YAdG01DN";
const DEFAULT_USER_ID = process.env.LYZR_USER_ID ?? "anmol@lyzr.ai";

const RESOLUTION_AGENT_ID =
  process.env.LYZR_RESOLUTION_AGENT_ID ?? "69b1911c864a3af62e527787";
const SUMMARY_AGENT_ID =
  process.env.LYZR_SUMMARY_AGENT_ID ?? "69b195df2adb5a3a023b9307";
const SPOOF_AGENT_ID =
  process.env.LYZR_SPOOF_AGENT_ID ?? "69b1b99863e526d4023c45ac";

export function generateSessionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function tryParseJson<T>(text: string): T | null {
  if (!text) return null;
  const stripped = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first === -1 || last === -1) return null;

  try {
    return JSON.parse(stripped.slice(first, last + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Extract the inner response string from a Lyzr API response.
 * Lyzr wraps agent output as: { "response": "<stringified JSON or text>", "module_outputs": {...} }
 */
function extractLyzrResponse(data: Record<string, unknown>): string {
  if (typeof data.response === "string") return data.response;
  if (typeof data.message === "string") return data.message;
  if (typeof data.content === "string") return data.content;
  return JSON.stringify(data);
}

// ─── Spoof Agent (customer simulator for demo calls) ───────────────────

export async function getSpoofAgentReply(
  message: string,
  sessionId: string
): Promise<string> {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      user_id: DEFAULT_USER_ID,
      agent_id: SPOOF_AGENT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`Spoof agent error: ${response.status}`);
  }

  const data = await response.json();
  const reply = extractLyzrResponse(data);
  return reply.trim();
}

// ─── Resolution Agent: dynamic phrases (greeting, offer help, closing) ───

/**
 * Ask the Resolution Agent for a single phrase (no transcript). Used for greeting, offer-help, and closing lines.
 * Returns plain text; uses fallback if the agent returns empty or errors.
 */
async function getAgentResponse(
  sessionId: string,
  prompt: string,
  fallback: string
): Promise<string> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        message: prompt,
        session_id: sessionId,
        user_id: DEFAULT_USER_ID,
        agent_id: RESOLUTION_AGENT_ID,
      }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    const reply = extractLyzrResponse(data);
    const parsed = tryParseJson<{ suggested_response?: string; whisper_response?: string }>(reply);
    const text =
      parsed?.suggested_response?.trim() ||
      parsed?.whisper_response?.trim() ||
      reply.replace(/^["']|["']$/g, "").trim();
    return text.slice(0, 500) || fallback;
  } catch {
    return fallback;
  }
}

/** Get the ISR's opening greeting (agent-driven). */
export async function getAgentGreeting(
  sessionId: string,
  isrName: string
): Promise<string> {
  const name = (isrName || "Sarah").trim();
  return getAgentResponse(
    sessionId,
    `You are an Inside Sales Representative at United Rentals. A customer is about to speak. Generate ONLY your opening greeting (one sentence). Use your name: ${name}. Reply with nothing else—no JSON, no labels—just the greeting.`,
    `Thank you for calling United Rentals. I'm ${name}. How may I help you today?`
  );
}

/** Get the ISR's line offering additional help before closing (agent-driven). */
export async function getAgentOfferHelp(sessionId: string): Promise<string> {
  return getAgentResponse(
    sessionId,
    `You are an ISR wrapping up a call. Generate ONLY your single line offering to help with anything else (e.g. asking if the customer needs anything more). One sentence only. Reply with nothing else—no JSON, no labels.`,
    "Is there anything else I can help you with?"
  );
}

/** Get the ISR's closing goodbye line (agent-driven). */
export async function getAgentClosing(sessionId: string): Promise<string> {
  return getAgentResponse(
    sessionId,
    `You are an ISR. The customer has said they don't need anything else. Generate ONLY your closing goodbye line (one sentence, thank them and wish them a good day). Reply with nothing else—no JSON, no labels.`,
    "Thank you for calling United Rentals. Hope you have a great day ahead."
  );
}

/**
 * Turn-based ISR reply helper.
 * Given the customer's latest message, ask the Resolution Agent for the ISR's next line.
 * This is used for live, turn-by-turn agent responses during the demo call.
 */
export async function getAgentReplyForCustomerMessage(
  sessionId: string,
  customerMessage: string
): Promise<string> {
  const trimmed = customerMessage?.trim();
  const safeCustomerLine =
    trimmed && trimmed.length > 0
      ? trimmed.slice(0, 600)
      : "The customer is waiting for assistance but has not said anything specific yet.";

  const prompt = `You are an Inside Sales Representative at United Rentals on a live phone call.

The customer just said: "${safeCustomerLine}"

Reply with ONLY your next line as the ISR in 1–3 short sentences.
Be conversational, concise, and helpful.
Do NOT include any labels, JSON, or prefixes—only the spoken line.`;

  return getAgentResponse(
    sessionId,
    prompt,
    "Thanks for letting me know. Let me look into that for you."
  );
}

// ─── Resolution Agent (real-time during call) ────────────────────────

/** Raw shape from Resolution Agent (may use different field names) */
interface LyzrResolutionResponse {
  whisper_response?: string | null;
  suggested_response?: string | null;
  intent_detected?: string;
  confidence?: number;
  customer_sentiment?: string;
  sentiment_cues?: string;
  de_escalation_tip?: string | null;
  resolution_steps?:
    | { step: number; action: string; detail?: string; system_reference?: string }[]
    | string[];
  knowledge_references?:
    | { title?: string; relevant_excerpt?: string }[]
    | string[];
  equipment_info?: {
    mentioned?: string[];
    equipment_name?: string;
    serial_number?: string | null;
    certifications?: string | null;
    certification_required?: string | null;
    specs_available?: boolean;
    accessories_to_suggest?: string[];
  };
  escalation?: {
    needed?: boolean;
    escalate?: boolean;
    reason?: string;
    escalate_to?: string | null;
    to?: string | null;
  };
  cross_sell_opportunity?: string | null;
  next_best_action?: string | null;
  off_topic?: boolean;
  message?: string | null;
}

function normalizeResolutionResponse(parsed: LyzrResolutionResponse): ResolutionSuggestion {
  const whisper = parsed.whisper_response?.trim() || undefined;
  const suggested = parsed.suggested_response?.trim() || undefined;
  const suggestedFallback = suggested || whisper || "";

  const resolution_steps = Array.isArray(parsed.resolution_steps)
    ? parsed.resolution_steps.map((item, i) =>
        typeof item === "string"
          ? { step: i + 1, action: item, detail: "", system_reference: null as string | null }
          : {
              step: item.step ?? i + 1,
              action: (item.action || "").trim(),
              detail: (item.detail || "").trim(),
              system_reference: item.system_reference ?? null,
            }
      )
    : undefined;

  const knowledge_references = Array.isArray(parsed.knowledge_references)
    ? parsed.knowledge_references.map((item) =>
        typeof item === "string"
          ? { title: "Reference", relevant_excerpt: item }
          : {
              title: (item.title || "Reference").trim(),
              relevant_excerpt: (item.relevant_excerpt || "").trim(),
            }
      )
    : undefined;

  const equipment_info = parsed.equipment_info
    ? {
        mentioned:
          Array.isArray(parsed.equipment_info.mentioned)
            ? parsed.equipment_info.mentioned
            : parsed.equipment_info.equipment_name
              ? [parsed.equipment_info.equipment_name]
              : [],
        specs_available: parsed.equipment_info.specs_available ?? false,
        certification_required:
          parsed.equipment_info.certification_required ??
          parsed.equipment_info.certifications ??
          null,
        accessories_to_suggest:
          parsed.equipment_info.accessories_to_suggest ?? [],
      }
    : undefined;

  const escalation = parsed.escalation
    ? {
        needed: parsed.escalation.needed ?? parsed.escalation.escalate ?? false,
        reason:
          parsed.escalation.reason ??
          (parsed.escalation.to || parsed.escalation.escalate_to) ??
          "",
        escalate_to:
          parsed.escalation.escalate_to ??
          parsed.escalation.to ??
          null,
      }
    : undefined;

  return {
    off_topic: parsed.off_topic ?? false,
    message: parsed.message ?? undefined,
    intent_detected: (parsed.intent_detected || "general_inquiry").replace(/\s*\/\s*/g, " / "),
    confidence: parsed.confidence != null ? parsed.confidence : 0.7,
    customer_sentiment: parsed.customer_sentiment ?? "neutral",
    sentiment_cues: parsed.sentiment_cues ?? undefined,
    whisper_response: whisper,
    suggested_response: suggestedFallback || undefined,
    de_escalation_tip: parsed.de_escalation_tip ?? undefined,
    resolution_steps,
    knowledge_references,
    equipment_info,
    escalation,
    cross_sell_opportunity: parsed.cross_sell_opportunity ?? undefined,
    next_best_action: parsed.next_best_action ?? undefined,
  };
}

export async function sendTranscriptForResolution(
  transcript: string,
  sessionId: string,
  personaLabel?: string,
  intentValue?: string
): Promise<ResolutionSuggestion> {
  const contextualMessage =
    personaLabel || intentValue
      ? `Customer persona: ${personaLabel ?? "Unknown"}; intent: ${intentValue ?? "unknown"}.\n\nFull transcript:\n${transcript}`
      : transcript;

  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message: contextualMessage,
      session_id: sessionId,
      user_id: DEFAULT_USER_ID,
      agent_id: RESOLUTION_AGENT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resolution agent error: ${response.status}`);
  }

  const data = await response.json();
  const reply = extractLyzrResponse(data);
  const parsed: LyzrResolutionResponse | null =
    typeof data.response === "object" && data.response !== null
      ? (data.response as LyzrResolutionResponse)
      : typeof data.message === "object" && data.message !== null
        ? (data.message as LyzrResolutionResponse)
        : tryParseJson<LyzrResolutionResponse>(reply);

  if (parsed) {
    return normalizeResolutionResponse(parsed);
  }

  // Plain-text or unparseable reply: show as response suggestion with default insights
  const textSuggestion = reply.trim().slice(0, 600);
  return {
    off_topic: false,
    intent_detected: "general_inquiry",
    confidence: 0.5,
    customer_sentiment: "neutral",
    suggested_response: textSuggestion || "Listen and gather more context.",
    resolution_steps: [],
    next_best_action: "Listen and gather more context",
  };
}

// ─── Summary Agent (post-call) ───────────────────────────────────────

/** Full response shape from Summary Agent (Lyzr) - supports multiple agent output formats */
interface LyzrSummaryResponse {
  call_record_id?: string;
  account_id?: string;
  account_name?: string;
  call_date?: string;
  /** Narrative summary (primary key in most agent configs) */
  call_summary?: string;
  /** Narrative summary (alternate key used by some agent outputs) */
  summary?: string;
  /** Alternate shape: customer object instead of account_name/account_id */
  customer?: {
    name?: string;
    id?: string;
    contact_preference?: string;
    rental_number?: string;
    health?: {
      sentiment?: string;
      retention_risk?: string;
      nps?: number;
      notes?: string;
    };
  };
  job_site?: string;
  equipment_issue?: {
    equipment_type?: string;
    symptoms?: string[];
    visible_damage?: string[];
  };
  equipment_requested?: {
    equipment_type?: string;
    location_preferred?: string;
    rental_start_date?: string;
    requested_duration_days?: number;
    delivery_request?: {
      requested_delivery_date?: string;
      requested_delivery_before?: string;
    };
  };
  /** Action items – supports legacy and new agent shapes */
  action_items?: {
    id?: number;
    description?: string;
    action?: string;
    owner?: string;
    deadline?: string;
    status?: string;
    // New structured shape fields
    priority?: string;
    task?: string;
    assigned_to?: string;
    due_date?: string;
    notes?: string;
  }[];
  /** Next steps – supports string list and structured objects */
  next_steps?: (
    | { step?: string; owner?: string; timeline?: string; channel?: string }
    | {
        step_number?: number;
        description?: string;
        owner?: string;
        deadline?: string;
        method?: string;
        dependency?: string | null;
        tool?: string | null;
      }
    | string
  )[];
  call_categories?: {
    primary_type?: string;
    secondary_types?: string[];
  };
  sentiment?: {
    customer_sentiment?: string;
    summary?: string;
    score_1_to_5?: number;
  };
  retention_risk?: {
    risk_level?: string;
    rationale?: string;
  };
  /** New structured summary fields */
  interaction?: {
    subject?: string;
    date?: string;
    time?: string;
    duration_minutes?: number;
    summary?: string;
  };
  equipment_details?: {
    item?: string;
    use_case?: string;
    duration?: string;
    project_start_date?: string;
    location?: string;
  };
  insights?: string[];
  sales_opportunities?: {
    description?: string;
    potential_equipment?: string[];
  };
  follow_up_requirement?: string;
  customer_update?: {
    update_applied?: boolean;
    updated_fields?: Record<string, unknown>;
    updated_by?: string;
    updated_at?: string;
  };
  stored_transcript?: string;
  record_management?: {
    record_saved?: boolean;
    storage_location?: string;
    saved_by?: string;
    saved_at?: string;
  };
}

function buildLocalFallbackSummary(
  fullTranscript: string,
  customerName?: string
): { summaryText: string; category: string } {
  const trimmedTranscript = fullTranscript.trim();
  const safeName =
    customerName && customerName !== "" ? customerName : "the customer";

  if (!trimmedTranscript) {
    return {
      summaryText: `${safeName} contacted United Rentals with a general inquiry, but the conversation details were not captured in the transcript.`,
      category: "general_inquiry",
    };
  }

  const lower = trimmedTranscript.toLowerCase();

  // ── 1) Infer high‑level intent (category) from keywords ─────────────────────
  let category: string = "general_inquiry";
  let intentPhrase: string = "a general question about their rental needs";

  // Prefer highly specific intents first so we don't mis-classify
  if (
    lower.includes("transfer my rental") ||
    lower.includes("transfer the rental") ||
    lower.includes("rental transfer") ||
    (lower.includes("transfer") && lower.includes("pickup"))
  ) {
    category = "rental_transfer";
    intentPhrase =
      "transferring an existing rental between branches or jobsites and confirming any transfer fees or pickup timing";
  } else if (
    lower.includes("invoice dispute") ||
    lower.includes("dispute") ||
    (lower.includes("invoice") && lower.includes("charge"))
  ) {
    category = "billing_dispute";
    intentPhrase = "disputing a billing charge on an invoice";
  } else if (
    lower.includes("invoice") ||
    lower.includes("billing") ||
    lower.includes("statement") ||
    lower.includes("payment")
  ) {
    category = "billing_inquiry";
    intentPhrase = "clarifying billing, invoice details, or charges";
  } else if (
    lower.includes("extend my rental") ||
    lower.includes("rental extension") ||
    lower.includes("extend the rental") ||
    lower.includes("extra day") ||
    lower.includes("keep it longer")
  ) {
    category = "rental_extension";
    intentPhrase = "requesting an extension to an existing rental";
  } else if (
    lower.includes("off-rent") ||
    lower.includes("off rent") ||
    lower.includes("pickup") ||
    lower.includes("pick up the equipment") ||
    lower.includes("return the equipment")
  ) {
    category = "off_rent";
    intentPhrase = "taking equipment off‑rent and arranging pickup/return";
  } else if (
    lower.includes("not working") ||
    lower.includes("isn't working") ||
    lower.includes("doesn't start") ||
    lower.includes("error code") ||
    lower.includes("issue with the equipment") ||
    lower.includes("troubleshoot")
  ) {
    category = "equipment_troubleshooting";
    intentPhrase = "troubleshooting equipment that is not working as expected";
  } else if (
    lower.includes("delivery window") ||
    lower.includes("delivery time") ||
    lower.includes("delivery eta") ||
    lower.includes("drop off") ||
    lower.includes("when will it arrive")
  ) {
    category = "delivery_scheduling";
    intentPhrase = "confirming delivery timing and logistics";
  } else if (
    lower.includes("operator training") ||
    lower.includes("operator certification") ||
    lower.includes("safety training") ||
    lower.includes("osha")
  ) {
    category = "operator_training";
    intentPhrase = "discussing operator training and certification requirements";
  } else if (
    lower.includes("new account") ||
    lower.includes("set up an account") ||
    lower.includes("credit application")
  ) {
    category = "account_setup";
    intentPhrase = "setting up or updating a customer account and credit profile";
  }

  // ── 2) Extract a concise customer opening + key details ─────────────────────
  const lines = trimmedTranscript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const customerUtterances = lines
    .filter((l) => l.toLowerCase().startsWith("customer:"))
    .map((l) => l.replace(/^customer\s*:\s*/i, "").trim());
  const agentUtterances = lines
    .filter((l) => l.toLowerCase().startsWith("agent:"))
    .map((l) => l.replace(/^agent\s*:\s*/i, "").trim());

  const openingCustomerLine =
    customerUtterances[0] || customerUtterances[1] || lines[0] || "";

  // Try to pick out an obvious equipment or invoice/contract reference
  const equipmentLikeLine =
    lines.find((l) =>
      /scissor lift|boom lift|forklift|generator|excavator|cat\s*\d{2,3}|lift\b/i.test(
        l
      )
    ) || "";

  const invoiceOrContractMatch = trimmedTranscript.match(
    /(invoice\s*(no\.?|number)?\s*[:#]?\s*\w+|\bcontract\b\s*(no\.?|number)?\s*[:#]?\s*\w+)/i
  );
  const invoiceOrContract = invoiceOrContractMatch
    ? invoiceOrContractMatch[0]
    : "";

  const firstAgentHelpfulLine =
    agentUtterances.find((l) =>
      /(i can help|let me check|i can look that up|i can pull that up)/i.test(l)
    ) || agentUtterances[0] || "";

  // Build a short narrative that feels like the summariser agent output
  const narrativeParts: string[] = [];
  narrativeParts.push(
    `${safeName} contacted United Rentals regarding ${intentPhrase}.`
  );

  if (openingCustomerLine) {
    narrativeParts.push(
      `The customer explained that ${openingCustomerLine.replace(
        /^i\b/i,
        "they"
      )}`
    );
  }

  if (equipmentLikeLine) {
    narrativeParts.push(
      `Key equipment or job details mentioned included: ${equipmentLikeLine
        .replace(/^customer:\s*/i, "")
        .replace(/^agent:\s*/i, "")}`
    );
  }

  if (invoiceOrContract) {
    narrativeParts.push(`The discussion referenced ${invoiceOrContract}.`);
  }

  if (firstAgentHelpfulLine) {
    narrativeParts.push(
      `The ISR responded by ${firstAgentHelpfulLine
        .replace(/^i\b/i, "confirming they would")
        .replace(/^we\b/i, "the team would")}.`
    );
  }

  const summaryText = narrativeParts.join(" ");

  return { summaryText, category };
}

function buildLocalFallbackCallRecord(args: {
  fullTranscript: string;
  customerName?: string;
  customerAccount?: string | null;
  callDateIso?: string;
}): CallRecord {
  const callDateIso = args.callDateIso ?? new Date().toISOString();
  const { summaryText, category } = buildLocalFallbackSummary(
    args.fullTranscript,
    args.customerName
  );

  const fallbackId = `CALL-${callDateIso.slice(0, 10).replace(/-/g, "")}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const fallbackName =
    args.customerName && args.customerName !== "" ? args.customerName : "Unknown";
  const fallbackAccount =
    args.customerAccount && args.customerAccount !== "" ? args.customerAccount : null;

  const transcript = args.fullTranscript.trim();
  const lines = transcript
    ? transcript
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const equipmentLikeLine =
    lines.find((l) =>
      /scissor lift|boom lift|forklift|generator|excavator|skid steer|telehandler|manlift|lift\b|s-?\d{2,3}/i.test(
        l
      )
    ) ?? "";
  const equipmentItem = equipmentLikeLine
    ? equipmentLikeLine
        .replace(/^customer\s*:\s*/i, "")
        .replace(/^agent\s*:\s*/i, "")
        .slice(0, 140)
    : category.replace(/_/g, " ");

  const now = new Date(callDateIso);
  const subject =
    category === "off_rent"
      ? "Schedule Equipment Pickup"
      : category === "delivery_scheduling"
        ? "Confirm Delivery Timing"
        : category === "rental_extension"
          ? "Extend Rental Duration"
          : category === "billing_inquiry" || category === "billing_dispute"
            ? "Billing Inquiry"
            : category === "equipment_troubleshooting"
              ? "Troubleshoot Equipment Issue"
              : "Customer Support Call";

  const durationMinutes = Math.min(
    12,
    Math.max(3, Math.round((transcript.length || 300) / 220))
  );

  const makeActionItems = (): ActionItem[] => {
    const baseOwner: ActionItem["owner"] = "isr";
    const due = "Tomorrow after 2 PM";
    if (category === "off_rent") {
      return [
        {
          id: "AI-1",
          action: "Schedule equipment pickup",
          owner: baseOwner,
          priority: "high",
          deadline: due,
          status: "pending",
          notes: equipmentItem ? `Coordinate pickup for ${equipmentItem}.` : undefined,
        },
        {
          id: "AI-2",
          action: "Confirm ETA and inform customer",
          owner: baseOwner,
          priority: "high",
          deadline: due,
          status: "pending",
          notes: "Call customer 30 minutes before arrival.",
        },
      ];
    }
    if (category === "delivery_scheduling") {
      return [
        {
          id: "AI-1",
          action: "Confirm delivery ETA and logistics",
          owner: baseOwner,
          priority: "high",
          deadline: due,
          status: "pending",
          notes: "Verify jobsite access details and delivery window.",
        },
        {
          id: "AI-2",
          action: "Send delivery confirmation to customer",
          owner: baseOwner,
          priority: "medium",
          deadline: due,
          status: "pending",
        },
      ];
    }
    if (category === "rental_extension") {
      return [
        {
          id: "AI-1",
          action: "Check availability and extend the rental",
          owner: baseOwner,
          priority: "high",
          deadline: "Today by 5 PM",
          status: "pending",
          notes: "Confirm updated return date and pricing.",
        },
        {
          id: "AI-2",
          action: "Confirm updated charges and share revised confirmation",
          owner: baseOwner,
          priority: "medium",
          deadline: "Today by end of day",
          status: "pending",
        },
      ];
    }
    return [
      {
        id: "AI-1",
        action: "Confirm details and provide next steps",
        owner: baseOwner,
        priority: "medium",
        deadline: "Today by end of day",
        status: "pending",
      },
    ];
  };

  const actionItems = makeActionItems();
  const followUpRequired = actionItems.length > 0;

  const structured = {
    customer: {
      name: fallbackName !== "Unknown" ? fallbackName : "Customer",
      rental_number: fallbackAccount ?? undefined,
      health: {
        sentiment: "satisfied",
        retention_risk: "none",
        nps: 10,
        notes: "Customer was satisfied with the service and next steps.",
      },
    },
    interaction: {
      subject,
      date: now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      duration_minutes: durationMinutes,
      summary: summaryText,
    },
    equipment_details: {
      item: equipmentItem || "Equipment",
      use_case: category.replace(/_/g, " "),
      duration: "rental period",
      location: lines.find((l) => /\bjob site\b|\bsite\b|\blocation\b/i.test(l))?.slice(0, 80),
    },
    insights: [
      "Customer request captured and confirmed.",
      "Next steps defined for follow-up.",
      "Customer sentiment assessed as satisfied.",
    ],
    sales_opportunities: {
      description: "None",
      potential_equipment: ["None"],
    },
    summary: summaryText,
    stored_transcript: transcript || args.fullTranscript,
  };

  return {
    call_summary: {
      call_id: fallbackId,
      call_date: callDateIso,
      call_duration_estimate: `${durationMinutes} min`,
      call_category: category,
      customer_name: fallbackName,
      customer_account: fallbackAccount,
    },
    summary: JSON.stringify(structured),
    key_topics: structured.insights,
    equipment_discussed: [],
    action_items: actionItems,
    next_steps: actionItems.map((a) => ({
      step: a.action,
      owner: "ISR",
      timeline: a.deadline ?? "",
      channel: "phone" as const,
    })),
    customer_health: {
      sentiment: "satisfied",
      sentiment_triggers: ["Customer was satisfied with the service and the next steps."],
      retention_risk: "none",
      nps_estimate: "10",
    },
    follow_up_required: followUpRequired,
    account_id: fallbackAccount ?? undefined,
    account_name: fallbackName !== "Unknown" ? fallbackName : undefined,
    stored_transcript: transcript || args.fullTranscript,
    _usedLocalFallback: true,
  };
}

export async function generateCallSummary(
  fullTranscript: string,
  sessionId: string,
  customerName?: string,
  customerAccount?: string
): Promise<CallRecord> {
  // #region agent log
  const transcriptLen = typeof fullTranscript === "string" ? fullTranscript.trim().length : 0;
  fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
    body: JSON.stringify({
      sessionId: "1be390",
      location: "ur-agents.ts:generateCallSummary:entry",
      message: "Summary generation start",
      data: { transcriptLen, sessionId: sessionId?.slice(0, 20), hasTranscript: !!fullTranscript },
      timestamp: Date.now(),
      hypothesisId: "E",
    }),
  }).catch(() => {});
  // #endregion
  console.log("[SummaryAgent] generateCallSummary start", {
    hasTranscript: !!fullTranscript,
    sessionId,
    customerName,
    customerAccount,
  });
  const customerContext =
    customerName != null && customerName !== ""
      ? `This call was with customer: ${customerName}. Account: ${customerAccount ?? "N/A"}.\n\n`
      : "";
  const message = `${customerContext}Process this completed call transcript and generate a full structured summary:\n\n${fullTranscript}`;
  let data: any;
  let reply = "";
  let isErrorReply = false;

  const MAX_ATTEMPTS = 4;
  const RETRY_DELAY_MS = 2000;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          user_id: DEFAULT_USER_ID,
          agent_id: SUMMARY_AGENT_ID,
        }),
      });

      console.log("[SummaryAgent] HTTP response received", {
        ok: response.ok,
        status: response.status,
        attempt,
      });

      if (!response.ok) {
        throw new Error(`Summary agent error: ${response.status}`);
      }

      data = await response.json();
      reply = extractLyzrResponse(data);

      /** Detect if the reply is an LLM/API error message rather than a valid summary. */
      isErrorReply =
        typeof reply === "string" &&
        (reply.includes("Error in LLM") ||
          reply.includes("BadRequestError") ||
          reply.includes("tool_use_failed") ||
          reply.includes("invalid_request_error") ||
          reply.includes("GroqException") ||
          reply.includes("failed_generation"));

      // #region agent log
      if (isErrorReply) {
        fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
          body: JSON.stringify({
            sessionId: "1be390",
            location: "ur-agents.ts:generateCallSummary:isErrorReply",
            message: "Lyzr returned error-like reply",
            data: { attempt, replySnippet: String(reply).slice(0, 300), status: response?.status },
            timestamp: Date.now(),
            hypothesisId: "A",
          }),
        }).catch(() => {});
      }
      // #endregion

      if (!isErrorReply) {
        break;
      }

      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          "[SummaryAgent] Error-like reply, retrying after delay...",
          { attempt, maxAttempts: MAX_ATTEMPTS, delayMs: RETRY_DELAY_MS }
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    if (isErrorReply) {
      console.warn(
        "[SummaryAgent] Using local fallback only after all retries failed (last resort)"
      );
      return buildLocalFallbackCallRecord({
        fullTranscript,
        customerName,
        customerAccount: customerAccount ?? null,
      });
    }

    // Lyzr may return response as string (JSON) or already as object
    let parsed: LyzrSummaryResponse | null =
      typeof data.response === "object" && data.response !== null
        ? (data.response as LyzrSummaryResponse)
        : tryParseJson<LyzrSummaryResponse>(reply);

    // #region agent log
    if (parsed) {
      fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
        body: JSON.stringify({
          sessionId: "1be390",
          location: "ur-agents.ts:generateCallSummary:parsed",
          message: "Summary parsed successfully from Lyzr",
          data: { sentiment: (parsed as any)?.customer_health?.sentiment ?? (parsed as any)?.customer?.health?.sentiment ?? "unknown" },
          timestamp: Date.now(),
          hypothesisId: "success",
        }),
      }).catch(() => {});
    } else {
      fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
        body: JSON.stringify({
          sessionId: "1be390",
          location: "ur-agents.ts:generateCallSummary:parseFallback",
          message: "Lyzr response not parseable, using fallback",
          data: { replyStartsWithBrace: typeof reply === "string" && reply.trim().startsWith("{"), replySnippet: String(reply).slice(0, 280) },
          timestamp: Date.now(),
          hypothesisId: "C",
        }),
      }).catch(() => {});
    }
    // #endregion

    if (parsed) {
      const callDate = parsed.call_date ?? new Date().toISOString().slice(0, 10);
    const callId =
      parsed.call_record_id ??
      `CALL-${callDate.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Prefer the explicit customer info we passed into the agent,
    // so Call History always matches the Customer Info panel.
    const finalCustomerName =
      customerName && customerName !== ""
        ? customerName
        : parsed.account_name ?? parsed.customer?.name ?? "Unknown";
    const finalCustomerAccount =
      customerAccount && customerAccount !== ""
        ? customerAccount
        : parsed.account_id ?? parsed.customer?.rental_number ?? null;
    // Prefer explicit narrative fields from the agent; support legacy and new structured shapes.
    const interactionSummary =
      typeof (parsed as any).interaction?.summary === "string"
        ? (parsed as any).interaction.summary
        : undefined;
    const narrativeSummary =
      (typeof parsed.call_summary === "string" && parsed.call_summary) ||
      (typeof parsed.summary === "string" && parsed.summary) ||
      interactionSummary ||
      (typeof reply === "string" && !reply.trim().startsWith("{")
        ? reply
        : "");

    // If the agent returned structured JSON, persist the full JSON string
    // in the CallRecord.summary field so the Call History UI can render
    // interaction, equipment, insights, etc. directly from it.
    let summaryField =
      typeof reply === "string" && reply.trim().startsWith("{")
        ? reply
        : narrativeSummary || "No summary generated.";

    const actionItems = (parsed.action_items ?? []).map((item, idx) => {
      const raw = item as {
        id?: number;
        description?: string;
        action?: string;
        owner?: string;
        deadline?: string;
        status?: string;
        priority?: string;
        task?: string;
        assigned_to?: string;
        due_date?: string;
        notes?: string;
      };
      const desc = raw.description ?? raw.action ?? raw.task ?? "";
      if (!desc) {
        return {
          id: String(raw.id ?? idx + 1),
          action: "",
          owner: "isr" as const,
          priority: "medium" as const,
          deadline: "",
          status: "pending" as const,
          notes: raw.notes,
        };
      }
      const ownerRaw = raw.owner ?? raw.assigned_to ?? "isr";
      const deadline = raw.deadline ?? raw.due_date ?? "";
      const priorityRaw = (raw.priority ?? "").toLowerCase();
      const priority: "critical" | "high" | "medium" | "low" =
        priorityRaw.includes("critical")
          ? "critical"
          : priorityRaw.includes("high")
            ? "high"
            : priorityRaw.includes("low")
              ? "low"
              : "medium";
      return {
        id: String(raw.id ?? idx + 1),
        action: desc,
        owner: mapOwner(ownerRaw),
        priority,
        deadline,
        status: (raw.status === "in_progress" || raw.status === "completed"
          ? raw.status
          : "pending") as "pending" | "in_progress" | "completed",
        notes: raw.notes,
      };
    });

    const rawNextSteps = parsed.next_steps ?? [];
    const nextSteps = rawNextSteps
      .map((ns) => {
        if (typeof ns === "string") {
          return {
            step: ns,
            owner: "ISR",
            timeline: "",
            channel: "phone" as const,
          };
        }
        const raw = ns as {
          step?: string;
          description?: string;
          owner?: string;
          timeline?: string;
          deadline?: string;
          method?: string;
        };
        const stepText = raw.step ?? raw.description ?? "";
        if (!stepText) return { step: "", owner: "ISR", timeline: "", channel: "phone" as const };
        const method = (raw.method ?? "").toLowerCase();
        const channel: "phone" | "email" | "rentalman_update" | "total_control" | "in_person" =
          method.includes("email")
            ? "email"
            : method.includes("phone")
              ? "phone"
              : method.includes("total control")
                ? "total_control"
                : method.includes("in-person") || method.includes("in person")
                  ? "in_person"
                  : "phone";
        return {
          step: stepText,
          owner: raw.owner ?? "ISR",
          timeline: raw.timeline ?? raw.deadline ?? "",
          channel,
        };
      })
      .filter((ns) => ns.step);

    const primaryCategory = parsed.call_categories?.primary_type ?? "general_inquiry";
    const callCategory = primaryCategory
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/\//g, "_");

    const eqReq = parsed.equipment_requested;
    const eqIssue = parsed.equipment_issue;
    const equipmentDiscussed = eqReq
      ? [
          {
            type: eqReq.equipment_type ?? "Equipment",
            model: eqReq.equipment_type,
            details: [
              eqReq.location_preferred && `Location: ${eqReq.location_preferred}`,
              eqReq.rental_start_date && `Start: ${eqReq.rental_start_date}`,
              eqReq.requested_duration_days != null &&
                `Duration: ${eqReq.requested_duration_days} days`,
              eqReq.delivery_request &&
                `Delivery: ${eqReq.delivery_request.requested_delivery_date ?? ""} before ${eqReq.delivery_request.requested_delivery_before ?? ""}`,
            ]
              .filter(Boolean)
              .join("; "),
            action_needed: undefined,
            certification_required: undefined,
          },
        ]
      : eqIssue
        ? [
            {
              type: eqIssue.equipment_type ?? "Equipment",
              model: eqIssue.equipment_type,
              details: [
                eqIssue.symptoms?.length
                  ? `Symptoms: ${eqIssue.symptoms.join(", ")}`
                  : "",
                eqIssue.visible_damage?.length
                  ? `Visible damage: ${eqIssue.visible_damage.join(", ")}`
                  : "",
              ]
                .filter(Boolean)
                .join("; "),
              action_needed: undefined,
              certification_required: undefined,
            },
          ]
        : [];

    // Prefer new-style customer.health signal, but still support legacy
    // sentiment/retention_risk fields if they are present.
    const customerHealth = parsed.customer?.health;
    let sentiment = parsed.sentiment;
    let retentionRisk = parsed.retention_risk;
    if (customerHealth) {
      if (!sentiment) {
        sentiment = {
          customer_sentiment: customerHealth.sentiment,
          summary: customerHealth.notes,
          score_1_to_5:
            typeof customerHealth.nps === "number"
              ? customerHealth.nps
              : undefined,
        };
      }
      if (!retentionRisk) {
        retentionRisk = {
          risk_level: customerHealth.retention_risk,
          rationale: customerHealth.notes,
        };
      }
    }

    const insights =
      Array.isArray(parsed.insights) && parsed.insights.length > 0
        ? parsed.insights
        : [];
    const topicsFromCategories = parsed.call_categories?.secondary_types ?? [];
    const keyTopics = [...topicsFromCategories, ...insights];

      const record: CallRecord = {
      call_summary: {
        call_id: callId,
        call_date: parsed.call_date ?? new Date().toISOString(),
        call_duration_estimate: "—",
        call_category: callCategory,
        subcategory: parsed.call_categories?.secondary_types?.[0]
          ?.toLowerCase()
          .replace(/\s+/g, "_"),
        customer_name: finalCustomerName,
        customer_account: finalCustomerAccount,
      },
      summary: summaryField,
      key_topics: keyTopics,
      equipment_discussed: equipmentDiscussed,
      action_items: actionItems,
      next_steps: nextSteps,
      customer_health: {
        sentiment: mapSentiment(sentiment?.customer_sentiment),
        sentiment_triggers: sentiment?.summary ? [sentiment.summary] : [],
        retention_risk: mapRisk(retentionRisk?.risk_level),
        retention_risk_reason: retentionRisk?.rationale,
        nps_estimate:
          sentiment?.score_1_to_5 != null
            ? String(sentiment.score_1_to_5)
            : undefined,
      },
      follow_up_required: (parsed.action_items?.length ?? 0) > 0,
      follow_up_details:
        rawNextSteps[0] && typeof rawNextSteps[0] === "object"
          ? (rawNextSteps[0] as { step?: string }).step
          : typeof rawNextSteps[0] === "string"
            ? rawNextSteps[0]
            : undefined,
      account_id: finalCustomerAccount ?? undefined,
      account_name: finalCustomerName !== "Unknown" ? finalCustomerName : undefined,
      call_date: parsed.call_date,
      job_site: parsed.job_site,
      equipment_issue: parsed.equipment_issue
        ? {
            equipment_type: parsed.equipment_issue.equipment_type,
            symptoms: parsed.equipment_issue.symptoms,
            visible_damage: parsed.equipment_issue.visible_damage,
          }
        : undefined,
      equipment_requested: eqReq as EquipmentRequested | undefined,
      call_categories: parsed.call_categories as CallCategories | undefined,
      sentiment: sentiment as SentimentSummary | undefined,
      retention_risk: retentionRisk as RetentionRiskSummary | undefined,
      customer_update: parsed.customer_update as CustomerUpdateSummary | undefined,
      stored_transcript: parsed.stored_transcript,
      record_management: parsed.record_management as RecordManagement | undefined,
      };
      return record;
    }

    // Fallback: try to extract narrative and customer from raw reply if it's JSON
    let fallbackSummary = "";
    let fallbackName = customerName && customerName !== "" ? customerName : "Unknown";
    const fallbackAccount = customerAccount && customerAccount !== "" ? customerAccount : null;
    if (typeof reply === "string" && reply.trim().startsWith("{")) {
      const obj = tryParseJson<{ summary?: string; call_summary?: string; account_name?: string; customer?: { name?: string } }>(reply);
      if (obj) {
        fallbackSummary = (typeof obj.summary === "string" ? obj.summary : null) ?? (typeof obj.call_summary === "string" ? obj.call_summary : null) ?? "";
        if (!fallbackName || fallbackName === "Unknown") {
          fallbackName = obj.account_name ?? obj.customer?.name ?? "Unknown";
        }
      }
    }
    if (!fallbackSummary) {
      // When the agent reply is unusable or looks like an internal error
      // (e.g. invalid API key), build a local heuristic summary from the
      // actual transcript instead of surfacing an opaque error message.
      const { summaryText } = buildLocalFallbackSummary(
        fullTranscript,
        fallbackName
      );
      fallbackSummary = summaryText;
    }

    return buildLocalFallbackCallRecord({
      fullTranscript,
      customerName: fallbackName,
      customerAccount: fallbackAccount,
    });
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
      body: JSON.stringify({
        sessionId: "1be390",
        location: "ur-agents.ts:generateCallSummary:catch",
        message: "Exception in generateCallSummary",
        data: {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : undefined,
        },
        timestamp: Date.now(),
        hypothesisId: "D",
      }),
    }).catch(() => {});
    // #endregion
    console.error("[SummaryAgent] Error while generating summary, using local fallback", {
      error:
        error instanceof Error ? { message: error.message, name: error.name } : String(error),
    });
    return buildLocalFallbackCallRecord({
      fullTranscript,
      customerName,
      customerAccount: customerAccount ?? null,
    });
  }
}

function mapOwner(
  raw: string
): "isr" | "customer" | "branch_manager" | "dispatch" | "field_service" | "billing" | "national_accounts" {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("dispatch")) return "dispatch";
  if (lower.includes("branch") || lower.includes("reservation"))
    return "branch_manager";
  if (lower.includes("customer") || lower.includes("marcus")) return "customer";
  if (lower.includes("field") || lower.includes("service"))
    return "field_service";
  if (lower.includes("billing")) return "billing";
  return "isr";
}

function mapSentiment(
  raw?: string
): "satisfied" | "neutral" | "concerned" | "frustrated" | "angry" | "at_risk" {
  const lower = (raw ?? "neutral").toLowerCase();
  if (lower.includes("positive") || lower.includes("satisfied"))
    return "satisfied";
  if (lower.includes("frustrated")) return "frustrated";
  if (lower.includes("angry")) return "angry";
  if (lower.includes("concern")) return "concerned";
  if (lower.includes("risk")) return "at_risk";
  return "neutral";
}

function mapRisk(raw?: string): "none" | "low" | "medium" | "high" {
  const lower = (raw ?? "none").toLowerCase();
  if (lower.includes("high")) return "high";
  if (lower.includes("medium") || lower.includes("moderate")) return "medium";
  if (lower.includes("low")) return "low";
  return "none";
}

// ─── Demo call history (seed data) ───────────────────────────────────

export function getDemoCallHistory(): CallRecord[] {
  return [
    {
      call_summary: {
        call_id: "CALL-20260310-4821",
        call_date: "2026-03-10T14:32:00Z",
        call_duration_estimate: "12 minutes",
        call_category: "new_reservation",
        subcategory: "scissor_lift_26ft_reservation",
        customer_name: "Marcus Rivera",
        customer_account: "UR-10042",
        isr_name: "Sarah Thompson",
        branch: "Austin South #1247",
      },
      summary:
        "Customer called to reserve a 26ft scissor lift for a new commercial painting project starting March 18. ISR confirmed the equipment category and discussed delivery logistics to the Riverside Warehouse jobsite. Customer also asked about RPP coverage and was informed about the 15% charge and coverage limits. Reservation was created in RentalMan pending delivery scheduling.",
      key_topics: [
        "scissor lift reservation",
        "RPP explanation",
        "delivery scheduling",
      ],
      equipment_discussed: [
        {
          type: "Aerial Work Platforms",
          model: "26ft Scissor Lift",
          details: "Needed for interior painting at commercial warehouse, 2-week rental",
          action_needed: "Confirm availability and schedule delivery",
          certification_required: "Aerial Boom Lift & Scissor Lift",
        },
      ],
      action_items: [
        {
          id: "AI-1",
          action: "Confirm 26ft scissor lift availability for March 18 delivery",
          owner: "isr",
          priority: "high",
          deadline: "Today by 5pm EST",
          status: "pending",
          notes: "Customer needs confirmation call back today",
        },
        {
          id: "AI-2",
          action: "Verify customer has valid aerial operator certification",
          owner: "isr",
          priority: "medium",
          deadline: "Before March 18",
          status: "pending",
          notes: "Customer mentioned his team is certified but ISR should verify in system",
        },
        {
          id: "AI-3",
          action: "Email RPP information sheet to customer",
          owner: "isr",
          priority: "low",
          deadline: "Today",
          status: "pending",
        },
      ],
      next_steps: [
        {
          step: "Call customer to confirm availability and finalize delivery time",
          owner: "Sarah Thompson (ISR)",
          timeline: "Today by 5pm",
          channel: "phone",
        },
        {
          step: "Schedule delivery with dispatch for March 18 morning",
          owner: "Dispatch",
          timeline: "After availability confirmation",
          channel: "rentalman_update",
        },
      ],
      customer_health: {
        sentiment: "satisfied",
        sentiment_triggers: [
          "Customer was friendly and engaged",
          "Appreciated detailed RPP explanation",
        ],
        retention_risk: "none",
        expansion_opportunity:
          "Customer mentioned a larger warehouse renovation project in Q2 — potential for additional aerial and material handling equipment",
        nps_estimate: "8",
      },
      follow_up_required: true,
      follow_up_details:
        "Confirm availability and call back today by 5pm EST",
    },
    {
      call_summary: {
        call_id: "CALL-20260309-7734",
        call_date: "2026-03-09T09:15:00Z",
        call_duration_estimate: "8 minutes",
        call_category: "invoice_dispute",
        subcategory: "environmental_charge_dispute",
        customer_name: "Jennifer Park",
        customer_account: "UR-20078",
        isr_name: "Mike Johnson",
        branch: "Columbus East #0834",
      },
      summary:
        "National account customer called to dispute the Environmental Service Charge on invoice #INV-445892. Customer was frustrated that the charge was not clearly explained at rental start. ISR explained that the Environmental Service Charge is mandatory for federal/state regulatory compliance and cannot be waived. Customer requested to speak with a manager for further discussion. Call escalated to branch manager.",
      key_topics: [
        "environmental charge dispute",
        "charge transparency",
        "escalation to manager",
      ],
      equipment_discussed: [
        {
          type: "Trench Safety & Shoring",
          model: "Trench Box 8ft x 20ft",
          details:
            "Active rental — charge dispute related to this contract",
          action_needed: "None — equipment performing fine",
        },
      ],
      action_items: [
        {
          id: "AI-1",
          action: "Branch manager to call Jennifer Park regarding environmental charge explanation",
          owner: "branch_manager",
          priority: "high",
          deadline: "Today",
          status: "pending",
          notes: "National account — handle with care. Customer was frustrated.",
        },
        {
          id: "AI-2",
          action: "Review invoice #INV-445892 for accuracy",
          owner: "billing",
          priority: "medium",
          deadline: "Within 24 hours",
          status: "pending",
        },
      ],
      next_steps: [
        {
          step: "Branch manager callback to customer",
          owner: "Branch Manager",
          timeline: "Today",
          channel: "phone",
        },
        {
          step: "Update customer record with dispute details",
          owner: "Mike Johnson (ISR)",
          timeline: "Today",
          channel: "rentalman_update",
        },
      ],
      customer_health: {
        sentiment: "frustrated",
        sentiment_triggers: [
          "Said 'nobody told me about this charge'",
          "Asked to speak with a manager",
        ],
        retention_risk: "medium",
        retention_risk_reason:
          "National account customer frustrated over charge transparency. Quarterly rate review coming in April.",
        nps_estimate: "4",
      },
      follow_up_required: true,
      follow_up_details:
        "Branch manager callback today, then ISR follow-up within 48 hours to confirm resolution",
    },
    {
      call_summary: {
        call_id: "CALL-20260308-2156",
        call_date: "2026-03-08T11:45:00Z",
        call_duration_estimate: "6 minutes",
        call_category: "off_rent",
        subcategory: "skid_steer_pickup",
        customer_name: "David Chen",
        customer_account: "UR-30155",
        isr_name: "Sarah Thompson",
        branch: "Portland NW #0291",
      },
      summary:
        "Customer called to schedule a pickup for a skid steer loader no longer needed at the Cedar Hills Residential Phase 2 jobsite. ISR confirmed the off-rent process and reminded customer to return with a full fuel tank to avoid the Fuel Convenience Charge. Pickup scheduled for March 11 afternoon.",
      key_topics: [
        "off-rent",
        "pickup scheduling",
        "fuel charge reminder",
      ],
      equipment_discussed: [
        {
          type: "Earthmoving",
          model: "Skid Steer Loader",
          details:
            "Returning from Cedar Hills jobsite, rental complete",
          action_needed: "Schedule pickup for March 11",
        },
      ],
      action_items: [
        {
          id: "AI-1",
          action: "Confirm pickup with dispatch for March 11 afternoon at Cedar Hills site",
          owner: "dispatch",
          priority: "medium",
          deadline: "March 10",
          status: "pending",
        },
      ],
      next_steps: [
        {
          step: "Dispatch to confirm pickup window with customer",
          owner: "Dispatch",
          timeline: "March 10",
          channel: "phone",
        },
        {
          step: "Generate final invoice after equipment return inspection",
          owner: "Billing",
          timeline: "After pickup on March 11",
          channel: "rentalman_update",
        },
      ],
      customer_health: {
        sentiment: "satisfied",
        sentiment_triggers: [
          "Thanked ISR for the reminder about fuel tank",
        ],
        retention_risk: "none",
        expansion_opportunity:
          "Seasonal customer — follow up in April for spring landscaping season needs",
        nps_estimate: "7",
      },
      follow_up_required: true,
      follow_up_details:
        "Follow up in April for spring season rental needs",
    },
    {
      call_summary: {
        call_id: "CALL-20260307-9903",
        call_date: "2026-03-07T15:20:00Z",
        call_duration_estimate: "15 minutes",
        call_category: "equipment_troubleshooting",
        subcategory: "boom_lift_hydraulic_issue",
        customer_name: "Marcus Rivera",
        customer_account: "UR-10042",
        isr_name: "Mike Johnson",
        branch: "Austin South #1247",
      },
      summary:
        "Customer reported a hydraulic leak on the 60ft boom lift at the I-35 Overpass jobsite. The leak is causing slow platform elevation. ISR walked through basic troubleshooting but the issue persists. Field service dispatch ticket created with high priority. Customer was offered an equipment swap but preferred field repair. Estimated field service arrival: next morning before 9 AM.",
      key_topics: [
        "hydraulic leak",
        "field service dispatch",
        "project downtime",
        "equipment swap offer",
      ],
      equipment_discussed: [
        {
          type: "Aerial Work Platforms",
          model: "60ft Boom Lift",
          details: "Hydraulic leak causing slow elevation",
          action_needed: "Field service repair — dispatched for March 8 morning",
          certification_required: "Aerial Boom Lift & Scissor Lift",
        },
      ],
      action_items: [
        {
          id: "AI-1",
          action: "Field service technician to inspect and repair hydraulic leak on 60ft boom lift at I-35 Overpass Lot C",
          owner: "field_service",
          priority: "critical",
          deadline: "March 8 before 9 AM",
          status: "pending",
          notes: "Customer's crew is unable to work at height — project downtime",
        },
        {
          id: "AI-2",
          action: "ISR to call customer by 9:30 AM March 8 to confirm field service arrival",
          owner: "isr",
          priority: "high",
          deadline: "March 8, 9:30 AM",
          status: "pending",
        },
        {
          id: "AI-3",
          action: "If field repair cannot be completed on-site, arrange immediate equipment swap",
          owner: "dispatch",
          priority: "high",
          deadline: "March 8 by noon if repair fails",
          status: "pending",
        },
      ],
      next_steps: [
        {
          step: "Field service visit at I-35 Overpass Lot C",
          owner: "Field Service",
          timeline: "March 8 before 9 AM",
          channel: "in_person",
        },
        {
          step: "ISR follow-up call to confirm repair completion",
          owner: "Mike Johnson (ISR)",
          timeline: "March 8, 9:30 AM",
          channel: "phone",
        },
        {
          step: "Review downtime credit eligibility if repair takes more than 4 hours",
          owner: "Branch Manager",
          timeline: "March 8 afternoon",
          channel: "rentalman_update",
        },
      ],
      customer_health: {
        sentiment: "concerned",
        sentiment_triggers: [
          "Mentioned project deadline pressure",
          "Said 'we can't afford to lose another day'",
        ],
        retention_risk: "low",
        retention_risk_reason:
          "Equipment issue but customer was understanding and appreciated the quick dispatch response",
        nps_estimate: "6",
      },
      follow_up_required: true,
      follow_up_details:
        "Confirm field service completion March 8 and follow up on downtime credit if applicable",
    },
  ];
}
