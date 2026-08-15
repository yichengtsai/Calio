import ClientPackage from "@/models/ClientPackage";
import Booking from "@/models/Booking";

/**
 * 尚未扣堂、仍佔用額度的預約：pending / confirmed，且 sessionDeductedAt 為空
 * （取消、拒絕、過期不佔堂）
 */
export async function countReservedSessions(packageId) {
  if (!packageId) return 0;
  return Booking.countDocuments({
    sessionPackage: packageId,
    status: { $in: ["pending", "confirmed"] },
    sessionDeductedAt: null,
  });
}

/**
 * 真正可用堂數 = total - used - 已預約未扣
 */
export async function getPackageAvailability(pkg) {
  if (!pkg) {
    return {
      totalSessions: 0,
      usedSessions: 0,
      reservedSessions: 0,
      remainingSessions: 0,
    };
  }
  const total = Number(pkg.totalSessions) || 0;
  const used = Number(pkg.usedSessions) || 0;
  const reserved = await countReservedSessions(pkg._id || pkg.id);
  const remaining = Math.max(0, total - used - reserved);
  return {
    totalSessions: total,
    usedSessions: used,
    reservedSessions: reserved,
    remainingSessions: remaining,
  };
}

/**
 * 同步版（已有 reserved 數字時）
 */
export function packageRemainingFromParts(total, used, reserved = 0) {
  return Math.max(0, (total || 0) - (used || 0) - (reserved || 0));
}

/** @deprecated 未含已預約；請用 getPackageAvailability */
export function packageRemaining(pkg) {
  if (!pkg) return 0;
  return Math.max(0, (pkg.totalSessions || 0) - (pkg.usedSessions || 0));
}

/**
 * 找可用方案：同教練 + 同活動 + email，真正剩餘 > 0，狀態 active
 * 多筆時取最早建立且仍有額度的
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
    const { remainingSessions } = await getPackageAvailability(pkg);
    if (remainingSessions > 0) return pkg;
  }
  return null;
}

/**
 * 同教練 + email + 某課程：加總所有 active 方案的真正可用堂數
 */
export async function getStudentCourseBalance({
  organizerId,
  eventTypeId,
  inviteeEmail,
}) {
  const email = String(inviteeEmail || "").trim().toLowerCase();
  if (!email) {
    return {
      remainingSessions: 0,
      totalSessions: 0,
      usedSessions: 0,
      reservedSessions: 0,
      hasPackage: false,
      inviteeName: null,
      packageId: null,
    };
  }

  const packages = await ClientPackage.find({
    organizer: organizerId,
    eventType: eventTypeId,
    inviteeEmail: email,
    status: "active",
  }).sort({ createdAt: 1 });

  let remainingSessions = 0;
  let totalSessions = 0;
  let usedSessions = 0;
  let reservedSessions = 0;
  let inviteeName = null;
  let packageId = null;

  for (const pkg of packages) {
    const avail = await getPackageAvailability(pkg);
    remainingSessions += avail.remainingSessions;
    totalSessions += avail.totalSessions;
    usedSessions += avail.usedSessions;
    reservedSessions += avail.reservedSessions;
    if (pkg.inviteeName && !inviteeName) inviteeName = pkg.inviteeName;
    if (avail.remainingSessions > 0 && !packageId) {
      packageId = String(pkg._id);
    }
  }

  return {
    remainingSessions,
    totalSessions,
    usedSessions,
    reservedSessions,
    hasPackage: packages.length > 0,
    inviteeName,
    packageId,
  };
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

  const avail = await getPackageAvailability(pkg);
  return { deducted: true, remaining: avail.remainingSessions };
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
 * pending 拖過開始時間 → 自動取消（不佔堂，因取消後 reserved 不再計入）
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
    b.cancelReason =
      "Automatically cancelled — start time passed while still pending";
    await b.save();
    cancelled += 1;
  }
  return { cancelled };
}
