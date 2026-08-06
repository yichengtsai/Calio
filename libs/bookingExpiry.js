import Booking from "@/models/Booking";
import User from "@/models/User";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { buildExpiredEmail } from "@/libs/emails/bookingConfirmation";

const PENDING_EXPIRY_HOURS = 48;

/**
 * 沒有背景排程系統(cron worker)的情況下,用「隨機應變」的方式處理逾期:
 * 每次有人真的去查詢這個 organizer 的預約列表時,先做一次「順手清理」,
 * 把超過 48 小時還沒審核的 pending 預約標記成 expired、寄信通知對方。
 * 缺點是如果完全沒人查詢,逾期的預約不會主動被處理,但對 MVP 規模來說足夠。
 */
export async function expireStalePendingBookings(organizerId) {
  const cutoff = new Date(Date.now() - PENDING_EXPIRY_HOURS * 60 * 60 * 1000);

  const stale = await Booking.find({
    organizer: organizerId,
    status: "pending",
    createdAt: { $lt: cutoff },
  }).populate("eventType", "title");

  if (!stale.length) return;

  const organizer = await User.findById(organizerId);
  const timezone = organizer?.timezone || "Asia/Taipei";

  await Promise.all(
    stale.map(async (booking) => {
      booking.status = "expired";
      booking.respondedAt = new Date();
      await booking.save();

      await resend.emails
        .send({
          from: EMAIL_FROM,
          to: booking.inviteeEmail,
          ...buildExpiredEmail({
            eventTitle: booking.eventType?.title || "Event",
            organizerName: organizer?.name || organizer?.email,
            startTime: booking.startTime,
            endTime: booking.endTime,
            timezone,
            inviteeName: booking.inviteeName,
          }),
        })
        .catch((e) => console.error("Failed to send expiry email:", e.message));
    })
  );
}
