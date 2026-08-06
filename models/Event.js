import mongoose from "mongoose";

// 參與者用 embedded subdocument,跟著 Event 存,不用另開一個 collection
const participantSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "declined"],
      default: "pending",
    },
    notifiedAt: { type: Date },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    timezone: { type: String, default: "Asia/Taipei" },
    location: { type: String, trim: true },
    meetingUrl: { type: String, trim: true },
    color: { type: String, default: "#0ea5e9" }, // 在日曆上顯示的識別色
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    googleEventId: { type: String }, // 對應到使用者 Google Calendar 上的事件 id,方便之後更新/刪除同步
    // 開始前幾分鐘寄一次提醒信給所有參與者,0 = 不寄提醒信
    reminderMinutesBefore: { type: Number, default: 30, min: 0 },
    // 提醒信寄出的時間戳記,寄過就不會再寄第二次
    reminderSentAt: { type: Date },
    participants: [participantSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// 避免 Next.js hot-reload 時重複註冊 model 出錯
export default mongoose.models.Event || mongoose.model("Event", eventSchema);
