import { NextResponse } from "next/server";
import { getCallHistoryCollection } from "@/lib/mongodb";
import { generateCallSummary } from "@/lib/ur-agents";
import type { CallRecord } from "@/types/call-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/call-history
 * Fetches call history from MongoDB. Returns empty array if MongoDB is not configured or fails.
 */
export async function GET() {
  try {
    const collection = await getCallHistoryCollection();
    if (!collection) return NextResponse.json([]);

    const docs = await collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    const records: CallRecord[] = docs.map((doc) => {
      const { _id, createdAt, ...record } = doc;
      return record as CallRecord;
    });
    return NextResponse.json(records);
  } catch {
    return NextResponse.json([]);
  }
}

type PostBody = {
  transcript: string;
  sessionId: string;
  customerName?: string;
  customerAccount?: string;
  callRecord?: CallRecord;
   /** Demo-only fields to keep Call History aligned with Co-pilot spoof settings */
  spoofPersona?: string;
  spoofIntent?: string;
};

/**
 * POST /api/call-history
 * Accepts transcript + optional callRecord from client. If callRecord is provided, uses it and saves to MongoDB;
 * otherwise calls Summary Agent, then saves to MongoDB. Returns the call record.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostBody;
    const {
      transcript,
      sessionId,
      customerName,
      customerAccount,
      callRecord,
      spoofPersona,
      spoofIntent,
    } = body;
    if (!transcript || typeof transcript !== "string" || !sessionId) {
      return NextResponse.json(
        { error: "transcript and sessionId are required" },
        { status: 400 }
      );
    }

    const summary: CallRecord = callRecord
      ? callRecord
      : await generateCallSummary(
          transcript,
          sessionId,
          customerName,
          customerAccount
        );

    // Ensure the stored record carries through the spoof persona/intent used
    // on the Co-pilot page so Call History matches the live experience.
    if (spoofPersona) {
      summary.call_summary.spoof_persona = spoofPersona;
    }
    if (spoofIntent) {
      summary.call_summary.spoof_intent = spoofIntent;
    }
    // Force customer name/account from Co-pilot so Call History matches Customer Info tab
    if (customerName != null && customerName !== "") {
      summary.call_summary.customer_name = customerName;
      summary.account_name = customerName;
    }
    if (customerAccount != null && customerAccount !== "") {
      summary.call_summary.customer_account = customerAccount;
      summary.account_id = customerAccount;
    }

    const collection = await getCallHistoryCollection();
    const recordWithTranscript: CallRecord = {
      ...summary,
      stored_transcript: transcript,
    };

    // When MongoDB is unavailable (e.g. demo deployments without MONGODB_URI),
    // treat storage as optional: return the record so the UI has a summary,
    // but mark that it was not persisted.
    if (!collection) {
      console.warn(
        "[CallHistory] MongoDB not configured or unavailable. Returning summary without persistence."
      );
      return NextResponse.json({
        ...recordWithTranscript,
        savedToHistory: false,
        _storage: "unavailable",
      });
    }

    await collection.insertOne({
      ...recordWithTranscript,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ...recordWithTranscript,
      savedToHistory: true,
      _storage: "mongodb",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
