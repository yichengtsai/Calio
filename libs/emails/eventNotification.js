import { escapeHtml, safeUrl } from "./escapeHtml";

function formatDateRange(start, end, timezone) {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  });
  const startStr = dateFmt.format(start);
  const endTimeOnly = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: timezone,
  }).format(end);

  return `${startStr} - ${endTimeOnly}`;
}

/**
 * Builds the HTML content for an event invite/notification email
 * @param {Object} params
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {Date} params.startTime
 * @param {Date} params.endTime
 * @param {string} params.timezone
 * @param {string} [params.location]
 * @param {string} [params.meetingUrl]
 * @param {string} params.organizerName
 * @param {string} [params.participantName]
 * @param {string} params.confirmUrl
 */
export function buildEventNotificationEmail(params) {
  const {
    title,
    description,
    startTime,
    endTime,
    timezone,
    location,
    meetingUrl,
    organizerName,
    participantName,
    confirmUrl,
  } = params;

  const when = formatDateRange(startTime, endTime, timezone);
  const safeName = escapeHtml(participantName);
  const greeting = safeName ? `Hi ${safeName}` : "Hi there";
  const meetingLink = safeUrl(meetingUrl);

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">${escapeHtml(organizerName)} invited you to</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(title)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">When</td>
        <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${when}</td>
      </tr>
      ${location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Where</td><td style="padding: 8px 0; font-size: 14px;">${escapeHtml(location)}</td></tr>` : ""}
      ${meetingLink ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Meeting link</td><td style="padding: 8px 0; font-size: 14px;"><a href="${meetingLink}" style="color: #2563eb;">${meetingLink}</a></td></tr>` : ""}
    </table>

    ${description ? `<p style="font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 24px;">${escapeHtml(description)}</p>` : ""}

    <p style="font-size: 14px; margin-bottom: 16px;">${greeting}, please let us know if you can make it:</p>

    <a href="${safeUrl(confirmUrl)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600;">
      Confirm attendance
    </a>

    <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">This is an automated message — please don't reply to this email.</p>
  </div>
  `;

  return {
    subject: `Invitation: ${title} (${when})`,
    html,
  };
}

/**
 * 取消行程時,寄給每位參與者的通知信
 */
export function buildEventCancellationEmail(params) {
  const { title, startTime, endTime, timezone, organizerName, participantName } = params;

  const when = formatDateRange(startTime, endTime, timezone);
  const safeName = escapeHtml(participantName);
  const greeting = safeName ? `Hi ${safeName}` : "Hi there";

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px;">Cancelled by ${escapeHtml(organizerName)}</p>
    <h1 style="font-size: 22px; margin: 0 0 20px; line-height: 1.4;">${escapeHtml(title)}</h1>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">Was</td>
        <td style="padding: 8px 0; font-size: 14px; text-decoration: line-through; color: #9ca3af;">${when}</td>
      </tr>
    </table>

    <p style="font-size: 14px;">${greeting}, this event has been cancelled.</p>

    <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">This is an automated message — please don't reply to this email.</p>
  </div>
  `;

  return {
    subject: `Cancelled: ${title} (${when})`,
    html,
  };
}
