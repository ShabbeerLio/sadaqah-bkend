const mongoose = require("mongoose");
const { Schema } = mongoose;

const DeleteRequestSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  email:{
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("DeleteRequest", DeleteRequestSchema);
