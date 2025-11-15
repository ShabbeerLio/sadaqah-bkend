const express = require("express");
const router = express.Router();
const DonationRequest = require("../models/DonationRequests");
const { Institute } = require("../models/User");
const fetchInstitute = require("../middleware/fetchInstitute");
const fetchuser = require("../middleware/fetchUser");

// ✅ Create Donation Request (only institutes)
router.post("/create", fetchInstitute, async (req, res) => {
  try {
    const { title, description, items } = req.body;

    // check if logged-in user is an institute
    const institute = await Institute.findById(req.institute.id);
    if (!institute) {
      return res
        .status(403)
        .json({ error: "Only institutes can create donation requests" });
    }

    // calculate total price of all items
    const totalPrice = items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );

    const donationRequest = new DonationRequest({
      institute: institute._id,
      instituteName: institute.userName, // 👈 added
      instituteLocation: institute.location, // 👈 added
      title,
      description,
      items: items.map((i) => ({
        ...i,
        total: i.price * i.quantity,
      })),
      totalPrice,
    });

    await donationRequest.save();

    res.json({ success: true, donationRequest });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ✅ Get all Donation Requests (public)
router.get("/", async (req, res) => {
  try {
    const donations = await DonationRequest.find().populate(
      "institute",
      "userName email instituteType location avatar"
    );

    res.json({ success: true, donations });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ✅ Get single Donation Request by ID
router.get("/:id", async (req, res) => {
  try {
    const donation = await DonationRequest.findById(req.params.id).populate(
      "institute",
      "userName email instituteType location"
    );

    if (!donation) {
      return res.status(404).json({ error: "Donation request not found" });
    }

    res.json({ success: true, donation });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ✅ Edit Donation Request (only institute can update main status OR items)
router.put("/edit/:id", fetchInstitute, async (req, res) => {
  try {
    const { title, description, items, status } = req.body;

    let donationRequest = await DonationRequest.findById(req.params.id);
    if (!donationRequest) {
      return res.status(404).json({ error: "Donation request not found" });
    }

    // ensure only the institute that created can edit
    if (donationRequest.institute.toString() !== req.institute.id) {
      return res.status(403).json({ error: "Not allowed" });
    }

    // update fields if provided
    if (title) donationRequest.title = title;
    if (description) donationRequest.description = description;
    if (status) donationRequest.status = status;

    if (items && items.length > 0) {
      donationRequest.items = items.map((i) => ({
        ...i,
        total: i.price * i.quantity,
        updatedBy: "institute",
      }));

      // 🔥 recalc totalPrice whenever items are updated
      donationRequest.totalPrice = donationRequest.items.reduce(
        (acc, item) => acc + item.total,
        0
      );
    }

    await donationRequest.save();
    res.json({ success: true, donationRequest });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ✅ Toggle Item Status (user/institute actions)
router.put(
  "/item-status/:requestId/:itemId",
  fetchuser,
  fetchInstitute,
  async (req, res) => {
    try {
      let role;

      if (req.user) role = "user";
      else if (req.institute) role = "institute";

      if (!role) return res.status(401).json({ error: "Unauthorized" });

      const donationRequest = await DonationRequest.findById(
        req.params.requestId
      );
      if (!donationRequest)
        return res.status(404).json({ error: "Donation request not found" });

      const item = donationRequest.items.id(req.params.itemId);
      if (!item) return res.status(404).json({ error: "Item not found" });

      const { status } = req.body;

      // -------------------------------
      // ✅ USER ACTIONS
      // -------------------------------
      // User toggles taken/awaited/pending
      if (role === "user") {
        if (status === "taken") {
          if (item.status !== "pending") {
            return res.status(400).json({ error: "Item already taken" });
          }

          item.status = "taken";
          item.updatedBy = "user";

          // ✅ Save who took it
          item.takenBy = req.user.id;
          item.takenAt = new Date();
        } else if (status === "awaited") {
          if (item.takenBy?.toString() !== req.user.id) {
            return res
              .status(403)
              .json({
                error: "Only the user who took this item can set it to awaited",
              });
          }
          item.status = "awaited";
          item.updatedBy = "user";
        } else if (status === "pending") {
          if (item.takenBy?.toString() !== req.user.id) {
            return res
              .status(403)
              .json({
                error: "Only the user who took this item can revert it",
              });
          }
          item.status = "pending";
          item.updatedBy = "user";

          // ✅ Clear user info on revert
          item.takenBy = null;
          item.takenByName = null;
          item.takenByLocation = null;
          item.takenAt = null;
        } else {
          return res
            .status(400)
            .json({ error: "Invalid status change for user" });
        }
      }

      // -------------------------------
      // ✅ INSTITUTE ACTIONS
      // -------------------------------
       if (role === "institute") {
        if (status === "fulfilled") {
          if (item.status !== "fulfilled") {
            donationRequest.amountReceived += item.total;
          }
          item.status = "fulfilled";
          item.updatedBy = "institute";
          item.takenAt = null;
        } else if (status === "pending") {
          // Allow institute to revert back to pending
          // (in case they didn’t actually receive the item)
          if (item.status === "fulfilled") {
            donationRequest.amountReceived -= item.total;
            if (donationRequest.amountReceived < 0)
              donationRequest.amountReceived = 0;
          }
          item.status = "pending";
          item.updatedBy = "institute";
          item.takenAt = null;
        } else {
          return res
            .status(400)
            .json({ error: "Institute can only set status to fulfilled or pending" });
        }
      }

      await donationRequest.save();

      res.json({
        success: true,
        message: "Item status updated successfully",
        item,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal server error");
    }
  }
);

module.exports = router;
