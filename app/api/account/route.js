import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectMongo();
  const user = await User.findById(session.user.id);

  return NextResponse.json({
    name: user?.name || "",
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

  const updates = {};

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (username !== undefined) {
    const normalized = username.trim().toLowerCase();

    if (!/^[a-z0-9-]{3,30}$/.test(normalized)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-30 characters: lowercase letters, numbers, and hyphens only",
        },
        { status: 400 }
      );
    }

    if (RESERVED_USERNAMES.includes(normalized)) {
      return NextResponse.json(
        { error: "This username is reserved, please choose another" },
        { status: 400 }
      );
    }

    const existing = await User.findOne({
      username: normalized,
      _id: { $ne: session.user.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 409 }
      );
    }

    updates.username = normalized;
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
