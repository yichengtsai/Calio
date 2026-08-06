import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// USER SCHEMA
const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      private: true,
    },
    image: {
      type: String,
    },
    // 預約頁網址用,例如 yourapp.com/johnlin 裡的 "johnlin"
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // 允許還沒設定 username 的舊帳號存在(值是 null)
      match: [/^[a-z0-9-]+$/, "Username can only contain lowercase letters, numbers, and hyphens"],
    },
    // 顯示在預約頁上的自介
    bio: {
      type: String,
      trim: true,
      maxlength: 280,
    },
    // 用來計算可預約時段,IANA 格式,例如 "Asia/Taipei"
    timezone: {
      type: String,
      default: "Asia/Taipei",
    },
    // ---- 預約頁品牌自訂 ----
    brandColor: {
      type: String,
      default: "#6366f1", // 預約頁上的強調色(按鈕、連結 hover 之類)
    },
    logoUrl: {
      type: String,
      trim: true, // 不填就 fallback 用 Google 頭像(image 欄位)
    },
    welcomeMessage: {
      type: String,
      trim: true,
      maxlength: 300, // 顯示在預約頁最上方的招呼文字,跟 bio(簡短自介)是分開的
    },
    title: {
      type: String,
      trim: true,
      maxlength: 100, // 職稱/一句話定位,例如 "Product Designer"
    },
    socialLinks: {
      linkedin: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
      instagram: { type: String, trim: true, default: "" },
    },
    policyNotes: {
      type: String,
      trim: true,
      maxlength: 1000, // 取消政策、準備事項這類,顯示在預約頁的可展開區塊
    },
    tags: {
      type: [String],
      default: [], // 個人區塊下方的小標籤,例如 "Product", "Consulting", "1:1"
    },
    // Used in the Stripe webhook to identify the user in Stripe and later create Customer Portal or prefill user credit card details
    customerId: {
      type: String,
      validate(value) {
        return value.includes("cus_");
      },
    },
    // Used in the Stripe webhook. should match a plan in config.js file.
    priceId: {
      type: String,
      validate(value) {
        return value.includes("price_");
      },
    },
    // Used to determine if the user has access to the product—it's turn on/off by the Stripe webhook
    hasAccess: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);

export default mongoose.models.User || mongoose.model("User", userSchema);
