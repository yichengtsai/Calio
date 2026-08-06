import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// 使用者自己的忙碌時段(開會、私事、不想被打擾),不邀請任何人、不寄信
// 但會跟預約頁的空檔計算綁在一起,別人不能約到這段時間
const blockSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, trim: true, default: "Busy" },
    notes: { type: String, trim: true, maxlength: 500 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    color: { type: String, default: "#6b7280" }, // 預設用中性灰,跟預約(紫)、行程(藍)區分開
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

blockSchema.index({ user: 1, startTime: 1 });

blockSchema.plugin(toJSON);

export default mongoose.models.Block || mongoose.model("Block", blockSchema);
