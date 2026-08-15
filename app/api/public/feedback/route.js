import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import Feedback from "@/models/Feedback";
import { rateLimit, getClientIp } from "@/libs/rateLimit";

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`feedback:${ip}`, 8, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const message = String(body.message || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const category = ["idea", "bug", "other"].includes(body.category)
      ? body.category
      : "idea";
    const username = String(body.username || "").trim().toLowerCase();
    const sourcePath = String(body.sourcePath || "").trim().slice(0, 300);

    if (!message || message.length < 3) {
      return NextResponse.json(
        { error: "Please write a short message (at least a few characters)." },
        { status: 400 }
      );
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    await connectMongo();

    let organizer = null;
    if (username) {
      organizer = await User.findOne({ username }).select("_id username");
    }

    const doc = await Feedback.create({
      organizer: organizer?._id,
      organizerUsername: organizer?.username || username || undefined,
      email: email || undefined,
      name: name || undefined,
      category,
      message,
      sourcePath: sourcePath || undefined,
      status: "new",
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (e) {
    console.error("POST feedback", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
