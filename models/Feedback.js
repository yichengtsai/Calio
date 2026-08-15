import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const feedbackSchema = mongoose.Schema(
  {
    // Coach whose public page this was submitted on (optional)
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    organizerUsername: { type: String, trim: true, lowercase: true },
    // guest contact (optional)
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    name: { type: String, trim: true, maxlength: 100 },
    // idea | bug | other
    category: {
      type: String,
      enum: ["idea", "bug", "other"],
      default: "idea",
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    // where it was sent from
    sourcePath: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ["new", "read", "archived"],
      default: "new",
      index: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

feedbackSchema.plugin(toJSON);

export default mongoose.models.Feedback ||
  mongoose.model("Feedback", feedbackSchema);
