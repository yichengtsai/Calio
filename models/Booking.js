import mongoose from "mongoose";
import { randomUUID } from "crypto";
import toJSON from "./plugins/toJSON";

const bookingSchema = new mongoose.Schema(
  {
    eventType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventType",
      required: true,
    },
    // 冗餘存一份 organizer,方便查「這個人所有的預約」不用先查 EventType 再查 Booking
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    inviteeName: { type: String, required: true, trim: true, maxlength: 100 },
    inviteeEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    inviteeNotes: { type: String, trim: true, maxlength: 1000 },
    inviteeTimezone: { type: String }, // 預約當下,對方瀏覽器偵測到的時區,顯示用

    // 不用登入就能取消自己這筆預約用的亂碼,寄在確認信裡的連結會帶這個
    cancelToken: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
    },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "declined", "expired"],
      default: "pending",
    },
    respondedAt: { type: Date }, // 主辦人同意或拒絕的時間
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
    // 提醒信寄出的時間戳記,寄過就不會再寄第二次(每筆預約只寄一次提醒)
    reminderSentAt: { type: Date },

    // 對應到 organizer 的 Google Calendar 上的事件 id(Pro 版才會寫入)。
    // 有這個值代表這筆預約已經同步到 Google Calendar,改期/取消時要跟著更新/刪除那筆事件。
    googleEventId: { type: String },
    // Google Meet 連結（建立會議時寫入，確認信與日曆詳情用）
    meetingUrl: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

// 常見查詢:查某個 organizer 在某段時間內已確認的預約(算空檔、防止雙重預約都要用)
bookingSchema.index({ organizer: 1, startTime: 1, status: 1 });
// pending count / 狀態篩選
bookingSchema.index({ organizer: 1, status: 1 });

bookingSchema.plugin(toJSON);

export default mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
