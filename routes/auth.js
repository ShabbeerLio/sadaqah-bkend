// require("dotenv").config();
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var fetchuser = require("../middleware/fetchUser");
const { Institute, User,Admin } = require("../models/User");
const nodemailer = require("nodemailer");
const Otp = require("../models/Otp");
const DeleteRequest = require("../models/DeleteRequest");
const passport = require("passport");
const fetchadmin = require("../middleware/fetchAdmin");

const JWT_SECRET = "SadaqahApp";

// ------------------ GOOGLE CREDENTIAL----------------------

// Route to trigger Google Login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback from Google
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const token = jwt.sign({ user: { id: req.user._id } }, JWT_SECRET);
    res.redirect(`http://localhost:3000/login/?token=${token}`); // redirect to frontend with token
    // res.redirect(`https://feastiq.netlify.app/login/?token=${token}`); // redirect to frontend with token
  }
);

// ------------------ USER CREDENTIAL ROUTES----------------------

// Route 1 : Create a User using a POST "/api/auth/createuser"
router.post(
  "/createuser",
  [
    body("userName", "Enter a valid Name").isLength({ min: 3 }),
    body("email", "Enter a valid Email").isEmail(),
    body("password", "Password must be at least 5 characters").isLength({
      min: 5,
    }),
    body("number", "Enter a valid number"),
    body("location", "Enter location"),
    body(" pincode", "Enter  pincode"),
  ],
  async (req, res) => {
    let success = false;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success, errors: errors.array() });
    }

    try {
      let user = await User.findOne({ email: req.body.email });
      if (user) {
        return res
          .status(400)
          .json({ success, error: "This email already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const secPass = await bcrypt.hash(req.body.password, salt);

      // ✅ Note: use userName instead of name
      user = await User.create({
        userName: req.body.userName,
        number: req.body.number,
        email: req.body.email,
        password: secPass,
        location: req.body.location,
        pincode: req.body.pincode,
      });

      const data = {
        user: { id: user.id },
      };
      const authToken = jwt.sign(data, JWT_SECRET);

      success = true;
      res.json({ success, authToken });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal server Error");
    }
  }
);

// Route 2 : Authentication a User using a POST "/api/auth/login" no login required
router.post(
  "/login",
  [
    body("email", "Enter a valid Email").isEmail(),
    body("password", "Password cannot be blank").exists(),
  ],
  async (req, res) => {
    let success = false;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // 🔍 Try to find User first
      let account = await User.findOne({ email });
      let role = "user";

      // If not found, try Institute
      if (!account) {
        account = await Institute.findOne({ email });
        role = "institute";
      }

      // If neither found
      if (!account) {
        return res
          .status(400)
          .json({ success, error: "Invalid email or password" });
      }

      // ✅ Check password
      const isMatch = await bcrypt.compare(password, account.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ success, error: "Invalid email or password" });
      }

      // 🎯 Prepare payload for JWT
      const data =
        role === "institute"
          ? { institute: { id: account.id } }
          : { user: { id: account.id } };

      const authToken = jwt.sign(data, JWT_SECRET);
      success = true;

      // ✅ Send success response
      res.json({
        success,
        authToken,
        role,
        name: account.name || account.instituteName,
        email: account.email,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal server Error");
    }
  }
);

// Route 3 : Get loggedin User user detail using a POST "/api/auth/getuser" no login required

router.post("/getuser", fetchuser, async (req, res) => {
  try {
    userId = req.user.id;
    const user = await User.findById(userId).select("-password");
    res.send(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server Error");
  }
});

// Route 4: Update user details using a PUT "/api/auth/edituser" - Login required
router.put(
  "/edituser",
  fetchuser,
  [
    body("name", "Enter a valid name").optional().isLength({ min: 3 }),
    body("email", "Enter a valid email").optional().isEmail(),
    body("number", "Enter a valid number").optional(),
    body("location", "Enter a valid location").optional(),
    body("pincode", "Enter a valid pincode").optional(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userName, email, number, location, pincode } = req.body;
    const updatedFields = {};

    // Add fields to be updated if provided
    if (userName) updatedFields.userName = userName;
    if (email) updatedFields.email = email;
    if (number) updatedFields.number = number;
    if (location) updatedFields.location = location;
    if (pincode) updatedFields.pincode = pincode;

    try {
      // Find user and update their data
      const userId = req.user.id;
      let user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      user = await User.findByIdAndUpdate(
        userId,
        { $set: updatedFields },
        { new: true } // Return the updated document
      ).select("-password");

      res.json({ success: true, user });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal server error");
    }
  }
);

//  ----------------- admin gets user ------------------

// Route 5: Fetch All Users - Only accessible by Admin
router.get("/getallusers", fetchadmin, async (req, res) => {
  try {
    // Fetch all users, excluding passwords
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// Route 6: Delete a user and their details by Admin - Only accessible by Admin
router.delete("/deleteuser/:id", fetchadmin, async (req, res) => {
  try {
    const userIdToDelete = req.params.id;

    // Check if user exists
    const userToDelete = await User.findById(userIdToDelete);
    if (!userToDelete) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete the user
    await User.findByIdAndDelete(userIdToDelete);
    res.json({
      success: true,
      message: "User deleted. Details removed if found.",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
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

// -------------- DELETE REQUEST -------------------

// Route 7: Request for deleting
// 1. Route: User Requests Account Deletion POST /api/auth/request-delete
router.post("/user-request-delete", fetchuser, async (req, res) => {
  try {
    const existingRequest = await DeleteRequest.findOne({ user: req.user.id });
    if (existingRequest) {
      return res
        .status(400)
        .json({ error: "Delete request already submitted." });
    }

    const deleteRequest = new DeleteRequest({
      user: req.user.id,
      email: req.body.email || "",
    });

    await deleteRequest.save();
    res.json({ success: true, message: "Delete request submitted." });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

//  -------------------Forgot Password-----------------------

// Step 1: Send OTP
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.USER_ID,
        pass: process.env.PASS_KEY,
      },
    });

    await transporter.sendMail({
      from: '"Sadaqah App" <sadaqahapp@gmail.com>',
      to: email,
      subject: "Your OTP for Password Reset",
      text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
    });

    // Save or update OTP
    await Otp.findOneAndUpdate(
      { email },
      { email, otp, createdAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal server error");
  }
});

// Step 2: Verify OTP only
router.post("/verify-reset-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired OTP" });
    }

    res.json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal server error");
  }
});

// Step 3: Reset Password (after OTP is verified)
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    await Otp.deleteOne({ _id: validOtp._id });

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal server error");
  }
});

// Get all institutes (for users to browse & follow)
router.get("/all-institutes", async (req, res) => {
  try {
    const institutes = await Institute.find().select("-password -__v");
    res.json({ success: true, institutes });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// GET institute by ID (accessible to users)
router.get("/institute/:id", fetchuser, async (req, res) => {
  try {
    const instituteId = req.params.id;
    const institute = await Institute.findById(instituteId)
      .select("-password") // hide password
      .populate("followers", "userName email"); // optional: show followers info

    if (!institute) {
      return res.status(404).json({ error: "Institute not found" });
    }

    res.json({ success: true, institute });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// GET /api/institutes/following
router.get("/following-institutes", fetchuser, async (req, res) => {
  try {
    // 1. Find current user and populate followingInstitutes
    const user = await User.findById(req.user.id).populate(
      "followingInstitutes",
      "-password -__v"
    ); // exclude sensitive fields

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // 2. Return the institutes the user follows
    res.json({ success: true, followingInstitutes: user.followingInstitutes });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//  adhan select
router.put("/set-default-institute/:id", fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    const newInstituteId = req.params.id;
    const { enabledTimes } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if user follows this institute
    if (!user.followingInstitutes.includes(newInstituteId)) {
      return res.status(400).json({
        success: false,
        message: "You must follow this institute first",
      });
    }

    // 🧩 Remove previous default institute if any
    const oldInstituteId = user.defaultInstitute?.toString();

    if (oldInstituteId && oldInstituteId !== newInstituteId) {
      // Remove old adhan preference
      user.adhanPreferences = user.adhanPreferences.filter(
        (pref) => pref.institute.toString() !== oldInstituteId
      );
    }

    // 🆕 Set new default institute
    user.defaultInstitute = newInstituteId;

    // 🧠 Update or Add new adhan preferences for this institute
    const existingPrefIndex = user.adhanPreferences.findIndex(
      (pref) => pref.institute.toString() === newInstituteId
    );

    if (existingPrefIndex > -1) {
      // Update existing preference
      user.adhanPreferences[existingPrefIndex].enabledTimes = {
        ...user.adhanPreferences[existingPrefIndex].enabledTimes,
        ...enabledTimes,
      };
    } else {
      // Add new preference for new institute
      user.adhanPreferences.push({
        institute: newInstituteId,
        enabledTimes: enabledTimes || {},
      });
    }

    await user.save();

    return res.json({
      success: true,
      message: "Default institute and Adhan preferences updated successfully",
      defaultInstitute: user.defaultInstitute,
      adhanPreferences: user.adhanPreferences,
    });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

// Route: Update Consent
router.put("/consent", fetchuser, async (req, res) => {
  try {
    const { consent } = req.body;

    if (typeof consent !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "Consent must be true or false" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { consent },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Consent updated",
      consent: user.consent,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


module.exports = router;
