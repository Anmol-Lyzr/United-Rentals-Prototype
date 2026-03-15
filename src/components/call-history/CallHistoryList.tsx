"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Package,
  FileText,
  ArrowRight,
  MessageSquare,
  Tag,
  Target,
  Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CallRecord, ActionItem } from "@/types/call-records";

interface CallHistoryListProps {
  records: CallRecord[];
}

const SENTIMENT_CONFIG: Record<
  string,
  { label: string; dot: string; bg: string }
> = {
  satisfied: { label: "Satisfied", dot: "bg-emerald-500", bg: "bg-emerald-50" },
  neutral: { label: "Neutral", dot: "bg-slate-400", bg: "bg-slate-50" },
  concerned: { label: "Concerned", dot: "bg-amber-500", bg: "bg-amber-50" },
  frustrated: { label: "Frustrated", dot: "bg-orange-500", bg: "bg-orange-50" },
  angry: { label: "Angry", dot: "bg-red-500", bg: "bg-red-50" },
  at_risk: { label: "At risk", dot: "bg-red-600", bg: "bg-red-50" },
};

function priorityStyle(p: ActionItem["priority"]) {
  switch (p) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Extract display name for line item heading */
function getDisplayName(record: CallRecord): string {
  const name =
    record.call_summary.customer_name ?? record.account_name;
  if (name && name !== "Unknown") return name;
  return "Customer";
}

/** Detect if summary content is an LLM/API error message to avoid showing it to the user. */
function isSummaryErrorText(text: string): boolean {
  return (
    text.includes("Error in LLM") ||
    text.includes("BadRequestError") ||
    text.includes("GroqException") ||
    text.includes("tool_use_failed") ||
    text.includes("invalid_request_error") ||
    text.includes("failed_generation")
  );
}

/** Extract plain summary text from record; handle JSON-wrapped response, never show error strings. */
function getSummaryText(record: CallRecord): string {
  const raw = record.summary?.trim() || "";
  if (!raw) {
    return "No summary available.";
  }
  if (isSummaryErrorText(raw)) {
    return "Summary could not be generated for this call. You can review the transcript below.";
  }
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const narrative =
        typeof obj.summary === "string"
          ? obj.summary
          : typeof obj.call_summary === "string"
            ? obj.call_summary
            : typeof (obj as any).interaction?.summary === "string"
              ? (obj as any).interaction.summary
              : null;
      if (narrative) return narrative;
    } catch {
      // fall through
    }
  }
  const callSummaryMatch = raw.match(/"call_summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (callSummaryMatch) {
    return callSummaryMatch[1].replace(/\\"/g, '"');
  }
  const summaryMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    return summaryMatch[1].replace(/\\"/g, '"');
  }
  if (raw.startsWith('"') && raw.endsWith('"')) {
    const unquoted = raw.slice(1, -1).replace(/\\"/g, '"');
    return isSummaryErrorText(unquoted) ? "Summary could not be generated for this call. You can review the transcript below." : unquoted;
  }
  return isSummaryErrorText(raw) ? "Summary could not be generated for this call. You can review the transcript below." : raw;
}

function CallRow({ record }: { record: CallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const cs = record.call_summary;
  const health = record.customer_health;
  const sentimentCfg =
    SENTIMENT_CONFIG[health.sentiment] || SENTIMENT_CONFIG.neutral;
  const summaryText = getSummaryText(record);
  // Optional structured JSON summary from newer agent shape
  let structuredSummary: any | null = null;
  if (record.summary?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(record.summary);
      if (parsed && typeof parsed === "object" && "customer" in parsed && "interaction" in parsed) {
        structuredSummary = parsed;
      }
    } catch {
      // ignore parse errors
    }
  }
  const structuredInteraction = structuredSummary?.interaction as
    | {
        subject?: string;
        date?: string;
        time?: string;
        duration_minutes?: number;
        summary?: string;
      }
    | undefined;
  const structuredEquipment = structuredSummary?.equipment_details as
    | {
        item?: string;
        use_case?: string;
        duration?: string;
        project_start_date?: string;
        location?: string;
      }
    | undefined;
  const structuredInsights = structuredSummary?.insights as string[] | undefined;
  const structuredSales = structuredSummary?.sales_opportunities as
    | {
        description?: string;
        potential_equipment?: string[];
      }
    | undefined;
  const structuredFollowUp: string | undefined =
    structuredSummary?.follow_up_requirement;
  const hasActions = record.action_items.length > 0;
  const hasNextSteps = record.next_steps.length > 0;
  const hasInsights =
    (record.key_topics?.length ?? 0) > 0 ||
    !!record.sentiment?.customer_sentiment ||
    !!record.sentiment?.summary ||
    !!record.call_categories?.primary_type ||
    (record.call_categories?.secondary_types?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all overflow-hidden",
        expanded
          ? "border-primary/30 bg-slate-50/50 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center gap-4"
      >
        <span
          className={cn(
            "size-3 rounded-full shrink-0",
            sentimentCfg.dot
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {getDisplayName(record)}
            </span>
            {record.follow_up_required && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-100 text-amber-800 border-amber-200"
              >
                Follow-up
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatDate(cs.call_date)}
            </span>
            {cs.call_duration_estimate &&
              cs.call_duration_estimate !== "—" &&
              cs.call_duration_estimate !== "Unknown" && (
                <span>{cs.call_duration_estimate}</span>
              )}
            {(hasActions || hasNextSteps) && (
              <span>
                {record.action_items.filter((a) => a.status === "completed").length}
                /{record.action_items.length} actions
                {hasNextSteps && ` · ${record.next_steps.length} next steps`}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="size-5 text-slate-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-5 border-t border-slate-200">
          {/* Summary — always show; full content, no trim */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-slate-800">Summary</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
              {summaryText}
            </p>
            {(getDisplayName(record) !== "Customer" || cs.customer_account || record.account_id) && (
              <p className="mt-2 text-xs text-slate-500">
                {getDisplayName(record) !== "Customer" ? getDisplayName(record) : ""}
                {(cs.customer_account ?? record.account_id) &&
                  ` (${cs.customer_account ?? record.account_id})`}
              </p>
            )}
          </section>

          {/* Interaction details from structured summary (new agent shape) */}
          {structuredInteraction && (
            <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <h3 className="text-xs font-semibold text-slate-600 mb-1">
                Interaction
              </h3>
              {structuredInteraction.subject && (
                <p className="text-sm font-medium text-slate-800">
                  {structuredInteraction.subject}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-600">
                {[structuredInteraction.date, structuredInteraction.time]
                  .filter(Boolean)
                  .join(" · ")}
                {structuredInteraction.duration_minutes != null &&
                  ` · ${structuredInteraction.duration_minutes} min`}
              </p>
            </section>
          )}

          {/* Equipment details from structured summary */}
          {structuredEquipment && (
            <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <h3 className="text-xs font-semibold text-slate-600 mb-1">
                Equipment & project
              </h3>
              {structuredEquipment.item && (
                <p className="text-sm font-medium text-slate-800">
                  {structuredEquipment.item}
                </p>
              )}
              <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                {structuredEquipment.use_case && (
                  <p>
                    <span className="font-medium">Use case:</span>{" "}
                    {structuredEquipment.use_case}
                  </p>
                )}
                {structuredEquipment.duration && (
                  <p>
                    <span className="font-medium">Duration:</span>{" "}
                    {structuredEquipment.duration}
                  </p>
                )}
                {structuredEquipment.project_start_date && (
                  <p>
                    <span className="font-medium">Start date:</span>{" "}
                    {structuredEquipment.project_start_date}
                  </p>
                )}
                {structuredEquipment.location && (
                  <p>
                    <span className="font-medium">Location:</span>{" "}
                    {structuredEquipment.location}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Job site */}
          {record.job_site && (
            <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <h3 className="text-xs font-semibold text-slate-600 mb-1">Job site</h3>
              <p className="text-sm text-slate-800">{record.job_site}</p>
            </section>
          )}

          {/* Equipment issue */}
          {record.equipment_issue && (
            <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <h3 className="text-xs font-semibold text-slate-600 mb-2">Equipment issue</h3>
              <div className="space-y-1.5 text-sm text-slate-800">
                {record.equipment_issue.equipment_type && (
                  <p><span className="font-medium">Type:</span> {record.equipment_issue.equipment_type}</p>
                )}
                {record.equipment_issue.symptoms && record.equipment_issue.symptoms.length > 0 && (
                  <p><span className="font-medium">Symptoms:</span> {record.equipment_issue.symptoms.join(", ")}</p>
                )}
                {record.equipment_issue.visible_damage && record.equipment_issue.visible_damage.length > 0 && (
                  <p><span className="font-medium">Visible damage:</span> {record.equipment_issue.visible_damage.join(", ")}</p>
                )}
              </div>
            </section>
          )}

          {/* Insights / Key topics */}
          {(hasInsights ||
            (record.key_topics?.length ?? 0) > 0 ||
            (structuredInsights?.length ?? 0) > 0) && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Target className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Insights
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {record.call_categories?.primary_type && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      record.call_categories.primary_type === "general_inquiry"
                        ? "bg-[#eef2ff] text-[#4f46e5] border-[#e0e7ff] text-xs"
                        : "bg-primary/10 text-primary border-primary/20 text-xs"
                    )}
                  >
                    {record.call_categories.primary_type}
                  </Badge>
                )}
                {(record.call_categories?.secondary_types ?? []).map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="bg-slate-100 text-slate-700 border-slate-200"
                  >
                    {s}
                  </Badge>
                ))}
                {(record.key_topics ?? []).map((t, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="bg-blue-50 text-blue-800 border-blue-200"
                  >
                    <Tag className="size-3 mr-1" />
                    {t}
                  </Badge>
                ))}
                {record.sentiment?.customer_sentiment && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-current/20",
                      sentimentCfg.bg,
                      "text-slate-700"
                    )}
                  >
                    Sentiment: {record.sentiment.customer_sentiment}
                  </Badge>
                )}
              </div>
              {structuredInsights && structuredInsights.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-xs text-slate-600 space-y-0.5">
                  {structuredInsights.map((insight, i) => (
                    <li key={i}>{insight}</li>
                  ))}
                </ul>
              )}
              {record.sentiment?.summary && (
                <p className="mt-2 text-xs text-slate-600 italic">
                  {record.sentiment.summary}
                </p>
              )}
            </section>
          )}

          {/* Action items */}
          {record.action_items.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="size-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Action Items ({record.action_items.length})
                </h3>
              </div>
              <ul className="space-y-2">
                {record.action_items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px] font-semibold",
                        priorityStyle(item.priority)
                      )}
                    >
                      {item.priority}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {item.action}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-0.5">
                          <User className="size-3" />
                          {item.owner}
                        </span>
                        {item.deadline && (
                          <span>Due: {item.deadline}</span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            item.status === "completed"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-amber-100 text-amber-800 border-amber-200"
                          )}
                        >
                          {item.status}
                        </Badge>
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-xs text-slate-500 italic">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Next steps */}
          {record.next_steps.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Next Steps
                </h3>
              </div>
              <ol className="space-y-2">
                {record.next_steps.map((ns, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-lg bg-primary/5 border border-primary/10 p-3"
                  >
                    <span className="text-sm font-bold text-primary shrink-0">
                      {i + 1}.
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {ns.step}
                      </p>
                      {(ns.owner || ns.timeline || ns.channel) && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[ns.owner, ns.timeline, ns.channel]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Customer health */}
          <section className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="size-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Customer Health
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs border-slate-200",
                  sentimentCfg.bg,
                  "text-slate-700"
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full mr-1.5 inline-block", sentimentCfg.dot)}
                />
                Sentiment: {health.sentiment}
              </Badge>
              <Badge variant="outline" className="text-xs bg-slate-100">
                Retention risk: {health.retention_risk}
              </Badge>
              {health.nps_estimate && (
                <Badge variant="outline" className="text-xs">
                  NPS: {health.nps_estimate}
                </Badge>
              )}
            </div>
            {health.sentiment_triggers?.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                {health.sentiment_triggers.join(". ")}
              </p>
            )}
            {health.retention_risk_reason && (
              <p className="mt-2 text-xs text-amber-700 flex items-center gap-1">
                <AlertTriangle className="size-3.5 shrink-0" />
                {health.retention_risk_reason}
              </p>
            )}
            {health.expansion_opportunity && (
              <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1">
                <TrendingUp className="size-3.5 shrink-0" />
                {health.expansion_opportunity}
              </p>
            )}
          </section>

          {/* Follow-up */}
          {(record.follow_up_details || structuredFollowUp) && (
            <section className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">
                Follow-up required
              </p>
              <p className="text-sm text-amber-800">
                {record.follow_up_details ?? structuredFollowUp}
              </p>
            </section>
          )}

          {/* Sales opportunity from structured summary */}
          {structuredSales?.description && (
            <section className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="size-4 text-emerald-700" />
                <h3 className="text-xs font-semibold text-emerald-800">
                  Sales opportunity
                </h3>
              </div>
              <p className="text-sm text-emerald-900">
                {structuredSales.description}
              </p>
              {structuredSales.potential_equipment &&
                structuredSales.potential_equipment.length > 0 && (
                  <p className="mt-1 text-xs text-emerald-800">
                    Potential equipment:{" "}
                    {structuredSales.potential_equipment.join(", ")}
                  </p>
                )}
            </section>
          )}

          {/* Equipment discussed */}
          {record.equipment_discussed?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Package className="size-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Equipment discussed
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {record.equipment_discussed.map((eq, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="bg-slate-50 text-slate-700 border-slate-200"
                  >
                    {eq.model || eq.type}
                    {eq.details && ` — ${eq.details}`}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Stored transcript */}
          {record.stored_transcript && (
            <StoredTranscriptBlock transcript={record.stored_transcript} />
          )}
        </div>
      )}
    </div>
  );
}

function StoredTranscriptBlock({ transcript }: { transcript: string }) {
  const [showAll, setShowAll] = useState(false);
  const preview = transcript.slice(0, 300);
  const hasMore = transcript.length > 300;

  return (
    <section className="rounded-xl bg-slate-50 border border-slate-200 p-3">
      <button
        type="button"
        onClick={() => setShowAll(!showAll)}
        className="flex items-center gap-2 w-full text-left mb-1.5"
      >
        <MessageSquare className="size-4 text-slate-600" />
        <span className="text-xs font-semibold text-slate-800">
          Full transcript
        </span>
        {hasMore && (
          <span className="text-xs text-primary ml-auto">
            {showAll ? "Collapse" : "Expand"}
          </span>
        )}
      </button>
      <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">
        {showAll ? transcript : preview}
        {hasMore && !showAll && "…"}
      </p>
    </section>
  );
}

export function CallHistoryList({ records }: CallHistoryListProps) {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-4 space-y-3">
        {records.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500">
              No calls yet. Complete a call from Co-Pilot to see history.
            </p>
          </div>
        ) : (
          records.map((record) => (
            <CallRow
              key={record.call_summary.call_id}
              record={record}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
}
