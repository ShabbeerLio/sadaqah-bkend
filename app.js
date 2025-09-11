require("dotenv").config();
const connectToMongo = require("./db");
connectToMongo();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const autoCancelItems = require("./controllers/autoCancelItems");
// Allow all origins (not recommended for production)

// Connect to MongoDB
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
const passport = require("passport");
require("./controllers/passport"); // your passport strategy config

app.use(passport.initialize());

// Available routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/auth", require("./routes/institute"));
app.use("/api/posts", require("./routes/post"));
app.use("/api/admindetail", require("./routes/adminDetail"));
app.use("/api/invoice", require("./routes/invoiceDetail"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/transaction", require("./routes/transactions"));
app.use("/api/follow", require("./routes/followers"));
app.use("/api/donation", require("./routes/donation"));

app.get("/", (req, res) => {
  res.json({ message: "Hello MERN Stack! " });
});

cron.schedule("0 0 * * *", autoCancelItems);
// Start server
app.listen(PORT, () => {
  console.log(`Sadaqah backend listening on port ${PORT}`);
});