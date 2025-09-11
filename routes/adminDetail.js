const express = require("express");
const router = express.Router();
const AdminDetail = require("../models/AdminDetail");
const User = require("../models/User");

// Route to fetch all details (Accessible to all users) /api/admindetail/all
router.get("/all", async (req, res) => {
  try {
    const details = await AdminDetail.find().sort({ date: -1 });
    res.status(200).json(details);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
