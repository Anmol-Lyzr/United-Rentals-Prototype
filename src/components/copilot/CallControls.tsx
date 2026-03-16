"use client";

import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SpoofPersonaOption {
  value: string;
  label: string;
}

export interface SpoofIntentOption {
  value: string;
  label: string;
}

interface CallControlsProps {
  callStatus: "idle" | "ringing" | "connecting" | "active" | "ended";
  callDuration: number;
  /** Demo: persona for spoof customer (value = name, label can include emoji) */
  selectedPersona: string;
  onPersonaChange: (persona: string) => void;
  personaOptions: SpoofPersonaOption[];
  /** Demo: intent for spoof call */
  selectedIntent: string;
  onIntentChange: (intent: string) => void;
  intentOptions: SpoofIntentOption[];
  onStartCall: () => void;
  onEndCall: () => void;
  onNewCall: () => void;
  /** Start a dedicated new-customer call (first-time caller / new project). */
  onStartNewCustomerCall: () => void;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const selectClass =
  "h-8 rounded-lg bg-gray-50 border border-gray-200 px-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed";

export function CallControls({
  callStatus,
  callDuration,
  selectedPersona,
  onPersonaChange,
  personaOptions,
  selectedIntent,
  onIntentChange,
  intentOptions,
  onStartCall,
  onEndCall,
  onNewCall,
  onStartNewCustomerCall,
}: CallControlsProps) {
  const demoDisabled = callStatus === "active" || callStatus === "connecting";
  return (
    <div className="shrink-0 min-h-14 px-5 py-2 bg-white border-b border-gray-200 flex flex-wrap items-center gap-3">
      {/* Left side: Incoming call banner or live status */}
      {callStatus === "ringing" ? (
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-900">
                Incoming call
              </span>
              <span className="text-[11px] text-gray-500">
                Customer waiting — pick up to begin
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 shrink-0">
          {callStatus === "active" && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-sm tabular-nums font-medium text-gray-900">
                {formatDuration(callDuration)}
              </span>
            </>
          )}
          {callStatus === "connecting" && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
              </span>
              Connecting call...
            </span>
          )}
        </div>
      )}

      {/* Right side: Call-to-action buttons */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {callStatus === "ringing" || callStatus === "idle" || callStatus === "ended" ? (
          <>
            <Button
              onClick={callStatus === "ended" ? onNewCall : onStartCall}
              className="rounded-full bg-[#6366f1] text-white shadow-none hover:bg-[#4f46e5] h-9 px-4 gap-2"
            >
              <Phone className="size-4" />
              <span className="text-sm font-semibold">
                {callStatus === "ended" ? "New Call" : "Pick up now"}
              </span>
            </Button>
            <Button
              type="button"
              onClick={onStartNewCustomerCall}
              className="rounded-full bg-[#6366f1] text-white shadow-none hover:bg-[#4f46e5] h-9 px-4 gap-2 text-sm font-semibold"
            >
              <Phone className="size-4" />
              <span>First-time caller</span>
            </Button>
          </>
        ) : callStatus === "connecting" ? (
          <Button
            disabled
            className="rounded-full shadow-none h-9 px-4 gap-2 bg-[#e5e7eb] text-slate-600"
          >
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm font-semibold">Connecting…</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
