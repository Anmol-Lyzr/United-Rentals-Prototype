"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CUSTOMER_ASSIST_QUICK_ACTIONS } from "@/constants/quick-actions";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

function buildMockAnswer(question: string): string {
  return (
    "Demo answer from the ISR Co-Pilot knowledge base. " +
    "In a real deployment this panel would call your KB agents to answer:\n\n" +
    `“${question}”`
  );
}

export function CustomerAssistChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [nextId, setNextId] = useState(1);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = {
      id: nextId,
      role: "user",
      text: trimmed,
    };
    const answer: ChatMessage = {
      id: nextId + 1,
      role: "assistant",
      text: buildMockAnswer(trimmed),
    };
    setNextId(nextId + 2);
    setMessages((prev) => [...prev, userMessage, answer]);
    setInput("");
  };

  const quickAsk = (text: string) => {
    send(text);
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-[#eef2ff] via-white to-white">
      {/* Chat history */}
      <div className="mt-3 flex-1 min-h-0 px-4 pb-3 overflow-y-auto space-y-2 text-xs">
        {messages.length === 0 && (
          <p className="mt-4 text-center text-slate-500">
            Start by choosing a quick question above or type your own below.
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
              className={`max-w-[80%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[#6366f1] text-white"
                  : "bg-white text-slate-900 border border-[#e5e7eb]"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions row (search shortcuts) */}
      <div className="px-4 pb-2 pt-1 border-t border-[#e5e7eb] bg-white/90 flex flex-wrap gap-2 text-[11px] text-slate-700">
        {CUSTOMER_ASSIST_QUICK_ACTIONS.map((label) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full border-[#e5e7eb] bg-white px-3 py-0 text-[11px] shadow-xs"
            onClick={() => quickAsk(label)}
          >
            {label}
          </Button>
        ))}
      </div>

      <form
        className="px-4 pb-3 pt-2 border-t border-[#e5e7eb] bg-white flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the knowledge base..."
          className="h-9 rounded-full border-[#e5e7eb] bg-white text-xs text-slate-900 placeholder:text-slate-400"
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-sm"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </section>
  );
}

