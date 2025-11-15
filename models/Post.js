const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReplySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User" }, // optional
  institute: { type: Schema.Types.ObjectId, ref: "Institute" }, // optional
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const CommentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User" }, // optional
  institute: { type: Schema.Types.ObjectId, ref: "Institute" }, // optional
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
  replies: [ReplySchema],
});

const ShareSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // user who shares
  platform: {
    type: String,
    enum: ["facebook", "twitter", "whatsapp", "instagram", "copyLink"],
    default: "copyLink",
  },
  date: { type: Date, default: Date.now },
});

const PostSchema = new Schema(
  {
    institute: {
      type: Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
    }, // ✅ only institute
    type: { type: String, enum: ["Quran", "Hadith", "Notice"], required: true },
    location: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    image: [{ type: String }], // multiple images supported

    // Engagement (Users only)
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [CommentSchema],
    shares: [ShareSchema],
    // status handling
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

module.exports = mongoose.model("Post", PostSchema);
