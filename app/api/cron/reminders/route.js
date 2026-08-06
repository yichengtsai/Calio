import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { sendDueReminders } from "@/libs/reminders";

// 給外部排程服務(Vercel Cron / cron-job.org / GitHub Actions schedule...)固定觸發的端點。
// 建議每 5-10 分鐘打一次;打太稀疏的話,有些提醒窗口可能會被整個跳過(見 libs/reminders.js 的說明)。
//
// 保護方式:帶 Authorization: Bearer <CRON_SECRET>,值要跟 .env.local 裡的 CRON_SECRET 一致。
// 沒設定 CRON_SECRET 的話,為了避免正式站不小心整個公開,這支端點會直接回 500 拒絕執行。
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongo();
    const result = await sendDueReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("GET /api/cron/reminders error:", e);
    return NextResponse.json(
      { error: "Something went wrong while sending reminders" },
      { status: 500 }
    );
  }
}
