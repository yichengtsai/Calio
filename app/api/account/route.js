import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";
import { isGoogleCalendarConnected } from "@/libs/googleCalendar";
import { FREE_EVENT_TYPE_LIMIT } from "@/libs/plans";

// 這些路徑是系統本來就在用的,不能讓使用者拿去當 username,不然自己的預約頁網址會撞路由
const RESERVED_USERNAMES = [
  "dashboard",
  "api",
  "events",
  "auth",
  "login",
  "logout",
  "signup",
  "signin",
  "settings",
  "admin",
  "app",
  "www",
  "static",
  "public",
  "assets",
  "help",
  "support",
  "about",
  "pricing",
  "blog",
  "privacy-policy",
  "tos",
  "terms",
];

// 產生 3 碼隨機亂碼(小寫字母+數字),接在使用者填的 base 後面組成完整 username。
// 目的是讓別人不能單憑姓名/公司名猜到預約頁網址就亂槍打鳥送預約請求。
function randomSuffix(length = 3) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();
  const user = await User.findById(session.user.id);
  const [googleCalendarConnected, eventTypeCount] = await Promise.all([
    isGoogleCalendarConnected(session.user.id),
    EventType.countDocuments({ user: session.user.id }),
  ]);

  return NextResponse.json({
    name: user?.name || "",
    // usernameBase 是編輯輸入框用的「好記」名稱;username 是含隨機尾碼的完整值,只用來顯示/複製網址
    usernameBase: user?.usernameBase || "",
    username: user?.username || "",
    bio: user?.bio || "",
    image: user?.image || "",
    brandColor: user?.brandColor || "#6366f1",
    logoUrl: user?.logoUrl || "",
    welcomeMessage: user?.welcomeMessage || "",
    title: user?.title || "",
    socialLinks: {
      linkedin: user?.socialLinks?.linkedin || "",
      website: user?.socialLinks?.website || "",
      instagram: user?.socialLinks?.instagram || "",
    },
    policyNotes: user?.policyNotes || "",
    tags: user?.tags || [],
    plan: {
      hasAccess: Boolean(user?.hasAccess),
      googleCalendarConnected,
      // Free 版連結了 Google 帳號也不會真的雙向同步,要升級才會啟用
      googleCalendarSyncActive: Boolean(user?.hasAccess) && googleCalendarConnected,
      eventTypeCount,
      eventTypeLimit: user?.hasAccess ? null : FREE_EVENT_TYPE_LIMIT,
    },
  });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const { name, username, bio, brandColor, logoUrl, welcomeMessage, title, socialLinks, policyNotes, tags } = body;

  await connectMongo();

  const currentUser = await User.findById(session.user.id);

  const updates = {};

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updates.name = name.trim();
  }

  // 這裡的 `username` 其實是使用者填的「好記」那段(base),不是最終網址。
  // 真正的 username 一律是 `${base}-${隨機3碼}`,只有 base 真的變了才會重新產生亂碼,
  // 不然每次存設定都換網址,之前分享出去的連結會全部失效。
  if (username !== undefined) {
    const normalizedBase = username.trim().toLowerCase();

    if (!/^[a-z0-9-]{3,30}$/.test(normalizedBase)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-30 characters: lowercase letters, numbers, and hyphens only",
        },
        { status: 400 }
      );
    }

    if (RESERVED_USERNAMES.includes(normalizedBase)) {
      return NextResponse.json(
        { error: "This username is reserved, please choose another" },
        { status: 400 }
      );
    }

    const baseUnchanged =
      currentUser?.usernameBase === normalizedBase && Boolean(currentUser?.username);

    if (!baseUnchanged) {
      let candidate;
      let attempts = 0;
      do {
        candidate = `${normalizedBase}-${randomSuffix()}`;
        attempts += 1;
        // 3 碼亂碼空間是 36^3 = 46656 種組合,撞到的機率很低,但保險起見還是重抽,
        // 抽太多次抽不到就拉長亂碼長度,避免無窮迴圈卡住整個請求。
      } while (
        (await User.exists({ username: candidate, _id: { $ne: session.user.id } })) &&
        attempts < 20
      );

      if (attempts >= 20) {
        candidate = `${normalizedBase}-${randomSuffix(6)}`;
      }

      updates.username = candidate;
      updates.usernameBase = normalizedBase;
    }
  }

  if (bio !== undefined) {
    if (bio.length > 280) {
      return NextResponse.json(
        { error: "Bio must be 280 characters or fewer" },
        { status: 400 }
      );
    }
    updates.bio = bio;
  }

  if (brandColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return NextResponse.json(
        { error: "Brand color must be a valid hex code, e.g. #6366f1" },
        { status: 400 }
      );
    }
    updates.brandColor = brandColor;
  }

  if (logoUrl !== undefined) {
    if (logoUrl && !/^(https?:\/\/|data:image\/)/.test(logoUrl)) {
      return NextResponse.json(
        { error: "Logo must be an uploaded image or a URL starting with http:// or https://" },
        { status: 400 }
      );
    }
    // 前端有先壓縮圖片,但不能只信任前端——這裡再擋一次真正的大小上限(base64 字串長度換算實際位元組數)
    if (logoUrl?.startsWith("data:image/")) {
      const approxBytes = (logoUrl.length * 3) / 4;
      if (approxBytes > 2 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Logo image is too large. Please choose a smaller image." },
          { status: 400 }
        );
      }
    }
    updates.logoUrl = logoUrl;
  }

  if (welcomeMessage !== undefined) {
    if (welcomeMessage.length > 300) {
      return NextResponse.json(
        { error: "Welcome message must be 300 characters or fewer" },
        { status: 400 }
      );
    }
    updates.welcomeMessage = welcomeMessage;
  }

  if (title !== undefined) {
    if (title.length > 100) {
      return NextResponse.json(
        { error: "Title must be 100 characters or fewer" },
        { status: 400 }
      );
    }
    updates.title = title;
  }

  if (socialLinks !== undefined) {
    const urlOrEmpty = (v) => !v || /^https?:\/\//.test(v);
    if (
      !urlOrEmpty(socialLinks.linkedin) ||
      !urlOrEmpty(socialLinks.website) ||
      !urlOrEmpty(socialLinks.instagram)
    ) {
      return NextResponse.json(
        { error: "Social links must be full URLs starting with http:// or https://" },
        { status: 400 }
      );
    }
    updates.socialLinks = {
      linkedin: socialLinks.linkedin || "",
      website: socialLinks.website || "",
      instagram: socialLinks.instagram || "",
    };
  }

  if (policyNotes !== undefined) {
    if (policyNotes.length > 1000) {
      return NextResponse.json(
        { error: "Notes must be 1000 characters or fewer" },
        { status: 400 }
      );
    }
    updates.policyNotes = policyNotes;
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string" || t.length > 30)) {
      return NextResponse.json(
        { error: "Tags must be an array of short strings" },
        { status: 400 }
      );
    }
    updates.tags = tags.filter(Boolean).slice(0, 6); // 最多 6 個,避免版面爆掉
  }

  const user = await User.findByIdAndUpdate(session.user.id, updates, {
    new: true,
  });

  return NextResponse.json({
    name: user.name,
    usernameBase: user.usernameBase,
    username: user.username,
    bio: user.bio,
    image: user.image,
    brandColor: user.brandColor,
    logoUrl: user.logoUrl,
    welcomeMessage: user.welcomeMessage,
    title: user.title,
    socialLinks: user.socialLinks,
    policyNotes: user.policyNotes,
    tags: user.tags,
  });
}
