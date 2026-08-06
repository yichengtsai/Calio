import { google } from "googleapis";
import mongoose from "mongoose";
import connectMongo from "@/libs/mongoose";

/**
 * NextAuth 的 MongoDBAdapter 會把 OAuth token 存在 "accounts" collection 裡,
 * 這個 collection 沒有對應的 Mongoose model(是 adapter 自己管的),
 * 所以直接用底層的 mongodb driver 查。
 */
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
        // Google 不一定每次都回傳新的 refresh_token,只有回傳時才覆蓋
        ...(tokens.refresh_token
          ? { refresh_token: tokens.refresh_token }
          : {}),
      },
    }
  );
}

/**
 * 取得該使用者已授權的 Google Calendar client。
 * 如果使用者當初登入時沒有同意 calendar 權限(或還沒重新登入拿新 scope),回傳 null。
 */
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

  // access_token 過期時,googleapis 會自動用 refresh_token 換新的,
  // 這裡監聽事件把新 token 存回資料庫,下次才不用重新走一次刷新流程
  oauth2Client.on("tokens", (tokens) => {
    persistRefreshedTokens(account._id, tokens).catch((e) =>
      console.error("Failed to persist refreshed Google tokens:", e)
    );
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * 用 Google 的 Free/Busy API 查詢這段時間使用者的 Google Calendar 是否已經有事情。
 * 回傳 { checked: boolean, conflicts: Array<{start, end}> }
 * checked = false 代表使用者沒有連結 Google Calendar,無法檢查(不視為衝突)
 */
export async function checkCalendarConflict(userId, startTime, endTime) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) {
    return { checked: false, conflicts: [] };
  }

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busy = res.data.calendars?.primary?.busy || [];
    return { checked: true, conflicts: busy };
  } catch (e) {
    console.error("Google Free/Busy check failed:", e.message);
    // API 查詢失敗不應該擋住整個建立行程流程,當作沒檢查成功處理
    return { checked: false, conflicts: [] };
  }
}

/**
 * 把行程寫回使用者的 Google Calendar 主行事曆,回傳 Google 那邊的 event id
 * (存起來以後才能做「更新/刪除也同步」)。失敗回傳 null,不中斷主流程。
 */
export async function pushEventToGoogleCalendar(userId, event) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) return null;

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: event.timezone,
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: event.timezone,
        },
        attendees: event.participants.map((p) => ({
          email: p.email,
          displayName: p.name || undefined,
        })),
      },
      sendUpdates: "none", // 我們自己有寄通知信了,不用讓 Google 也重複寄一次邀請信
    });

    return res.data.id || null;
  } catch (e) {
    console.error("Failed to push event to Google Calendar:", e.message);
    return null;
  }
}
