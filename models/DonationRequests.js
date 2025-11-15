const mongoose = require("mongoose");
const { Schema } = mongoose;

const DonationItemSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  price: { type: Number, required: true },
  total: { type: Number, required: true }, // quantity * price
  status: {
    type: String,
    enum: ["pending", "taken", "awaited", "fulfilled", "collected"],
    default: "pending",
  },
  updatedBy: {
    type: String,
    enum: ["user", "institute"],
    default: "institute",
  },

  // 🔹 Track who took the item
  takenBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  takenAt: { type: Date },
});

const DonationRequestSchema = new Schema({
  institute: { type: Schema.Types.ObjectId, ref: "Institute", required: true },
  instituteName: { type: String, required: true },
  instituteLocation: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  items: [DonationItemSchema],
  totalPrice: { type: Number, required: true },
  amountReceived: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["open", "closed"],
    default: "open",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DonationRequest", DonationRequestSchema);
