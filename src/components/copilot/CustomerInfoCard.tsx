"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Database, CheckCircle2 } from "lucide-react";
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
  isWaitingForCall,
  isLoading,
  mode = "default",
  locationReady = true,
}: {
  record?: CallRecord | null;
  personaLabel?: string;
  isWaitingForCall?: boolean;
  isLoading?: boolean;
  mode?: "default" | "minimalNewCustomer";
  /** For new-customer demo: true once the full jobsite line has appeared in the transcript. */
  locationReady?: boolean;
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

  const [isProfileOpen, setIsProfileOpen] = useState(true);
  const [isActiveRentalsOpen, setIsActiveRentalsOpen] = useState(true);
  const [isPastCallsOpen, setIsPastCallsOpen] = useState(true);
  const [isTicketHistoryOpen, setIsTicketHistoryOpen] = useState(true);
  const [isKbSaved, setIsKbSaved] = useState(false);

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

  // Persist KB saved state for new customer demo so it survives panel collapse.
  useEffect(() => {
    if (mode !== "minimalNewCustomer") return;
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem("ur_new_customer_kb_saved");
    if (stored === "1") {
      setIsKbSaved(true);
    }
  }, [mode]);

  if (isWaitingForCall) {
    return (
      <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff] flex items-center justify-center">
        <p className="text-xs text-slate-600 text-center">
          {mode === "minimalNewCustomer"
            ? "Customer details will appear here after they share their name and jobsite address."
            : "Customer details will appear here once the call is answered."}
        </p>
      </section>
    );
  }

  if (isLoading) {
    if (mode === "minimalNewCustomer") {
      return (
        <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff]">
          <div className="rounded-xl border border-[#e5e7eb] bg-white/85 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-200/70 bg-white/70 flex items-center gap-2">
              <div className="size-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[11px] font-semibold text-slate-600 truncate">
                Listening to transcript to fetch customer details…
              </p>
            </div>
            <div className="px-3.5 py-3 flex items-start gap-3">
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e5e7ff] text-[#4f46e5] text-sm font-semibold">
                --
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm font-semibold text-slate-400 truncate">
                  Customer name · fetching…
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="size-3 text-slate-300" />
                  <span className="truncate">Location · fetching…</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="size-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          <span>Fetching customer details...</span>
        </div>
      </section>
    );
  }

  const addressLike =
    customer.location &&
    customer.location.trim() !== "" &&
    customer.location.trim() !== "—" &&
    (mode !== "minimalNewCustomer" || locationReady)
      ? customer.location.trim()
      : null;
  const gmapHref = addressLike
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        addressLike
      )}`
    : null;

  if (mode === "minimalNewCustomer") {
    return (
      <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff]">
        <div className="rounded-xl border border-[#e5e7eb] bg-white/85 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-200/70 bg-white/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Database className="size-4 text-indigo-600 shrink-0" />
              <p className="text-[11px] font-semibold text-slate-700 truncate">
                System fetched customer details
              </p>
            </div>
            {locationReady ? (
              isKbSaved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shrink-0">
                  <CheckCircle2 className="size-3" />
                  Saved
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsKbSaved(true);
                    if (typeof window !== "undefined") {
                      window.sessionStorage.setItem(
                        "ur_new_customer_kb_saved",
                        "1"
                      );
                    }
                  }}
                  className="shrink-0 inline-flex items-center rounded-full bg-[#eef2ff] border border-[#e0e7ff] px-2.5 py-1 text-[10px] font-semibold text-[#4f46e5] hover:bg-white transition-colors"
                >
                  Save to knowledge base
                </button>
              )
            ) : null}
          </div>

          <div className="px-3.5 py-3 flex items-start gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f46e5] text-sm font-semibold">
              {initials || "UR"}
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border border-white bg-emerald-400" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {customer.name}
              </p>
              <p className="text-[11px] text-slate-600 flex items-center gap-1">
                <MapPin className="size-3 text-indigo-500" />
                {addressLike ? (
                  <span className="truncate">{addressLike}</span>
                ) : (
                  <span className="truncate text-slate-400">
                    Location · fetching…
                  </span>
                )}
              </p>
              {gmapHref && (
                <a
                  href={gmapHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 hover:underline"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 pt-4 pb-4 border-b border-[#e5e7eb] bg-gradient-to-b from-white via-[#f5f3ff] to-[#eef2ff]">
      {/* Profile */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsProfileOpen((v) => !v)}
          className="w-full px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-white/60 transition-colors"
          aria-label={isProfileOpen ? "Collapse profile" : "Expand profile"}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f46e5] text-sm font-semibold">
              {initials || "UR"}
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border border-white bg-emerald-400" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {customer.name}
              </p>
              {customer.account && (
                <p className="text-[11px] text-slate-500 truncate">
                  Account: {customer.account}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {customer.tier || "Premium"}
            </span>
            {customer.personaLabel &&
              customer.personaLabel.toLowerCase().includes("new customer") && (
                <span className="inline-flex items-center rounded-full border border-indigo-500/40 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  New customer added to database
                </span>
              )}
            {isProfileOpen ? (
              <ChevronUp className="size-4 text-slate-500" />
            ) : (
              <ChevronDown className="size-4 text-slate-500" />
            )}
          </div>
        </button>
        {isProfileOpen && (
          <div className="px-3.5 pb-3">
            <dl className="mt-2 grid grid-cols-1 gap-y-2 gap-x-4 text-[11px] text-slate-600">
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

            {gmapHref && (
              <a
                href={gmapHref}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 hover:underline"
              >
                <MapPin className="size-3.5" />
                Open in Google Maps
              </a>
            )}
          </div>
        )}
      </div>

      {/* Active rentals (equipment & rental details from KB) */}
      {activeRentals.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-white/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsActiveRentalsOpen((v) => !v)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/60 transition-colors"
            aria-label={isActiveRentalsOpen ? "Collapse active rentals" : "Expand active rentals"}
          >
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
              Active rentals
            </span>
            {isActiveRentalsOpen ? (
              <ChevronUp className="size-4 text-slate-500" />
            ) : (
              <ChevronDown className="size-4 text-slate-500" />
            )}
          </button>
          {isActiveRentalsOpen && (
            <div className="px-3.5 pb-3">
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
        </div>
      )}

      {/* Past calls */}
      <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-white/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsPastCallsOpen((v) => !v)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/60 transition-colors"
          aria-label={isPastCallsOpen ? "Collapse past calls" : "Expand past calls"}
        >
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
            Past calls
          </span>
          {isPastCallsOpen ? (
            <ChevronUp className="size-4 text-slate-500" />
          ) : (
            <ChevronDown className="size-4 text-slate-500" />
          )}
        </button>
        {isPastCallsOpen && (
          <div className="px-3.5 pb-3">
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
        )}
      </div>

      {/* Ticket info box */}
      {tickets.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-white/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsTicketHistoryOpen((v) => !v)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/60 transition-colors"
            aria-label={isTicketHistoryOpen ? "Collapse ticket info" : "Expand ticket info"}
          >
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
              Ticket info
            </span>
            {isTicketHistoryOpen ? (
              <ChevronUp className="size-4 text-slate-500" />
            ) : (
              <ChevronDown className="size-4 text-slate-500" />
            )}
          </button>
          {isTicketHistoryOpen && (
            <div className="px-3.5 pb-3">
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {tickets.slice(0, 3).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-md bg-white px-2 py-2 text-[11px] border border-[#e5e7eb]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {ticket.title}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5 break-words">
                          {ticket.summary}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                          <span>{ticket.id}</span>
                          {ticket.generatedAt && <span>{ticket.generatedAt}</span>}
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
