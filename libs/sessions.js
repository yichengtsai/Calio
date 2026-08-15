import ClientPackage from "@/models/ClientPackage";
import Booking from "@/models/Booking";

/**
 * 找可用方案：同教練 + 同活動 + email，剩餘 > 0，狀態 active
 * 多筆時取最早建立的
 */
export async function findAvailablePackage({
  organizerId,
  eventTypeId,
  inviteeEmail,
}) {
  const email = String(inviteeEmail || "").trim().toLowerCase();
  if (!email) return null;

  const packages = await ClientPackage.find({
    organizer: organizerId,
    eventType: eventTypeId,
    inviteeEmail: email,
    status: "active",
  }).sort({ createdAt: 1 });

  for (const pkg of packages) {
    const remaining = Math.max(0, pkg.totalSessions - pkg.usedSessions);
    if (remaining > 0) return pkg;
  }
  return null;
}

export function packageRemaining(pkg) {
  if (!pkg) return 0;
  return Math.max(0, (pkg.totalSessions || 0) - (pkg.usedSessions || 0));
}

/**
 * 扣 1 堂（已扣過的預約跳過）
 */
export async function deductSessionForBooking(booking) {
  if (!booking || booking.sessionDeductedAt) return { deducted: false };
  if (booking.status !== "confirmed") return { deducted: false };
  if (!booking.sessionPackage) return { deducted: false };

  const pkg = await ClientPackage.findById(booking.sessionPackage);
  if (!pkg) {
    booking.sessionDeductedAt = new Date();
    await booking.save();
    return { deducted: false, reason: "package_missing" };
  }

  pkg.usedSessions = Math.min(
    pkg.totalSessions,
    (pkg.usedSessions || 0) + 1
  );
  if (pkg.usedSessions >= pkg.totalSessions) {
    pkg.status = "depleted";
  }
  await pkg.save();

  booking.sessionDeductedAt = new Date();
  await booking.save();

  return { deducted: true, remaining: packageRemaining(pkg) };
}

/**
 * 開始時間已過的 confirmed + 有方案 + 未扣 → 扣堂
 */
export async function processDueSessionDeductions() {
  const now = new Date();
  const due = await Booking.find({
    status: "confirmed",
    sessionPackage: { $ne: null },
    sessionDeductedAt: null,
    startTime: { $lte: now },
  }).limit(200);

  let deducted = 0;
  for (const b of due) {
    try {
      const r = await deductSessionForBooking(b);
      if (r.deducted) deducted += 1;
    } catch (e) {
      console.error("deductSessionForBooking", b._id, e.message);
    }
  }
  return { deducted, checked: due.length };
}

/**
 * pending 拖過開始時間 → 自動取消
 */
export async function expirePendingPastStart() {
  const now = new Date();
  const stale = await Booking.find({
    status: "pending",
    startTime: { $lte: now },
  }).limit(200);

  let cancelled = 0;
  for (const b of stale) {
    b.status = "cancelled";
    b.cancelledAt = now;
    b.cancelReason = "Automatically cancelled — start time passed while still pending";
    await b.save();
    cancelled += 1;
  }
  return { cancelled };
}
