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
import type { FirstTimeCallerSuggestionState } from "@/mock/new-customer-scenario";
import type { ProductOption } from "@/mock/product-catalog";
import { Tooltip } from "@/components/ui/tooltip";
import { EQUIPMENT_DETAILS } from "@/mock/new-customer-scenario";

interface SuggestionsPanelProps {
  /** New (preferred): append-only history of suggestions. */
  suggestions?: ResolutionSuggestion[];
  /** Back-compat: single suggestion (legacy). */
  suggestion?: ResolutionSuggestion | null;
  isLoading: boolean;
  isActive: boolean;
  /** True after at least one customer utterance is present in the transcript. */
  hasCustomerSpoken?: boolean;
  /** When user clicks "Say this" on the whisper/read-this-out line, send as agent response (audio + text) */
  onSayWhisper?: (text: string) => void;
  /** Demo-only product cards to help selling for new customers. */
  productRecommendations?: ProductOption[];
  /** Scenario-specific guidance for the scripted first-time caller experience. */
  firstTimeCustomerState?: FirstTimeCallerSuggestionState | null;
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
  suggestions,
  suggestion,
  isLoading,
  isActive,
  hasCustomerSpoken = false,
  productRecommendations = [],
  firstTimeCustomerState,
}: SuggestionsPanelProps) {
  const suggestionList =
    suggestions ??
    (suggestion ? [suggestion] : []);
  const s =
    suggestionList.length > 0
      ? suggestionList[suggestionList.length - 1]
      : null;
  const isNewCustomerGuidanceMode = !!firstTimeCustomerState;
  // In "first time caller" scripted mode, the resolution agent can sometimes emit
  // identical suggestion text across consecutive turns. Keep the append-only
  // history behavior, but hide exact duplicates so the user always sees variety.
  const displaySuggestionList = (() => {
    if (!isNewCustomerGuidanceMode) return suggestionList;
    const seen = new Set<string>();
    const unique: ResolutionSuggestion[] = [];
    for (const item of suggestionList) {
      const rawText = item.off_topic
        ? (item.message || "").trim()
        : (item.whisper_response || "").trim();
      const key = rawText.replace(/\s+/g, " ").trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return unique;
  })();

  const showEmpty = !isActive && displaySuggestionList.length === 0;
  const showWaitingForCustomer =
    isActive && displaySuggestionList.length === 0 && !hasCustomerSpoken;
  const showAnalyzing =
    isActive && displaySuggestionList.length === 0 && hasCustomerSpoken;
  const hasProducts = Array.isArray(productRecommendations) && productRecommendations.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="shrink-0 h-11 px-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-800">
            AI Assistance
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
      ) : showWaitingForCustomer ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <p className="text-sm text-gray-500 text-center">
            Waiting for the customer to speak.
          </p>
          <p className="text-xs text-gray-400 text-center">
            Once the customer talks, AI suggestions will begin.
          </p>
        </div>
      ) : showAnalyzing ? (
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
            {/* Scenario-specific guidance for scripted first-time caller */}
            {firstTimeCustomerState && (
              <div className="space-y-3">
                {/* SUGGESTION */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="size-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                      Suggestion
                    </span>
                  </div>
                  {/* Append-only suggestion history (do not replace older items). */}
                  {displaySuggestionList.length > 0 ? (
                    <ol className="list-decimal pl-4 space-y-1 text-[13px] leading-relaxed text-slate-800 break-words">
                      {displaySuggestionList.map((item, idx) => {
                        const text = item.off_topic
                          ? (item.message || "").trim()
                          : (item.whisper_response || "").trim();
                        if (!text) return null;
                        return (
                          <li
                            key={idx}
                            className={cn(
                              "whitespace-pre-line",
                              item.off_topic ? "text-amber-800" : "text-slate-800"
                            )}
                          >
                            {text}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="text-[13px] leading-relaxed text-slate-800 break-words">
                      {firstTimeCustomerState.intentSummary}
                    </p>
                  )}
                </div>

                {/* Equipment */}
                {firstTimeCustomerState.equipmentToOffer.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Package className="size-3.5 text-slate-600 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-700">
                        Equipment to offer
                      </span>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <ol className="list-decimal pl-4 space-y-2">
                        {firstTimeCustomerState.equipmentToOffer.map(
                          (item, idx) => {
                            const details = EQUIPMENT_DETAILS[item];
                            const label = details?.name ?? item;
                            const description = details?.description;
                            const tooltipText = description || item;

                            return (
                              <li
                                key={idx}
                                className="text-xs text-slate-800 break-words"
                              >
                                <div className="font-medium">
                                  <Tooltip content={tooltipText}>
                                    <span>{label}</span>
                                  </Tooltip>
                                </div>
                              </li>
                            );
                          }
                        )}
                      </ol>
                    </div>
                  </div>
                )}

                {/* Clarifying questions */}
                {firstTimeCustomerState.clarifyingQuestions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="size-3.5 text-emerald-600 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-700">
                        Clarifying questions
                      </span>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <ol className="list-decimal pl-4 space-y-1.5">
                        {firstTimeCustomerState.clarifyingQuestions.map((q, idx) => (
                          <li
                            key={idx}
                            className="text-xs font-medium text-slate-800 break-words"
                          >
                            {q}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}

                {/* Safety tip */}
                {firstTimeCustomerState.safetyNotes.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
                    <ShieldAlert className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-amber-800 mb-0.5">
                        Safety & training notes
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-700">
                        {firstTimeCustomerState.safetyNotes.map((note, idx) => (
                          <li key={idx} className="break-words">
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Additional equipment */}
                {firstTimeCustomerState.crossSell.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex gap-2">
                    <TrendingUp className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-emerald-800 mb-0.5">
                        Additional equipment to mention
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-emerald-700">
                        {firstTimeCustomerState.crossSell.map((item, idx) => (
                          <li key={idx} className="break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Demo-only selling assistance: recommended products + prices */}
            {hasProducts && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Package className="size-4 text-slate-700 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                      Recommended products
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-white border-slate-200">
                    New customer
                  </Badge>
                </div>
                <div className="space-y-2">
                  {productRecommendations.slice(0, 3).map((p) => (
                    <div key={p.id} className="rounded-lg bg-white border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-slate-900 break-words">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {p.category}
                            {p.availabilityNote ? ` · ${p.availabilityNote}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] text-slate-500">From</div>
                          <div className="text-[13px] font-semibold text-slate-900 tabular-nums">
                            ${p.dailyRateUsd}/day
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            ${p.weeklyRateUsd}/week
                          </div>
                        </div>
                      </div>
                      {Array.isArray(p.upsells) && p.upsells.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.upsells.slice(0, 3).map((u) => (
                            <Badge
                              key={u}
                              variant="outline"
                              className="text-[10px] bg-slate-50 border-slate-200 text-slate-600"
                            >
                              {u}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                          Add to quote (demo)
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Ask job details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isNewCustomerGuidanceMode && s?.off_topic && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800">{s.message}</p>
              </div>
            )}

            {!isNewCustomerGuidanceMode && suggestionList.length > 0 && (
              <>
                {/* Suggestion history in a single box (append-only; newest at bottom) */}
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Brain className="size-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide truncate">
                        AI Suggestion
                      </span>
                    </div>
                    {s?.intent_detected ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-[18px] px-2",
                          (SENTIMENT_CONFIG[s.customer_sentiment || "neutral"] ||
                            SENTIMENT_CONFIG.neutral).bg,
                          (SENTIMENT_CONFIG[s.customer_sentiment || "neutral"] ||
                            SENTIMENT_CONFIG.neutral).color,
                          "border-slate-200"
                        )}
                      >
                        {String(s.intent_detected).replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex items-start gap-2">
                    <MessageSquare className="size-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <ol className="list-decimal pl-4 space-y-1 text-[13px] leading-relaxed text-slate-800 break-words">
                      {suggestionList.map((item, idx) => {
                        const text = item.off_topic
                          ? (item.message || "").trim()
                          : (item.whisper_response || "").trim();
                        if (!text) return null;
                        return (
                          <li
                            key={idx}
                            className={cn(
                              "whitespace-pre-line",
                              item.off_topic ? "text-amber-800" : "text-slate-800"
                            )}
                          >
                            {text}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>

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

                {/* Keep detailed sections only for the latest suggestion to avoid clutter */}
                {s && !s.off_topic && (
                  <>
                    {/* Resolution Steps — only show if at least one step has content */}
                    {(() => {
                      const steps =
                        Array.isArray(s.resolution_steps) &&
                        s.resolution_steps.filter(
                          (step) =>
                            (step.action || "").trim() || (step.detail || "").trim()
                        );
                      return steps && steps.length > 0 ? (
                        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle className="size-3.5 text-emerald-600 shrink-0" />
                            <span className="text-[11px] font-semibold text-gray-700">
                              Resolution Steps
                            </span>
                          </div>
                          <div className="space-y-2">
                            {steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2">
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
                                        className="mt-1 text-[9px] h-[16px] bg-white border-gray-200"
                                      >
                                        {step.system_reference}
                                      </Badge>
                                    )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Policy References — only show if at least one ref has content */}
                    {(() => {
                      const refs =
                        Array.isArray(s.knowledge_references) &&
                        s.knowledge_references
                          .map((ref) => ({
                            title: (ref.title || "").trim(),
                            excerpt: (ref.relevant_excerpt || "").trim(),
                          }))
                          // Drop generic placeholder titles like "Reference"
                          .map((ref) => ({
                            ...ref,
                            title:
                              /^reference$/i.test(ref.title) ||
                              /^policy reference$/i.test(ref.title)
                                ? ""
                                : ref.title,
                          }))
                          // Only keep entries that have an actual title or excerpt
                          .filter((ref) => ref.title || ref.excerpt);
                      return refs && refs.length > 0 ? (
                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <BookOpen className="size-3.5 text-blue-600 shrink-0" />
                            <span className="text-[11px] font-semibold text-gray-700">
                              Policy References
                            </span>
                          </div>
                          <div className="space-y-2">
                            {refs.map((ref, i) => (
                              <div key={i} className="min-w-0">
                                {ref.title ? (
                                  <div className="text-[11px] font-semibold text-blue-800 break-words">
                                    {ref.title}
                                  </div>
                                ) : null}
                                {ref.excerpt ? (
                                  <p className="text-[11px] text-blue-700 mt-0.5 break-words">
                                    {ref.excerpt}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
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
                                {s.equipment_info.accessories_to_suggest.join(", ")}
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
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
