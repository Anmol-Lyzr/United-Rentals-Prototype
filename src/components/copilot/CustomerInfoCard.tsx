"use client";

import { useEffect, useState } from "react";
import type { CallRecord } from "@/types/call-records";
import { getTicketsForPersona, type Ticket } from "@/mock/customer-tickets";
import {
  getPastCallsForPersona,
  type PastCallEntry,
} from "@/mock/customer-past-calls";
import {
  getCustomerInfoForPersona,
  type PersonaCustomerProfile,
} from "@/mock/customer-personas";
import {
  getRentalProfileByAccount,
  type ActiveRental,
} from "@/mock/equipment-and-rentals";

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
      name: "Customer",
      account: "UR-001",
      email: "customer@example.com",
      phone: "+1 (555) 010-0000",
      location: "—",
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
  isWaitingForCall,
  isLoading,
}: {
  record?: CallRecord | null;
  personaLabel?: string;
  aiInsights?: AiCustomerInsights | null;
  isWaitingForCall?: boolean;
  isLoading?: boolean;
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
  const [pastCalls, setPastCalls] = useState<PastCallEntry[]>([]);
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [rentalBranch, setRentalBranch] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [creditLimit, setCreditLimit] = useState<number | null>(null);

  // Resolve account ID from record or persona
  const accountId =
    record?.call_summary?.customer_account ??
    record?.account_id ??
    (personaCustomer?.account ?? null);

  useEffect(() => {
    void (async () => {
      const [ticketData, callData] = await Promise.all([
        getTicketsForPersona(personaLabel),
        getPastCallsForPersona(personaLabel),
      ]);
      setTickets(ticketData);
      setPastCalls(callData);
    })();
  }, [personaLabel]);

  useEffect(() => {
    if (!accountId) {
      setActiveRentals([]);
      setRentalBranch(null);
      setAccountType(null);
      setCreditLimit(null);
      return;
    }
    const profile = getRentalProfileByAccount(accountId);
    if (profile) {
      setActiveRentals(profile.active_rentals);
      setRentalBranch(profile.branch);
      setAccountType(profile.account_type);
      setCreditLimit(profile.credit_limit ?? null);
    } else {
      setActiveRentals([]);
      setRentalBranch(null);
      setAccountType(null);
      setCreditLimit(null);
    }
  }, [accountId]);

  if (isWaitingForCall) {
    return (
      <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff] flex items-center justify-center">
        <p className="text-xs text-slate-600 text-center">
          Customer details will appear here once the call is answered.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="size-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          <span>Fetching customer details...</span>
        </div>
      </section>
    );
  }

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
        {rentalBranch && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Branch</dt>
            <dd className="truncate text-right">{rentalBranch}</dd>
          </div>
        )}
        {accountType && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Account type</dt>
            <dd className="truncate text-right capitalize">{accountType}</dd>
          </div>
        )}
        {creditLimit != null && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Credit limit</dt>
            <dd className="truncate text-right">
              ${creditLimit.toLocaleString()}
            </dd>
          </div>
        )}
      </dl>

      {/* Active rentals (equipment & rental details from KB) */}
      {activeRentals.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#e5e7eb]">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-2">
            Active rentals
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {activeRentals.map((r) => (
              <div
                key={r.contract_number}
                className="rounded-md bg-white px-2 py-1.5 text-[11px] border border-[#e5e7eb]"
              >
                <p className="font-medium text-slate-900 truncate">
                  {r.equipment}
                </p>
                <div className="flex items-center justify-between gap-2 mt-0.5 text-[10px] text-slate-500">
                  <span>{r.contract_number}</span>
                  {r.rate_tier && (
                    <span className="rounded bg-[#eef2ff] text-[#4f46e5] px-1.5 py-0.5 capitalize">
                      {r.rate_tier}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                  {r.jobsite}
                  {r.start_date ? ` · Out ${r.start_date}` : ""}
                  {r.scheduled_in ? ` · In ${r.scheduled_in}` : ""}
                  {r.rpp_included ? " · RPP" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Past calls */}
      <div className="mt-4 pt-3 border-t border-[#e5e7eb]">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-2">
          Past calls
        </p>
        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
          {pastCalls.map((call) => (
            <div
              key={call.id}
              className="rounded-md bg-white px-2 py-1.5 text-[11px] border border-[#e5e7eb]"
            >
              <p className="font-medium text-slate-900 truncate">{call.subject}</p>
              <div className="flex items-center justify-between gap-2 mt-0.5 text-[10px] text-slate-500">
                <span>{call.date}</span>
                <span className="rounded bg-[#eef2ff] text-[#4f46e5] px-1.5 py-0.5">
                  {call.category}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                {call.outcome}
                {call.duration ? ` · ${call.duration}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket generate history */}
      <div className="mt-4 pt-3 border-t border-[#e5e7eb]">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-2">
          Ticket history
        </p>
        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-[11px] border border-[#e5e7eb]"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {ticket.title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{ticket.id}</span>
                  {ticket.generatedAt && (
                    <span>Generated {ticket.generatedAt}</span>
                  )}
                </div>
              </div>
              <span
                className={`ml-2 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
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

