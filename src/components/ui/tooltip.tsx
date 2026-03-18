import * as React from "react";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
};

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span className="pointer-events-none absolute left-0 bottom-full z-20 mb-1 hidden whitespace-normal rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-900 shadow-sm border border-slate-200 group-hover:block max-w-sm w-64 text-left leading-snug">
        {content}
      </span>
    </span>
  );
}

