import { redirect } from "next/navigation";

// Calendar 現在是首頁(/dashboard),這裡保留舊路徑做轉址,
// 避免使用者書籤或別處連結指到 /dashboard/calendar 時變成 404。
export default function CalendarPageRedirect() {
  redirect("/dashboard");
}
