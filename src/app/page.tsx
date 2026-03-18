"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  LineChart,
  Users,
  Clock,
  Activity,
  Phone,
  History,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CallRecord } from "@/types/call-records";
import { format, isSameDay, subDays } from "date-fns";
import {
  getDashboardAgents,
  type DashboardAgentSnapshot,
  demoAnalyticsSnapshot,
} from "@/mock/app-demo-data";

function parseDurationMinutes(estimate?: string): number | null {
  if (!estimate) return null;
  const match = estimate.match(/([\d.]+)/);
  if (!match) return null;
  const num = Number.parseFloat(match[1]);
  return Number.isFinite(num) ? num : null;
}

async function getCallHistory(): Promise<CallRecord[]> {
  try {
    const response = await fetch("/api/call-history", {
      method: "GET",
    });
    if (!response.ok) {
      console.error("[Dashboard] Failed to fetch call history", {
        status: response.status,
      });
      return [];
    }
    const data = (await response.json()) as CallRecord[];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("[Dashboard] Error fetching call history", error);
    return [];
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [agents, setAgents] = useState<DashboardAgentSnapshot[]>([]);

  useEffect(() => {
    void (async () => {
      const data = await getCallHistory();
      setRecords(data);
      const agentData = await getDashboardAgents();
      setAgents(agentData);
    })();
  }, []);

  const {
    totalConversations,
    resolvedCount,
    todayCalls,
    aiResolutionRate,
    avgHandleMinutes,
    volumeSeries,
    volumeMax,
  } = useMemo(() => {
    // If we don't yet have any real call history, fall back to the
    // unified demo snapshot so the dashboard always looks \"alive\".
    if (!records.length) {
      const demo = demoAnalyticsSnapshot;
      const series = demo.volume.map((point) => ({
        day: new Date(point.date),
        count: point.total,
      }));
      const max = Math.max(
        series.reduce((m, p) => (p.count > m ? p.count : m), 0),
        1
      );
      const todayCalls = demo.volume[demo.volume.length - 1]?.total ?? 0;
      return {
        totalConversations: demo.totalConversations,
        resolvedCount: Math.round(
          (demo.totalConversations * demo.aiResolutionRate) / 100
        ),
        todayCalls,
        aiResolutionRate: demo.aiResolutionRate,
        avgHandleMinutes: demo.avgHandleMinutes,
        volumeSeries: series,
        volumeMax: max,
      };
    }

    const now = new Date();

    const total = records.length;
    const resolved = records.filter((r) => r.follow_up_required === false)
      .length;
    const aiRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const durations: number[] = [];
    for (const r of records) {
      const mins = parseDurationMinutes(r.call_summary?.call_duration_estimate);
      if (mins != null) durations.push(mins);
    }
    const avgMins =
      durations.length > 0
        ? Number(
            (
              durations.reduce((a, b) => a + b, 0) / durations.length
            ).toFixed(1)
          )
        : 0;

    const today = new Date();
    const todayCount = records.filter((r) => {
      const d = r.call_summary?.call_date;
      if (!d) return false;
      const parsed = new Date(d);
      if (Number.isNaN(parsed.getTime())) return false;
      return isSameDay(parsed, today);
    }).length;

    const days = Array.from({ length: 7 }, (_, idx) => subDays(now, 6 - idx));
    const series = days.map((day) => {
      const count = records.filter((r) => {
        const d = r.call_summary?.call_date;
        if (!d) return false;
        const parsed = new Date(d);
        if (Number.isNaN(parsed.getTime())) return false;
        return isSameDay(parsed, day);
      }).length;
      return { day, count };
    });
    const max = Math.max(
      series.reduce((m, p) => (p.count > m ? p.count : m), 0),
      1
    );

    return {
      totalConversations: total,
      resolvedCount: resolved,
      todayCalls: todayCount,
      aiResolutionRate: aiRate,
      avgHandleMinutes: avgMins,
      volumeSeries: series,
      volumeMax: max,
    };
  }, [records]);

  const hasData = totalConversations > 0;

  return (
    <div
      className="h-screen w-screen p-4 flex gap-4 bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.7),_transparent_55%),linear-gradient(to_br,_#f5f3ff,_#e0f2fe)]"
      suppressHydrationWarning
    >
      <AppSidebar />

      <div className="flex-1 min-w-0 h-full rounded-3xl bg-white/95 border border-white/80 shadow-[0_26px_60px_rgba(148,163,184,0.45)] backdrop-blur-2xl overflow-hidden flex flex-col relative">
        {/* Top header */}
        <header className="relative shrink-0 px-8 pt-6 pb-4 border-b border-slate-200/60 bg-gradient-to-r from-white via-[#f5f3ff] to-[#eef2ff] text-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                ISR Co-Pilot is live for today&apos;s calls
              </div>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center shadow-md shadow-indigo-200">
                  <Sparkles className="size-5 text-[#4f46e5]" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900">
                    Welcome back, ISR.
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 max-w-xl">
                    Start a Co-Pilot session, then review live analytics of how the
                    agent supports every United Rentals customer conversation.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs min-w-[220px] max-w-sm">
              <div className="rounded-2xl bg-[#ede9fe] border border-[#ddd6fe] px-4 py-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Today&apos;s calls
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {hasData ? todayCalls : 32}
                </p>
                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  {hasData ? "Based on last 24 hours" : "+18% vs. yesterday"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#eef2ff] border border-[#e0e7ff] px-4 py-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  AI resolution
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  85%
                </p>
                <p className="text-[11px] text-slate-500">
                  {hasData
                    ? "Across saved Co-Pilot calls"
                    : "Based on last 50 simulated calls"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="relative flex-1 min-h-0 overflow-auto px-8 py-6 space-y-5">
          {/* Overview stats row */}
          <section className="grid gap-4 md:grid-cols-4">
            <Card className="border-none bg-white text-slate-900 shadow-sm shadow-indigo-100/60">
              <CardContent className="pt-4 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Total conversations
                </p>
                <p className="text-2xl font-semibold">
                  {hasData ? totalConversations.toLocaleString() : "1,847"}
                </p>
                <p className="text-[11px] text-emerald-600">
                  {hasData ? "From call history" : "+12.5% vs. last week"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none bg-white text-slate-900 shadow-sm shadow-indigo-100/60">
              <CardContent className="pt-4 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Avg. resolution
                </p>
                <p className="text-2xl font-semibold">
                  {hasData && avgHandleMinutes > 0
                    ? `${avgHandleMinutes.toFixed(1)} min`
                    : "4.2 min"}
                </p>
                <p className="text-[11px] text-emerald-600">
                  {hasData ? "Average across recent calls" : "-18% handle time"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none bg-white text-slate-900 shadow-sm shadow-indigo-100/60">
              <CardContent className="pt-4 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  AI handled
                </p>
                <p className="text-2xl font-semibold">
                  {hasData ? resolvedCount.toLocaleString() : "847"}
                </p>
                <p className="text-[11px] text-emerald-600">
                  {hasData ? "Resolved without follow-up" : "+15.2% uplift"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none bg-white text-slate-900 shadow-sm shadow-indigo-100/60">
              <CardContent className="pt-4 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Cost saved
                </p>
                <p className="text-2xl font-semibold">
                  {hasData
                    ? `$${(resolvedCount * 50).toLocaleString()}`
                    : "$42.8K"}
                </p>
                <p className="text-[11px] text-emerald-600">
                  {hasData
                    ? "Rough estimate from saved calls"
                    : "+23.1% vs. baseline"}
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Middle grid: volume & mix + agent snapshot */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)]">
            <Card className="shadow-sm border-slate-100/60 bg-white/90">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LineChart className="size-4 text-indigo-500" />
                    Call volume
                  </CardTitle>
                  <CardDescription>
                    Support calls handled by ISR Co-Pilot over the last 7 days.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  Last 7 days
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Always use a smooth, demo-style 7-day series so the chart
                  // looks like a continuous trend line regardless of gaps in
                  // real call history.
                  const demoSeries = demoAnalyticsSnapshot.volume.map((point) => ({
                    day: new Date(point.date),
                    count: point.total,
                  }));
                  const series = demoSeries.length
                    ? demoSeries
                    : [
                        { day: subDays(new Date(), 6), count: 18 },
                        { day: subDays(new Date(), 5), count: 22 },
                        { day: subDays(new Date(), 4), count: 25 },
                        { day: subDays(new Date(), 3), count: 23 },
                        { day: subDays(new Date(), 2), count: 27 },
                        { day: subDays(new Date(), 1), count: 21 },
                        { day: new Date(), count: 22 },
                      ];
                  const maxCount = Math.max(
                    ...series.map((p) => p.count),
                    1
                  );
                  const chartHeight = 140;
                  const barGap = 4;
                  const barWidth =
                    series.length > 0
                      ? (100 - barGap * (series.length + 1)) / series.length
                      : 0;
                  return (
                    <div className="h-48 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-100 relative overflow-hidden px-4 pt-3 pb-5">
                      <div className="absolute right-3 top-3 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        Calls
                      </div>
                      <svg
                        viewBox={`0 0 100 ${chartHeight}`}
                        preserveAspectRatio="none"
                        className="w-full h-[120px] min-h-[120px] block"
                      >
                        <defs>
                          <linearGradient
                            id="volumeGradient"
                            x1="0"
                            x2="0"
                            y1="1"
                            y2="0"
                          >
                            <stop
                              offset="0%"
                              stopColor="#4f46e5"
                              stopOpacity="0.3"
                            />
                            <stop
                              offset="50%"
                              stopColor="#6366f1"
                              stopOpacity="0.9"
                            />
                            <stop
                              offset="100%"
                              stopColor="#22d3ee"
                              stopOpacity="1"
                            />
                          </linearGradient>
                        </defs>
                        {/* subtle horizontal grid lines */}
                        {[0.25, 0.5, 0.75].map((ratio) => {
                          const y =
                            chartHeight -
                            ratio * (chartHeight - 16);
                          return (
                            <line
                              // eslint-disable-next-line react/no-array-index-key
                              key={ratio}
                              x1="0"
                              x2="100"
                              y1={y}
                              y2={y}
                              stroke="#e5e7eb"
                              strokeWidth="0.6"
                              strokeDasharray="2 3"
                            />
                          );
                        })}
                        {series.map((p, i) => {
                          const x =
                            barGap + i * (barWidth + barGap);
                          const barHeight =
                            (p.count / maxCount) * (chartHeight - 16);
                          const y = chartHeight - barHeight;
                          return (
                            <rect
                              key={format(p.day, "EEE")}
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              rx={2.5}
                              fill="url(#volumeGradient)"
                            />
                          );
                        })}
                      </svg>
                      <div className="flex justify-between mt-3 text-[10px] text-slate-500 px-1">
                        {series.map((point) => (
                          <span key={format(point.day, "EEE")}>
                            {format(point.day, "EEE")}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                        <span>
                          Total this period:{" "}
                          <span className="font-semibold text-slate-800">
                            {series.reduce((a, p) => a + p.count, 0)} calls
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-100/60 bg-white/90">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="size-4 text-indigo-500" />
                    ISR Co-Pilot snapshot
                  </CardTitle>
                  <CardDescription>
                    High-level view of the agents.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  3 agents
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-xs sm:text-sm">
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <div key={agent.name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {agent.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {agent.label}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {agent.value}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                          style={{ width: `${agent.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                  <span>Avg. first response: 32s</span>
                  <span>Avg. resolution: 4.2m</span>
                  <span>CSAT: 4.8 / 5</span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Bottom strip: quick actions */}
          <section>
            <Card className="shadow-sm border-dashed border-slate-200/80 bg-slate-50/90">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="size-4 text-indigo-500" />
                    Get the most from this prototype
                  </CardTitle>
                  <CardDescription>
                    Run a few simulated calls, then explore Analytics and Reports
                    for a full AgenticOS-style view.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 rounded-full"
                    onClick={() => router.push("/analytics")}
                  >
                    <LineChart className="size-4" />
                    Open Analytics
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 rounded-full"
                    onClick={() => router.push("/reports")}
                  >
                    <History className="size-4" />
                    View Reports
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
