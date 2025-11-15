// require("dotenv").config();
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var fetchinstitute = require("../middleware/fetchInstitute");
const { User, Institute, Admin } = require("../models/User");
const fetchadmin = require("../middleware/fetchAdmin");
const DeleteRequest = require("../models/DeleteRequest");

const JWT_SECRET = "SadaqahApp";

const fetchAny = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    return res.status(401).json({ success: false, message: "Access denied" });
  }

  try {
    const data = jwt.verify(token, JWT_SECRET);

    if (data.user) {
      req.userId = data.user.id;
      req.role = "user";
    } else if (data.institute) {
      req.instituteId = data.institute.id;
      req.role = "institute";
    } else {
      return res.status(400).json({ success: false, message: "Invalid token" });
    }

    next();
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

router.post("/getaccount", fetchAny, async (req, res) => {
  try {
    if (req.role === "user") {
      const user = await User.findById(req.userId).select("-password");
      return res.send(user);
    }

    if (req.role === "institute") {
      const institute = await Institute.findById(req.instituteId).select(
        "-password"
      );
      return res.send(institute);
    }

    res.status(400).json({ success: false, message: "No account found" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Route: Create Institute
router.post(
  "/createinstitute",
  [
    body("userName", "userName required").isLength({ min: 3 }),
    body("email", "Enter a valid Email").isEmail(),
    body("pincode", "Enter a valid pincode"),
    body("password", "Password must be at least 5 characters").isLength({
      min: 5,
    }),
    body("instituteType", "Select a valid type").isIn([
      "masjid",
      "madrasa",
      "khanqah",
      "kabristan",
    ]),
    body("AuthorizedPerson.name", "Authorized person name required").isLength({
      min: 3,
    }),
    body(
      "AuthorizedPerson.number",
      "Authorized person number required"
    ).isNumeric(),
  ],
  async (req, res) => {
    try {
      let institute = await Institute.findOne({ email: req.body.email });
      if (institute) {
        return res.status(400).json({ error: "Institute already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const secPass = await bcrypt.hash(req.body.password, salt);

      institute = await Institute.create({
        userName: req.body.userName,
        email: req.body.email,
        password: secPass,
        instituteType: req.body.instituteType,
        location: req.body.location,
        pincode: req.body.pincode,
        AuthorizedPerson: {
          name: req.body.AuthorizedPerson.name,
          number: req.body.AuthorizedPerson.number,
        },
      });

      const data = { institute: { id: institute.id } };
      const authToken = jwt.sign(data, JWT_SECRET);

      res.json({ success: true, authToken });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal server Error");
    }
  }
);

// Route: Login Institute
// router.post("/logininstitute", async (req, res) => {
//   const { email, password } = req.body;
//   try {
//     let institute = await Institute.findOne({ email });
//     if (!institute) {
//       return res.status(400).json({ error: "Invalid credentials" });
//     }

//     const isMatch = await bcrypt.compare(password, institute.password);
//     if (!isMatch) {
//       return res.status(400).json({ error: "Invalid credentials" });
//     }

//     const data = { institute: { id: institute.id } };
//     const authToken = jwt.sign(data, JWT_SECRET);

//     res.json({ success: true, authToken });
//   } catch (error) {
//     console.error(error.message);
//     res.status(500).send("Internal server Error");
//   }
// });

// GET logged-in Institute details
router.post("/getinstitute", fetchinstitute, async (req, res) => {
  try {
    const instituteId = req.institute.id; // fetchinstitute sets req.institute
    const institute = await Institute.findById(instituteId).select("-password");
    res.json({ success: true, institute });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server Error" });
  }
});

// Route 4: Update user details using a PUT "/api/auth/editinstitute" - Login required
router.put(
  "/editinstitute",
  fetchinstitute,
  [
    body("userName", "userName required").optional().isLength({ min: 3 }),
    body("email", "Enter a valid Email").optional().isEmail(),
    body("pincode", "Enter a valid pincode").optional().isNumeric(),
    body("instituteType", "Select a valid type")
      .optional()
      .isIn(["masjid", "madrasa", "khanqah", "kabristan"]),
    body("AuthorizedPerson.name", "Authorized person name required")
      .optional()
      .isLength({ min: 3 }),
    body("AuthorizedPerson.number", "Authorized person number required")
      .optional()
      .isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      userName,
      email,
      instituteType,
      location,
      pincode,
      AuthorizedPerson,
    } = req.body;
    const updatedFields = {};

    if (userName) updatedFields.userName = userName;
    if (email) updatedFields.email = email;
    if (instituteType) updatedFields.instituteType = instituteType;
    if (location) updatedFields.location = location;
    if (pincode) updatedFields.pincode = pincode;
    if (AuthorizedPerson) updatedFields.AuthorizedPerson = AuthorizedPerson;

    try {
      const instituteId = req.institute.id; // fetchinstitute sets this
      let institute = await Institute.findById(instituteId);

      if (!institute) {
        return res.status(404).json({ error: "Institute not found" });
      }

      institute = await Institute.findByIdAndUpdate(
        instituteId,
        { $set: updatedFields },
        { new: true } // return updated document
      ).select("-password");

      res.json({ success: true, institute });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal server error");
    }
  }
);

// Route 5: Fetch All Institute - Only accessible by Admin
router.get("/getallinstitute", fetchadmin, async (req, res) => {
  try {
    // Fetch all Institute, excluding passwords
    const institute = await Institute.find().select("-password");
    res.json(institute);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// Route 6: Delete a Institute and their details by Admin - Only accessible by Admin
router.delete("/deleteinstitute/:id", fetchadmin, async (req, res) => {
  try {
    const instiIdToDelete = req.params.id;

    // Check if user exists
    const instiToDelete = await Institute.findById(instiIdToDelete);
    if (!instiToDelete) {
      return res.status(404).json({ error: "Institute not found" });
    }

    // Delete the user
    await Institute.findByIdAndDelete(instiIdToDelete);
    res.json({
      success: true,
      message: "Institute deleted. Details removed if found.",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// -------------- DELETE REQUEST -------------------

// Route 7: Request for deleting
// 1. Route: User Requests Account Deletion POST /api/auth/request-delete
router.post("/institute-request-delete", fetchinstitute, async (req, res) => {
  try {
    const existingRequest = await DeleteRequest.findOne({
      user: req.institute.id,
    });
    if (existingRequest) {
      return res
        .status(400)
        .json({ error: "Delete request already submitted." });
    }
    console.log(req.institute.id, "id");
    const deleteRequest = new DeleteRequest({
      user: req.institute.id,
      email: req.body.email || "",
    });

    await deleteRequest.save();
    res.json({ success: true, message: "Delete request submitted." });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// Adhan
// Route: Add or Update Adhan Times
router.put("/add-adhan", fetchinstitute, async (req, res) => {
  try {
    const instituteId = req.institute.id;
    const { Fajr, Dhuhr, Asr, Maghrib, Isha, Jumma } = req.body;

    const updatedInstitute = await Institute.findByIdAndUpdate(
      instituteId,
      {
        $set: {
          "adhanTimes.Fajr": Fajr,
          "adhanTimes.Dhuhr": Dhuhr,
          "adhanTimes.Asr": Asr,
          "adhanTimes.Maghrib": Maghrib,
          "adhanTimes.Isha": Isha,
          "adhanTimes.Jumma": Jumma,
        },
      },
      { new: true }
    ).select("-password");

    res.json({ success: true, adhanTimes: updatedInstitute.adhanTimes });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Route: Delete specific Adhan time
router.delete("/delete-adhan/:prayerName", fetchinstitute, async (req, res) => {
  try {
    const instituteId = req.institute.id;
    const { prayerName } = req.params;

    // only allow valid keys
    const validKeys = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Jumma"];
    if (!validKeys.includes(prayerName)) {
      return res.status(400).json({ error: "Invalid prayer name" });
    }

    const unsetField = {};
    unsetField[`adhanTimes.${prayerName}`] = "";

    const updatedInstitute = await Institute.findByIdAndUpdate(
      instituteId,
      { $unset: unsetField },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: `${prayerName} time removed`,
      adhanTimes: updatedInstitute.adhanTimes,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/activate-wallet", fetchinstitute, async (req, res) => {
  try {
    const instituteId = req.institute.id;

    const {
      bankName,
      accountHolderName,
      accountNumber,
      confirmAccountNumber,
      ifscCode,
      financeMobile
    } = req.body;

    if (!bankName || !accountHolderName || !accountNumber || !confirmAccountNumber || !ifscCode || !financeMobile) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (accountNumber !== confirmAccountNumber) {
      return res.status(400).json({ error: "Account numbers do not match" });
    }

    const institute = await Institute.findById(instituteId);
    if (!institute) {
      return res.status(404).json({ error: "Institute not found" });
    }

    // ❗ Prevent duplicate requests
    if (institute.walletActivationStatus === "pending") {
      return res.status(400).json({
        error: "Wallet activation request already submitted and pending approval."
      });
    }

    if (institute.walletActivationStatus === "accepted") {
      return res.status(400).json({
        error: "Your wallet is already activated."
      });
    }

    // Update bank details & set pending
    institute.bankDetails = {
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      financeMobile,
    };

    institute.walletActivationStatus = "pending";
    await institute.save();

    // Save in admin
    const admin = await Admin.findOne();

    // ❗ Check if admin already has pending for this institute
    const duplicate = admin.walletActivationRequests.find(
      (req) =>
        req.institute.toString() === instituteId &&
        req.status === "pending"
    );

    if (duplicate) {
      return res.status(400).json({
        error: "Wallet activation request already pending with admin."
      });
    }

    admin.walletActivationRequests.push({
      institute: instituteId,
      status: "pending",
    });

    await admin.save();

    res.json({
      success: true,
      message: "Wallet activation request submitted successfully"
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
