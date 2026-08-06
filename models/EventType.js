import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const eventTypeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true }, // e.g. "30 Minute Meeting"
    // 這個活動類型在預約頁網址上的代稱,例如 yourapp.com/johnlin/30min
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
    },
    description: { type: String, trim: true, maxlength: 500 },
    duration: { type: Number, required: true, min: 5 }, // 分鐘
    location: { type: String, trim: true }, // e.g. "Google Meet", "Phone call", 自訂文字都可以
    color: { type: String, default: "#6366f1" }, // 預約頁上這個活動類型的識別色
    isActive: { type: Boolean, default: true }, // 關閉後預約頁上不會顯示,但歷史預約紀錄還在
    requiresApproval: { type: Boolean, default: true }, // true=有人預約先變pending要你Approve;false=送出就直接確認
    bufferMinutes: { type: Number, default: 0, min: 0 }, // 每個已確認行程前後留的緩衝時間(分鐘)
    minimumNoticeMinutes: { type: Number, default: 0, min: 0 }, // 最少要提前多久才能預約(分鐘)
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

// 同一個使用者底下 slug 不能重複,但不同使用者可以有一樣的 slug(各自的網址不同)
eventTypeSchema.index({ user: 1, slug: 1 }, { unique: true });

eventTypeSchema.plugin(toJSON);

export default mongoose.models.EventType ||
  mongoose.model("EventType", eventTypeSchema);
