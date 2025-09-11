const mongoose = require("mongoose");
const { Schema } = mongoose;

const WithdrawRequestSchema = new Schema({
  institute: { type: Schema.Types.ObjectId, ref: "Institute", required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "cancelled"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

WithdrawRequestSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Transactions
const TransactionSchema = new Schema({
  type: { type: String, enum: ["payment", "withdraw", "Zakat", "Donation"] },
  from: { type: String },
  to: { type: String },
  transactionId: { type: String },
  amount: { type: Number },
  status: {
    type: String,
    enum: ["pending", "accepted", "cancelled"],
    default: "pending",
  }, // NEW
  date: { type: Date, default: Date.now },
});

// Invoices
const InvoiceSchema = new Schema({
  type: { type: String },
  plan: { type: String },
  invoiceNumber: { type: String },
  transactionId: { type: String },
  price: { type: String },
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  pincode: { type: String },
  city: { type: String },
  state: { type: String },
  date: { type: Date, default: Date.now },
});

// Generate invoiceNumber automatically
InvoiceSchema.pre("save", function (next) {
  if (!this.invoiceNumber) {
    this.invoiceNumber = `INV-${Date.now()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
  }
  next();
});

// Users
const UserSchema = new Schema({
  role: { type: String, default: "user" },
  userName: { type: String, required: true },
  number: { type: Number },
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  googleId: { type: String },
  avatar: { type: String },
  followingInstitutes: [
    { type: Schema.Types.ObjectId, ref: "Institute", default: [] },
  ],
  location: { type: String },
  pincode: { type: Number },
  blockedPosts: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  transactions: [TransactionSchema],
  invoices: [InvoiceSchema],
  date: { type: Date, default: Date.now },
});

// Institutes
const InstituteSchema = new Schema({
  role: { type: String, default: "institute" },
  instituteType: {
    type: String,
    enum: ["masjid", "madrasa", "khanqah", "kabristan"],
  },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  avatar: { type: String },
  followers: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
  pincode: { type: Number },
  location: { type: String },
  AuthorizedPerson: {
    name: String,
    number: Number,
  },
  adhanTimes: {
    Fajr: String,
    Dhuhr: String,
    Asr: String,
    Maghrib: String,
    Isha: String,
    Jumma: String,
  },
  wallet: {
    balance: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    transactions: [TransactionSchema],
  },
  invoices: [InvoiceSchema],
  date: { type: Date, default: Date.now },
});

// Admin Schema
const AdminSchema = new Schema({
  userName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  role: { type: String, default: "admin" },
  permissions: {
    manageUsers: { type: Boolean, default: true },
    manageInstitutes: { type: Boolean, default: true },
    managePosts: { type: Boolean, default: true },
    manageTransactions: { type: Boolean, default: true },
    manageInvoices: { type: Boolean, default: true },
    manageAdhanTimes: { type: Boolean, default: true },
  },
  withdrawRequests: [WithdrawRequestSchema],
  date: { type: Date, default: Date.now },
});

// Register Models
const Admin = mongoose.model("Admin", AdminSchema);
const User = mongoose.model("User", UserSchema);
const Institute = mongoose.model("Institute", InstituteSchema);

module.exports = { User, Institute, Admin };
