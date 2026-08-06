import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// 一天裡的一段可預約時間,例如 09:00 - 12:00
const timeSlotSchema = new mongoose.Schema(
  {
    // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    // 用 "HH:mm" 字串儲存(24小時制),搭配 user.timezone 解讀,不用處理日期只處理時刻比較單純
    startTime: { type: String, required: true }, // e.g. "09:00"
    endTime: { type: String, required: true }, // e.g. "17:00"
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // 一個使用者只有一份可預約時段設定
    },
    timeSlots: [timeSlotSchema],
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

availabilitySchema.plugin(toJSON);

export default mongoose.models.Availability ||
  mongoose.model("Availability", availabilitySchema);
