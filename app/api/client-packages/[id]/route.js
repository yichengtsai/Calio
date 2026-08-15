import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import ClientPackage from "@/models/ClientPackage";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  await connectMongo();

  const pkg = await ClientPackage.findOne({
    _id: id,
    organizer: session.user.id,
  });
  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // 手動調整：setTotal / setUsed / adjustRemaining (+/-)
  if (body.inviteeName !== undefined) pkg.inviteeName = body.inviteeName;
  if (body.notes !== undefined) pkg.notes = body.notes;
  if (body.status !== undefined && ["active", "depleted", "paused"].includes(body.status)) {
    pkg.status = body.status;
  }
  if (body.totalSessions !== undefined) {
    const t = Number(body.totalSessions);
    if (!Number.isFinite(t) || t < 1) {
      return NextResponse.json({ error: "totalSessions must be >= 1" }, { status: 400 });
    }
    pkg.totalSessions = t;
  }
  if (body.usedSessions !== undefined) {
    const u = Number(body.usedSessions);
    if (!Number.isFinite(u) || u < 0) {
      return NextResponse.json({ error: "usedSessions must be >= 0" }, { status: 400 });
    }
    pkg.usedSessions = Math.min(u, pkg.totalSessions);
  }
  if (body.adjustRemaining !== undefined) {
    // +N 減少 used；-N 增加 used
    const adj = Number(body.adjustRemaining);
    if (Number.isFinite(adj) && adj !== 0) {
      pkg.usedSessions = Math.max(
        0,
        Math.min(pkg.totalSessions, (pkg.usedSessions || 0) - adj)
      );
    }
  }

  if (pkg.usedSessions >= pkg.totalSessions) {
    pkg.status = pkg.status === "paused" ? "paused" : "depleted";
  } else if (pkg.status === "depleted") {
    pkg.status = "active";
  }

  await pkg.save();

  return NextResponse.json({
    package: {
      ...pkg.toJSON(),
      remainingSessions: Math.max(0, pkg.totalSessions - pkg.usedSessions),
    },
  });
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  await connectMongo();

  const pkg = await ClientPackage.findOneAndDelete({
    _id: id,
    organizer: session.user.id,
  });
  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
