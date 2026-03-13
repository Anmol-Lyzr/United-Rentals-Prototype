"use client";

import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle,
  Loader2,
  MessageSquare,
  Mic,
  Package,
  ShieldAlert,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ResolutionSuggestion } from "@/types/call-records";

interface SuggestionsPanelProps {
  suggestion: ResolutionSuggestion | null;
  isLoading: boolean;
  isActive: boolean;
  /** When user clicks "Say this" on the whisper/read-this-out line, send as agent response (audio + text) */
  onSayWhisper?: (text: string) => void;
}

const SENTIMENT_CONFIG: Record<string, { color: string; bg: string }> = {
  positive: { color: "text-emerald-700", bg: "bg-emerald-50" },
  neutral: { color: "text-gray-600", bg: "bg-gray-100" },
  negative: { color: "text-orange-700", bg: "bg-orange-50" },
  concerned: { color: "text-amber-700", bg: "bg-amber-50" },
  frustrated: { color: "text-orange-700", bg: "bg-orange-50" },
  urgent: { color: "text-red-600", bg: "bg-red-50" },
  angry: { color: "text-red-700", bg: "bg-red-50" },
};

export function SuggestionsPanel({
  suggestion,
  isLoading,
  isActive,
  onSayWhisper,
}: SuggestionsPanelProps) {
  const s = suggestion;
  const sentimentCfg =
    SENTIMENT_CONFIG[s?.customer_sentiment || "neutral"] ||
    SENTIMENT_CONFIG.neutral;

  const showEmpty = !isActive && !s;
  const showWaiting = isActive && !s;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="shrink-0 h-11 px-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-800">
            AI Suggestions
          </h3>
        </div>
        {isLoading && (
          <Loader2 className="size-4 animate-spin text-primary" />
        )}
      </div>

      {/* Body */}
      {showEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400 text-center px-6">
            Start a call to receive real-time AI suggestions.
          </p>
        </div>
      ) : showWaiting ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <Loader2 className="size-6 animate-spin text-primary/40" />
          <p className="text-sm text-gray-500 text-center">
            Analyzing transcript...
          </p>
          <p className="text-xs text-gray-400 text-center">
            Suggestions will appear here as the conversation progresses.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {s?.off_topic && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800">{s.message}</p>
              </div>
            )}

            {s && !s.off_topic && (
              <>
                {/* 1. Read this out — customer-facing line the agent says aloud; "Say this" sends as agent (audio + text) */}
                {/* {s.suggested_response && (
                  <div className="rounded-xl bg-violet-50 border border-violet-200 p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Mic className="size-4 text-violet-600 shrink-0" />
                        <span className="text-xs font-semibold text-violet-800 uppercase tracking-wide">
                          Read this out
                        </span>
                      </div>
                      {onSayWhisper && (
                        <button
                          type="button"
                          onClick={() => onSayWhisper(s.suggested_response!)}
                          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
                        >
                          <Mic className="size-3.5" />
                          Say this
                        </button>
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-gray-800 break-words">
                      &ldquo;{s.suggested_response}&rdquo;
                    </p>
                  </div>
                )} */}

                {/* 2. Response suggestion — internal steps / notes (whisper) */}
                {s.whisper_response && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MessageSquare className="size-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                        Suggestion
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-gray-800 break-words whitespace-pre-line">
                      {s.whisper_response}
                    </p>
                  </div>
                )}

                {/* 3. Insights */}
                <div className="space-y-3 pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <Brain className="size-3.5 text-gray-500 shrink-0" />
                    <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                      Insights
                    </span>
                  </div>

                  {/* Intent + Sentiment */}
                  <div className="flex flex-wrap items-center gap-2">
                    {s.intent_detected && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-primary border-blue-200 text-[11px]"
                      >
                        {s.intent_detected.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {s.customer_sentiment && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px]",
                          sentimentCfg.color,
                          sentimentCfg.bg,
                          "border-current/20"
                        )}
                      >
                        {s.customer_sentiment}
                      </Badge>
                    )}
                    {s.confidence != null && (
                      <span className="text-[10px] text-gray-400">
                        {s.confidence <= 1
                          ? Math.round(s.confidence * 100)
                          : Math.min(100, Math.round(s.confidence))}% confidence
                      </span>
                    )}
                  </div>

                  {s.sentiment_cues && (
                    <p className="text-xs text-gray-500 italic break-words">
                      {s.sentiment_cues}
                    </p>
                  )}

                  {/* De-escalation Tip */}
                  {s.de_escalation_tip && (
                    <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex gap-2">
                      <ShieldAlert className="size-4 shrink-0 text-orange-600 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-orange-800 mb-0.5">
                          De-escalation Tip
                        </div>
                        <p className="text-xs text-orange-700 break-words">
                          {s.de_escalation_tip}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Resolution Steps — only show if at least one step has content */}
                {(() => {
                  const steps =
                    Array.isArray(s.resolution_steps) &&
                    s.resolution_steps.filter(
                      (step) =>
                        (step.action || "").trim() || (step.detail || "").trim()
                    );
                  return steps && steps.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="size-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-semibold text-gray-700">
                          Resolution Steps
                        </span>
                      </div>
                      {steps.map((step, i) => (
                        <div
                          key={i}
                          className="rounded-lg bg-gray-50 border border-gray-200 p-2.5"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-bold text-primary mt-0.5 shrink-0">
                              {step.step}.
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-gray-800 break-words">
                                {(step.action || "").trim() || "—"}
                              </div>
                              {(step.detail || "").trim() ? (
                                <div className="text-[11px] text-gray-500 mt-0.5 break-words">
                                  {step.detail}
                                </div>
                              ) : null}
                              {step.system_reference &&
                                step.system_reference !== "null" && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 text-[9px] h-[16px] bg-gray-100 border-gray-200"
                                  >
                                    {step.system_reference}
                                  </Badge>
                                )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Policy References — only show if at least one ref has content */}
                {(() => {
                  const refs =
                    Array.isArray(s.knowledge_references) &&
                    s.knowledge_references.filter(
                      (ref) =>
                        (ref.title || "").trim() ||
                        (ref.relevant_excerpt || "").trim()
                    );
                  return refs && refs.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="size-3.5 text-blue-600 shrink-0" />
                        <span className="text-[11px] font-semibold text-gray-700">
                          Policy References
                        </span>
                      </div>
                      {refs.map((ref, i) => (
                        <div
                          key={i}
                          className="rounded-lg bg-blue-50 border border-blue-100 p-2.5"
                        >
                          <div className="text-[11px] font-semibold text-blue-800 break-words">
                            {(ref.title || "").trim() || "Policy reference"}
                          </div>
                          <p className="text-[11px] text-blue-600 mt-0.5 break-words">
                            {(ref.relevant_excerpt || "").trim() || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Equipment Info */}
                {s.equipment_info &&
                  Array.isArray(s.equipment_info.mentioned) &&
                  s.equipment_info.mentioned.length > 0 && (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Package className="size-3.5 text-gray-600 shrink-0" />
                        <span className="text-[11px] font-semibold text-gray-700">
                          Equipment
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.equipment_info.mentioned.map((eq, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] bg-white border-gray-200"
                          >
                            {eq}
                          </Badge>
                        ))}
                      </div>
                      {s.equipment_info.certification_required && (
                        <p className="text-[11px] text-amber-700 mt-2 break-words">
                          Certification required:{" "}
                          {s.equipment_info.certification_required}
                        </p>
                      )}
                      {Array.isArray(s.equipment_info.accessories_to_suggest) &&
                        s.equipment_info.accessories_to_suggest.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-1 break-words">
                            Accessories:{" "}
                            {s.equipment_info.accessories_to_suggest.join(
                              ", "
                            )}
                          </p>
                        )}
                    </div>
                  )}

                {/* Escalation Alert */}
                {(s.escalation?.needed || s.escalation?.escalate_to) && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-red-800 mb-0.5">
                        Escalation Needed
                      </div>
                      {(s.escalation.reason || s.escalation.escalate_to) && (
                        <p className="text-xs text-red-700 break-words">
                          {s.escalation.reason || s.escalation.escalate_to}
                        </p>
                      )}
                      {s.escalation.escalate_to && (
                        <Badge
                          variant="outline"
                          className="mt-1.5 text-[10px] bg-red-100 text-red-700 border-red-200"
                        >
                          Escalate to:{" "}
                          {String(s.escalation.escalate_to).replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Cross-sell */}
                {s.cross_sell_opportunity && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex gap-2">
                    <TrendingUp className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-emerald-800 mb-0.5">
                        Cross-sell Opportunity
                      </div>
                      <p className="text-xs text-emerald-700 break-words">
                        {s.cross_sell_opportunity}
                      </p>
                    </div>
                  </div>
                )}

                {/* Next Best Action */}
                {s.next_best_action && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 flex gap-2">
                    <ArrowRight className="size-4 shrink-0 text-primary mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-primary mb-0.5">
                        Next Best Action
                      </div>
                      <p className="text-xs text-gray-700 break-words">
                        {s.next_best_action}
                      </p>
                    </div>
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
