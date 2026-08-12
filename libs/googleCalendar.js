import { google } from "googleapis";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

async function getGoogleAccount(userId) {
  await connectMongo();
  const db = mongoose.connection.db;
  return db.collection("accounts").findOne({
    userId: new mongoose.Types.ObjectId(userId),
    provider: "google",
  });
}

async function persistRefreshedTokens(accountId, tokens) {
  const db = mongoose.connection.db;
  await db.collection("accounts").updateOne(
    { _id: accountId },
    {
      $set: {
        access_token: tokens.access_token,
        ...(tokens.expiry_date
          ? { expires_at: Math.floor(tokens.expiry_date / 1000) }
          : {}),
        ...(tokens.refresh_token
          ? { refresh_token: tokens.refresh_token }
          : {}),
      },
    }
  );
}

export async function getGoogleCalendarClient(userId) {
  const account = await getGoogleAccount(userId);
  if (!account?.refresh_token) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ID,
    process.env.GOOGLE_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  oauth2Client.on("tokens", (tokens) => {
    persistRefreshedTokens(account._id, tokens).catch((e) =>
      console.error("Failed to persist refreshed Google tokens:", e)
    );
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function isGoogleCalendarConnected(userId) {
  const account = await getGoogleAccount(userId);
  return Boolean(account?.refresh_token);
}

export async function listGoogleCalendars(userId) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) return { calendars: [], error: "not_connected" };

  try {
    // 不加 minAccessRole，避免權限邊界把可用日曆全過濾掉
    const res = await calendar.calendarList.list({ maxResults: 250 });

    const calendars = (res.data.items || []).map((c) => ({
      id: c.id,
      summary: c.summary || c.id,
      primary: Boolean(c.primary),
      accessRole: c.accessRole || null,
      backgroundColor: c.backgroundColor || null,
    }));
    return { calendars, error: null };
  } catch (e) {
    // 常見：token 只有 calendar.events、沒有 calendar.readonly → 403
    console.error("Failed to list Google calendars:", e.code, e.message);
    return {
      calendars: [],
      error: e.code === 403 || /insufficient|scope|permission/i.test(String(e.message))
        ? "missing_scope"
        : "api_error",
      errorMessage: e.message,
    };
  }
}

async function resolveCalendarIds(userId) {
  const user = await User.findById(userId).select("googleCalendarIds").lean();
  const configured = (user?.googleCalendarIds || []).filter(Boolean);
  if (configured.length > 0) return configured;
  return ["primary"];
}

export async function checkCalendarConflict(userId, startTime, endTime) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) {
    return { checked: false, conflicts: [] };
  }

  try {
    const calendarIds = await resolveCalendarIds(userId);

    const freebusyPromise = calendar.freebusy.query({
      requestBody: {
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      },
    });
    // 避免 Google API 卡住拖慢整個建立/取消流程
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("freebusy timeout")), 8000)
    );
    const res = await Promise.race([freebusyPromise, timeoutPromise]);

    const calendars = res.data.calendars || {};
    const conflicts = [];
    for (const id of calendarIds) {
      const busy = calendars[id]?.busy || [];
      for (const b of busy) {
        if (b.start && b.end) {
          conflicts.push({ start: b.start, end: b.end });
        }
      }
    }

    return { checked: true, conflicts };
  } catch (e) {
    console.error("Google Free/Busy check failed:", e.message);
    return { checked: false, conflicts: [] };
  }
}

/**
 * options.createMeet = true 時建立 Google Meet
 * 回傳 string (event id) 或 { id, meetingUrl }
 */
export async function pushEventToGoogleCalendar(userId, event, options = {}) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) return null;

  const { createMeet = false } = options;

  try {
    const requestBody = {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      transparency: "opaque",
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone,
      },
      attendees: (event.participants || []).map((p) => ({
        email: p.email,
        displayName: p.name || undefined,
      })),
    };

    if (createMeet) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: `calio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody,
      conferenceDataVersion: createMeet ? 1 : undefined,
      sendUpdates: "none",
    });

    const id = res.data.id || null;
    if (!id) return null;

    if (createMeet) {
      const meetingUrl =
        res.data.hangoutLink ||
        res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
          ?.uri ||
        null;
      return { id, meetingUrl };
    }

    return id;
  } catch (e) {
    console.error("Failed to push event to Google Calendar:", e.message);
    return null;
  }
}

export async function listGoogleCalendarEvents(userId, timeMin, timeMax) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) return [];

  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    return (res.data.items || [])
      .filter((e) => e.start?.dateTime && e.end?.dateTime && e.status !== "cancelled")
      .map((e) => ({
        googleEventId: e.id,
        title: e.summary || "(No title)",
        startTime: new Date(e.start.dateTime),
        endTime: new Date(e.end.dateTime),
        location: e.location || null,
      }));
  } catch (e) {
    console.error("Failed to list Google Calendar events:", e.message);
    return [];
  }
}

export async function updateGoogleCalendarEvent(userId, googleEventId, event) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar || !googleEventId) return null;

  try {
    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId: googleEventId,
      requestBody: {
        summary: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        transparency: "opaque",
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: event.timezone,
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: event.timezone,
        },
      },
      sendUpdates: "none",
    });

    return res.data.id || null;
  } catch (e) {
    if (e.code === 404 || e.code === 410) {
      return null;
    }
    console.error("Failed to update Google Calendar event:", e.message);
    return googleEventId;
  }
}

export async function deleteGoogleCalendarEvent(userId, googleEventId) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar || !googleEventId) return;

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "none",
    });
  } catch (e) {
    if (e.code === 404 || e.code === 410) return;
    console.error("Failed to delete Google Calendar event:", e.message);
  }
}
