import { notFound, redirect } from "next/navigation";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import EventType from "@/models/EventType";

// 舊版每個 event type 各自一個網址(/username/slug),現在整合進 /username 的單頁流程。
// 保留這支路由只是為了讓過去分享出去的連結不要死掉——驗證存在之後轉址回列表頁,
// 帶上 ?event=slug 讓 EventTypePicker 自動展開對應的日曆。
export default async function BookingRedirectPage({ params }) {
  const { username, slug } = await params;

  await connectMongo();

  const user = await User.findOne({ username });
  if (!user) notFound();

  const eventType = await EventType.findOne({
    user: user._id,
    slug,
    isActive: true,
  });
  if (!eventType) notFound();

  redirect(`/${username}?event=${slug}`);
}
