import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import Booking from "@/models/Booking";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await connectMongo();

    // 只 count，不 populate、不跑 expiry、不拉整表
    const count = await Booking.countDocuments({
      organizer: session.user.id,
      status: "pending",
    });

    return NextResponse.json(
      { count },
      {
        headers: {
          // 瀏覽器短快取，切頁時少打幾次
          "Cache-Control": "private, max-age=15",
        },
      }
    );
  } catch (e) {
    console.error("GET /api/bookings/pending-count error:", e);
    return NextResponse.json({ count: 0 });
  }
}
