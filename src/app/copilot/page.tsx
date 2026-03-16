"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic, ChevronRight, ChevronLeft } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { CallControls } from "@/components/copilot/CallControls";
import { TranscriptFeed } from "@/components/copilot/TranscriptFeed";
import { SuggestionsPanel } from "@/components/copilot/SuggestionsPanel";
import { CustomerInfoCard } from "@/components/copilot/CustomerInfoCard";
import { CustomerAssistChat } from "@/components/copilot/CustomerAssistChat";
import { recommendProductsFromTranscript } from "@/lib/product-recommendations";
import {
  buildFirstTimeCallerTranscript,
  buildFirstTimeCallerSuggestionState,
  NEW_CUSTOMER_NAME,
  NEW_CUSTOMER_LOCATION,
} from "@/mock/new-customer-scenario";
import {
  sendTranscriptForResolution,
  generateCallSummary,
  generateSessionId,
  getSpoofAgentReply,
  getAgentGreeting,
  getAgentOfferHelp,
  getAgentClosing,
  getAgentReplyForCustomerMessage,
} from "@/lib/ur-agents";
import { getCustomerInfoForPersona } from "@/mock/customer-personas";
import { cancelTTS } from "@/lib/tts";
import { useAgentSpeechCapture } from "@/hooks/useAgentSpeechCapture";
import type {
  TranscriptEntry,
  ResolutionSuggestion,
  CallRecord,
} from "@/types/call-records";

type AiCustomerInsights = {
  nextBestAction?: string;
  sentiment?: string;
  crossSellOpportunity?: string;
};

const MAX_TURNS = 5;

type CallMode = "standard" | "new_customer";

/** Fallback when spoof agent fails to return a closing customer line */
const FALLBACK_CUSTOMER_DECLINE = "No thank you.";

const SPOOF_PERSONAS = [
  { value: "happy_customer", label: "Happy customer" },
  { value: "angry_customer", label: "Angry customer" },
  { value: "confused_customer", label: "Confused customer" },
  { value: "neutral_customer", label: "Neutral customer" },
] as const;

const SPOOF_INTENTS = [
  { value: "new_reservation", label: "New reservation" },
  { value: "billing_inquiry", label: "Billing inquiry" },
  { value: "contract_inquiry", label: "Contract inquiry" },
  { value: "general_inquiry", label: "General inquiry" },
  { value: "invoice_dispute", label: "Invoice dispute" },
  { value: "equipment_troubleshooting", label: "Equipment troubleshooting" },
  { value: "off_rent", label: "Off-rent / pickup" },
  { value: "rental_extension", label: "Rental extension" },
  { value: "delivery_scheduling", label: "Delivery scheduling" },
  { value: "rpp_question", label: "RPP question" },
  { value: "account_setup", label: "Account setup" },
  { value: "operator_certification", label: "Operator certification" },
  { value: "equipment_swap", label: "Equipment swap" },
  { value: "total_control_support", label: "Total Control support" },
  { value: "branch_transfer", label: "Branch transfer" },
  { value: "competitor_mention", label: "Competitor mention" },
  { value: "multi_topic", label: "Multi-topic call" },
] as const;

/** Intent-specific opening instructions so the spoof customer says a different type of query each call (not always equipment/scissor lift). */
function getIntentOpeningInstruction(intentValue: string): string {
  const instructions: Record<string, string> = {
    new_reservation:
      "You are calling to RESERVE equipment for an upcoming job (e.g. forklift, scissor lift, or excavator for a future start date). Say you need to book or reserve equipment and mention the type and timeframe. Do NOT mention broken equipment or current rentals that are not working.",
    billing_inquiry:
      "You are calling about a BILL or INVOICE — e.g. an unexpected charge, a line item you don't understand, or a question about your last invoice. Mention an invoice number or charge type. Do NOT mention equipment breakdowns, scissor lifts that won't raise, or needing a technician.",
    contract_inquiry:
      "You are calling about your CONTRACT or rental agreement — e.g. terms, duration, or paperwork. Do NOT mention equipment failures or scissor lifts.",
    general_inquiry:
      "You are calling with a general question — e.g. hours, branch location, or how to place an order. Keep it broad. Do NOT mention a specific equipment problem like a scissor lift not raising.",
    invoice_dispute:
      "You are calling to DISPUTE a charge on your invoice — e.g. a cleaning fee, damage charge, or fuel charge you disagree with. Mention the invoice and the charge. Do NOT mention equipment not working or needing a technician.",
    equipment_troubleshooting:
      "You are calling because RENTED EQUIPMENT is NOT WORKING — e.g. a scissor lift won't raise, an excavator won't start, or similar. Describe the problem and ask for a technician or equipment swap. This is the ONLY intent where you should mention equipment malfunction.",
    off_rent:
      "You are calling to schedule PICKUP or OFF-RENT — you are done with the equipment and want to return it or have it picked up. Mention the equipment and when you need pickup. Do NOT say the equipment is broken.",
    rental_extension:
      "You are calling to EXTEND your current rental — you need the equipment longer and want to add days or weeks. Mention the equipment and how much longer you need. Do NOT mention the equipment is broken.",
    delivery_scheduling:
      "You are calling to schedule or change a DELIVERY — e.g. delivery time, address, or gate code for an upcoming or existing delivery. Do NOT mention equipment problems.",
    rpp_question:
      "You are calling to ask about RPP (Rental Protection Plan) — what it covers, cost, or whether you have it. Do NOT mention scissor lifts not working or equipment failures.",
    account_setup:
      "You are calling to SET UP a new account or get credit approval — first-time caller, need to know what documents or process. Do NOT mention equipment breakdowns.",
    operator_certification:
      "You are calling about OPERATOR CERTIFICATION or training — e.g. your crew needs to get certified for aerial or forklift. Do NOT mention equipment currently broken.",
    equipment_swap:
      "You are calling to SWAP or REPLACE equipment that is not working — you need a replacement unit sent out. Briefly state the problem and that you need a swap. Keep it distinct from a general troubleshooting question by focusing on 'need a replacement today.'",
    total_control_support:
      "You are calling about TOTAL CONTROL (portal/website) — e.g. can't log in, report not showing data, or need help with the online system. Do NOT mention physical equipment on a jobsite.",
    branch_transfer:
      "You are calling about moving equipment between BRANCHES or a different pickup/return location. Do NOT mention equipment not working.",
    competitor_mention:
      "You are calling and MENTIONING A COMPETITOR — e.g. Sunbelt gave you a quote and you want to compare or match. Do NOT mention equipment failures.",
    multi_topic:
      "You are calling with MULTIPLE topics — e.g. one question about an invoice and another about extending a rental. Combine two different topics in one opening. Do NOT lead with a scissor lift that won't raise.",
  };
  return (
    instructions[intentValue] ??
    `You are calling about ${intentValue.replace(/_/g, " ")}. State your reason clearly. Do NOT mention a scissor lift that won't raise unless this intent is specifically equipment troubleshooting.`
  );
}

function buildSpoofInitialMessage(
  personaDescription: string,
  intentDescription: string,
  intentValue: string,
  isrName: string,
  agentGreeting: string
): string {
  const isr = isrName.trim() || "Sarah";
  const openingInstruction = getIntentOpeningInstruction(intentValue);
  return `The ISR (agent) has just said: "${agentGreeting}"

You are ${personaDescription}, a United Rentals customer. For THIS call you must stick to ONE specific reason for calling.

REQUIRED — Your opening line must do the following (and nothing else):
${openingInstruction}

Reply with ONLY your first line as the customer: greet, state your name, and then state your reason for calling as specified above. No prefixes or labels. Do not mention equipment breakdowns or scissor lifts unless the required reason above is about equipment not working.`;
}

function buildSpoofContinuation(
  conversationBlurb: string,
  intentLabel?: string
): string {
  const topicReminder = intentLabel
    ? ` This call is about: ${intentLabel}. Stay on that topic only.\n\n`
    : "";
  return `Conversation so far:\n\n${conversationBlurb}\n\n${topicReminder}You are the customer. Reply with ONLY your next line (1-4 sentences). If you are satisfied with the resolution or wrapping up, end your reply with [CALL_END].`;
}

function buildClosingPrompt(
  conversationBlurb: string,
  agentOfferHelpLine: string
): string {
  return `${conversationBlurb}\n\nISR: ${agentOfferHelpLine}\n\nYou are the customer. Reply with ONLY a brief decline (e.g. "No thank you." or "That's all, thanks."). One short sentence. Do NOT include [CALL_END].`;
}

export default function CoPilotPage() {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<
    "idle" | "ringing" | "connecting" | "active" | "ended" | "summarizing"
  >("ringing");
  const [callDuration, setCallDuration] = useState(0);
  const [transcriptEntries, setTranscriptEntries] = useState<
    TranscriptEntry[]
  >([]);
  const [suggestion, setSuggestion] = useState<ResolutionSuggestion | null>(
    null
  );
  const [aiCustomerInsights, setAiCustomerInsights] =
    useState<AiCustomerInsights | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() =>
    generateSessionId("copilot")
  );
  const [selectedPersona, setSelectedPersona] =
    useState<string>("happy_customer");
  const [selectedIntent, setSelectedIntent] = useState<string>(
    SPOOF_INTENTS[0].value
  );
  const [summarySaved, setSummarySaved] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [rightPanelTab, setRightPanelTab] = useState<"chat" | "info">("chat");
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [isCustomerInfoAvailable, setIsCustomerInfoAvailable] =
    useState(false);
  const [currentCallRecord, setCurrentCallRecord] = useState<CallRecord | null>(
    null
  );
  const [currentCustomerName, setCurrentCustomerName] = useState<string | undefined>(undefined);
  const [currentCustomerAccount, setCurrentCustomerAccount] = useState<string | undefined>(undefined);
  const [hasCustomerSpoken, setHasCustomerSpoken] = useState(false);
  const [isTranscriptCollapsed, setIsTranscriptCollapsed] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryUsedFallback, setSummaryUsedFallback] = useState(false);
  const [summaryStorageNote, setSummaryStorageNote] = useState<string | null>(
    null
  );
  const [callMode, setCallMode] = useState<CallMode>("standard");
  const [newCustomerLocationReady, setNewCustomerLocationReady] =
    useState(false);

  const spoofLoopAbortedRef = useRef(false);
  const scriptedPlaybackAbortRef = useRef(false);
  const scriptedPlaybackRunIdRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  const spoofSessionIdRef = useRef("");
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  /** Customer name and account from Customer Info, captured when the call starts; used when saving to Call History */
  const callCustomerNameRef = useRef<string | undefined>(undefined);
  const callCustomerAccountRef = useRef<string | undefined>(undefined);
  // Separate indices used to cycle personas and intents so each call uses a
  // different combination in sequence instead of randomness.
  const personaCycleIndexRef = useRef<number>(-1);
  const intentCycleIndexRef = useRef<number>(-1);

  const agentSpeech = useAgentSpeechCapture();

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Restore persona/intent indices from sessionStorage so that even if the
  // user navigates away from /copilot and returns, the next call will use
  // the next persona/intent in the loop instead of restarting from the first.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPersonaIndex = window.sessionStorage.getItem(
      "ur_spoof_persona_index"
    );
    const storedIntentIndex = window.sessionStorage.getItem(
      "ur_spoof_intent_index"
    );
    if (storedPersonaIndex != null) {
      const parsed = Number.parseInt(storedPersonaIndex, 10);
      if (!Number.isNaN(parsed)) {
        personaCycleIndexRef.current = parsed;
      }
    }
    if (storedIntentIndex != null) {
      const parsed = Number.parseInt(storedIntentIndex, 10);
      if (!Number.isNaN(parsed)) {
        intentCycleIndexRef.current = parsed;
      }
    }
  }, []);

  useEffect(() => {
    if (callStatus !== "active") return;
    const t = setInterval(() => setCallDuration((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callStatus]);

  // Default to collapsed when a new call is coming in (ringing).
  useEffect(() => {
    if (callStatus === "ringing") {
      setIsTranscriptCollapsed(true);
    }
  }, [callStatus]);

  const addToTranscript = useCallback(
    (entry: TranscriptEntry) => {
      transcriptRef.current = [...transcriptRef.current, entry];
      setTranscriptEntries([...transcriptRef.current]);

      if (
        entry.speaker === "customer" &&
        !isCustomerInfoAvailable &&
        callMode !== "new_customer"
      ) {
        setIsCustomerInfoAvailable(true);
      }
      if (entry.speaker === "customer") {
        setHasCustomerSpoken(true);
      }
    },
    [isCustomerInfoAvailable, callMode]
  );

  const resolveCustomerFromPanel = useCallback(() => {
    if (currentCallRecord) {
      const meta = currentCallRecord.call_summary;
      const name =
        meta.customer_name ||
        currentCallRecord.account_name ||
        "United Rentals Customer";
      const account =
        meta.customer_account ?? currentCallRecord.account_id ?? undefined;
      console.log("[CoPilot] resolveCustomerFromPanel from currentCallRecord", {
        name,
        account,
      });
      return { name, account };
    }

    const personaLabel =
      SPOOF_PERSONAS.find((p) => p.value === selectedPersona)?.label ?? null;
    const personaProfile = personaLabel
      ? getCustomerInfoForPersona(personaLabel)
      : null;
    if (personaProfile) {
      console.log("[CoPilot] resolveCustomerFromPanel from personaProfile", {
        name: personaProfile.name,
        account: personaProfile.account,
      });
      return {
        name: personaProfile.name,
        account: personaProfile.account ?? undefined,
      };
    }

    console.log(
      "[CoPilot] resolveCustomerFromPanel falling back to generic customer"
    );
    return { name: "Customer", account: undefined as string | undefined };
  }, [currentCallRecord, selectedPersona]);

  const updateAiInsightsFromSuggestion = useCallback(
    (s: ResolutionSuggestion | null) => {
      if (!s) {
        setAiCustomerInsights(null);
        return;
      }
      const nextBest = s.next_best_action?.trim();
      const sentiment = s.customer_sentiment?.trim();
      const crossSell = s.cross_sell_opportunity?.trim();
      if (!nextBest && !sentiment && !crossSell) {
        setAiCustomerInsights(null);
        return;
      }
      setAiCustomerInsights({
        nextBestAction: nextBest || undefined,
        sentiment: sentiment || undefined,
        crossSellOpportunity: crossSell || undefined,
      });
    },
    []
  );

  const runCallLoop = useCallback(
    async (
      persona: string,
      intent: string,
      isrName: string,
      onCallResolved: (transcript: TranscriptEntry[]) => void
    ) => {
      const sid = sessionIdRef.current;
      const spoofSid = spoofSessionIdRef.current;

      let agentGreeting: string;
      try {
        agentGreeting = await getAgentGreeting(sid, isrName);
      } catch {
        agentGreeting = `Thank you for calling United Rentals. I'm ${isrName.trim() || "Sarah"}. How may I help you today?`;
      }
      if (spoofLoopAbortedRef.current) return;
      agentGreeting = agentGreeting.trim() || `Thank you for calling United Rentals. I'm ${isrName.trim() || "Sarah"}. How may I help you today?`;

      transcriptRef.current = [
        { speaker: "agent", text: agentGreeting, timestamp: new Date() },
      ];
      setTranscriptEntries([...transcriptRef.current]);
      if (spoofLoopAbortedRef.current) return;

      const blurb = (t: TranscriptEntry[]) =>
        t
          .map((e) =>
            e.speaker === "customer" ? `Customer: ${e.text}` : `ISR: ${e.text}`
          )
          .join("\n\n");

      const personaLabel =
        SPOOF_PERSONAS.find((p) => p.value === persona)?.label ?? persona;
      const intentLabel =
        SPOOF_INTENTS.find((i) => i.value === intent)?.label ?? intent;

      let spoofMessage = buildSpoofInitialMessage(
        personaLabel,
        intentLabel,
        intent,
        isrName,
        agentGreeting
      );
      let turnCount = 0;
      let resolvedByCustomer = false;

      while (turnCount < MAX_TURNS && !spoofLoopAbortedRef.current) {
        setIsSuggestionsLoading(true);

        // ── Customer turn: use the last agent message as input ────────────────
        const lastAgentLine =
          [...transcriptRef.current]
            .reverse()
            .find((e) => e.speaker === "agent")?.text ?? agentGreeting;

        let customerLine: string;
        try {
          // Pass only the latest agent line into the spoof agent; remind of intent so customer stays on topic
          spoofMessage = buildSpoofContinuation(
            `ISR: ${lastAgentLine}`,
            intentLabel
          );
          customerLine = await getSpoofAgentReply(spoofMessage, spoofSid);
        } catch (err) {
          console.error("Spoof agent error:", err);
          setIsSuggestionsLoading(false);
          // Ensure we still save a summary: add fallback line and exit loop so onCallResolved runs
          addToTranscript({
            speaker: "customer",
            text: "[Call ended unexpectedly.]",
            timestamp: new Date(),
          });
          break;
        }
        if (spoofLoopAbortedRef.current) return;

        const callEnded = /\[CALL_END\]/i.test(customerLine);
        customerLine = customerLine
          .replace(/\s*\[CALL_END\]\s*/gi, "")
          .trim();
        if (!customerLine && !callEnded) {
          spoofMessage = buildSpoofContinuation(
            blurb(transcriptRef.current),
            intentLabel
          );
          turnCount++;
          continue;
        }
        if (customerLine) {
          addToTranscript({
            speaker: "customer",
            text: customerLine,
            timestamp: new Date(),
          });
        }
        if (spoofLoopAbortedRef.current) return;

        if (callEnded || turnCount >= MAX_TURNS - 1) {
          let agentOfferHelp: string;
          try {
            agentOfferHelp = await getAgentOfferHelp(sid);
          } catch {
            agentOfferHelp = "Is there anything else I can help you with?";
          }
          agentOfferHelp = agentOfferHelp.trim() || "Is there anything else I can help you with?";
          if (spoofLoopAbortedRef.current) return;

          addToTranscript({
            speaker: "agent",
            text: agentOfferHelp,
            timestamp: new Date(),
          });
          if (spoofLoopAbortedRef.current) return;

          let noThanksLine: string;
          try {
            noThanksLine = await getSpoofAgentReply(
              buildClosingPrompt(blurb(transcriptRef.current), agentOfferHelp),
              spoofSid
            );
          } catch {
            noThanksLine = FALLBACK_CUSTOMER_DECLINE;
          }
          if (spoofLoopAbortedRef.current) return;
          noThanksLine = noThanksLine
            .replace(/\s*\[CALL_END\]\s*/gi, "")
            .trim() || FALLBACK_CUSTOMER_DECLINE;

          addToTranscript({
            speaker: "customer",
            text: noThanksLine,
            timestamp: new Date(),
          });
          if (spoofLoopAbortedRef.current) return;

          let agentClosing: string;
          try {
            agentClosing = await getAgentClosing(sid);
          } catch {
            agentClosing = "Thank you for calling United Rentals. Hope you have a great day ahead.";
          }
          agentClosing = agentClosing.trim() || "Thank you for calling United Rentals. Hope you have a great day ahead.";
          addToTranscript({
            speaker: "agent",
            text: agentClosing,
            timestamp: new Date(),
          });
          resolvedByCustomer = true;
          break;
        }

        const fullText = transcriptRef.current
          .map((e) => `${e.speaker}: ${e.text}`)
          .join("\n");
        try {
          const resolutionResult = await sendTranscriptForResolution(
            fullText,
            sid,
            SPOOF_PERSONAS.find((p) => p.value === persona)?.label,
            intent
          );
          if (resolutionResult) {
            setSuggestion(resolutionResult);
            updateAiInsightsFromSuggestion(resolutionResult);
          }
        } catch (err) {
          console.error("Resolution agent error:", err);
        }
        if (spoofLoopAbortedRef.current) return;

        // ── Agent turn: use the last customer message as input ───────────────
        const lastCustomerLine =
          [...transcriptRef.current]
            .reverse()
            .find((e) => e.speaker === "customer")?.text ?? "";

        let agentGeneratedLine: string;
        try {
          agentGeneratedLine = await getAgentReplyForCustomerMessage(
            sid,
            lastCustomerLine
          );
        } catch (err) {
          console.error("Agent reply error:", err);
          agentGeneratedLine = "(Agent is thinking...)";
        }
        if (spoofLoopAbortedRef.current) return;
        setIsSuggestionsLoading(false);

        const agentText = (agentGeneratedLine || "(Agent is thinking...)").trim();
        addToTranscript({
          speaker: "agent",
          text: agentText,
          timestamp: new Date(),
        });

        spoofMessage = buildSpoofContinuation(
          blurb(transcriptRef.current),
          intentLabel
        );
        turnCount++;
      }

      setIsSuggestionsLoading(false);
      const snapshot = transcriptRef.current.length > 0 ? [...transcriptRef.current] : [];
      if (snapshot.length > 0) {
        onCallResolved(snapshot);
      }
    },
    [addToTranscript, updateAiInsightsFromSuggestion]
  );

  const handleSayWhisper = useCallback(
    (text: string) => {
      if (!text?.trim()) return;
      agentSpeech.submitTypedResponse(text.trim());
    },
    [agentSpeech]
  );


  const handleSendAsAgent = useCallback(() => {
    const text = customInput.trim();
    if (!text || callStatus !== "active") return;
    agentSpeech.submitTypedResponse(text);
    setCustomInput("");
  }, [customInput, callStatus, agentSpeech]);

  const handleSendAsCustomer = useCallback(() => {
    const text = customInput.trim();
    if (!text || callStatus !== "active") return;
    const entry: TranscriptEntry = {
      speaker: "customer",
      text,
      timestamp: new Date(),
    };
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscriptEntries([...transcriptRef.current]);
    setHasCustomerSpoken(true);
    setCustomInput("");
    const fullText = transcriptRef.current
      .map((e) => `${e.speaker}: ${e.text}`)
      .join("\n");
    setIsSuggestionsLoading(true);
    const personaLabel =
      SPOOF_PERSONAS.find((p) => p.value === selectedPersona)?.label;
    sendTranscriptForResolution(fullText, sessionId, personaLabel, selectedIntent)
      .then((result) => {
        if (result) {
          setSuggestion(result);
          updateAiInsightsFromSuggestion(result);
        }
      })
      .catch((err) => console.error("Resolution agent error:", err))
      .finally(() => setIsSuggestionsLoading(false));
  }, [customInput, callStatus, sessionId, updateAiInsightsFromSuggestion]);

  const saveCallAndGetSummary = useCallback(
    async (
      fullTranscript: string,
      sid: string,
      customerName?: string,
      customerAccount?: string,
      spoofPersonaLabel?: string,
      spoofIntent?: string
    ) => {
      let summary: CallRecord | null = null;
      try {
        console.log("[CoPilot] saveCallAndGetSummary starting", {
          sessionId: sid,
          hasTranscript: !!fullTranscript,
          customerName,
          customerAccount,
        });
        // First, call the Summary Agent directly from the browser so it is visible
        // in the Network tab and we can inspect the payload/response.
        summary = await generateCallSummary(
          fullTranscript,
          sid,
          customerName,
          customerAccount
        );
        if (spoofPersonaLabel) {
          summary.call_summary.spoof_persona = spoofPersonaLabel;
        }
        if (spoofIntent) {
          summary.call_summary.spoof_intent = spoofIntent;
        }
        // Force customer name/account to match Customer Info (persona) so Call History shows the same name
        if (customerName != null && customerName !== "") {
          summary.call_summary.customer_name = customerName;
          summary.account_name = customerName;
        }
        if (customerAccount != null && customerAccount !== "") {
          summary.call_summary.customer_account = customerAccount;
          summary.account_id = customerAccount;
        }
        // Also persist the customer's location so the Google Maps link in
        // Customer Info remains available even after the call is saved and
        // reloaded from history.
        if (spoofPersonaLabel) {
          const personaProfile = getCustomerInfoForPersona(spoofPersonaLabel);
          if (personaProfile?.location) {
            if (!summary.call_summary.branch) {
              summary.call_summary.branch = personaProfile.location;
            }
            if (!summary.job_site) {
              summary.job_site = personaProfile.location;
            }
          }
        }
        // #region agent log
        fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
          body: JSON.stringify({
            sessionId: "1be390",
            location: "copilot:saveCallAndGetSummary:afterGenerate",
            message: "Summary received",
            data: { transcriptLen: fullTranscript.length, sentiment: summary.customer_health?.sentiment },
            timestamp: Date.now(),
            hypothesisId: "E",
          }),
        }).catch(() => {});
        // #endregion
        console.log("[CoPilot] generateCallSummary completed", {
          callId: summary.call_summary.call_id,
          customerName: summary.call_summary.customer_name,
          customerAccount: summary.call_summary.customer_account,
        });

        const usedLocalFallback = !!summary._usedLocalFallback;
        const recordForApi = { ...summary };
        delete (recordForApi as Record<string, unknown>)._usedLocalFallback;

        const res = await fetch("/api/call-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: fullTranscript,
            sessionId: sid,
            customerName: customerName ?? undefined,
            customerAccount: customerAccount ?? undefined,
            callRecord: recordForApi,
            spoofPersona: spoofPersonaLabel ?? undefined,
            spoofIntent: spoofIntent ?? undefined,
          }),
        });
        if (res.ok) {
          const record = await res.json();
          const storageFlag: string | undefined = record?._storage;
          const savedFlagFromApi: boolean | undefined = record?.savedToHistory;
          const savedToHistory =
            savedFlagFromApi !== undefined
              ? !!savedFlagFromApi
              : storageFlag === "mongodb";

          console.log("[CoPilot] saveCallAndGetSummary received record from API", {
            callId: record?.call_summary?.call_id,
            usedLocalFallback,
            storageFlag,
            savedToHistory,
          });

          const recordWithFallback = {
            ...record,
            _usedLocalFallback: summary._usedLocalFallback,
          };

          return { record: recordWithFallback, savedToHistory, usedLocalFallback };
        }
        const errBody = await res.text();
        console.error("[CoPilot] saveCallAndGetSummary API error", {
          status: res.status,
          body: errBody?.slice(0, 200),
        });
        return { record: summary, savedToHistory: false, usedLocalFallback };
      } catch (err) {
        console.error("[CoPilot] saveCallAndGetSummary failed", err);
        const usedLocalFallback = !!summary?._usedLocalFallback;
        return {
          record: summary ?? null,
          savedToHistory: false,
          usedLocalFallback,
        };
      }
    },
    []
  );

  const handleCallResolved = useCallback(
    async (transcript: TranscriptEntry[]) => {
      if (transcript.length === 0) {
        setCallStatus("ended");
        return;
      }
      setCallStatus("ended");
      setSummarySaved(false);
      setSummaryStorageNote(null);
      const fullTranscript = transcript
        .map((e) => `${e.speaker}: ${e.text}`)
        .join("\n");
      // #region agent log
      fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
        body: JSON.stringify({
          sessionId: "1be390",
          location: "copilot:handleCallResolved",
          message: "Call resolved (natural end), saving summary",
          data: { entryCount: transcript.length, transcriptLen: fullTranscript.length },
          timestamp: Date.now(),
          hypothesisId: "B",
        }),
      }).catch(() => {});
      // #endregion
      const sid = sessionIdRef.current;
      // Use customer name and account saved from Customer Info when the call started
      const savedName = callCustomerNameRef.current;
      const savedAccount = callCustomerAccountRef.current;
      const personaLabel =
        selectedIntent === "account_setup" || callMode === "new_customer"
          ? "New customer (construction project)"
          : SPOOF_PERSONAS.find((p) => p.value === selectedPersona)?.label;
      setCurrentCustomerName(savedName);
      setCurrentCustomerAccount(savedAccount);
      setSummaryError(null);
      try {
        const { record, savedToHistory, usedLocalFallback } = await saveCallAndGetSummary(
          fullTranscript,
          sid,
          savedName,
          savedAccount,
          personaLabel,
          selectedIntent
        );
        if (!record) {
          setSummaryError("Summary could not be generated.");
          return;
        }
        console.log("[CoPilot] handleCallResolved summary received", {
          callId: record?.call_summary?.call_id,
          savedToHistory,
          usedLocalFallback,
        });
        if (savedName) {
          record.call_summary.customer_name = savedName;
          record.account_name = savedName;
        }
        if (savedAccount) {
          record.call_summary.customer_account =
            savedAccount ?? record.call_summary.customer_account;
          record.account_id = savedAccount;
        }
        setCurrentCallRecord(record);
        setSummaryUsedFallback(!!usedLocalFallback);
        if (savedToHistory) {
          setSummarySaved(true);
          setSummaryError(null);
          setSummaryStorageNote(null);
        } else {
          setSummarySaved(false);
          setSummaryError(null);
          setSummaryStorageNote(
            "Summary generated for this call (not stored in Call History in this environment)."
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Summary generation failed:", err);
        setSummaryError(msg || "Summary generation failed.");
        setSummaryStorageNote(null);
      }
    },
    [saveCallAndGetSummary, selectedPersona, selectedIntent, callMode]
  );

  const handleStartCall = useCallback(() => {
    setCallStatus("connecting");
    setTranscriptEntries([]);
    setSuggestion(null);
    setAiCustomerInsights(null);
    setSummarySaved(false);
    setSummaryError(null);
    setSummaryUsedFallback(false);
    setCallDuration(0);
    setCustomInput("");
    spoofLoopAbortedRef.current = false;
    setIsCustomerInfoAvailable(false);
    setHasCustomerSpoken(false);
    setRightPanelTab("chat");

    // Cycle persona and intent in deterministic loops so each new call
    // uses a different customer and a different intent instead of randomness.
    const nextPersonaIndex =
      (personaCycleIndexRef.current + 1 + SPOOF_PERSONAS.length) %
      SPOOF_PERSONAS.length;
    const nextIntentIndex =
      (intentCycleIndexRef.current + 1 + SPOOF_INTENTS.length) %
      SPOOF_INTENTS.length;
    personaCycleIndexRef.current = nextPersonaIndex;
    intentCycleIndexRef.current = nextIntentIndex;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "ur_spoof_persona_index",
        String(nextPersonaIndex)
      );
      window.sessionStorage.setItem(
        "ur_spoof_intent_index",
        String(nextIntentIndex)
      );
    }
    const nextPersona = SPOOF_PERSONAS[nextPersonaIndex].value;
    const nextIntent = SPOOF_INTENTS[nextIntentIndex].value;

    console.log("[CoPilot] Call started", {
      persona: nextPersona,
      intent: nextIntent,
      personaIndex: nextPersonaIndex,
      intentIndex: nextIntentIndex,
    });
    setSelectedPersona(nextPersona);
    setSelectedIntent(nextIntent);

    // Save customer name and account from Customer Info (persona) for this call so Call History uses the same
    const personaLabelForCall =
      SPOOF_PERSONAS.find((p) => p.value === nextPersona)?.label;
    const profileForCall = personaLabelForCall
      ? getCustomerInfoForPersona(personaLabelForCall)
      : null;
    callCustomerNameRef.current = profileForCall?.name ?? undefined;
    callCustomerAccountRef.current =
      profileForCall?.account ?? undefined;

    const newSessionId = generateSessionId("copilot");
    const newSpoofSessionId = generateSessionId("spoof");
    setSessionId(newSessionId);
    sessionIdRef.current = newSessionId;
    spoofSessionIdRef.current = newSpoofSessionId;
    setCallStatus("active");
    const isrName = "Sarah";
    runCallLoop(nextPersona, nextIntent, isrName, handleCallResolved);
  }, [runCallLoop, handleCallResolved]);

  const handleEndCall = useCallback(() => {
    spoofLoopAbortedRef.current = true;
    scriptedPlaybackAbortRef.current = true;
    scriptedPlaybackRunIdRef.current += 1;
    setIsSuggestionsLoading(false);
    cancelTTS();
    agentSpeech.cancelWaiting();
    // #region agent log
    const stateLen = transcriptEntries.length;
    const refLen = transcriptRef.current.length;
    const fullFromState = transcriptEntries.map((e) => `${e.speaker}: ${e.text}`).join("\n");
    const fullFromRef = transcriptRef.current.map((e) => `${e.speaker}: ${e.text}`).join("\n");
    fetch("http://127.0.0.1:7594/ingest/a2672ed4-520f-49e8-9f0d-1425ca65bd21", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1be390" },
      body: JSON.stringify({
        sessionId: "1be390",
        location: "copilot:handleEndCall",
        message: "End call transcript source",
        data: { stateLen, refLen, stateTranscriptLen: fullFromState.length, refTranscriptLen: fullFromRef.length, refHasMore: refLen > stateLen },
        timestamp: Date.now(),
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    if (transcriptEntries.length > 0) {
      setCallStatus("summarizing");
      const fullTranscript = transcriptEntries
        .map((e) => `${e.speaker}: ${e.text}`)
        .join("\n");
      const personaLabel =
        selectedIntent === "account_setup" || callMode === "new_customer"
          ? "New customer (construction project)"
          : SPOOF_PERSONAS.find((p) => p.value === selectedPersona)?.label;
      // Use customer name and account saved from Customer Info when the call started
      const savedName = callCustomerNameRef.current;
      const savedAccount = callCustomerAccountRef.current;
      setCurrentCustomerName(savedName);
      setCurrentCustomerAccount(savedAccount);
      setSummaryStorageNote(null);
      saveCallAndGetSummary(
        fullTranscript,
        sessionId,
        savedName,
        savedAccount,
        personaLabel,
        selectedIntent
      )
        .then(({ record, savedToHistory, usedLocalFallback }) => {
          if (!record) {
            setSummaryError("Summary could not be generated.");
            return;
          }
          console.log("[CoPilot] handleEndCall summary received", {
            callId: record?.call_summary?.call_id,
            savedToHistory,
            usedLocalFallback,
          });
          if (savedName) {
            record.call_summary.customer_name = savedName;
            record.account_name = savedName;
          }
          if (savedAccount) {
            record.call_summary.customer_account =
              savedAccount ?? record.call_summary.customer_account;
            record.account_id = savedAccount;
          }
          setCurrentCallRecord(record);
          setSummaryUsedFallback(!!usedLocalFallback);
          if (savedToHistory) {
            setSummarySaved(true);
            setSummaryError(null);
            setSummaryStorageNote(null);
          } else {
            setSummarySaved(false);
            setSummaryError(null);
            setSummaryStorageNote(
              "Summary generated for this call (not stored in Call History in this environment)."
            );
          }
        })
        .catch((err) => {
          console.error("Summary generation failed:", err);
          setSummaryError(err instanceof Error ? err.message : "Summary generation failed.");
          setSummaryStorageNote(null);
        })
        .finally(() => setCallStatus("ended"));
    } else {
      setCallStatus("ended");
    }
  }, [
    transcriptEntries,
    sessionId,
    agentSpeech,
    selectedPersona,
    saveCallAndGetSummary,
    selectedIntent,
    callMode,
  ]);

  const handleNewCall = useCallback(() => {
    scriptedPlaybackAbortRef.current = true;
    scriptedPlaybackRunIdRef.current += 1;
    setIsSuggestionsLoading(false);
    setCallStatus("ringing");
    setTranscriptEntries([]);
    setSuggestion(null);
    setAiCustomerInsights(null);
    setCallDuration(0);
    setSummarySaved(false);
    setSummaryError(null);
    setSummaryUsedFallback(false);
    setSummaryStorageNote(null);
    setSessionId(generateSessionId("copilot"));
    setIsCustomerInfoAvailable(false);
    setHasCustomerSpoken(false);
    setRightPanelTab("chat");
    setCallMode("standard");
    setNewCustomerLocationReady(false);
  }, []);

  const callStatusForControls =
    callStatus === "summarizing" ? "active" : callStatus;

  const isNewCustomerUseCase =
    selectedIntent === "account_setup" || callMode === "new_customer";
  const productRecommendations =
    callStatus === "active" && isNewCustomerUseCase
      ? recommendProductsFromTranscript(transcriptEntries, {
          maxProducts: 3,
          lookbackCustomerTurns: 6,
        })
      : [];

  const firstTimeCustomerState =
    callMode === "new_customer"
      ? buildFirstTimeCallerSuggestionState(transcriptEntries)
      : null;

  const handleStartNewCustomerCall = useCallback(() => {
    // Abort any previous scripted playback run.
    scriptedPlaybackAbortRef.current = true;
    scriptedPlaybackRunIdRef.current += 1;
    const runId = scriptedPlaybackRunIdRef.current;
    scriptedPlaybackAbortRef.current = false;

    const scriptedTranscript = buildFirstTimeCallerTranscript();
    const personaLabel = "New customer (construction project)";
    const intentValue = "account_setup";
    const scriptedCustomerName = NEW_CUSTOMER_NAME;

    // Reset state for scripted playback mode.
    transcriptRef.current = [];
    setTranscriptEntries([]);
    setCallStatus("active");
    setCallDuration(0);
    setSuggestion(null);
    setAiCustomerInsights(null);
    setSummarySaved(false);
    setSummaryError(null);
    setSummaryUsedFallback(false);
    setSummaryStorageNote(null);
    setIsCustomerInfoAvailable(false);
    setNewCustomerLocationReady(false);
    setHasCustomerSpoken(false);
    setRightPanelTab("info");
    setCallMode("new_customer");
    setSelectedIntent(intentValue);
    setIsSuggestionsLoading(false);
    callCustomerNameRef.current = scriptedCustomerName;
    callCustomerAccountRef.current = undefined;
    setCurrentCustomerName(scriptedCustomerName);
    setCurrentCustomerAccount(undefined);

    void (async () => {
      // Initial pause after clicking “First time caller”
      await sleep(2000);
      if (scriptedPlaybackAbortRef.current || scriptedPlaybackRunIdRef.current !== runId) {
        return;
      }

      for (let i = 0; i < scriptedTranscript.length; i++) {
        const entry = scriptedTranscript[i];

        if (i > 0) {
          const prev = scriptedTranscript[i - 1];
          const deltaMs = Math.max(
            0,
            entry.timestamp.getTime() - prev.timestamp.getTime()
          );
          if (deltaMs > 0) {
            await sleep(deltaMs);
          }
          if (scriptedPlaybackAbortRef.current || scriptedPlaybackRunIdRef.current !== runId) {
            return;
          }
        }

        addToTranscript({
          speaker: entry.speaker,
          text: entry.text,
          // use “now” so the UI clock feels live
          timestamp: new Date(),
        });

        if (entry.speaker === "customer") {
          if (entry.text.includes(NEW_CUSTOMER_NAME)) {
            // Name is now known, stop the "fetching" skeleton.
            setIsCustomerInfoAvailable(true);
          }
          if (entry.text.includes(NEW_CUSTOMER_LOCATION)) {
            setNewCustomerLocationReady(true);
          }
        }

        if (entry.speaker === "customer") {
          const fullText = transcriptRef.current
            .map((e) => `${e.speaker}: ${e.text}`)
            .join("\n");

          setIsSuggestionsLoading(true);
          try {
            const result = await sendTranscriptForResolution(
              fullText,
              sessionIdRef.current,
              personaLabel,
              intentValue
            );
            if (
              !scriptedPlaybackAbortRef.current &&
              scriptedPlaybackRunIdRef.current === runId &&
              result
            ) {
              setSuggestion(result);
              updateAiInsightsFromSuggestion(result);
            }
          } catch (err) {
            console.error("Resolution agent error:", err);
          } finally {
            if (
              !scriptedPlaybackAbortRef.current &&
              scriptedPlaybackRunIdRef.current === runId
            ) {
              setIsSuggestionsLoading(false);
            }
          }
        }
      }

      if (scriptedPlaybackAbortRef.current || scriptedPlaybackRunIdRef.current !== runId) {
        return;
      }

      // Script ended: save summary + call history like normal calls.
      const playbackEndedAt = Date.now();
      setIsSuggestionsLoading(false);
      setCallStatus("summarizing");
      setSummarySaved(false);
      setSummaryError(null);
      setSummaryStorageNote(null);

      const fullTranscript = transcriptRef.current
        .map((e) => `${e.speaker}: ${e.text}`)
        .join("\n");

      const sid = sessionIdRef.current;
      const customerName = callCustomerNameRef.current;
      const customerAccount = callCustomerAccountRef.current;

      try {
        const { record, savedToHistory, usedLocalFallback } = await saveCallAndGetSummary(
          fullTranscript,
          sid,
          customerName,
          customerAccount,
          personaLabel,
          intentValue
        );
        if (scriptedPlaybackAbortRef.current || scriptedPlaybackRunIdRef.current !== runId) {
          return;
        }
        if (!record) {
          setSummaryError("Summary could not be generated.");
          setCallStatus("ended");
          return;
        }

        setCurrentCallRecord(record);
        setSummaryUsedFallback(!!usedLocalFallback);

        // End the call UI first (so the footer and link appear), then show “saved” after ~3s.
        setCallStatus("ended");
        const remainingMs = Math.max(0, 3000 - (Date.now() - playbackEndedAt));
        if (remainingMs > 0) {
          await sleep(remainingMs);
        }
        if (scriptedPlaybackAbortRef.current || scriptedPlaybackRunIdRef.current !== runId) {
          return;
        }

        if (savedToHistory) {
          setSummarySaved(true);
          setSummaryError(null);
          setSummaryStorageNote(null);
        } else {
          setSummarySaved(false);
          setSummaryError(null);
          setSummaryStorageNote(
            "Summary generated for this call (not stored in Call History in this environment)."
          );
        }
      } catch (err) {
        if (scriptedPlaybackAbortRef.current || scriptedPlaybackRunIdRef.current !== runId) {
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setSummaryError(msg || "Summary generation failed.");
        setSummaryStorageNote(null);
        setCallStatus("ended");
      }
    })();
  }, [addToTranscript, saveCallAndGetSummary, sleep, updateAiInsightsFromSuggestion]);

  return (
    <div
      className="h-screen w-screen p-4 flex gap-4 bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.7),_transparent_55%),linear-gradient(to_br,_#f5f3ff,_#e0f2fe)]"
      suppressHydrationWarning
    >
      <AppSidebar />

      <div className="flex-1 min-w-0 h-full flex flex-col rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <CallControls
          callStatus={callStatusForControls}
          callDuration={callDuration}
          selectedPersona={selectedPersona}
          onPersonaChange={setSelectedPersona}
          personaOptions={[...SPOOF_PERSONAS]}
          selectedIntent={selectedIntent}
          onIntentChange={setSelectedIntent}
          intentOptions={[...SPOOF_INTENTS]}
          onStartCall={handleStartCall}
          onEndCall={handleEndCall}
          onNewCall={handleNewCall}
          onStartNewCustomerCall={handleStartNewCustomerCall}
        />

        <div className="flex-1 flex min-h-0 gap-4 overflow-hidden">
            {/* Left panel: live transcript with slide-out rail */}
            <div className="shrink-0 h-full flex items-stretch">
              {isTranscriptCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsTranscriptCollapsed(false)}
                  className="h-full w-8 flex items-center justify-center bg-indigo-600 text-white rounded-l-2xl shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all duration-200"
                  aria-label="Expand transcript panel"
                >
                  <ChevronRight className="size-4" />
                </button>
              ) : (
                <div className="relative w-[26vw] max-w-[360px] min-w-[240px] h-full">
                  <div className="h-full w-full border border-gray-200 rounded-2xl bg-white flex flex-col overflow-hidden shadow-[0_18px_40px_rgba(148,163,184,0.35)]">
                    <TranscriptFeed
                      entries={transcriptEntries}
                      isActive={callStatus === "active"}
                    />
                    {(callStatus === "summarizing" || callStatus === "ended") && (
                      <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-slate-50 flex flex-wrap items-center gap-2">
                        {callStatus === "summarizing" && (
                          <div className="inline-flex items-center gap-2">
                            <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <span className="text-sm text-slate-700 font-medium">
                              ⏳ Processing chat and creating summary...
                            </span>
                          </div>
                        )}
                        {callStatus === "ended" && (
                          <>
                            {summarySaved && (
                              <span className="text-sm text-emerald-700 font-semibold">
                                Call history saved.
                              </span>
                            )}
                            {summaryError && (
                              <span
                                className="text-sm text-red-700 font-semibold"
                                title={summaryError}
                              >
                                Summary failed: {summaryError}
                              </span>
                            )}
                            {!summarySaved && !summaryError && summaryStorageNote && (
                              <span className="text-sm text-slate-700 font-medium">
                                {summaryStorageNote}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => router.push("/call-history")}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              View chat history →
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTranscriptCollapsed(true)}
                    className="absolute inset-y-0 -right-3 my-auto size-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all duration-200"
                    aria-label="Collapse transcript panel"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* {callStatus === "active" && (
                <div className="shrink-0 border-t border-gray-200 bg-slate-50 p-3">
                  {agentSpeech.isWaitingForAgent ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">
                        Your turn — say the suggestion, type, or use mic
                      </p>
                      {agentSpeech.error && (
                        <p className="text-xs text-red-600">{agentSpeech.error}</p>
                      )}
                      {!agentSpeech.isListening ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={agentSpeech.startListening}
                            disabled={!agentSpeech.isSupported}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                          >
                            <Mic className="size-4" />
                            Mic
                          </button>
                          <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSendAsAgent();
                            }}
                            placeholder="Type your response..."
                            className="flex-1 min-w-[140px] h-9 rounded-lg border border-gray-200 px-3 text-sm"
                          />
                          <button
                            type="button"
                            onClick={handleSendAsAgent}
                            className="shrink-0 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900"
                          >
                            Send
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {agentSpeech.capturedTranscript && (
                            <span className="text-xs text-gray-600 italic min-w-0 truncate max-w-[200px]">
                              &ldquo;{agentSpeech.capturedTranscript}&rdquo;
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={agentSpeech.stopListening}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                          >
                            Done speaking
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-gray-600 w-full">
                        Add a customer line (optional)
                      </p>
                      <input
                        type="text"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendAsCustomer();
                        }}
                        placeholder="Custom customer line..."
                        className="flex-1 min-w-[140px] h-9 rounded-lg border border-gray-200 px-3 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleSendAsCustomer}
                        className="shrink-0 px-3 py-2 rounded-lg bg-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-300"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              )} */}

            {/* Middle panel: AI suggestions (AI Assist box) */}
            <div className="flex-1 h-full overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <SuggestionsPanel
                suggestion={suggestion}
                isLoading={isSuggestionsLoading}
                isActive={callStatus === "active"}
                hasCustomerSpoken={hasCustomerSpoken}
                onSayWhisper={callStatus === "active" ? handleSayWhisper : undefined}
                productRecommendations={productRecommendations}
                firstTimeCustomerState={firstTimeCustomerState}
              />
            </div>

            {/* Right panel: slide-out drawer with Chat Assist / Info tabs */}
            <div className="shrink-0 h-full flex items-stretch">
              {isRightPanelCollapsed ? (
                /* Collapsed: elegant rail to expand panel */
                <button
                  type="button"
                  onClick={() => setIsRightPanelCollapsed(false)}
                  className="h-full w-8 flex items-center justify-center bg-indigo-600 text-white rounded-l-2xl shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all duration-200"
                  aria-label="Expand assistant panel"
                >
                  <ChevronLeft className="size-4" />
                </button>
              ) : (
                /* Expanded: full drawer */
                <div className="relative w-[360px] h-full">
                  <div className="h-full w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white flex flex-col shadow-[0_18px_40px_rgba(148,163,184,0.5)]">
                    {/* Header: collapse button + tabs */}
                    <div className="px-4 pt-3 pb-2 border-b border-slate-200/80 bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setIsRightPanelCollapsed(true)}
                          className="inline-flex items-center justify-center size-9 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all duration-200"
                          aria-label="Collapse assistant panel"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                        <div className="inline-flex rounded-xl bg-slate-100/80 p-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setRightPanelTab("chat")}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 font-medium transition-all duration-200 ${
                              rightPanelTab === "chat"
                                ? "bg-white text-indigo-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Chat Assist
                          </button>
                          <button
                            type="button"
                            onClick={() => setRightPanelTab("info")}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 font-medium transition-all duration-200 ${
                              rightPanelTab === "info"
                                ? "bg-white text-indigo-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Customer Info
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {rightPanelTab === "info" ? (
                        <CustomerInfoCard
                          record={currentCallRecord ?? undefined}
                          personaLabel={
                            callMode === "new_customer"
                              ? "New customer (construction project)"
                              : SPOOF_PERSONAS.find((p) => p.value === selectedPersona)
                                  ?.label
                          }
                          isWaitingForCall={
                            callStatus === "idle" || callStatus === "ringing"
                          }
                          isLoading={
                            callStatus === "active" && !isCustomerInfoAvailable
                          }
                          mode={
                            callMode === "new_customer"
                              ? "minimalNewCustomer"
                              : "default"
                          }
                          locationReady={
                            callMode === "new_customer"
                              ? newCustomerLocationReady
                              : true
                          }
                        />
                      ) : (
                        <CustomerAssistChat
                          customerContext={(() => {
                            const p = SPOOF_PERSONAS.find(
                              (x) => x.value === selectedPersona
                            );
                            const profile = p
                              ? getCustomerInfoForPersona(p.label)
                              : null;
                            return profile
                              ? {
                                  name: profile.name,
                                  accountId: profile.account ?? undefined,
                                  personaLabel: p?.label,
                                }
                              : undefined;
                          })()}
                          showCustomerContextHint={transcriptEntries.some(
                            (e) => e.speaker === "customer"
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
