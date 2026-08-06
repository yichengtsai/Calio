import { escapeHtml } from "./escapeHtml";

function formatWhen(start, end, timezone) {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  });
  const endTimeOnly = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: timezone,
  }).format(end);

  return `${dateFmt.format(start)} - ${endTimeOnly}`;
}

function wrapEmail(bodyHtml) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
    ${bodyHtml}
    <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">This is an automated message — please don't reply to this email.</p>
  </div>
  `;
}

/**
 * 給預約人(invitee)的確認信
 */
export function buildInviteeConfirmationEmail({
  eventTitle,
  organizerName,
  startTime,
  endTime,
  timezone,
  location,
  inviteeName,
  cancelUrl,
}) {
  const when = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Confirmed with ${escapeHtml(organizerName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">When</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${when}</td>
      </tr>
      ${location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Where</td><td style="padding: 8px 0; font-size: 14px;">${escapeHtml(location)}</td></tr>` : ""}
    </table>

    <p style="font-size: 14px;">Hi ${escapeHtml(inviteeName)}, you're all set — this has been added as confirmed.</p>

    ${cancelUrl ? `<p style="font-size: 13px; margin-top: 20px;"><a href="${escapeHtml(cancelUrl)}" style="color: #6b7280;">Need to cancel? Click here</a></p>` : ""}
  `);

  return { subject: `Confirmed: ${eventTitle} (${when})`, html };
}

/**
 * 給主辦人(organizer)的新預約「請求」通知信,提醒要去後台審核
 */
export function buildOrganizerNotificationEmail({
  eventTitle,
  startTime,
  endTime,
  timezone,
  location,
  inviteeName,
  inviteeEmail,
  inviteeNotes,
  reviewUrl,
}) {
  const when = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Needs your approval</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 90px;">When</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${when}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Requested by</td>
        <td style="padding: 8px 0; font-size: 14px;">${escapeHtml(inviteeName)} (${escapeHtml(inviteeEmail)})</td>
      </tr>
      ${location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Where</td><td style="padding: 8px 0; font-size: 14px;">${escapeHtml(location)}</td></tr>` : ""}
    </table>

    ${inviteeNotes ? `<p style="font-size: 14px; line-height: 1.6; color: #374151;"><strong>Notes:</strong> ${escapeHtml(inviteeNotes)}</p>` : ""}

    <p style="font-size: 14px; margin-top: 20px;">This time is being held for them, but nothing is confirmed until you approve it.</p>

    ${reviewUrl ? `<a href="${escapeHtml(reviewUrl)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 12px;">Review request</a>` : ""}
  `);

  return { subject: `Action needed: ${inviteeName} wants to book ${eventTitle}`, html };
}

/**
 * 給預約人(invitee)的「已收到請求,等待審核」信
 */
export function buildRequestReceivedEmail({ eventTitle, organizerName, startTime, endTime, timezone, inviteeName, cancelUrl }) {
  const when = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Request sent to ${escapeHtml(organizerName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">Requested</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${when}</td>
      </tr>
    </table>

    <p style="font-size: 14px;">Hi ${escapeHtml(inviteeName)}, this time isn't confirmed yet — ${escapeHtml(organizerName)} needs to approve it first. We'll email you as soon as they respond.</p>

    ${cancelUrl ? `<p style="font-size: 13px; margin-top: 20px;"><a href="${escapeHtml(cancelUrl)}" style="color: #6b7280;">Changed your mind? Cancel this request</a></p>` : ""}
  `);

  return { subject: `Request sent: ${eventTitle} (${when})`, html };
}

/**
 * 給預約人(invitee)的「主辦人拒絕」信
 */
export function buildDeclinedEmail({ eventTitle, organizerName, startTime, endTime, timezone, inviteeName }) {
  const when = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Not available</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">Requested</td>
        <td style="padding: 8px 0; font-size: 14px; text-decoration: line-through; color: #9ca3af;">${when}</td>
      </tr>
    </table>

    <p style="font-size: 14px;">Hi ${escapeHtml(inviteeName)}, ${escapeHtml(organizerName)} isn't able to make this time. Feel free to pick another time that works.</p>
  `);

  return { subject: `Unavailable: ${eventTitle} (${when})`, html };
}

/**
 * 主辦人改了預約時間後,寄給預約人(invitee)的「已改期」通知信
 */
export function buildRescheduledEmail({
  eventTitle,
  organizerName,
  previousStartTime,
  previousEndTime,
  startTime,
  endTime,
  timezone,
  inviteeName,
  cancelUrl,
}) {
  const was = formatWhen(previousStartTime, previousEndTime, timezone);
  const now2 = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #b45309; margin: 0 0 4px; font-weight: 600;">Rescheduled by ${escapeHtml(organizerName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">Was</td>
        <td style="padding: 8px 0; font-size: 14px; text-decoration: line-through; color: #9ca3af;">${was}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Now</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${now2}</td>
      </tr>
    </table>

    <p style="font-size: 14px;">Hi ${escapeHtml(inviteeName)}, this booking has moved to a new time — it's still confirmed, no action needed.</p>

    ${cancelUrl ? `<p style="font-size: 13px; margin-top: 20px;"><a href="${escapeHtml(cancelUrl)}" style="color: #6b7280;">Can't make the new time? Cancel here</a></p>` : ""}
  `);

  return { subject: `Rescheduled: ${eventTitle} (${now2})`, html };
}

/**
 * 給預約人(invitee)的取消通知信
 */
export function buildCancellationEmail({
  eventTitle,
  organizerName,
  startTime,
  endTime,
  timezone,
  inviteeName,
}) {
  const when = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Cancelled by ${escapeHtml(organizerName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">Was</td>
        <td style="padding: 8px 0; font-size: 14px; text-decoration: line-through; color: #9ca3af;">${when}</td>
      </tr>
    </table>

    <p style="font-size: 14px;">Hi ${escapeHtml(inviteeName)}, this booking has been cancelled. Feel free to book another time if you'd like.</p>
  `);

  return { subject: `Cancelled: ${eventTitle} (${when})`, html };
}

/**
 * 自動確認模式下,給主辦人的通知信(不需要動作,純知會)
 */
export function buildOrganizerAutoConfirmedEmail({
  eventTitle,
  startTime,
  endTime,
  timezone,
  location,
  inviteeName,
  inviteeEmail,
  inviteeNotes,
}) {
  const when = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">New booking (auto-confirmed)</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 90px;">When</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${when}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Booked by</td>
        <td style="padding: 8px 0; font-size: 14px;">${escapeHtml(inviteeName)} (${escapeHtml(inviteeEmail)})</td>
      </tr>
      ${location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Where</td><td style="padding: 8px 0; font-size: 14px;">${escapeHtml(location)}</td></tr>` : ""}
    </table>

    ${inviteeNotes ? `<p style="font-size: 14px; line-height: 1.6; color: #374151;"><strong>Notes:</strong> ${escapeHtml(inviteeNotes)}</p>` : ""}

    <p style="font-size: 14px; margin-top: 20px; color: #6b7280;">This event type is set to auto-confirm, so it's already on your calendar — no action needed.</p>
  `);

  return { subject: `New booking: ${eventTitle} with ${inviteeName}`, html };
}

/**
 * 開始前 N 分鐘寄給預約人(invitee)的提醒信
 */
export function buildBookingReminderEmail({
  eventTitle,
  organizerName,
  startTime,
  endTime,
  timezone,
  location,
  inviteeName,
  minutesBefore,
}) {
  const when = formatWhen(startTime, endTime, timezone);
  const inLabel =
    minutesBefore % 60 === 0 && minutesBefore >= 60
      ? `${minutesBefore / 60} hour${minutesBefore / 60 === 1 ? "" : "s"}`
      : `${minutesBefore} minutes`;

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Starting in ${inLabel}</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">When</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${when}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">With</td>
        <td style="padding: 8px 0; font-size: 14px;">${escapeHtml(organizerName)}</td>
      </tr>
      ${location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Where</td><td style="padding: 8px 0; font-size: 14px;">${escapeHtml(location)}</td></tr>` : ""}
    </table>

    <p style="font-size: 14px;">Hi ${escapeHtml(inviteeName)}, just a heads up — this is coming up soon.</p>
  `);

  return { subject: `Reminder: ${eventTitle} in ${inLabel}`, html };
}

/**
 * 待審核逾時沒被主辦人處理,自動判定過期時寄給預約人的信
 */
export function buildExpiredEmail({ eventTitle, organizerName, startTime, endTime, timezone, inviteeName }) {
  const when = formatWhen(startTime, endTime, timezone);

  const html = wrapEmail(`
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Request expired</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(eventTitle)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">Requested</td>
        <td style="padding: 8px 0; font-size: 14px; text-decoration: line-through; color: #9ca3af;">${when}</td>
      </tr>
    </table>

    <p style="font-size: 14px;">Hi ${escapeHtml(inviteeName)}, ${escapeHtml(organizerName)} didn't respond to this request in time, so it's been automatically cancelled. Feel free to try booking another time.</p>
  `);

  return { subject: `Expired: ${eventTitle} (${when})`, html };
}
