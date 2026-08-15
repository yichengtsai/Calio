import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const clientPackageSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventType",
      required: true,
      index: true,
    },
    inviteeEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    inviteeName: { type: String, trim: true, maxlength: 100 },
    totalSessions: { type: Number, required: true, min: 1 },
    usedSessions: { type: Number, default: 0, min: 0 },
    // active | depleted | paused
    status: {
      type: String,
      enum: ["active", "depleted", "paused"],
      default: "active",
    },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

clientPackageSchema.virtual("remainingSessions").get(function () {
  return Math.max(0, (this.totalSessions || 0) - (this.usedSessions || 0));
});

clientPackageSchema.index({ organizer: 1, eventType: 1, inviteeEmail: 1 });
clientPackageSchema.index({ organizer: 1, inviteeEmail: 1 });

clientPackageSchema.plugin(toJSON);

export default mongoose.models.ClientPackage ||
  mongoose.model("ClientPackage", clientPackageSchema);
