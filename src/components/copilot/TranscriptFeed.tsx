"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/types/call-records";

interface TranscriptFeedProps {
  entries: TranscriptEntry[];
  isActive: boolean;
  // Optional props kept for backwards compatibility; currently ignored.
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function TranscriptFeed({
  entries,
  isActive,
}: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const isEmpty = entries.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 h-11 px-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800 truncate">
          Live Transcript
        </h3>
        {isActive && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Recording
          </span>
        )}
      </div>

      {/* Body */}
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center bg-white">
          <p className="text-sm text-gray-400 text-center px-6">
            {isActive
              ? "Listening... transcript will appear here."
              : "Start a call to see the live transcript."}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0 bg-white">
          <div className="px-4 py-3 space-y-2">
            {entries.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl px-3 py-2 border",
                  entry.speaker === "customer"
                    ? "bg-gray-50 border-gray-200"
                    : "bg-blue-50 border-blue-100"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      entry.speaker === "customer"
                        ? "text-gray-700"
                        : "text-primary"
                    )}
                  >
                    {entry.speaker === "customer"
                      ? "Customer"
                      : "Agent (ISR)"}
                  </span>
                  <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                    {entry.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-gray-800 break-words whitespace-pre-wrap">
                  {entry.text}
                </p>
              </div>
            ))}

            {isActive && (
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-400">Listening...</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
