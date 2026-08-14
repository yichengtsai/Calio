import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const eventTypeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
    },
    description: { type: String, trim: true, maxlength: 500 },
    duration: { type: Number, required: true, min: 5 },
    location: { type: String, trim: true },
    locationType: {
      type: String,
      enum: ["google_meet", "in_person", "phone", "custom"],
      default: "custom",
    },
    color: { type: String, default: "#6366f1" },
    isActive: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: true },
    bufferMinutes: { type: Number, default: 0, min: 0 },
    slotIntervalMinutes: { type: Number, default: 0, min: 0 },
    minimumNoticeMinutes: { type: Number, default: 0, min: 0 },
    reminderMinutesBefore: { type: Number, default: 30, min: 0 },
    bookingWindowDays: { type: Number, default: 60, min: 1 },
    maxBookingsPerDay: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

eventTypeSchema.index({ user: 1, slug: 1 }, { unique: true });

eventTypeSchema.plugin(toJSON);

// 不刪除已註冊 model（刪除會讓每個請求重編譯 schema，極慢）
// 若已註冊且缺欄位，用 schema.add 補上
if (mongoose.models.EventType) {
  const s = mongoose.models.EventType.schema;
  if (!s.path("slotIntervalMinutes")) {
    s.add({ slotIntervalMinutes: { type: Number, default: 0, min: 0 } });
  }
}

export default mongoose.models.EventType || mongoose.model("EventType", eventTypeSchema);
