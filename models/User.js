const mongoose = require("mongoose");
const { Schema } = mongoose;

const WalletActivationRequestSchema = new Schema({
  institute: { type: Schema.Types.ObjectId, ref: "Institute", required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

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
  donationRequestId: { type: Schema.Types.ObjectId },
  from: { type: String },
  to: { type: String },
  transactionId: { type: String },
  fee: { type: Number },
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
  googleId: {
    type: String,
  },
  avatar: { type: String },
  followingInstitutes: [
    { type: Schema.Types.ObjectId, ref: "Institute", default: [] },
  ],
  defaultInstitute: {
    type: Schema.Types.ObjectId,
    ref: "Institute",
    default: null,
  },
  adhanPreferences: [
    {
      institute: { type: Schema.Types.ObjectId, ref: "Institute" },
      enabledTimes: {
        Fajr: { type: Boolean, default: false },
        Dhuhr: { type: Boolean, default: false },
        Asr: { type: Boolean, default: false },
        Maghrib: { type: Boolean, default: false },
        Isha: { type: Boolean, default: false },
        Jumma: { type: Boolean, default: false },
      },
    },
  ],
  location: { type: String },
  pincode: { type: Number },
  blockedPosts: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  transactions: [TransactionSchema],
  invoices: [InvoiceSchema],
  consent: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
});

// Institutes
const InstituteSchema = new Schema({
  role: { type: String, default: "institute" },
  instituteType: {
    type: String,
    enum: ["masjid", "madrasa", "khanqah", "kabristan"],
  },
  userName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  googleId: {
    type: String,
  },
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
    isActive: { type: Boolean, default: false },
    transactions: [TransactionSchema],
  },
  bankDetails: {
    bankName: { type: String },
    accountHolderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    financeMobile: { type: String },
  },
  walletActivationStatus: {
    type: String,
    enum: ["not_submitted", "pending", "accepted", "rejected"],
    default: "not_submitted",
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
  walletActivationRequests: [WalletActivationRequestSchema],
  date: { type: Date, default: Date.now },
});

// Register Models
const Admin = mongoose.model("Admin", AdminSchema);
const User = mongoose.model("User", UserSchema);
const Institute = mongoose.model("Institute", InstituteSchema);

module.exports = { User, Institute, Admin };
