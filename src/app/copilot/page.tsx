"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { CallControls } from "@/components/copilot/CallControls";
import { TranscriptFeed } from "@/components/copilot/TranscriptFeed";
import { SuggestionsPanel } from "@/components/copilot/SuggestionsPanel";
import { CustomerInfoCard } from "@/components/copilot/CustomerInfoCard";
import { CustomerAssistChat } from "@/components/copilot/CustomerAssistChat";
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
} from "@/types/call-records";

type AiCustomerInsights = {
  nextBestAction?: string;
  sentiment?: string;
  crossSellOpportunity?: string;
};

const MAX_TURNS = 5;

/** Fallback when spoof agent fails to return a closing customer line */
const FALLBACK_CUSTOMER_DECLINE = "No thank you.";

export const SPOOF_PERSONAS = [
  { value: "angry_customer", label: "Angry customer" },
  { value: "confused_customer", label: "Confused customer" },
  { value: "neutral_customer", label: "Neutral customer" },
  { value: "happy_customer", label: "Happy customer" },
] as const;

export const SPOOF_INTENTS = [
  { value: "new_reservation", label: "New reservation" },
  { value: "billing_inquiry", label: "Billing inquiry" },
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

function buildSpoofInitialMessage(
  persona: string,
  intent: string,
  isrName: string,
  agentGreeting: string
): string {
  const isr = isrName.trim() || "Sarah";
  return `The ISR (agent) has just said: "${agentGreeting}" You are ${persona}. Reply with ONLY your first line as the customer: greet, state your name, and briefly state your reason for calling (e.g. ${intent}). No prefixes or labels.`;
}

function buildSpoofContinuation(conversationBlurb: string): string {
  return `Conversation so far:\n\n${conversationBlurb}\n\nYou are the customer. Reply with ONLY your next line (1-4 sentences). If you are satisfied with the resolution or wrapping up, end your reply with [CALL_END].`;
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
  const [selectedPersona, setSelectedPersona] = useState<string>(SPOOF_PERSONAS[0].value);
  const [selectedIntent, setSelectedIntent] = useState<string>(SPOOF_INTENTS[0].value);
  const [summarySaved, setSummarySaved] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [rightPanelTab, setRightPanelTab] = useState<"chat" | "info">("chat");
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

  const spoofLoopAbortedRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const spoofSessionIdRef = useRef("");
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const agentSpeech = useAgentSpeechCapture();

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (callStatus !== "active") return;
    const t = setInterval(() => setCallDuration((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callStatus]);

  const addToTranscript = useCallback((entry: TranscriptEntry) => {
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscriptEntries([...transcriptRef.current]);
  }, []);

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

      let spoofMessage = buildSpoofInitialMessage(persona, intent, isrName, agentGreeting);
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
          // Pass only the latest agent line into the spoof agent
          spoofMessage = buildSpoofContinuation(`ISR: ${lastAgentLine}`);
          customerLine = await getSpoofAgentReply(spoofMessage, spoofSid);
        } catch (err) {
          console.error("Spoof agent error:", err);
          setIsSuggestionsLoading(false);
          return;
        }
        if (spoofLoopAbortedRef.current) return;

        const callEnded = /\[CALL_END\]/i.test(customerLine);
        customerLine = customerLine
          .replace(/\s*\[CALL_END\]\s*/gi, "")
          .trim();
        if (!customerLine && !callEnded) {
          spoofMessage = buildSpoofContinuation(blurb(transcriptRef.current));
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
            sid
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

        spoofMessage = buildSpoofContinuation(blurb(transcriptRef.current));
        turnCount++;
      }

      setIsSuggestionsLoading(false);
      if (resolvedByCustomer && transcriptRef.current.length > 0) {
        onCallResolved(transcriptRef.current);
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
    setCustomInput("");
    const fullText = transcriptRef.current
      .map((e) => `${e.speaker}: ${e.text}`)
      .join("\n");
    setIsSuggestionsLoading(true);
    sendTranscriptForResolution(fullText, sessionId)
      .then((result) => {
        if (result) {
          setSuggestion(result);
          updateAiInsightsFromSuggestion(result);
        }
      })
      .catch((err) => console.error("Resolution agent error:", err))
      .finally(() => setIsSuggestionsLoading(false));
  }, [customInput, callStatus, sessionId, updateAiInsightsFromSuggestion]);

  const handleCallResolved = useCallback(
    async (transcript: TranscriptEntry[]) => {
      if (transcript.length === 0) {
        setCallStatus("ended");
        return;
      }
      setCallStatus("ended");
      setSummarySaved(false);
      const fullTranscript = transcript
        .map((e) => `${e.speaker}: ${e.text}`)
        .join("\n");
      const sid = sessionIdRef.current;
      generateCallSummary(fullTranscript, sid)
        .then((summary) => {
          // Ensure customer name on summary matches the active persona profile
          const personaProfile = getCustomerInfoForPersona(
            SPOOF_PERSONAS.find((p) => p.value === selectedPersona)?.label
          );
          if (personaProfile) {
            summary.call_summary.customer_name = personaProfile.name;
            summary.call_summary.customer_account =
              personaProfile.account ?? summary.call_summary.customer_account;
            summary.account_name = personaProfile.name;
            if (personaProfile.account) {
              summary.account_id = personaProfile.account;
            }
          }
          const existing = JSON.parse(
            localStorage.getItem("ur_call_history") ?? "[]"
          );
          existing.unshift(summary);
          localStorage.setItem("ur_call_history", JSON.stringify(existing));
          setSummarySaved(true);
        })
        .catch((err) => {
          console.error("Summary generation failed:", err);
        });
    },
    [selectedPersona]
  );

  const handleStartCall = useCallback(() => {
    setCallStatus("connecting");
    setTranscriptEntries([]);
    setSuggestion(null);
    setAiCustomerInsights(null);
    setSummarySaved(false);
    setCallDuration(0);
    setCustomInput("");
    spoofLoopAbortedRef.current = false;

    // Randomly select persona and intent for this incoming call
    const randomPersona =
      SPOOF_PERSONAS[Math.floor(Math.random() * SPOOF_PERSONAS.length)].value;
    const randomIntent =
      SPOOF_INTENTS[Math.floor(Math.random() * SPOOF_INTENTS.length)].value;
    setSelectedPersona(randomPersona);
    setSelectedIntent(randomIntent);

    const newSessionId = generateSessionId("copilot");
    const newSpoofSessionId = generateSessionId("spoof");
    setSessionId(newSessionId);
    sessionIdRef.current = newSessionId;
    spoofSessionIdRef.current = newSpoofSessionId;
    setCallStatus("active");
    const isrName = "Sarah";
    runCallLoop(
      randomPersona,
      randomIntent,
      isrName,
      handleCallResolved
    );
  }, [runCallLoop, handleCallResolved]);

  const handleEndCall = useCallback(() => {
    spoofLoopAbortedRef.current = true;
    cancelTTS();
    agentSpeech.cancelWaiting();
    if (transcriptEntries.length > 0) {
      setCallStatus("summarizing");
      const fullTranscript = transcriptEntries
        .map((e) => `${e.speaker}: ${e.text}`)
        .join("\n");
      generateCallSummary(fullTranscript, sessionId)
        .then((summary) => {
          const personaProfile = getCustomerInfoForPersona(
            SPOOF_PERSONAS.find((p) => p.value === selectedPersona)?.label
          );
          if (personaProfile) {
            summary.call_summary.customer_name = personaProfile.name;
            summary.call_summary.customer_account =
              personaProfile.account ?? summary.call_summary.customer_account;
            summary.account_name = personaProfile.name;
            if (personaProfile.account) {
              summary.account_id = personaProfile.account;
            }
          }
          const existing = JSON.parse(
            localStorage.getItem("ur_call_history") ?? "[]"
          );
          existing.unshift(summary);
          localStorage.setItem("ur_call_history", JSON.stringify(existing));
          setSummarySaved(true);
        })
        .catch((err) => {
          console.error("Summary generation failed:", err);
        })
        .finally(() => setCallStatus("ended"));
    } else {
      setCallStatus("ended");
    }
  }, [transcriptEntries, sessionId, agentSpeech]);

  const handleNewCall = useCallback(() => {
    setCallStatus("ringing");
    setTranscriptEntries([]);
    setSuggestion(null);
    setAiCustomerInsights(null);
    setCallDuration(0);
    setSummarySaved(false);
    setSessionId(generateSessionId("copilot"));
  }, []);

  const callStatusForControls =
    callStatus === "summarizing" ? "active" : callStatus;

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
        />

        {callStatus === "summarizing" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white">
            <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-900">
              Saving call and generating summary...
            </p>
          </div>
        )}

        {callStatus !== "summarizing" && (
          <div className="flex-1 flex min-h-0 gap-4 overflow-hidden">
            {/* Left panel: live transcript (fixed width, does not move with drawer) */}
            <div className="w-[40%] shrink-0 min-w-0 border border-gray-200 rounded-2xl bg-white flex flex-col overflow-hidden">
              <TranscriptFeed
                entries={transcriptEntries}
                isActive={callStatus === "active"}
              />

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

              {callStatus === "ended" && (
                <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-slate-50 flex flex-wrap items-center gap-2">
                  {summarySaved && (
                    <span className="text-sm text-emerald-600 font-medium">
                      Summary saved to Call History.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push("/call-history")}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    View Call History →
                  </button>
                </div>
              )}
            </div>

            {/* Middle panel: AI suggestions (AI Assist box) */}
            <div className="flex-1 h-full overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <SuggestionsPanel
                suggestion={suggestion}
                isLoading={isSuggestionsLoading}
                isActive={callStatus === "active"}
                onSayWhisper={callStatus === "active" ? handleSayWhisper : undefined}
              />
            </div>

            {/* Right panel: slide-out drawer with Chat Assist / Info tabs */}
            <div className="shrink-0 h-full flex items-stretch">
              {isRightPanelCollapsed ? (
                /* Collapsed: only thin bar on the far right */
                <button
                  type="button"
                  onClick={() => setIsRightPanelCollapsed(false)}
                  className="h-full w-6 flex items-center justify-center bg-[#6366f1] text-[11px] text-white border border-[#6366f1] rounded-l-none rounded-r-xl shadow-[0_10px_30px_rgba(79,70,229,0.6)]"
                  aria-label="Expand assistant panel"
                >
                  &lt;
                </button>
              ) : (
                /* Expanded: full drawer */
                <div className="relative w-[360px] h-full">
                  <div className="h-full w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white flex flex-col shadow-[0_18px_40px_rgba(148,163,184,0.5)]">
                    {/* Header: small slide button + tabs */}
                    <div className="px-4 pt-3 pb-2 border-b border-[#e5e7eb] bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setIsRightPanelCollapsed(true)}
                          className="inline-flex items-center justify-center rounded-lg border border-[#6366f1] bg-[#6366f1] px-2 py-1 text-[11px] text-white shadow-sm hover:bg-[#4f46e5]"
                          aria-label="Collapse assistant panel"
                        >
                          &gt;
                        </button>
                        <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setRightPanelTab("chat")}
                            className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-1 font-medium ${
                              rightPanelTab === "chat"
                                ? "bg-[#6366f1] text-white"
                                : "text-slate-500"
                            }`}
                          >
                            Chat Assist
                          </button>
                          <button
                            type="button"
                            onClick={() => setRightPanelTab("info")}
                            className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-1 font-medium ${
                              rightPanelTab === "info"
                                ? "bg-[#6366f1] text-white"
                                : "text-slate-500"
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
                          record={undefined}
                          personaLabel={
                            SPOOF_PERSONAS.find((p) => p.value === selectedPersona)
                              ?.label
                          }
                          aiInsights={aiCustomerInsights}
                        />
                      ) : (
                        <CustomerAssistChat />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
