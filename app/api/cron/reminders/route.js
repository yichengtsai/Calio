import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { sendDueReminders } from "@/libs/reminders";
import {
  processDueSessionDeductions,
  expirePendingPastStart,
} from "@/libs/sessions";

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const authorized = bearer === secret || isVercelCron;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongo();
    const [reminders, deductions, pendingExpiry] = await Promise.all([
      sendDueReminders(),
      processDueSessionDeductions(),
      expirePendingPastStart(),
    ]);
    return NextResponse.json({
      success: true,
      reminders,
      sessionDeductions: deductions,
      pendingPastStartCancelled: pendingExpiry,
    });
  } catch (e) {
    console.error("GET /api/cron/reminders error:", e);
    return NextResponse.json(
      { error: "Something went wrong while running cron jobs" },
      { status: 500 }
    );
  }
}
