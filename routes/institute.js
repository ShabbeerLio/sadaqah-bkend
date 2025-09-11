require("dotenv").config();
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var fetchinstitute = require("../middleware/fetchInstitute");
const { Institute } = require("../models/User");
const fetchadmin = require("../middleware/fetchAdmin")
const DeleteRequest = require("../models/DeleteRequest");

const JWT_SECRET = "SadaqahApp";

// Route: Create Institute
router.post(
  "/createinstitute",
  [
    body("username", "Username required").isLength({ min: 3 }),
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
        username: req.body.username,
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
router.post("/logininstitute", async (req, res) => {
  const { email, password } = req.body;
  try {
    let institute = await Institute.findOne({ email });
    if (!institute) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, institute.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const data = { institute: { id: institute.id } };
    const authToken = jwt.sign(data, JWT_SECRET);

    res.json({ success: true, authToken });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server Error");
  }
});

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
    body("username", "Username required").optional().isLength({ min: 3 }),
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

    const { username, email, instituteType, location, pincode, AuthorizedPerson } = req.body;
    const updatedFields = {};

    if (username) updatedFields.username = username;
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
    const existingRequest = await DeleteRequest.findOne({ user: req.institute.id });
    if (existingRequest) {
      return res
        .status(400)
        .json({ error: "Delete request already submitted." });
    }
console.log(req.institute.id,"id")
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

module.exports = router;
