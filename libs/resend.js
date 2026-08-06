import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("缺少環境變數 RESEND_API_KEY,請至 https://resend.com 取得");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// 寄件人網域需要先在 Resend 後台完成 DNS 驗證
export const EMAIL_FROM =
  process.env.EMAIL_FROM || "行程通知 <notifications@yourdomain.com>";
