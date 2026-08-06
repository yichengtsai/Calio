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
 * 檢查使用者是否已經連結 Google Calendar(有 refresh_token)。
 * 給前端顯示連結狀態用,不會真的打 Google API。
 */
export async function isGoogleCalendarConnected(userId) {
  const account = await getGoogleAccount(userId);
  return Boolean(account?.refresh_token);
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

/**
 * 單向拉取:讀出使用者 Google Calendar 主行事曆上,落在指定時間範圍內的事件。
 * 用來讓「直接在 Google Calendar 上新增的行程」也能顯示在 Calio 的日曆頁裡。
 * 回傳 [] 代表沒連結 Google Calendar 或查詢失敗,不中斷主流程。
 *
 * 注意:這裡刻意不處理分頁(pageToken)——freebusy 用途的顯示時間範圍通常不會
 * 超過 Google 單頁回傳上限(預設 250 筆),先求簡單堪用,之後真的遇到量大再補分頁。
 */
export async function listGoogleCalendarEvents(userId, timeMin, timeMax) {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) return [];

  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true, // 展開重複事件(recurring event)成一筆一筆,不然只會拿到主事件
      orderBy: "startTime",
      maxResults: 250,
    });

    return (res.data.items || [])
      // 全天事件(只有 date,沒有 dateTime)、被使用者標記「free」的事件先跳過,
      // 不然全天行程會把整個日曆版面撐爆
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

/**
 * 改期/編輯時同步更新 Google Calendar 上已存在的事件(靠先前存的 googleEventId)。
 * 如果找不到那個事件(可能被使用者自己在 Google Calendar 裡刪掉了),就當作沒有,
 * 回傳 null,呼叫端可以自行決定要不要退回成「重新建立一筆新的」。失敗不中斷主流程。
 */
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
    // 404/410 代表那筆事件在 Google 那邊已經不存在了(例如使用者自己刪掉),
    // 這種情況回傳 null,讓呼叫端知道要重新 push 一筆新的,而不是當成暫時性錯誤忽略。
    if (e.code === 404 || e.code === 410) {
      return null;
    }
    console.error("Failed to update Google Calendar event:", e.message);
    return googleEventId; // 未知錯誤:保守起見假設事件還在,不要把 id 弄丟
  }
}

/**
 * 取消/拒絕預約時,把已經寫到 Google Calendar 的事件刪掉,保持雙向同步。
 * 找不到（已經被手動刪掉過）或使用者沒連結 Google Calendar 都當作成功處理,不拋錯。
 */
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
    if (e.code === 404 || e.code === 410 || e.code === 410) return; // 本來就已經不在了
    console.error("Failed to delete Google Calendar event:", e.message);
  }
}
