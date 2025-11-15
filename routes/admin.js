const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Institute, Admin } = require("../models/User");
const fetchadmin = require("../middleware/fetchAdmin");
const JWT_SECRET = "SadaqahApp";
const DeleteRequest = require("../models/DeleteRequest");

// ROUTE 1: Register Admin (one-time or for multiple admins)
router.post(
  "/create",
  [
    body("userName", "Username required").isLength({ min: 3 }),
    body("email", "Valid email required").isEmail(),
    body("password", "Password must be 5+ chars").isLength({ min: 5 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let admin = await Admin.findOne({ email: req.body.email });
      if (admin) {
        return res.status(400).json({ error: "Admin already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const secPass = await bcrypt.hash(req.body.password, salt);

      admin = await Admin.create({
        userName: req.body.userName,
        email: req.body.email,
        password: secPass,
      });

      const data = { admin: { id: admin.id } };
      const authToken = jwt.sign(data, process.env.JWT_SECRET);

      res.json({ success: true, authToken });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal Server Error");
    }
  }
);

// ROUTE 2: Login Admin
router.post(
  "/login",
  [
    body("email", "Enter a valid Email").isEmail(),
    body("password", "Password cannot be blank").exists(),
  ],
  async (req, res) => {
    try {
      const { email, password } = req.body;
      let admin = await Admin.findOne({ email });
      if (!admin) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const passwordCompare = await bcrypt.compare(password, admin.password);
      if (!passwordCompare) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const data = { admin: { id: admin.id } };
      const authToken = jwt.sign(data, JWT_SECRET);

      res.json({ success: true, authToken });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal Server Error");
    }
  }
);

// ROUTE 3: Get Admin Profile
router.get("/profile", fetchadmin, async (req, res) => {
  try {
    res.json({ success: true, admin: req.admin });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
});

// 2. Route: Admin Gets All Delete Requests GET /api/auth/delete-requests
router.get("/user-delete-requests", fetchadmin, async (req, res) => {
  try {
    const requests = await DeleteRequest.find();
    res.json(requests);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// 3. Route: DELETE /api/auth/cancel-delete-request/:userid
router.delete(
  "/cancel-user-delete-request/:userid",
  fetchadmin,
  async (req, res) => {
    try {
      const userId = req.params.userid;

      const request = await DeleteRequest.findOne({ user: userId });
      if (!request) {
        return res.status(404).json({ error: "Delete request not found" });
      }

      await DeleteRequest.deleteOne({ user: userId });

      res.json({ success: true, message: "Delete request canceled by admin." });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Internal server error");
    }
  }
);

// Wallet

router.patch(
  "/wallet-activation-request/:requestId",
  fetchadmin,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { action } = req.body; // accept or reject

      const admin = await Admin.findOne();
      const request = admin.walletActivationRequests.id(requestId);

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      request.status = action === "accept" ? "accepted" : "rejected";
      request.updatedAt = new Date();
      await admin.save();

      await Institute.findByIdAndUpdate(request.institute, {
        $set: {
          "wallet.isActive": action === "accept",
          walletActivationStatus: action === "accept" ? "accepted" : "rejected",
        },
      });

      res.json({
        success: true,
        message: `Wallet activation ${action}ed successfully`,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/wallet-activation-requests", fetchadmin, async (req, res) => {
  try {
    const admin = await Admin.findOne().populate(
      "walletActivationRequests.institute",
      "userName email"
    );

    res.json({
      success: true,
      requests: admin.walletActivationRequests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
