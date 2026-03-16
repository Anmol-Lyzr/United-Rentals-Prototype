"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CUSTOMER_ASSIST_QUICK_ACTIONS } from "@/constants/quick-actions";
import { buildKbAnswer, type CustomerContext } from "@/lib/kb-assist";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

/** Simple formatting for KB answers: **bold** and newlines. */
function formatKbText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

export function CustomerAssistChat({
  customerContext,
  showCustomerContextHint = false,
}: {
  customerContext?: CustomerContext | null;
  /** When true, show the personalized hint (e.g. "Sarah Lopez's active rentals") in the empty state. Set to true only after a customer message has been displayed in the call. */
  showCustomerContextHint?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [nextId, setNextId] = useState(1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const showQuickQuestions = messages.length === 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = {
      id: nextId,
      role: "user",
      text: trimmed,
    };
    const answerText = buildKbAnswer(trimmed, customerContext);
    const answer: ChatMessage = {
      id: nextId + 1,
      role: "assistant",
      text: answerText,
    };
    setNextId(nextId + 2);
    // Question on top, answer below (answer appears just above chat box)
    setMessages((prev) => [...prev, userMessage, answer]);
    setInput("");
  };

  const quickAsk = (text: string) => {
    send(text);
  };

  return (
    <section className="flex flex-col h-full min-h-0 bg-gradient-to-b from-slate-50/80 via-white to-white">
      {/* Chat history — responses visible here, just above the chat box */}
      <div className="flex-1 min-h-[160px] px-4 py-3 overflow-y-auto space-y-2.5 text-xs">
        {messages.length === 0 && (
          <p className="pt-6 text-center text-slate-400 text-[11px] leading-relaxed">
            {customerContext?.name && showCustomerContextHint
              ? `Ask about rates, off-rent, delivery, RPP, or "${customerContext.name}"'s active rentals.`
              : "Pick a quick question above or type your own in the box below."}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${
                m.role === "user"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white text-slate-800 border border-slate-200/80 shadow-sm"
              } ${m.role === "assistant" ? "" : "whitespace-pre-wrap"}`}
            >
              {m.role === "assistant" ? (
                <span
                  className="text-[11px] leading-relaxed [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{
                    __html: formatKbText(m.text),
                  }}
                />
              ) : (
                <span className="text-[11px] leading-relaxed">
                  {m.text}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Quick questions (hidden once chat is initiated) */}
      {showQuickQuestions && (
        <div className="shrink-0 px-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-2.5">
            Quick questions
          </p>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_ASSIST_QUICK_ACTIONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => quickAsk(label)}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-medium text-slate-600 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-800 active:scale-[0.98] transition-all duration-200"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat box — answer appears just above this */}
      <form
        className="shrink-0 px-4 pb-4 pt-3 border-t border-slate-200/60 bg-white/95 flex items-center gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the knowledge base..."
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-200/60 focus-visible:border-indigo-300 focus-visible:bg-white transition-all"
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-indigo-300 transition-all duration-200"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </section>
  );
}
