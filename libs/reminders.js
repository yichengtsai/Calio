import Booking from "@/models/Booking";
import Event from "@/models/Event";
import User from "@/models/User";
import EventType from "@/models/EventType";
import { resend, EMAIL_FROM } from "@/libs/resend";
import { buildBookingReminderEmail } from "@/libs/emails/bookingConfirmation";
import { buildEventReminderEmail } from "@/libs/emails/eventNotification";

/**
 * 提醒信是「拉」的模式,不是背景常駐服務——需要有人(排程服務)定期打
 * /api/cron/reminders 才會真的檢查、寄信,跟 bookingExpiry.js 的懶惰清理是同一種精神,
 * 差別只在這個需要真的準時,所以得靠外部排程器固定觸發,不能等使用者剛好上線才順便觸發。
 *
 * 判斷邏輯:reminderMinutesBefore > 0,還沒寄過(reminderSentAt 是空的),
 * 而且「現在」已經進入 [開始時間 - 提醒分鐘數, 開始時間) 這個窗口內。
 * 如果排程器間隔比提醒窗口還長,有可能整個窗口被跳過而漏寄——這是已知取捨,
 * 排程器建議至少每 5-10 分鐘打一次。
 */

const CHECK_WINDOW_PAST_MINUTES = 60 * 24; // 保險上限:不要去翻超過一天前就該寄卻沒寄到的舊資料

async function sendBookingReminders() {
  const now = new Date();
  const earliestRelevantStart = new Date(now.getTime() - CHECK_WINDOW_PAST_MINUTES * 60 * 1000);

  const candidates = await Booking.find({
    status: "confirmed",
    reminderSentAt: null,
    startTime: { $gt: earliestRelevantStart },
  }).populate("eventType", "title duration location reminderMinutesBefore");

  let sent = 0;
  let failed = 0;

  for (const booking of candidates) {
    const minutesBefore = booking.eventType?.reminderMinutesBefore;
    if (!minutesBefore || minutesBefore <= 0) continue;

    const dueAt = new Date(booking.startTime.getTime() - minutesBefore * 60 * 1000);
    if (now < dueAt || now >= booking.startTime) continue; // 還沒到窗口,或已經開始了就不寄了

    try {
      const organizer = await User.findById(booking.organizer);
      const timezone = organizer?.timezone || "Asia/Taipei";

      const reminderPayload = buildBookingReminderEmail({
        eventTitle: booking.eventType?.title || "Event",
        organizerName: organizer?.name || organizer?.email,
        startTime: booking.startTime,
        endTime: booking.endTime,
        timezone,
        location: booking.eventType?.location,
        meetingUrl: booking.meetingUrl,
        inviteeName: booking.inviteeName,
        minutesBefore,
      });

      // 預約人
      await resend.emails.send({
        from: EMAIL_FROM,
        to: booking.inviteeEmail,
        ...reminderPayload,
      });

      // 主辦人也收一封
      if (organizer?.email) {
        await resend.emails
          .send({
            from: EMAIL_FROM,
            to: organizer.email,
            ...reminderPayload,
            subject: `[Host] ${reminderPayload.subject}`,
          })
          .catch((e) =>
            console.error(`Failed to send host reminder for ${booking._id}:`, e.message)
          );
      }

      booking.reminderSentAt = now;
      await booking.save();
      sent += 1;
    } catch (e) {
      console.error(`Failed to send booking reminder for ${booking._id}:`, e.message);
      failed += 1;
    }
  }

  return { sent, failed };
}

async function sendEventReminders() {
  const now = new Date();
  const earliestRelevantStart = new Date(now.getTime() - CHECK_WINDOW_PAST_MINUTES * 60 * 1000);

  const candidates = await Event.find({
    status: "scheduled",
    reminderSentAt: null,
    reminderMinutesBefore: { $gt: 0 },
    startTime: { $gt: earliestRelevantStart },
  });

  let sent = 0;
  let failed = 0;

  for (const event of candidates) {
    const minutesBefore = event.reminderMinutesBefore;
    const dueAt = new Date(event.startTime.getTime() - minutesBefore * 60 * 1000);
    if (now < dueAt || now >= event.startTime) continue;

    try {
      const organizer = await User.findById(event.organizer);
      const timezone = event.timezone || organizer?.timezone || "Asia/Taipei";

      const results = await Promise.allSettled(
        event.participants.map((participant) =>
          resend.emails.send({
            from: EMAIL_FROM,
            to: participant.email,
            ...buildEventReminderEmail({
              title: event.title,
              startTime: event.startTime,
              endTime: event.endTime,
              timezone,
              location: event.location,
              meetingUrl: event.meetingUrl,
              organizerName: organizer?.name || organizer?.email,
              participantName: participant.name,
              minutesBefore,
            }),
          })
        )
      );

      event.reminderSentAt = now;
      await event.save();
      sent += results.filter((r) => r.status === "fulfilled").length;
      failed += results.filter((r) => r.status === "rejected").length;
    } catch (e) {
      console.error(`Failed to send event reminders for ${event._id}:`, e.message);
      failed += 1;
    }
  }

  return { sent, failed };
}

export async function sendDueReminders() {
  const [bookingResult, eventResult] = await Promise.all([
    sendBookingReminders(),
    sendEventReminders(),
  ]);

  return {
    bookings: bookingResult,
    events: eventResult,
    totalSent: bookingResult.sent + eventResult.sent,
    totalFailed: bookingResult.failed + eventResult.failed,
  };
}
