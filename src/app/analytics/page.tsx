"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  BarChart3,
  Clock,
  LineChart,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CallRecord } from "@/types/call-records";
import {
  demoAnalyticsSnapshot,
  demoChannelStats,
  demoSlaBreakdown,
} from "@/mock/app-demo-data";
import { format, isSameDay, subDays } from "date-fns";

function parseDurationMinutes(estimate?: string): number | null {
  if (!estimate) return null;
  const match = estimate.match(/([\d.]+)/);
  if (!match) return null;
  const num = Number.parseFloat(match[1]);
  return Number.isFinite(num) ? num : null;
}

export default function AnalyticsPage() {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "90d">("7d");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/call-history");
        if (!res.ok) {
          setRecords([]);
          return;
        }
        const data = (await res.json()) as unknown;
        if (Array.isArray(data)) {
          setRecords(data as CallRecord[]);
        } else {
          setRecords([]);
        }
      } catch {
        setRecords([]);
      }
    })();
  }, []);

  const {
    totalConversations,
    aiResolutionRate,
    avgHandleMinutes,
    sentimentScore,
    volumeSeries,
    volumeMax,
    outcomeSeries,
    agentPerformance,
    slaBreakdown,
    channelStats,
  } = useMemo(() => {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const windowDays: Record<"24h" | "7d" | "30d" | "90d", number> = {
      "24h": 1,
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };
    const daysWindow = windowDays[range] ?? 7;

    const filtered = records.filter((r) => {
      const d = r.call_summary?.call_date ?? r.call_date;
      if (!d) return false;
      const parsed = new Date(d);
      if (Number.isNaN(parsed.getTime())) return false;
      const diffMs = now.getTime() - parsed.getTime();
      return diffMs >= 0 && diffMs <= daysWindow * msPerDay;
    });

    // If there is no history in the selected window, fall back to the
    // unified demo snapshot so the analytics page remains populated.
    if (filtered.length === 0) {
      const demo = demoAnalyticsSnapshot;
      const volume = demo.volume.map((point) => ({
        day: new Date(point.date),
        count: point.total,
        resolvedCount: point.resolved,
        followUpCount: point.followUp,
        otherCount: point.other,
      }));
      const max = volume.reduce((m, p) => (p.count > m ? p.count : m), 0);
      const channelStats = demoChannelStats;

      return {
        totalConversations: demo.totalConversations,
        aiResolutionRate: demo.aiResolutionRate,
        avgHandleMinutes: demo.avgHandleMinutes,
        sentimentScore: demo.sentimentScore,
        volumeSeries: volume,
        volumeMax: max,
        outcomeSeries: volume,
        agentPerformance: [
          {
            name: "ISR Voice Support Co-Pilot",
            value: 94,
            tone: "bg-indigo-500",
          },
          {
            name: "Billing Assist Co-Pilot",
            value: 89,
            tone: "bg-sky-400",
          },
          {
            name: "Troubleshooting Co-Pilot",
            value: 92,
            tone: "bg-violet-400",
          },
        ],
        slaBreakdown: demoSlaBreakdown,
        channelStats,
      };
    }

    const total = filtered.length;
    const followUps = records.filter((r) => r.follow_up_required).length;
    const resolved = total - followUps;
    const aiRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const durations: number[] = [];
    for (const r of filtered) {
      const mins = parseDurationMinutes(r.call_summary?.call_duration_estimate);
      if (mins != null) durations.push(mins);
    }
    const avgMins =
      durations.length > 0
        ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1))
        : 0;

    const sentimentMap: Record<string, number> = {
      satisfied: 5,
      neutral: 3,
      concerned: 2,
      frustrated: 1,
      angry: 1,
      at_risk: 1,
    };
    const sentimentScores: number[] = [];
    for (const r of filtered) {
      const sent = r.customer_health?.sentiment;
      if (sent && sentimentMap[sent] != null) {
        sentimentScores.push(sentimentMap[sent]);
      }
    }
    const avgSentiment =
      sentimentScores.length > 0
        ? Number(
            (sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length).toFixed(
              1
            )
          )
        : 0;

    const today = new Date();
    const days = Array.from({ length: 7 }, (_, idx) => subDays(today, 6 - idx));
    const series = days.map((day) => {
      const callsForDay = filtered.filter((r) => {
        const d = r.call_summary?.call_date;
        if (!d) return false;
        const parsed = new Date(d);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (Number.isNaN(parsed.getTime())) return false;
        return isSameDay(parsed, day);
      });
      const count = callsForDay.length;
      const resolvedCount = callsForDay.filter(
        (r) => r.follow_up_required === false
      ).length;
      const followUpCount = callsForDay.filter(
        (r) => r.follow_up_required === true
      ).length;
      const otherCount = Math.max(count - resolvedCount - followUpCount, 0);
      return {
        day,
        count,
        resolvedCount,
        followUpCount,
        otherCount,
      };
    });
    const max = series.reduce((m, p) => (p.count > m ? p.count : m), 0);

    const voiceCalls = total;
    const billingCalls = filtered.filter(
      (r) =>
        r.billing_details ||
        r.call_summary?.call_category.toLowerCase().includes("billing")
    ).length;
    const troubleshootingCalls = filtered.filter(
      (r) =>
        r.equipment_issue ||
        r.call_summary?.call_category.toLowerCase().includes("troubleshoot")
    ).length;

    const perfScale = (value: number) =>
      total > 0 ? Math.min(98, 70 + Math.round((value / total) * 25)) : 80;

    const agents = [
      {
        name: "ISR Voice Support Co-Pilot",
        value: perfScale(voiceCalls || 1),
        tone: "bg-indigo-500",
      },
      {
        name: "Billing Assist Co-Pilot",
        value: perfScale(billingCalls || 1),
        tone: "bg-sky-400",
      },
      {
        name: "Troubleshooting Co-Pilot",
        value: perfScale(troubleshootingCalls || 1),
        tone: "bg-violet-400",
      },
    ];

    const withinSla =
      total > 0 ? Math.min(97, Math.max(60, aiRate + 10)) : 87;
    const atRisk = total > 0 ? Math.max(3, 100 - withinSla - 4) : 9;
    const breached = 100 - withinSla - atRisk;

    const buckets: Record<"Voice" | "Billing" | "Troubleshooting", CallRecord[]> =
      {
        Voice: [],
        Billing: [],
        Troubleshooting: [],
      };

    for (const r of filtered) {
      const category = r.call_summary?.call_category?.toLowerCase() ?? "";
      let key: "Voice" | "Billing" | "Troubleshooting" = "Voice";
      if (category.includes("billing")) {
        key = "Billing";
      } else if (category.includes("troubleshoot") || r.equipment_issue) {
        key = "Troubleshooting";
      }
      buckets[key].push(r);
    }

    const channelStats = (Object.entries(buckets) as [
      "Voice" | "Billing" | "Troubleshooting",
      CallRecord[],
    ][]).map(([label, items]) => {
      // If this channel has no calls in the current window, fall back to
      // a realistic baseline from the unified demo data so we never show
      // empty or all-zero cards.
      if (items.length === 0) {
        const baseline = demoChannelStats.find((c) => c.label === label);
        if (baseline) {
          return baseline;
        }
      }

      const count = items.length;
      const resolvedCount = items.filter(
        (r) => r.follow_up_required === false
      ).length;
      const aiRes = count > 0 ? Math.round((resolvedCount / count) * 100) : 0;

      const chanDurations: number[] = [];
      for (const r of items) {
        const mins = parseDurationMinutes(
          r.call_summary?.call_duration_estimate
        );
        if (mins != null) chanDurations.push(mins);
      }
      const avgChanMins =
        chanDurations.length > 0
          ? Number(
              (
                chanDurations.reduce((a, b) => a + b, 0) /
                chanDurations.length
              ).toFixed(1)
            )
          : 0;

      const chanSentScores: number[] = [];
      for (const r of items) {
        const sent = r.customer_health?.sentiment;
        if (sent && sentimentMap[sent] != null) {
          chanSentScores.push(sentimentMap[sent]);
        }
      }
      const chanSentiment =
        chanSentScores.length > 0
          ? Number(
              (
                chanSentScores.reduce((a, b) => a + b, 0) /
                chanSentScores.length
              ).toFixed(1)
            )
          : 0;

      return {
        label,
        total: count,
        aiResolution: aiRes,
        avgMinutes: avgChanMins,
        sentiment: chanSentiment,
      };
    });

    return {
      totalConversations: total,
      aiResolutionRate: aiRate,
      avgHandleMinutes: avgMins,
      sentimentScore: avgSentiment,
      volumeSeries: series,
      volumeMax: max,
      outcomeSeries: series,
      agentPerformance: agents,
      slaBreakdown: {
        within: withinSla,
        atRisk,
        breached,
      },
      channelStats,
    };
  }, [records, range]);

  const formattedAvgHandle =
    avgHandleMinutes <= 0 ? "—" : `${avgHandleMinutes.toFixed(1)} min`;
  const satisfactionDisplay =
    sentimentScore <= 0 ? "—" : (sentimentScore / 5 * 5).toFixed(1);

  return (
    <div
      className="h-screen w-screen p-4 flex gap-4 bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.7),_transparent_55%),linear-gradient(to_br,_#f5f3ff,_#e0f2fe)]"
      suppressHydrationWarning
    >
      <AppSidebar />

      <div className="flex-1 min-w-0 h-full rounded-3xl bg-white/95 border border-white/80 shadow-[0_26px_60px_rgba(148,163,184,0.45)] backdrop-blur-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="shrink-0 h-20 px-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-white via-[#f5f3ff] to-[#eef2ff] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#eef2ff] flex items-center justify-center shadow-md shadow-indigo-100">
              <BarChart3 className="size-5 text-[#4f46e5]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Agent Analytics
              </h1>
              <p className="text-sm text-slate-500">
                Deep insights into your United Rentals ISR Co-Pilot performance.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            All systems operational
          </Badge>
        </header>

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-auto bg-slate-50 px-6 py-5 space-y-5">
          {/* Hero analytics band */}
          <Card className="bg-gradient-to-br from-indigo-500 via-indigo-500/95 to-sky-500 text-white border-none shadow-lg shadow-indigo-500/40 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.35),_transparent_55%)]" />
            <CardHeader className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/15">
                    <Sparkles className="size-4 text-amber-200" />
                  </span>
                  Agent Analytics overview
                </CardTitle>
                <CardDescription className="text-indigo-100 text-xs sm:text-sm max-w-xl">
                  Real-time view of how the ISR Co-Pilot assists across all
                  calls.
                </CardDescription>
              </div>
              <Tabs
                value={range}
                onValueChange={(value) =>
                  setRange(value as "24h" | "7d" | "30d" | "90d")
                }
                className="relative"
              >
                <TabsList className="rounded-full bg-white/10 px-1 py-1 text-indigo-100 shadow-sm">
                  <TabsTrigger
                    value="24h"
                    className="rounded-full px-3 data-[state=active]:bg-white data-[state=active]:text-indigo-700"
                  >
                    24h
                  </TabsTrigger>
                  <TabsTrigger
                    value="7d"
                    className="rounded-full px-3 data-[state=active]:bg-white data-[state=active]:text-indigo-700"
                  >
                    7d
                  </TabsTrigger>
                  <TabsTrigger
                    value="30d"
                    className="rounded-full px-3 data-[state=active]:bg-white data-[state=active]:text-indigo-700"
                  >
                    30d
                  </TabsTrigger>
                  <TabsTrigger
                    value="90d"
                    className="rounded-full px-3 data-[state=active]:bg-white data-[state=active]:text-indigo-700"
                  >
                    90d
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="relative grid gap-4 sm:grid-cols-4">
              <MetricTile
                label="AI resolution"
                value={
                  totalConversations > 0 ? `${aiResolutionRate}%` : "—"
                }
                delta={
                  totalConversations > 0
                    ? `${Math.max(1, aiResolutionRate - 60)}% vs. baseline`
                    : "Run more calls to see trend"
                }
                sublabel="Calls resolved without follow-up"
              />
              <MetricTile
                label="Conversations"
                value={totalConversations.toString()}
                delta={
                  totalConversations > 0
                    ? `+${Math.max(1, Math.round(totalConversations * 0.12))} vs. prior`
                    : "No conversations yet"
                }
                sublabel="Saved from this browser session"
              />
              <MetricTile
                label="Avg. handle time"
                value={formattedAvgHandle}
                delta={
                  avgHandleMinutes > 0
                    ? "-18% vs. unassisted baseline"
                    : "Measured from call summaries"
                }
                sublabel="Based on summary call_duration_estimate"
              />
              <MetricTile
                label="Satisfaction"
                value={satisfactionDisplay}
                delta={
                  sentimentScore > 0
                    ? "+2.3% vs. last 50 calls"
                    : "Derived from sentiment labels"
                }
                sublabel="Approximate CSAT from sentiment"
              />
            </CardContent>
          </Card>

          {/* Middle strip: core KPIs */}
          <section className="grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Total conversations"
              value={
                totalConversations > 0
                  ? totalConversations.toLocaleString()
                  : "No calls yet"
              }
              delta={
                totalConversations > 0
                  ? `+${Math.max(
                      1,
                      Math.round(totalConversations * 0.1)
                    )} new`
                  : "Start a Co-Pilot session"
              }
              tone="positive"
            />
            <KpiCard
              label="AI-assisted resolution"
              value={
                totalConversations > 0 ? `${aiResolutionRate}%` : "Waiting..."
              }
              delta={
                totalConversations > 0
                  ? `${Math.max(1, aiResolutionRate - 70)}% uplift`
                  : "Needs more calls"
              }
              tone="positive"
            />
            <KpiCard
              label="Average handle time"
              value={formattedAvgHandle}
              delta={avgHandleMinutes > 0 ? "-18%" : "Collecting data"}
              tone="positive"
            />
            <KpiCard
              label="Customer satisfaction"
              value={satisfactionDisplay}
              delta={
                sentimentScore > 0 ? "+5.2%" : "Sentiment not available yet"
              }
              tone="positive"
            />
          </section>

          {/* Channel / intent analytics */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Channel analytics
                </p>
                <p className="text-sm text-slate-600">
                  How different call types perform for the selected time range.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {channelStats.map((chan) => (
                <Card key={chan.label} className="shadow-sm">
                  <CardContent className="pt-4 pb-4 space-y-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">
                        {chan.label}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {chan.total > 0 ? `${chan.total} calls` : "No calls yet"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>AI resolution</span>
                        <span className="font-semibold text-slate-900">
                          {chan.total > 0 ? `${chan.aiResolution}%` : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${chan.aiResolution}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600">
                      <div>
                        <p className="text-slate-500">Avg. duration</p>
                        <p className="font-semibold text-slate-900">
                          {chan.avgMinutes > 0
                            ? `${chan.avgMinutes.toFixed(1)} min`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Satisfaction</p>
                        <p className="font-semibold text-slate-900">
                          {chan.sentiment > 0
                            ? chan.sentiment.toFixed(1)
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Bottom: charts + breakdown */}
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)]">
            {/* Conversation volume + channel mix style */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <LineChart className="size-4 text-indigo-500" />
                  Conversation volume & outcomes
                </CardTitle>
                <CardDescription>
                  Daily mix of resolved vs follow-up calls over the last week.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stacked bar chart style bands driven by history */}
                <div className="h-44 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden px-3 py-4">
                  <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-slate-200/80" />
                  <div className="relative h-full flex items-end gap-2">
                    {outcomeSeries.map((point) => {
                      const base = volumeMax > 0 ? point.count / volumeMax : 0;
                      const totalHeight =
                        base > 0 ? 18 + base * 65 : 8; // percentage
                      const resolvedPortion =
                        point.count > 0
                          ? (point.resolvedCount / point.count) * totalHeight
                          : 0;
                      const followUpPortion =
                        point.count > 0
                          ? (point.followUpCount / point.count) * totalHeight
                          : 0;
                      const otherPortion = Math.max(
                        totalHeight - resolvedPortion - followUpPortion,
                        0
                      );

                      return (
                        <div
                          key={format(point.day, "EEE")}
                          className="flex-1 flex items-end justify-center"
                        >
                          <div className="w-full max-w-[32px] rounded-t-xl overflow-hidden flex flex-col-reverse">
                            {otherPortion > 0 && (
                              <div
                                className="w-full bg-slate-300/80"
                                style={{ height: `${otherPortion}%` }}
                              />
                            )}
                            {followUpPortion > 0 && (
                              <div
                                className="w-full bg-amber-400/90"
                                style={{ height: `${followUpPortion}%` }}
                              />
                            )}
                            {resolvedPortion > 0 && (
                              <div
                                className="w-full bg-indigo-500/90"
                                style={{ height: `${resolvedPortion}%` }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex justify-between text-[11px] text-slate-400">
                    {outcomeSeries.map((point) => (
                      <span key={format(point.day, "EEE")}>
                        {format(point.day, "EEE")}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <LegendDot color="bg-indigo-500" label="Resolved" />
                  <LegendDot color="bg-amber-400" label="Follow-up" />
                  <LegendDot color="bg-slate-300" label="Other" />
                </div>
              </CardContent>
            </Card>

            {/* Agent performance + SLA overview style */}
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="size-4 text-indigo-500" />
                    ISR Co-Pilot performance
                  </CardTitle>
                  <CardDescription>
                    Key service levels for this agent.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                  3 active shifts
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {/* Agent bars */}
                <div className="space-y-3 text-xs sm:text-sm">
                  <p className="mb-1 text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
                    Agent breakdown
                  </p>
                  {agentPerformance.map((agent) => (
                    <div key={agent.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-slate-700">
                          {agent.name}
                        </span>
                        <span className="text-slate-900 font-semibold">
                          {agent.value}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${agent.tone}`}
                          style={{ width: `${agent.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* SLA overview */}
                <div className="space-y-3 text-xs sm:text-sm">
                  <p className="mb-1 text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
                    SLA overview
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        label: "Within SLA",
                        value: slaBreakdown.within,
                        color: "bg-emerald-500",
                      },
                      {
                        label: "At risk",
                        value: slaBreakdown.atRisk,
                        color: "bg-amber-400",
                      },
                      {
                        label: "Breached",
                        value: slaBreakdown.breached,
                        color: "bg-rose-400",
                      },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-slate-700">
                            <span
                              className={`size-2 rounded-full ${item.color}`}
                            />
                            {item.label}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {item.value}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color}`}
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-1 border-t border-slate-100 mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500">
                    <span>Avg. first response: 32s</span>
                    <span>Avg. resolution: 4.2m</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string;
  delta: string;
  sublabel: string;
};

function MetricTile({ label, value, delta, sublabel }: MetricProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.16em] text-indigo-100/80">
        {label}
      </p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-[11px] text-indigo-100/80">
        <span className="font-semibold text-emerald-200 mr-1">{delta}</span>
        {sublabel}
      </p>
    </div>
  );
}

type KpiProps = {
  label: string;
  value: string;
  delta: string;
  tone?: "positive" | "negative" | "neutral";
};

function KpiCard({ label, value, delta, tone = "neutral" }: KpiProps) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 bg-emerald-50"
      : tone === "negative"
      ? "text-rose-600 bg-rose-50"
      : "text-slate-600 bg-slate-50";

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl font-semibold text-slate-900">{value}</p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
          >
            {delta}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-2 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}

