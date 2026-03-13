"use client";

import { useEffect, useState } from "react";
import type { CallRecord } from "@/types/call-records";
import { getTicketsForPersona, type Ticket } from "@/mock/customer-tickets";
import {
  getCustomerInfoForPersona,
  type PersonaCustomerProfile,
} from "@/mock/customer-personas";

type AiCustomerInsights = {
  nextBestAction?: string;
  sentiment?: string;
  crossSellOpportunity?: string;
};

type CustomerInfo = {
  name: string;
  account?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  memberSince?: string | null;
  tier?: string;
  status?: "active" | "inactive";
  personaLabel?: string;
};

function buildCustomerFromRecord(
  record?: CallRecord | null,
  personaOverride?: PersonaCustomerProfile | null
): CustomerInfo {
  if (personaOverride) {
    return {
      name: personaOverride.name,
      account: personaOverride.account ?? null,
      email: personaOverride.email ?? null,
      phone: personaOverride.phone ?? null,
      location: personaOverride.location ?? null,
      memberSince: personaOverride.memberSince ?? null,
      tier: personaOverride.tier ?? "Premium",
      status: personaOverride.status ?? "active",
      personaLabel: personaOverride.personaLabel,
    };
  }

  if (!record) {
    return {
      name: "Demo Customer",
      account: "UR-DEMO-001",
      email: "customer@example.com",
      phone: "+1 (555) 010-0000",
      location: "Demo Branch",
      memberSince: "Jan 2024",
      tier: "Premium",
      status: "active",
    };
  }

  const meta = record.call_summary;
  const name =
    meta.customer_name || record.account_name || "United Rentals Customer";
  const account = meta.customer_account ?? record.account_id ?? null;

  return {
    name,
    account,
    email: meta.customer_email ?? null,
    phone: meta.customer_phone ?? null,
    location: meta.branch ?? record.job_site ?? null,
    memberSince: meta.call_date ?? null,
    tier: "Premium",
    status: "active",
  };
}

export function CustomerInfoCard({
  record,
  personaLabel,
  aiInsights,
}: {
  record?: CallRecord | null;
  personaLabel?: string;
  aiInsights?: AiCustomerInsights | null;
}) {
  const personaCustomer = !record
    ? getCustomerInfoForPersona(personaLabel)
    : null;
  const customer = buildCustomerFromRecord(record, personaCustomer);
  const initials = customer.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    void (async () => {
      const data = await getTicketsForPersona(personaLabel);
      setTickets(data);
    })();
  }, [personaLabel]);

  return (
    <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff]">
      <header className="flex items-center gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f46e5] text-sm font-semibold">
          {initials || "UR"}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border border-white bg-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {customer.name}
          </p>
          {customer.account && (
            <p className="text-[11px] text-slate-500 truncate">
              Account: {customer.account}
            </p>
          )}
        </div>
        <span className="ml-auto inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          {customer.tier || "Premium"}
        </span>
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-y-2 gap-x-4 text-[11px] text-slate-600">
        {customer.email && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Email</dt>
            <dd className="truncate text-right">{customer.email}</dd>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Phone</dt>
            <dd className="truncate text-right">{customer.phone}</dd>
          </div>
        )}
        {customer.location && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Location</dt>
            <dd className="truncate text-right">{customer.location}</dd>
          </div>
        )}
        {customer.memberSince && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Member since</dt>
            <dd className="truncate text-right">{customer.memberSince}</dd>
          </div>
        )}
      </dl>

      {/* AI-powered call insights */}
      {(
        aiInsights?.nextBestAction ||
        aiInsights?.sentiment ||
        aiInsights?.crossSellOpportunity
      ) && (
        <div className="mt-4 pt-3 border-t border-[#e5e7eb] space-y-2">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
            Call Insights
          </p>
          {aiInsights.nextBestAction && (
            <div className="rounded-md bg-white border border-emerald-100 px-3 py-2">
              <p className="text-[11px] font-semibold text-emerald-800 mb-0.5">
                Next best action
              </p>
              <p className="text-[11px] text-slate-700">
                {aiInsights.nextBestAction}
              </p>
            </div>
          )}
          {aiInsights.sentiment && (
            <div className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700">
              <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5" />
              Sentiment: {aiInsights.sentiment}
            </div>
          )}
          {aiInsights.crossSellOpportunity && (
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
              <p className="text-[11px] font-semibold text-blue-800 mb-0.5">
                Cross-sell opportunity
              </p>
              <p className="text-[11px] text-blue-700">
                {aiInsights.crossSellOpportunity}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[#e5e7eb]">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-2">
          Tickets
        </p>
        <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-[11px] border border-[#e5e7eb]"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {ticket.title}
                </p>
                <p className="text-[10px] text-slate-500">{ticket.id}</p>
              </div>
              <span
                className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  ticket.status === "open"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {ticket.status === "open" ? "Open" : "Closed"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

