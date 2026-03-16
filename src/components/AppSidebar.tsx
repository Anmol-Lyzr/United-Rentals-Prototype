"use client";

import {
  LayoutDashboard,
  Phone,
  History,
  BarChart3,
  FileText,
  Puzzle,
  HardHat,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function AppSidebar({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Persist collapsed state so navigation does not auto-expand the sidebar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("ur_sidebar_collapsed");
    if (stored === "1") {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ur_sidebar_collapsed", isCollapsed ? "1" : "0");
  }, [isCollapsed]);

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (isCollapsed) {
    return (
      <div
        className={cn(
          "flex h-full w-[72px] flex-col items-center justify-between bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.7),_transparent_55%),linear-gradient(to_bottom,_#eef2ff,_#e0e7ff)] border border-white/80 shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl",
          className
        )}
      >
        {/* Collapsed logo */}
        <div className="h-16 flex items-center justify-center">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-white/15 border border-indigo-300/70 shadow-sm shadow-indigo-400/40">
            <HardHat className="size-4 text-indigo-500" />
          </div>
        </div>

        {/* Icon-only nav */}
        <nav className="flex-1 flex flex-col items-center gap-3 pt-4 text-[11px]">
          <button
            onClick={() => router.push("/")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              isActive("/")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-500/60"
                : "text-slate-500 hover:text-[#4f46e5] hover:bg-white/30"
            )}
            aria-label="Dashboard"
          >
            <LayoutDashboard className="size-4" />
          </button>
          <button
            onClick={() => router.push("/copilot")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              isActive("/copilot")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-500/60"
                : "text-slate-500 hover:text-[#4f46e5] hover:bg-white/30"
            )}
            aria-label="Call"
          >
            <Phone className="size-4" />
          </button>
          <button
            onClick={() => router.push("/call-history")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              isActive("/call-history")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-500/60"
                : "text-slate-500 hover:text-[#4f46e5] hover:bg-white/30"
            )}
            aria-label="View history"
          >
            <History className="size-4" />
          </button>
          <button
            onClick={() => router.push("/analytics")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              isActive("/analytics")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-500/60"
                : "text-slate-500 hover:text-[#4f46e5] hover:bg-white/30"
            )}
            aria-label="Analytics"
          >
            <BarChart3 className="size-4" />
          </button>
          <button
            onClick={() => router.push("/reports")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              isActive("/reports")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-500/60"
                : "text-slate-500 hover:text-[#4f46e5] hover:bg-white/30"
            )}
            aria-label="Reports"
          >
            <FileText className="size-4" />
          </button>
          <button
            onClick={() => router.push("/integrations")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              isActive("/integrations")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-500/60"
                : "text-slate-500 hover:text-[#4f46e5] hover:bg-white/30"
            )}
            aria-label="Integrations"
          >
            <Puzzle className="size-4" />
          </button>
        </nav>

        {/* User + expand button */}
        <div className="flex flex-col items-center gap-3 pb-4">
          <div className="flex size-8 items-center justify-center rounded-full bg-[#6366f1] text-[11px] font-semibold text-white">
            ST
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-[#6366f1] text-white shadow-lg hover:bg-[#4f46e5] transition-colors"
            aria-label="Expand navigation"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-[260px] flex-col rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.35),_transparent_55%),linear-gradient(to_bottom,_#f3e8ff,_#eef2ff)] border border-white/80 shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center gap-3 px-4 pt-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg shadow-indigo-200">
          <HardHat className="size-5 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900 leading-none">
            United Rentals
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            ISR Co-Pilot Dashboard
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2 pb-4 space-y-4 text-[13px]">
        {/* Overview */}
        <div className="space-y-2">
          <p className="px-2 text-[11px] font-medium tracking-[0.16em] text-slate-500">
            OVERVIEW
          </p>
          <button
            onClick={() => router.push("/")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive("/")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-400"
                : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            <span>Dashboard</span>
          </button>
        </div>

        {/* Co-pilot */}
        <div className="space-y-2">
          <p className="px-2 text-[11px] font-medium tracking-[0.16em] text-slate-500">
            CO-PILOT
          </p>
          <button
            onClick={() => router.push("/copilot")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive("/copilot")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-400"
                : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            <Phone className="size-4 shrink-0" />
            <span>Call</span>
          </button>
          <button
            onClick={() => router.push("/call-history")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive("/call-history")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-400"
                : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            <History className="size-4 shrink-0" />
            <span>View History</span>
          </button>
        </div>

        {/* Intelligence */}
        <div className="space-y-2">
          <p className="px-2 text-[11px] font-medium tracking-[0.16em] text-slate-500">
            INTELLIGENCE
          </p>
          <button
            onClick={() => router.push("/analytics")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive("/analytics")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-400"
                : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            <BarChart3 className="size-4 shrink-0" />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => router.push("/reports")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive("/reports")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-400"
                : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            <FileText className="size-4 shrink-0" />
            <span>Reports</span>
          </button>
        </div>

        {/* System */}
        <div className="space-y-2">
          <p className="px-2 text-[11px] font-medium tracking-[0.16em] text-slate-500">
            SYSTEM
          </p>
          <button
            onClick={() => router.push("/integrations")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive("/integrations")
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-400"
                : "text-slate-700 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            <Puzzle className="size-4 shrink-0" />
            <span>Integrations</span>
          </button>
        </div>
      </nav>

      {/* User / status + collapse control */}
      <div className="px-3 pb-3 pt-2 border-t border-white/70 bg-white/70 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-full bg-gradient-to-r from-white via-[#e0e7ff] to-white text-slate-900 shadow-[0_14px_32px_rgba(79,70,229,0.20)]">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[#4f46e5] text-white text-xs shadow-md shadow-indigo-400/50 hover:bg-[#4338ca] transition-colors"
              aria-label="Collapse navigation"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-[11px] font-semibold text-white shadow-md shadow-indigo-400/60">
              ST
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                Sarah Thompson
              </p>
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}