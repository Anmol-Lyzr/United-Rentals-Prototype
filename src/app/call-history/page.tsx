"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { CallHistoryList } from "@/components/call-history/CallHistoryList";
import { History, Loader2 } from "lucide-react";
import type { CallRecord } from "@/types/call-records";

export default function CallHistoryPage() {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const res = await fetch("/api/call-history");
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setRecords(data);
            setLoading(false);
            return;
          }
        }
      } catch {
        if (cancelled) return;
      }
      setRecords([]);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="h-screen w-screen p-4 flex gap-4 bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.7),_transparent_55%),linear-gradient(to_br,_#f5f3ff,_#e0f2fe)]"
      suppressHydrationWarning
    >
      <AppSidebar />

      <div className="flex-1 min-w-0 h-full rounded-3xl bg-white/95 border border-white/80 shadow-[0_26px_60px_rgba(148,163,184,0.45)] backdrop-blur-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 h-16 px-6 bg-gradient-to-r from-white via-[#f5f3ff] to-[#eef2ff] border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#eef2ff] flex items-center justify-center">
              <History className="size-5 text-[#4f46e5]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Call History
              </h1>
              <p className="text-sm text-slate-500">
                {loading ? (
                  "Loading…"
                ) : (
                  <>
                    {records.length} call{records.length !== 1 ? "s" : ""} — click
                    a card to expand
                  </>
                )}
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="size-8 animate-spin text-indigo-500" />
              <p className="text-sm">Loading call history…</p>
            </div>
          </div>
        ) : (
          <CallHistoryList records={records} />
        )}
      </div>
    </div>
  );
}
